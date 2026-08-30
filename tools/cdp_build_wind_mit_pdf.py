"""Rebuilds js/vendor/forms/oir-b1-1802-fillable.pdf from tools/oir-b1-1802-master.pdf
(the flat official OIR-B1-1802 Rev. 04/26 master from floir.gov) by running
tools/build_fields.js in a real browser via pdf-lib. Only needs re-running if
the master form's layout changes (a new revision) or build_fields.js's field
list changes — the vendored PDF is otherwise a static, committed asset.

If floir.gov ever revises the form again, re-derive build_fields.js's
coordinates first with tools/cdp_extract_positions.py against the new
master, then update the field positions here before rebuilding.
"""
import base64
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache  # noqa: E402

OUT_PATH = __file__.rsplit("\\", 2)[0] + r"\js\vendor\forms\oir-b1-1802-fillable.pdf"


def run_eval(ws, expr, timeout=25):
    eval_id = ws.call("Runtime.evaluate", {"expression": expr, "awaitPromise": True, "returnByValue": True})
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = ws.recv_frame(timeout=0.5)
        if msg == "TIMEOUT" or msg is None:
            continue
        if msg.get("id") == eval_id:
            return msg
    return None


def run_eval_retry(ws, expr, timeout=20, attempts=6):
    r = None
    for _ in range(attempts):
        r = run_eval(ws, expr, timeout)
        if r and not r.get('result', {}).get('exceptionDetails'):
            return r
        time.sleep(1.5)
    return r


def load_script(ws, src):
    expr = f"""
    new Promise((resolve, reject) => {{
      const s = document.createElement('script');
      s.src = '{src}';
      s.onload = () => resolve('loaded');
      s.onerror = () => reject(new Error('load error: {src}'));
      document.head.appendChild(s);
    }})
    """
    return run_eval_retry(ws, expr, 20)


def main():
    proc = start_edge()
    try:
        ws_url = get_ws_url()
        ws = WS(ws_url)
        disable_cache(ws)
        ws.call("Runtime.enable")
        ws.call("Page.enable")
        ws.call("Page.navigate", {"url": "http://127.0.0.1:8420/index.html"})
        time.sleep(4)

        print("load pdf-lib:", json.dumps(load_script(ws, '/js/vendor/pdf-lib.min.js')))
        print("load build_fields.js:", json.dumps(load_script(ws, '/tools/build_fields.js')))

        build_expr = """
        (async () => {
          const xhr = new XMLHttpRequest();
          const bytes = await new Promise((resolve, reject) => {
            xhr.open('GET', '/tools/oir-b1-1802-master.pdf', true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => resolve(xhr.response);
            xhr.onerror = () => reject(new Error('xhr error'));
            xhr.send();
          });
          const outBytes = await window.buildWindMitFields(bytes);
          let binary = '';
          for (let i = 0; i < outBytes.length; i++) binary += String.fromCharCode(outBytes[i]);
          return btoa(binary);
        })()
        """
        result = run_eval_retry(ws, build_expr, 40)
        try:
            b64 = result['result']['result']['value']
            pdf_bytes = base64.b64decode(b64)
            with open(OUT_PATH, 'wb') as f:
                f.write(pdf_bytes)
            print(f"SAVED {len(pdf_bytes)} bytes to {OUT_PATH}")
        except Exception as e:
            print("BUILD FAILED:", e)
            print(json.dumps(result, indent=2)[:3000])
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
