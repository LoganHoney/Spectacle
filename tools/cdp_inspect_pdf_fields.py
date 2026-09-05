"""Loads a PDF via pdf-lib in a real browser and lists its AcroForm fields
(name, type, page, rect) — the reliable way to check whether a PDF someone
sent actually has real interactive form fields, since a raw byte grep for
/FT or /Widget can miss them when they're inside compressed object streams.
"""
import base64
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache  # noqa: E402

URL = "http://127.0.0.1:8420/index.html"


def evaluate(ws, expression, await_promise=True, timeout=60, return_by_value=True):
    mid = ws.call("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": return_by_value,
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


def main(local_pdf_path):
    proc = start_edge()
    try:
        ws_url = get_ws_url()
        ws = WS(ws_url)
        disable_cache(ws)
        ws.call("Runtime.enable")
        ws.call("Page.enable")
        ws.call("Page.navigate", {"url": URL})
        time.sleep(2.5)

        # Serving js/vendor/pdf-lib.min.js over HTTP has been observed to fail
        # outright in headless Edge on this machine (reproducible, content-
        # specific to that one file — see session notes; not a code issue).
        # Sidestep it entirely: read the file straight off disk in Python and
        # execute it in-page directly, no in-browser fetch of it at all.
        vendor_path = __file__.rsplit("\\tools\\", 1)[0] + r"\js\vendor\pdf-lib.min.js"
        with open(vendor_path, "r", encoding="utf-8") as f:
            pdf_lib_src = f.read()
        r = evaluate(ws, pdf_lib_src, await_promise=False, timeout=15, return_by_value=False)
        if r.get("result", {}).get("exceptionDetails"):
            print("pdf-lib inline-eval error:", json.dumps(r, indent=2)[:1500])
            return

        with open(local_pdf_path, "rb") as f:
            pdf_b64 = base64.b64encode(f.read()).decode()

        r = evaluate(ws, f"""
            (async () => {{
              const {{ PDFDocument }} = window.PDFLib;
              const bin = atob({json.dumps(pdf_b64)});
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const doc = await PDFDocument.load(bytes, {{ ignoreEncryption: true }});
              const pageCount = doc.getPageCount();
              let form, fields = [];
              try {{
                form = doc.getForm();
                fields = form.getFields().map(f => {{
                  let rects = [];
                  try {{
                    rects = f.acroField.getWidgets().map(w => {{
                      const r = w.getRectangle();
                      const pageRef = w.P();
                      let pageIndex = -1;
                      const pages = doc.getPages();
                      for (let i = 0; i < pages.length; i++) {{
                        if (pages[i].ref === pageRef) {{ pageIndex = i; break; }}
                      }}
                      return {{ page: pageIndex, x: Math.round(r.x*10)/10, y: Math.round(r.y*10)/10, w: Math.round(r.width*10)/10, h: Math.round(r.height*10)/10 }};
                    }});
                  }} catch (e) {{ rects = [{{ error: e.message }}]; }}
                  return {{ name: f.getName(), type: f.constructor.name, rects }};
                }});
              }} catch (e) {{
                fields = [{{ error: 'getForm/getFields failed: ' + e.message }}];
              }}
              return JSON.stringify({{ pageCount, fieldCount: fields.length, fields }}, null, 2);
            }})()
        """, timeout=150)
        val = r.get("result", {}).get("result", {}).get("value")
        if isinstance(val, str):
            print(val)
        else:
            print("RAW RESULT:", json.dumps(r, indent=2)[:4000])
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else __file__.rsplit("\\tools\\", 1)[0] + r"\tools\masters\4p-fillable.pdf")
