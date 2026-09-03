"""Verifies Round 4: transactions store/migration, routing.js OSRM call,
HQ settings autocomplete + lat/lon persistence, automatic mileage calc on
job creation, the Admin view, and checklist.js comment-library auto-sync.

Run after tools/cdp_console.py-style patterns. Uses raw CDP (see cdp_console.py
for the WS class this borrows).
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from cdp_console import start_edge, get_ws_url, WS, disable_cache  # noqa: E402

URL = "http://127.0.0.1:8420/index.html"


def evaluate(ws, expression, await_promise=True, timeout=10):
    mid = ws.call("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": await_promise,
    })
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = ws.recv_frame(timeout=0.5)
        if msg == "TIMEOUT" or msg is None:
            continue
        if msg.get("id") == mid:
            return msg
    return {"error": "timeout waiting for eval result"}


def drain_console(ws, seconds=1.0):
    end = time.time() + seconds
    out = []
    while time.time() < end:
        msg = ws.recv_frame(timeout=0.3)
        if msg == "TIMEOUT" or msg is None:
            continue
        m = msg.get("method")
        if m == "Runtime.exceptionThrown":
            ex = msg["params"]["exceptionDetails"]
            text = ex.get("exception", {}).get("description") or ex.get("text")
            out.append(f"[EXCEPTION] {text}")
        elif m == "Runtime.consoleAPICalled":
            p = msg["params"]
            args = [a.get("value", a.get("description", "")) for a in p.get("args", [])]
            out.append(f"[console.{p['type']}] " + " ".join(str(a) for a in args))
    return out


def main():
    proc = start_edge()
    try:
        ws_url = get_ws_url()
        ws = WS(ws_url)
        disable_cache(ws)
        ws.call("Runtime.enable")
        ws.call("Page.enable")
        ws.call("Page.navigate", {"url": URL})
        time.sleep(2.5)
        print("boot errors:", drain_console(ws, 1.5))

        # 1. DB migration to v3 + transactions store sanity (create/list/delete).
        r = evaluate(ws, """
            (async () => {
              const db = await import('./js/core/db.js');
              const store = await import('./js/core/store.js');
              await db.open();
              const t = store.newTransaction({ type: 'expense', amount: 42.5, category: 'Tools & Equipment', description: 'test-ladder' });
              await store.saveTransaction(t);
              const all = await store.listTransactions();
              const found = all.find(x => x.id === t.id);
              await store.deleteTransaction(t.id);
              const afterDelete = await store.listTransactions();
              return JSON.stringify({
                dbVersion: db.DB_VERSION ?? 'n/a',
                foundBeforeDelete: !!found,
                foundBody: found ? found.description : null,
                goneAfterDelete: !afterDelete.find(x => x.id === t.id),
              });
            })()
        """)
        print("1) transactions store:", r.get("result", {}).get("result", {}).get("value", r))

        # 2. routing.js — real OSRM call (network permitting), plus bad-input guard.
        r = evaluate(ws, """
            (async () => {
              const { roundTripMiles } = await import('./js/core/routing.js');
              const nullCase = await roundTripMiles(null, { lat: 1, lon: 1 });
              const realCase = await roundTripMiles(
                { lat: 28.0395, lon: -81.9498 },  // Lakeland-ish
                { lat: 28.5383, lon: -81.3792 }   // Orlando-ish
              );
              return JSON.stringify({ nullCase, realCase });
            })()
        """, timeout=15)
        print("2) routing.js:", r.get("result", {}).get("result", {}).get("value", r))

        # 3. Settings HQ fields exist in defaults + Admin route mounts.
        r = evaluate(ws, """
            (async () => {
              const store = await import('./js/core/store.js');
              const s = await store.getSettings();
              return JSON.stringify({
                hasHqFields: 'hqAddress' in s && 'hqLat' in s && 'mileageRate' in s,
                mileageRateDefault: s.mileageRate,
              });
            })()
        """)
        print("3) settings defaults:", r.get("result", {}).get("result", {}).get("value", r))

        # 4. Navigate to Settings view, confirm Home Base card + Admin link render.
        r = evaluate(ws, "location.hash = '#/settings'; new Promise(r => setTimeout(r, 600))")
        r = evaluate(ws, """
            JSON.stringify({
              hasHqAddressInput: !!document.querySelector('[data-k="hqAddress"]'),
              hasMileageRateInput: !!document.querySelector('[data-k="mileageRate"]'),
              hasAdminLink: !!document.querySelector('a[href="#/admin"]'),
            })
        """, await_promise=False)
        print("4) settings view DOM:", r.get("result", {}).get("result", {}).get("value", r))
        print("   settings console:", drain_console(ws, 0.5))

        # 5. Navigate to Admin view, confirm it renders without throwing.
        r = evaluate(ws, "location.hash = '#/admin'; new Promise(r => setTimeout(r, 800))")
        r = evaluate(ws, """
            JSON.stringify({
              hasYearSelect: !!document.querySelector('[data-year]'),
              hasExportBtn: !!document.querySelector('[data-export]'),
              hasAddTxBtn: !!document.querySelector('[data-add-tx]'),
              summaryCardText: document.querySelector('.card.stack')?.textContent?.slice(0, 200) || null,
            })
        """, await_promise=False)
        print("5) admin view DOM:", r.get("result", {}).get("result", {}).get("value", r))
        print("   admin console:", drain_console(ws, 0.5))

        # 6. Add a transaction via the real UI sheet, verify it shows in the list, then clean up.
        r = evaluate(ws, """
            (async () => {
              document.querySelector('[data-add-tx]').click();
              await new Promise(r => setTimeout(r, 400));
              const amt = document.querySelector('[data-amount]');
              const date = document.querySelector('[data-date]');
              const desc = document.querySelector('[data-description]');
              if (!amt) return JSON.stringify({ error: 'sheet did not open' });
              amt.value = '15.75';
              amt.dispatchEvent(new Event('input', { bubbles: true }));
              desc.value = 'cdp-test-expense';
              desc.dispatchEvent(new Event('input', { bubbles: true }));
              document.querySelector('[data-save]').click();
              await new Promise(r => setTimeout(r, 400));
              const rowText = document.body.textContent.includes('cdp-test-expense');
              return JSON.stringify({ rowAppeared: rowText });
            })()
        """, timeout=8)
        print("6) add transaction via UI:", r.get("result", {}).get("result", {}).get("value", r))
        print("   tx console:", drain_console(ws, 0.5))

        # cleanup the test transaction so it doesn't pollute real data
        r = evaluate(ws, """
            (async () => {
              const store = await import('./js/core/store.js');
              const all = await store.listTransactions();
              const t = all.find(x => x.description === 'cdp-test-expense');
              if (t) await store.deleteTransaction(t.id);
              return JSON.stringify({ cleaned: !!t });
            })()
        """)
        print("   cleanup:", r.get("result", {}).get("result", {}).get("value", r))

        # 7. checklist.js comment-library sync: newComment/getComment plumbing sanity
        # (full focusout DOM test needs a real inspection+checklist item; verifying
        # the store-level plumbing store.getComment/newComment/saveComment here).
        r = evaluate(ws, """
            (async () => {
              const store = await import('./js/core/store.js');
              const c = store.newComment({ category: 'Test', title: 'cdp test item', body: 'cdp test body', severity: 2 });
              await store.saveComment(c);
              const fetched = await store.getComment(c.id);
              await store.deleteComment?.(c.id);
              return JSON.stringify({ savedAndFetched: fetched && fetched.body === 'cdp test body' });
            })()
        """)
        print("7) comment library store plumbing:", r.get("result", {}).get("result", {}).get("value", r))

        # 8. geocode.js returns lat/lon on candidates now.
        r = evaluate(ws, """
            (async () => {
              const { searchAddress } = await import('./js/core/geocode.js');
              const results = await searchAddress('1600 Pennsylvania Ave NW, Washington DC');
              const first = results[0] || null;
              return JSON.stringify({
                gotResults: results.length > 0,
                hasLatLon: first ? (typeof first.lat === 'number' && typeof first.lon === 'number') : false,
              });
            })()
        """, timeout=15)
        print("8) geocode lat/lon:", r.get("result", {}).get("result", {}).get("value", r))

        # 9. checklist.js comment-library auto-sync via a real mountSectionItems + focusout.
        r = evaluate(ws, """
            (async () => {
              const store = await import('./js/core/store.js');
              const checklist = await import('./js/views/checklist.js');
              const inspection = await store.newInspection({});
              const section = inspection.template.sections.find(s => s.items.some(it => it.type !== 'narrative')) || inspection.template.sections[0];
              const item = section.items.find(it => it.type !== 'narrative') || section.items[0];
              inspection.data[item.id] = { noteOpen: true };
              const host = document.createElement('div');
              document.body.appendChild(host);
              checklist.mountSectionItems(host, inspection, section, () => {}, () => {});
              const ta = host.querySelector(`[data-note="${item.id}"]`);
              if (!ta) return JSON.stringify({ error: 'no textarea found', itemId: item.id });
              ta.value = 'cdp-sync-test comment body ' + Date.now();
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              ta.dispatchEvent(new Event('focusout', { bubbles: true }));
              await new Promise(r => setTimeout(r, 500));
              const libId = inspection.data[item.id]?.libraryCommentId;
              let libEntry = null;
              if (libId) libEntry = await store.getComment(libId);
              // cleanup
              host.remove();
              if (libId) await store.deleteComment?.(libId);
              return JSON.stringify({
                libraryCommentIdSet: !!libId,
                libraryBodyMatches: libEntry ? libEntry.body === ta.value : false,
              });
            })()
        """, timeout=8)
        print("9) checklist focusout sync:", r.get("result", {}).get("result", {}).get("value", r))
        print("   sync console:", drain_console(ws, 0.5))

        print("---- final console drain ----")
        print(drain_console(ws, 1.0))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
