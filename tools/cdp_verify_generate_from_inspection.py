"""End-to-end UI test: creates a real client/property/inspection with tagged
checklist data (roof covering, electrical panel, HVAC age) via the real
store, navigates to the inspection workspace, clicks the new "Generate
4-Point Report" button, and confirms it (a) navigated to the report page for
that form and (b) actually populated inspection.forms.fourpoint from the
checklist via crosspopulate — the real click handler, not a direct function
call.
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

    const client = store.newClient({ name: 'E2E Test Client' });
    await store.saveClient(client);
    const property = store.newProperty({ clientId: client.id, address: '1 Test Way', city: 'Brooksville', state: 'FL', zip: '34601', yearBuilt: '2015' });
    await store.saveProperty(property);
    let inspection = await store.newInspection({ clientId: client.id, propertyId: property.id, services: ['Full Home Inspection'] });

    // Tag some checklist answers the way a real inspection would have them.
    function findByTag(tpl, tag) {
      for (const s of tpl.sections) for (const it of s.items) if (it.tag === tag) return it;
      return null;
    }
    const roofCovering = findByTag(inspection.template, 'roof_covering');
    const roofAge = findByTag(inspection.template, 'roof_age');
    const panelBrand = findByTag(inspection.template, 'elec_panel_brand');
    const hvacAge = findByTag(inspection.template, 'hvac_age');
    if (roofCovering) inspection.data[roofCovering.id] = { value: 'Architectural Shingle' };
    if (roofAge) inspection.data[roofAge.id] = { value: 6 };
    if (panelBrand) inspection.data[panelBrand.id] = { value: 'Square D' };
    if (hvacAge) inspection.data[hvacAge.id] = { value: 4 };
    await store.saveInspection(inspection);

    // Navigate to the inspection workspace and let it render.
    router.go(`/inspection/${inspection.id}`);
    await new Promise((r) => setTimeout(r, 800));

    const btn = document.querySelector('[data-generate-form="fourpoint"]');
    if (!btn) return JSON.stringify({ ok: false, error: 'button not found in DOM' });
    btn.click();
    await new Promise((r) => setTimeout(r, 800));

    const afterHash = location.hash;
    const reloaded = await store.getInspection(inspection.id);
    const fp = reloaded.forms.fourpoint || {};

    return JSON.stringify({
      ok: true,
      navigatedTo: afterHash,
      fourpointKeys: Object.keys(fp).length,
      roof_p_covering: fp.roof_p_covering,
      roof_p_age: fp.roof_p_age,
      elec_main_brand: fp.elec_main_brand,
      hvac_age: fp.hvac_age,
      owner_name: fp.owner_name,
      address: fp.address,
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

        result = run_eval_retry(ws, JS, 30)
        print(json.dumps(result, indent=2))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
