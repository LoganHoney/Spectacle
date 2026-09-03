"""Verifies two follow-up fixes:
1. windmitPdfFill.js's initialsOf() now uses first+last word only (not every
   middle word) — "Logan T. Honey" should give "LH", not "LTH".
2. admin.js transaction sheet can attach a receipt photo (media keyed by the
   transaction's own id), and deleteTransaction() cleans that media up.
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

        # 1. initialsOf via buildWindMitOfficialPdf's actual footer field output.
        #    One case per eval call — this environment's headless-Edge fetches
        #    have been flaky under back-to-back network calls in one await chain.
        cases = ['Logan T. Honey', 'Logan Honey', 'Logan', 'Mary Jane Watson-Parker']
        results = {}
        for name in cases:
            r = evaluate(ws, f"""
                (async () => {{
                  const {{ buildWindMitOfficialPdf }} = await import('./js/report/windmitPdfFill.js');
                  const blob = await buildWindMitOfficialPdf({{ insp_name: {json.dumps(name)}, address: 'x' }});
                  const bytes = new Uint8Array(await blob.arrayBuffer());
                  const {{ PDFDocument }} = window.PDFLib;
                  const doc = await PDFDocument.load(bytes);
                  return doc.getForm().getTextField('footer_initials_p0').getText();
                }})()
            """, timeout=75)
            results[name] = r.get("result", {}).get("result", {}).get("value", r)
        print("1) initialsOf cases:", json.dumps(results))

        # 2. Admin transaction photo attach + cleanup on delete.
        r = evaluate(ws, """
            (async () => {
              const store = await import('./js/core/store.js');
              const media = await import('./js/core/media.js');
              const t = store.newTransaction({ type: 'expense', amount: 9.99, category: 'Tools & Equipment', description: 'cdp-photo-test' });
              await store.saveTransaction(t);

              // Simulate attaching a receipt photo the same way mountPhotos would —
              // a real (if tiny) 1x1 PNG so media.js's decode step succeeds.
              const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
              const bin = atob(png1x1);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const fakeFile = new File([bytes], 'receipt.png', { type: 'image/png' });
              const saved = await media.addFiles(t.id, 'receipt', [fakeFile]);

              const beforeDelete = await media.mediaFor(t.id);
              await store.deleteTransaction(t.id);
              const afterDelete = await media.mediaFor(t.id);

              return JSON.stringify({
                photoSaved: saved.length === 1,
                foundBeforeDelete: beforeDelete.length === 1,
                slotMatches: beforeDelete[0]?.slot === 'receipt',
                cleanedUpAfterDelete: afterDelete.length === 0,
              });
            })()
        """, timeout=15)
        print("2) admin photo attach + cleanup:", r.get("result", {}).get("result", {}).get("value", r))
        print("   console:", drain_console(ws, 0.5))

        # 3. Admin view: opening Add Entry actually mounts the photo-slot host with camera/library buttons.
        r = evaluate(ws, "location.hash = '#/admin'; new Promise(r => setTimeout(r, 800))")
        r = evaluate(ws, """
            (async () => {
              document.querySelector('[data-add-tx]').click();
              await new Promise(r => setTimeout(r, 500));
              const slot = document.querySelector('[data-photos]');
              return JSON.stringify({
                slotPresent: !!slot,
                hasCameraBtn: !!document.querySelector('[data-camera]'),
                hasLibraryBtn: !!document.querySelector('[data-library]'),
              });
            })()
        """, timeout=10)
        print("3) admin sheet photo UI:", r.get("result", {}).get("result", {}).get("value", r))
        print("   console:", drain_console(ws, 0.5))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
