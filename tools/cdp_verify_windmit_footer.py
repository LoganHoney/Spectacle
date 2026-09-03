"""Verifies the new footer fields (Inspectors Initials + Property Address,
repeated on all 6 pages) on the rebuilt oir-b1-1802-fillable.pdf: that all 12
fields exist, that buildWindMitOfficialPdf() fills them from insp_name/address,
and that each field's page-relative rect lands inside the page bounds at the
expected x-range (not on top of the printed label text).
"""
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache  # noqa: E402

URL = "http://127.0.0.1:8420/index.html"


def evaluate(ws, expression, await_promise=True, timeout=15, verbose=False):
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
        if verbose:
            m = msg.get("method")
            if m == "Runtime.consoleAPICalled":
                p = msg["params"]
                args = [a.get("value", a.get("description", "")) for a in p.get("args", [])]
                print("  [console]", " ".join(str(a) for a in args))
            elif m == "Runtime.exceptionThrown":
                ex = msg["params"]["exceptionDetails"]
                print("  [exception]", ex.get("exception", {}).get("description") or ex.get("text"))
    return {"error": "timeout waiting for eval result"}


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

        def drain(seconds=1.0):
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

        r = evaluate(ws, """
            (async () => {
              console.log('step1: importing module');
              const { buildWindMitOfficialPdf } = await import('./js/report/windmitPdfFill.js');
              console.log('step2: module imported, building pdf');
              const blob = await buildWindMitOfficialPdf({
                insp_name: 'Logan T. Honey',
                address: '123 Test Street, Brooksville, FL 34601',
              });
              console.log('step3: pdf built, size', blob.size);
              const bytes = new Uint8Array(await blob.arrayBuffer());
              let binary = '';
              for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
              window.__builtPdfB64 = btoa(binary);
              console.log('step4: stashed on window');
              return blob.size;
            })()
        """, timeout=45, verbose=True)
        print("stage 1 result:", r.get("result", {}).get("result", {}).get("value", r))

        r = evaluate(ws, """
            (async () => {
              const { PDFDocument } = window.PDFLib;
              const b64 = window.__builtPdfB64;
              const binary = atob(b64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              const doc = await PDFDocument.load(bytes);
              const form = doc.getForm();
              const pages = doc.getPages();
              const out = [];
              for (let p = 0; p < 6; p++) {
                const iName = `footer_initials_p${p}`;
                const aName = `footer_property_address_p${p}`;
                let iVal = null, aVal = null, iRect = null, aRect = null, err = null;
                try {
                  const iField = form.getTextField(iName);
                  iVal = iField.getText();
                  const w = iField.acroField.getWidgets()[0];
                  const rect = w.getRectangle();
                  iRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
                } catch (e) { err = 'initials: ' + e.message; }
                try {
                  const aField = form.getTextField(aName);
                  aVal = aField.getText();
                  const w = aField.acroField.getWidgets()[0];
                  const rect = w.getRectangle();
                  aRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
                } catch (e) { err = (err ? err + '; ' : '') + 'address: ' + e.message; }
                const pageWidth = pages[p].getWidth();
                out.push({ page: p, iVal, aVal, iRect, aRect, pageWidth, err });
              }
              return JSON.stringify(out, null, 2);
            })()
        """, timeout=40)
        val = r.get("result", {}).get("result", {}).get("value")
        if val:
            print(val)
        else:
            print("FAILED:", json.dumps(r, indent=2)[:3000])
            print("console:", drain(1.0))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
