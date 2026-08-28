import json
import time
from cdp_console import WS, start_edge, get_ws_url  # noqa: E402
from cdp_verify_checklist import evaluate  # noqa: E402

URL = "http://127.0.0.1:8420/index.html"


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
          const client = store.newClient({ name: 'Verify Test Client', email: 'client@example.com', phone: '555-1212' });
          await store.saveClient(client);
          const property = store.newProperty({ clientId: client.id, address: '123 Verify St', city: 'Brooksville', zip: '34601' });
          await store.saveProperty(property);
          const inspection = await store.newInspection({ clientId: client.id, propertyId: property.id, fee: '350' });
          await store.saveInspection(inspection);
          return inspection.id;
        })()
        """
        r = evaluate(ws, setup, await_promise=True, timeout=10)
        inspection_id = r.get("result", {}).get("result", {}).get("value")
        print("inspection:", inspection_id)

        # ---- settings page ----
        ws.call("Runtime.evaluate", {"expression": "location.hash = '#/settings'"})
        time.sleep(1.5)
        dump = """
        JSON.stringify({
          hasObjectObject: document.getElementById('view').innerHTML.includes('[object Object]'),
          hasEscapedTag: document.getElementById('view').innerHTML.includes('&lt;button'),
          emailCardCount: document.querySelectorAll('[data-email-subject]').length,
          agreementTextareaLen: document.querySelector('[data-k="agreementTemplate"]')?.value.length || 0
        })
        """
        r2 = evaluate(ws, dump, timeout=5)
        print("---- settings dump ----")
        print(json.dumps(json.loads(r2["result"]["result"]["value"]), indent=2))

        # ---- agreement page ----
        ws.call("Runtime.evaluate", {"expression": f"location.hash = '#/inspection/{inspection_id}/agreement'"})
        time.sleep(1.5)
        dump2 = """
        JSON.stringify({
          hasObjectObject: document.getElementById('view').innerHTML.includes('[object Object]'),
          hasEscapedTag: document.getElementById('view').innerHTML.includes('&lt;strong') || document.getElementById('view').innerHTML.includes('&lt;button'),
          agreementTextLen: document.querySelector('.agreement-text')?.innerText.length || 0,
          mergedAddressPresent: document.querySelector('.agreement-text')?.innerText.includes('123 Verify St') || false,
          sigPadCount: document.querySelectorAll('canvas.sigpad').length
        })
        """
        r3 = evaluate(ws, dump2, timeout=5)
        print("---- agreement dump ----")
        print(json.dumps(json.loads(r3["result"]["result"]["value"]), indent=2))

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
