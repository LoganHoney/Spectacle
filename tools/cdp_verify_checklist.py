"""Creates a real client + inspection via the app's own store module (in-page,
through CDP Runtime.evaluate), navigates to the checklist, and dumps the
rendered HTML of the first item so we can confirm no "[object Object]" bug
and that the flag row / summary toggle actually render.
"""
import json
import time
from cdp_console import WS, start_edge, get_ws_url  # noqa: E402

URL = "http://127.0.0.1:8420/index.html"


def evaluate(ws, expr, await_promise=False, timeout=6):
    cid = ws.call("Runtime.evaluate", {
        "expression": expr, "returnByValue": True, "awaitPromise": await_promise,
    })
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = ws.recv_frame(timeout=0.5)
        if msg == "TIMEOUT" or msg is None:
            continue
        if msg.get("id") == cid:
            return msg
    return None


def main():
    proc = start_edge()
    try:
        ws = WS(get_ws_url())
        ws.call("Runtime.enable")
        ws.call("Page.enable")
        ws.call("Page.navigate", {"url": URL})
        time.sleep(3)

        setup = """
        (async () => {
          const store = await import('./js/core/store.js');
          const client = store.newClient({ name: 'Verify Test Client' });
          await store.saveClient(client);
          const property = store.newProperty({ clientId: client.id, address: '123 Verify St', city: 'Brooksville', zip: '34601' });
          await store.saveProperty(property);
          const inspection = await store.newInspection({ clientId: client.id, propertyId: property.id });
          await store.saveInspection(inspection);
          return inspection.id;
        })()
        """
        r = evaluate(ws, setup, await_promise=True, timeout=10)
        result = r.get("result", {}).get("result", {})
        if result.get("subtype") == "error" or "exceptionDetails" in r.get("result", {}):
            print("SETUP FAILED:", json.dumps(r, indent=2))
            return
        inspection_id = result.get("value")
        print("Created inspection:", inspection_id)

        nav_id = ws.call("Runtime.evaluate", {"expression": f"location.hash = '#/inspection/{inspection_id}'"})
        time.sleep(2)

        dump = """
        JSON.stringify({
          firstFindingHtml: document.querySelector('.finding')?.outerHTML.slice(0, 1400),
          hasObjectObject: document.getElementById('view').innerHTML.includes('[object Object]'),
          findingCount: document.querySelectorAll('.finding').length,
          formsListHtml: document.querySelector('h2')?.parentElement?.innerHTML?.slice(0,200)
        })
        """
        r2 = evaluate(ws, dump, timeout=5)
        val = r2.get("result", {}).get("result", {}).get("value")
        print("---- checklist dump ----")
        print(json.dumps(json.loads(val), indent=2) if val else "no value")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
