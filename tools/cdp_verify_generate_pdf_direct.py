"""Confirms the fix: clicking "Generate Wind Mitigation" now produces a real
PDF blob directly (via downloadBlob) instead of navigating to an HTML
preview page. Intercepts URL.createObjectURL to capture the blob without
needing headless Chrome to actually complete a file download.
"""
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache, URL  # noqa: E402

JS = r"""
(async () => {
  try {
    const store = await import('/js/core/store.js');
    const router = await import('/js/core/router.js');

    const client = store.newClient({ name: 'PDF Direct Test Client' });
    await store.saveClient(client);
    const property = store.newProperty({ clientId: client.id, address: '2 Direct Ave', city: 'Brooksville', state: 'FL', zip: '34601', yearBuilt: '2012' });
    await store.saveProperty(property);
    let inspection = await store.newInspection({ clientId: client.id, propertyId: property.id, services: ['Full Home Inspection'] });
    function findByTag(tpl, tag) { for (const s of tpl.sections) for (const it of s.items) if (it.tag === tag) return it; return null; }
    const roofCovering = findByTag(inspection.template, 'roof_covering');
    if (roofCovering) inspection.data[roofCovering.id] = { value: 'Metal' };
    await store.saveInspection(inspection);

    router.go(`/inspection/${inspection.id}`);
    await new Promise((r) => setTimeout(r, 800));

    // Intercept blob creation instead of relying on an actual file download.
    const captured = [];
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      captured.push({ size: blob.size, type: blob.type });
      return origCreate.call(URL, blob);
    };

    const hashBefore = location.hash;
    const btn = document.querySelector('[data-generate-form="windmit"]');
    if (!btn) return JSON.stringify({ ok: false, error: 'windmit button not found' });
    btn.click();

    // Wait for the PDF build (pdf-lib fetch + fill) to complete.
    const deadline = Date.now() + 30000;
    while (captured.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 300));
    }
    URL.createObjectURL = origCreate;

    const toastEl = document.querySelector('.toast, [data-toast], .toast-msg');
    return JSON.stringify({
      ok: true,
      hashBefore,
      hashAfter: location.hash,
      navigated: location.hash !== hashBefore,
      capturedCount: captured.length,
      captured,
      toastText: toastEl ? toastEl.textContent : null,
      bodyToastSnippet: document.body.innerHTML.includes('Could not build') ? 'ERROR TOAST SEEN' : null,
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String((e && e.stack) || e) });
  }
})()
"""


def run_eval(ws, expr, timeout=30):
    eval_id = ws.call("Runtime.evaluate", {"expression": expr, "awaitPromise": True, "returnByValue": True})
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = ws.recv_frame(timeout=0.5)
        if msg == "TIMEOUT" or msg is None:
            continue
        if msg.get("id") == eval_id:
            return msg
    return None


def run_eval_retry(ws, expr, timeout=25, attempts=5):
    r = None
    for _ in range(attempts):
        r = run_eval(ws, expr, timeout)
        if r and not r.get('result', {}).get('exceptionDetails'):
            return r
        time.sleep(1.5)
    return r


def main():
    proc = start_edge()
    try:
        ws_url = get_ws_url()
        ws = WS(ws_url)
        disable_cache(ws)
        ws.call("Runtime.enable")
        ws.call("Page.enable")
        ws.call("Page.navigate", {"url": URL})
        time.sleep(3)

        eval_id = ws.call("Runtime.evaluate", {"expression": JS, "awaitPromise": True, "returnByValue": True})
        deadline = time.time() + 40
        result = None
        console_lines = []
        while time.time() < deadline:
            msg = ws.recv_frame(timeout=0.5)
            if msg == "TIMEOUT" or msg is None:
                continue
            if msg.get("method") in ("Runtime.consoleAPICalled", "Runtime.exceptionThrown"):
                console_lines.append(msg)
            if msg.get("id") == eval_id:
                result = msg
                break
        for c in console_lines:
            m = c["method"]
            if m == "Runtime.consoleAPICalled":
                args = [a.get("value", a.get("description", "")) for a in c["params"].get("args", [])]
                print(f"[console] {' '.join(str(a) for a in args)}")
            else:
                ex = c["params"]["exceptionDetails"]
                print(f"[EXCEPTION] {ex.get('exception', {}).get('description') or ex.get('text')}")
        print(json.dumps(result, indent=2))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
