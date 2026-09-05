"""For the 4P fillable master's multi-widget fields, determines the real
pdf-lib field class (CheckBox vs RadioGroup vs Text) and each widget's own
export/on-value — needed to know whether "Central heat" etc. actually behave
as a Yes/No radio (fillable independently per widget) or a single shared
checkbox (all widgets toggle together, which would need splitting).
"""
import base64
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache  # noqa: E402

URL = "http://127.0.0.1:8420/index.html"


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

        vendor_path = __file__.rsplit("\\tools\\", 1)[0] + r"\js\vendor\pdf-lib.min.js"
        with open(vendor_path, "r", encoding="utf-8") as f:
            pdf_lib_src = f.read()
        evaluate(ws, pdf_lib_src, await_promise=False, timeout=15)

        with open(local_pdf_path, "rb") as f:
            pdf_b64 = base64.b64encode(f.read()).decode()

        target_names = [
            "Any visible signs of leaks", "Any visible signs of leaks_2",
            "Atticunderside of decking", "Atticunderside of decking_2",
            "Interior ceilings", "Interior ceilings_2",
        ]

        r = evaluate(ws, f"""
            (async () => {{
              const {{ PDFDocument, PDFCheckBox, PDFRadioGroup, PDFTextField }} = window.PDFLib;
              const bin = atob({json.dumps(pdf_b64)});
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const doc = await PDFDocument.load(bytes, {{ ignoreEncryption: true }});
              const form = doc.getForm();
              const names = {json.dumps(target_names)};
              const out = [];
              for (const name of names) {{
                const field = form.getFields().find(f => f.getName() === name);
                if (!field) {{ out.push({{ name, error: 'not found' }}); continue; }}
                let className = field instanceof PDFCheckBox ? 'CheckBox'
                  : field instanceof PDFRadioGroup ? 'RadioGroup'
                  : field instanceof PDFTextField ? 'TextField' : 'Other';
                let widgets;
                try {{
                  widgets = field.acroField.getWidgets().map(w => {{
                    const ap = w.getAppearances ? w.getAppearances() : null;
                    let onValue = null;
                    try {{
                      const apDict = w.dict.get(window.PDFLib.PDFName.of('AP'));
                      const nDict = apDict ? apDict.get(window.PDFLib.PDFName.of('N')) : null;
                      if (nDict && nDict.keys) onValue = nDict.keys().map(k => k.asString ? k.asString() : String(k));
                    }} catch (e) {{ onValue = 'err:' + e.message; }}
                    const rect = w.getRectangle();
                    return {{ x: Math.round(rect.x*10)/10, y: Math.round(rect.y*10)/10, onValue }};
                  }});
                }} catch (e) {{ widgets = 'error: ' + e.message; }}
                out.push({{ name, className, widgets }});
              }}
              return JSON.stringify(out, null, 2);
            }})()
        """, timeout=30)
        val = r.get("result", {}).get("result", {}).get("value")
        print(val if isinstance(val, str) else json.dumps(r, indent=2)[:3000])
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "tools/masters/4p-fillable.pdf")
