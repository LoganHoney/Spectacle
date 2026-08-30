"""Verifies the new "Main Inspection" section: the Checklist is no longer
listed under Insurance Forms, and the button label reflects progress
(Start/Continue/Review Inspection).
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

    const client = store.newClient({ name: 'Btn Test Client' });
    await store.saveClient(client);
    const property = store.newProperty({ clientId: client.id, address: '5 Btn St' });
    await store.saveProperty(property);
    let inspection = await store.newInspection({ clientId: client.id, propertyId: property.id, services: ['Full Home Inspection'] });
    await store.saveInspection(inspection);

    router.go(`/inspection/${inspection.id}`);
    await new Promise((r) => setTimeout(r, 800));

    function snapshot() {
      const btn = document.querySelector('a.btn.primary.wide[href$="/checklist"]');
      const insuranceHeading = [...document.querySelectorAll('h2')].find(h => h.textContent === 'Insurance Forms');
      const insuranceList = insuranceHeading ? insuranceHeading.nextElementSibling?.nextElementSibling?.nextElementSibling : null;
      const checklistInInsuranceList = insuranceList ? insuranceList.textContent.includes('Checklist') : null;
      return {
        mainInspectionHeadingExists: !![...document.querySelectorAll('h2')].find(h => h.textContent === 'Main Inspection'),
        btnText: btn ? btn.textContent.trim() : null,
        btnHref: btn ? btn.getAttribute('href') : null,
        checklistInInsuranceList,
      };
    }

    const state0 = snapshot();

    // Answer one item, re-save, re-render by re-navigating.
    const firstItem = inspection.template.sections[0].items[0];
    inspection.data[firstItem.id] = { value: 'Acceptable' };
    await store.saveInspection(inspection);
    router.go('/inspections');
    await new Promise((r) => setTimeout(r, 200));
    router.go(`/inspection/${inspection.id}`);
    await new Promise((r) => setTimeout(r, 800));
    const state1 = snapshot();

    return JSON.stringify({ ok: true, state0, state1 });
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
        result = run_eval(ws, JS, 30)
        print(json.dumps(result, indent=2))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
