"""Rebuilds js/vendor/forms/oir-b1-1802-fillable-v2.pdf from
tools/masters/windmit-fillable.pdf (the real Acrobat-prepared fillable
OIR-B1-1802 the user supplied) by running tools/build_windmit_fields.js in a
real browser via pdf-lib — see that file's header for what it patches.

pdf-lib.min.js and the master PDF are both read straight off disk and passed
in as base64/eval'd source rather than fetched in-page — this dev server's
headless-Edge fetches have been observed to fail intermittently on this
machine (documented elsewhere in this project).
"""
import base64
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache  # noqa: E402

ROOT = __file__.rsplit("\\tools\\", 1)[0]
MASTER_PATH = ROOT + r"\tools\masters\windmit-fillable.pdf"
BUILD_SCRIPT_PATH = ROOT + r"\tools\build_windmit_fields.js"
PDF_LIB_PATH = ROOT + r"\js\vendor\pdf-lib.min.js"
OUT_PATH = ROOT + r"\js\vendor\forms\oir-b1-1802-fillable-v2.pdf"


def evaluate(ws, expression, await_promise=True, timeout=60, return_by_value=True):
    mid = ws.call("Runtime.evaluate", {"expression": expression, "returnByValue": return_by_value, "awaitPromise": await_promise})
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = ws.recv_frame(timeout=0.5)
        if msg == "TIMEOUT" or msg is None:
            continue
        if msg.get("id") == mid:
            return msg
    return {"error": "timeout waiting for eval result"}


def main():
    proc = start_edge()
    try:
        ws_url = get_ws_url()
        ws = WS(ws_url)
        disable_cache(ws)
        ws.call("Runtime.enable")
        ws.call("Page.enable")
        ws.call("Page.navigate", {"url": "http://127.0.0.1:8420/index.html"})
        time.sleep(2.5)

        for label, path in [("pdf-lib", PDF_LIB_PATH), ("build_windmit_fields.js", BUILD_SCRIPT_PATH)]:
            with open(path, "r", encoding="utf-8") as f:
                src = f.read()
            r = evaluate(ws, src, await_promise=False, timeout=15, return_by_value=False)
            if r.get("result", {}).get("exceptionDetails"):
                print(f"FAILED loading {label}:", json.dumps(r, indent=2)[:2000])
                return
            print(f"loaded {label}")

        with open(MASTER_PATH, "rb") as f:
            master_b64 = base64.b64encode(f.read()).decode()

        build_expr = f"""
            (async () => {{
              const bin = atob({json.dumps(master_b64)});
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const outBytes = await window.buildWindMitFieldsV2(bytes);
              let binary = '';
              for (let i = 0; i < outBytes.length; i++) binary += String.fromCharCode(outBytes[i]);
              return btoa(binary);
            }})()
        """
        result = evaluate(ws, build_expr, timeout=40)
        try:
            b64 = result["result"]["result"]["value"]
            pdf_bytes = base64.b64decode(b64)
            with open(OUT_PATH, "wb") as f:
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
