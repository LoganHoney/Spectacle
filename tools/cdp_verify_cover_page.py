"""Verifies the cover-page-prepend feature: creates a real client/property/
inspection, hydrates it, and checks that all three official PDF builders
(4-Point, Wind Mit, Roof Cert) produce a page count one greater than without
`hydrated`, and that calling without `hydrated` still works exactly as
before (backward compatible).
"""
import base64
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache  # noqa: E402

URL = "http://127.0.0.1:8420/index.html"
ROOT_DIR = __file__.rsplit("\\tools\\", 1)[0]


def evaluate(ws, expression, await_promise=True, timeout=60):
    mid = ws.call("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": await_promise})
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = ws.recv_frame(timeout=0.5)
        if msg == "TIMEOUT" or msg is None:
            continue
        if msg.get("id") == mid:
            return msg
    return {"error": "timeout"}


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
            out.append(f"[EXCEPTION] {ex.get('exception', {}).get('description') or ex.get('text')}")
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

        # Route all vendor/master fetches (pdf-lib, jsPDF, html2canvas, and the
        # three PDF masters) to locally-read bytes — this dev server's network
        # fetches for these larger files have been intermittently flaky.
        files = {
            "js/vendor/pdf-lib.min.js": "js/vendor/pdf-lib.min.js",
            "js/vendor/jspdf.umd.min.js": "js/vendor/jspdf.umd.min.js",
            "js/vendor/html2canvas.min.js": "js/vendor/html2canvas.min.js",
            "js/vendor/forms/insp4pt-fillable.pdf": "js/vendor/forms/insp4pt-fillable.pdf",
            "js/vendor/forms/oir-b1-1802-fillable-v2.pdf": "js/vendor/forms/oir-b1-1802-fillable-v2.pdf",
            "js/vendor/forms/roofcert-fillable.pdf": "js/vendor/forms/roofcert-fillable.pdf",
        }
        local_files_js = {}
        for key, path in files.items():
            with open(ROOT_DIR + "\\" + path.replace("/", "\\"), "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            is_text = path.endswith(".js")
            local_files_js[key] = {"b64": b64, "type": "text/javascript" if is_text else "application/pdf"}

        setup_expr = f"""
            (() => {{
              const localFiles = {json.dumps(local_files_js)};
              const realFetch = window.fetch.bind(window);
              window.fetch = (url, ...rest) => {{
                const key = Object.keys(localFiles).find((k) => String(url).endsWith(k));
                if (!key) return realFetch(url, ...rest);
                const {{ b64, type }} = localFiles[key];
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                return Promise.resolve(new Response(bytes, {{ status: 200, headers: {{ 'Content-Type': type }} }}));
              }};
              return 'patched';
            }})()
        """
        evaluate(ws, setup_expr, await_promise=False)

        build_expr = """
            (async () => {
              const store = await import('./js/core/store.js');
              const client = await store.newClient({ name: 'Test Client', email: 'test@example.com' });
              await store.saveClient(client);
              const property = await store.newProperty({ clientId: client.id, address: '123 Cover Test Ln', city: 'Brooksville', state: 'FL', zip: '34601' });
              await store.saveProperty(property);
              await store.setSetting('companyName', 'Test Inspections LLC');
              await store.setSetting('coverTagline', 'Trusted Since 2020');
              const inspection = await store.newInspection({ clientId: client.id, propertyId: property.id, inspectorName: 'Bob Inspector' });
              await store.saveInspection(inspection);
              const hydrated = await store.hydrate(inspection.id);

              const { buildFourPointOfficialPdf } = await import('./js/report/fourPointPdfFill.js');
              const { buildWindMitOfficialPdf } = await import('./js/report/windmitPdfFill.js');
              const { buildRoofCertOfficialPdf } = await import('./js/report/roofCertPdfFill.js');

              const results = {};
              for (const [name, fn] of [['fourpoint', buildFourPointOfficialPdf], ['windmit', buildWindMitOfficialPdf], ['roofcert', buildRoofCertOfficialPdf]]) {
                const withoutCover = await fn({ owner_name: 'Jane Homeowner' });
                const withCover = await fn({ owner_name: 'Jane Homeowner' }, hydrated);
                // window.PDFLib is only populated as a side effect of the fn() calls above.
                const { PDFDocument } = window.PDFLib;
                const docWithout = await PDFDocument.load(new Uint8Array(await withoutCover.arrayBuffer()));
                const docWith = await PDFDocument.load(new Uint8Array(await withCover.arrayBuffer()));
                results[name] = {
                  pagesWithoutCover: docWithout.getPageCount(),
                  pagesWithCover: docWith.getPageCount(),
                  delta: docWith.getPageCount() - docWithout.getPageCount(),
                };
              }

              await store.deleteInspection(inspection.id);
              await store.deleteClient(client.id);
              return JSON.stringify(results, null, 2);
            })()
        """
        r = evaluate(ws, build_expr, timeout=60)
        val = r.get("result", {}).get("result", {}).get("value")
        exc = r.get("result", {}).get("exceptionDetails")
        if exc:
            print("EXCEPTION:", json.dumps(exc, indent=2)[:2500])
        print(val if isinstance(val, str) else json.dumps(r, indent=2)[:3000])
        print("console:", drain_console(ws, 0.5))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
