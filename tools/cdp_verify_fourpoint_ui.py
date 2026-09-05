"""Verifies the 4-Point form fixes: no more duplicated "Yes. Yes" style radio
labels, Predominant/Secondary + Main/Second Panel tab switchers work (show
only that tab's fields, shared fields always show), the HVAC servicing field
is a plain number (year) input, and the roof "remaining useful life" fields
are text inputs. Also checks the main checklist's matching item is now text.
"""
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache  # noqa: E402

URL = "http://127.0.0.1:8420/index.html"


def evaluate(ws, expression, await_promise=True, timeout=15):
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
        print("boot errors:", drain_console(ws, 1.0))

        # Create a throwaway inspection and jump straight to the 4-Point form.
        r = evaluate(ws, """
            (async () => {
              const store = await import('./js/core/store.js');
              const i = await store.newInspection({});
              await store.saveInspection(i);
              location.hash = `#/inspection/${i.id}/form/fourpoint`;
              window.__testInspectionId = i.id;
              return i.id;
            })()
        """, timeout=10)
        insp_id = r.get("result", {}).get("result", {}).get("value")
        print("created test inspection:", insp_id)
        time.sleep(1.0)

        # 1. No more "X. X" duplicated radio labels anywhere on the form.
        r = evaluate(ws, """
            [...document.querySelectorAll('[data-radio] button')].map(b => b.textContent.trim())
              .filter(t => {
                const m = t.match(/^(.+?)\\.\\s*(.+)$/);
                return m && m[1] === m[2];
              })
        """, await_promise=False)
        print("1) duplicated radio labels found:", r.get("result", {}).get("result", {}).get("value", r))

        # 2. Roof + Electrical sections have tab switchers.
        r = evaluate(ws, """
            JSON.stringify({
              subtabHosts: [...document.querySelectorAll('[data-subtab]')].map(el => ({
                section: el.dataset.subtab,
                buttons: [...el.querySelectorAll('button')].map(b => b.textContent.trim()),
              })),
            })
        """, await_promise=False)
        print("2) subtab hosts:", r.get("result", {}).get("result", {}).get("value", r))

        # 3. HVAC "Year of last servicing" field is a number input, not a date input.
        r = evaluate(ws, """
            (() => {
              const labels = [...document.querySelectorAll('label.f')];
              const l = labels.find(el => el.textContent.includes('Year of last HVAC servicing'));
              const input = l?.querySelector('input');
              return JSON.stringify({ found: !!l, inputType: input?.type });
            })()
        """, await_promise=False)
        print("3) hvac_last_service field:", r.get("result", {}).get("result", {}).get("value", r))

        # 4. Roof remaining-life fields are text inputs (accept "5+ years"), on the correct tab.
        r = evaluate(ws, """
            (() => {
              const labels = [...document.querySelectorAll('label.f')];
              const l = labels.find(el => el.textContent.includes('Remaining useful life'));
              const input = l?.querySelector('input');
              if (input) { input.value = '5+ years'; input.dispatchEvent(new Event('input', {bubbles:true})); }
              return JSON.stringify({ found: !!l, inputType: input?.type, acceptedValue: input?.value });
            })()
        """, await_promise=False)
        print("4) roof remaining-life field (predominant tab, default):", r.get("result", {}).get("result", {}).get("value", r))

        # 5. Switch Electrical to "Second Panel" tab and confirm main-panel-only fields disappear, second-panel fields appear.
        r = evaluate(ws, """
            (async () => {
              const elecTabs = document.querySelector('[data-subtab="electrical"]');
              if (!elecTabs) return JSON.stringify({ error: 'no electrical subtab host' });
              const secondBtn = [...elecTabs.querySelectorAll('button')].find(b => b.textContent.trim() === 'Second Panel');
              secondBtn.click();
              await new Promise(r => setTimeout(r, 200));
              const labels = [...document.querySelectorAll('label.f, .f > span')].map(el => el.textContent.trim());
              return JSON.stringify({
                hasSecondPanelType: !!document.querySelector('[data-radio="elec_second_type"]'),
                hasMainPanelType: !!document.querySelector('[data-radio="elec_main_type"]'),
              });
            })()
        """, timeout=10)
        print("5) electrical tab switch (Second Panel active):", r.get("result", {}).get("result", {}).get("value", r))
        print("   console:", drain_console(ws, 0.5))

        # 6. Roof tab switch to Secondary.
        r = evaluate(ws, """
            (async () => {
              const roofTabs = document.querySelector('[data-subtab="roof"]');
              if (!roofTabs) return JSON.stringify({ error: 'no roof subtab host' });
              const secBtn = [...roofTabs.querySelectorAll('button')].find(b => b.textContent.trim() === 'Secondary');
              secBtn.click();
              await new Promise(r => setTimeout(r, 200));
              return JSON.stringify({
                hasSecondaryCovering: !!document.querySelector('[data-f="roof_s_covering"]'),
                hasPredominantCovering: !!document.querySelector('[data-f="roof_p_covering"]'),
                hasSharedDamageExplain: !!document.querySelector('[data-f="roof_damage_explain"]'),
              });
            })()
        """, timeout=10)
        print("6) roof tab switch (Secondary active):", r.get("result", {}).get("result", {}).get("value", r))
        print("   console:", drain_console(ws, 0.5))

        # 7. Main checklist item type for "Estimated remaining useful life" is now text.
        r = evaluate(ws, """
            (async () => {
              const store = await import('./js/core/store.js');
              const i = await store.getInspection(window.__testInspectionId);
              const roofSection = i.template.sections.find(s => s.title === 'Roof');
              const item = roofSection.items.find(it => it.label.includes('remaining useful life'));
              await store.deleteInspection(window.__testInspectionId);
              return JSON.stringify({ found: !!item, type: item?.type, hint: item?.hint });
            })()
        """, timeout=10)
        print("7) main checklist item type + cleanup:", r.get("result", {}).get("result", {}).get("value", r))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
