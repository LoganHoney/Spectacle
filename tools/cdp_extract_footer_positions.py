"""Extracts exact glyph positions of the repeating footer line
"Inspectors Initials ___ Property Address ___" on every page of the
OIR-B1-1802 master, via pdf.js getTextContent() — same technique as
cdp_extract_positions.py, narrowed to just this footer so it's easy to read.
"""
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache  # noqa: E402


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

        print("load pdf.js:", json.dumps(load_script(ws, '/tools/vendor/pdf.min.js')))

        step2 = """
        (async () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/tools/vendor/pdf.worker.min.js';
          const xhr = new XMLHttpRequest();
          const bytes = await new Promise((resolve, reject) => {
            xhr.open('GET', '/tools/oir-b1-1802-master.pdf', true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => resolve(xhr.response);
            xhr.onerror = () => reject(new Error('xhr error'));
            xhr.send();
          });
          const doc = await window.pdfjsLib.getDocument({ data: bytes }).promise;
          window.__pdfDoc = doc;
          return doc.numPages;
        })()
        """
        print("load doc:", json.dumps(run_eval_retry(ws, step2, 25)))

        step3 = """
        (async () => {
          const doc = window.__pdfDoc;
          const out = [];
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const items = content.items.map(it => ({
              str: it.str,
              x: Math.round(it.transform[4] * 10) / 10,
              y: Math.round(it.transform[5] * 10) / 10,
              w: Math.round(it.width * 10) / 10,
              h: Math.round(it.height * 10) / 10,
            }));
            const hits = items.filter(it =>
              /Inspectors Initials/i.test(it.str) || /Property Address/i.test(it.str)
            );
            out.push({ page: i, hits });
          }
          return JSON.stringify(out, null, 2);
        })()
        """
        result = run_eval_retry(ws, step3, 40)
        try:
            val = result['result']['result']['value']
            print(val)
        except Exception as e:
            print("FAILED:", e)
            print(json.dumps(result, indent=2)[:2000])
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
