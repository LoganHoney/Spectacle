"""Verifies the new official-form-styled 4-Point / Wind Mitigation renderer
in a real browser context: calls the real renderFormReport() for both forms
with representative filled data and checks that checkboxes, tables, and
option text render correctly (not just a generic label/value dump).
"""
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache, URL  # noqa: E402

JS = r"""
(async () => {
  try {
    const tpl = await import('/js/report/template.js');
    const render = await import('/js/report/render.js');
    const master = await tpl.defaultTemplate();
    const clone = tpl.cloneTemplate(master);

    const inspection = {
      id: 'cdptest2', clientId: '', propertyId: '', template: clone, data: {},
      inspectedAt: '2026-08-25', scheduledAt: '2026-08-25', inspectorName: 'Logan Honey',
      forms: {
        fourpoint: {
          owner_name: 'Test Owner', policy_no: 'POL123', address: '123 Test St', year_built: 1997,
          inspection_date: '2026-08-25',
          photo_reqs: ['Dwelling: each side', 'Roof: each slope'],
          elec_main_type: 'Circuit breaker', elec_main_amps: 200, elec_main_sufficient: 'Yes',
          elec_hazards: ['Double taps', 'Corrosion'],
          elec_condition: 'Satisfactory',
          plumb_tprv: 'Yes', plumb_wh_location: 'Garage',
          plumb_fixtures: { Dishwasher: { sat: true }, Toilets: { sat: true }, Sinks: { unsat: true } },
          plumb_pipe_types: ['Copper', 'PEX'],
          roof_p_covering: 'Asphalt / Fiberglass Shingle', roof_p_age: 9, roof_p_condition: 'Satisfactory',
          roof_p_damage: ['Cupping/curling'],
          insp_signature: '', insp_title: 'Inspector', insp_license_no: 'HI#13924',
        },
        windmit: {
          owner_name: 'Test Owner', address: '123 Test St', year_of_home: 1997,
          q1_answer: 'B', q1_year_built: 1997,
          q2_answer: 'Region 2',
          q3_answer: '≥ 6:12',
          q4_table: { 'Asphalt/Fiberglass Shingle': { inuse: true, year: '2017' } },
          q4_2_answer: 'A',
          q5_answer: 'C',
          q6_answer: 'B', q6_min_conditions: ['Single-strap connector wraps over truss/rafter, secured with ≥3 nails each side, free of visible severe corrosion'],
          q7_answer: 'A', q7_nonhip_len: 9, q7_perimeter: 120,
          q8_answer: 'A', q8_methods: ['Spray foam products along rafter deck intersections and panel joints'],
          q9_table: { 'X — No windborne debris protection': { win_entry: true } },
          q9_answer: 'X',
          insp_name: 'Logan Honey', insp_license_no: 'HI#13924', insp_qualification: 'home_inspector',
        },
      },
    };
    const client = { name: 'Test Client' };
    const property = { address: '123 Test St', city: 'Brooksville', state: 'FL', zip: '34601', yearBuilt: '1997' };
    const settings = { companyName: 'Hernando Inspections', inspectorName: 'Logan Honey', inspectorTitle: 'Owner', savedSignature: '', reportFooter: '' };

    const fpHtml = await render.renderFormReport({ inspection, client, property, settings, jobContacts: [] }, 'fourpoint', () => '');
    const wmHtml = await render.renderFormReport({ inspection, client, property, settings, jobContacts: [] }, 'windmit', () => '');

    function checks(html, label) {
      return {
        len: html.length,
        hasCheckboxes: html.includes('wf-cb'),
        hasCheckedBoxes: (html.match(/wf-cb on/g) || []).length,
        hasSectionBoxes: html.includes('wf-section'),
        hasTable: html.includes('wf-table'),
        hasOwnerName: html.includes('Test Owner'),
      };
    }

    return JSON.stringify({
      ok: true,
      fourpoint: {
        ...checks(fpHtml),
        hasTitle: fpHtml.includes('4-Point Inspection Report'),
        hasElecHazard: fpHtml.includes('Double taps'),
        hasRoofCovering: fpHtml.includes('Asphalt / Fiberglass Shingle'),
        hasFixturesTable: fpHtml.includes('Dishwasher') && fpHtml.includes('Toilets'),
      },
      windmit: {
        ...checks(wmHtml),
        hasTitle: wmHtml.includes('Uniform Mitigation Verification Inspection Form'),
        hasQ1Option: wmHtml.includes('Code in force was the FBC 2007 and later'),
        hasQ4Table: wmHtml.includes('Asphalt/Fiberglass Shingle'),
        hasQ9Table: wmHtml.includes('No windborne debris protection'),
      },
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String((e && e.stack) || e) });
  }
})()
"""


def main():
    proc = start_edge()
    try:
        ws_url = get_ws_url()
        ws = WS(ws_url)
        disable_cache(ws)
        ws.call("Runtime.enable")
        ws.call("Page.enable")
        ws.call("Page.navigate", {"url": URL})
        time.sleep(2.5)

        eval_id = ws.call("Runtime.evaluate", {
            "expression": JS,
            "awaitPromise": True,
            "returnByValue": True,
        })
        deadline = time.time() + 15
        result = None
        while time.time() < deadline:
            msg = ws.recv_frame(timeout=0.5)
            if msg == "TIMEOUT" or msg is None:
                continue
            if msg.get("id") == eval_id:
                result = msg
                break
        print(json.dumps(result, indent=2) if result else "no response")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
