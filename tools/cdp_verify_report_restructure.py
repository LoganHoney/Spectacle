"""Verifies the restructured main report (render.js) end-to-end in a real
browser context: builds a synthetic inspection using the real template.js
tag wiring, calls the real renderFullReport(), and checks the new
Cover -> Executive Summary -> Letter -> TOC -> Introduction ordering, the
verbatim Introduction text, and the emergency-controls tag lookups.
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
    const master = await tpl.defaultTemplate();
    const clone = tpl.cloneTemplate(master);
    function findByTag(t) { for (const s of clone.sections) for (const it of s.items) if (it.tag === t) return it; return null; }
    const meterItem = findByTag('elec_meter_location');
    const panelItem = findByTag('elec_panel_location');
    const waterItem = findByTag('water_shutoff_location');
    const data = {};
    if (meterItem) data[meterItem.id] = { value: 'Outside, right side of the building' };
    if (panelItem) data[panelItem.id] = { value: 'Garage' };
    if (waterItem) data[waterItem.id] = { value: 'At the well' };
    const inspection = {
      id: 'cdptest', clientId: '', propertyId: '', template: clone, data,
      inspectedAt: '2026-08-25', scheduledAt: '2026-08-25', inspectorName: 'Logan Honey',
      weather: 'Sunny', tempF: '85', summaryNote: 'Overall in good condition.',
      forms: {},
    };
    const client = { name: 'Test Client' };
    const property = { address: '123 Test St', city: 'Brooksville', state: 'FL', zip: '34601', yearBuilt: '2015' };
    const settings = { companyName: 'Hernando Inspections', inspectorName: 'Logan Honey', inspectorTitle: 'Owner', savedSignature: '', reportFooter: 'Footer text' };
    const render = await import('/js/report/render.js');
    const html = await render.renderFullReport({ inspection, client, property, settings, jobContacts: [] }, () => '');

    const iExec = html.indexOf('Executive Summary');
    const iDear = html.indexOf('Dear Test Client');
    const iToc = html.indexOf('Table of Contents');
    const iIntroH = html.indexOf('id="sec-introduction"');
    const iEmerg = html.indexOf('id="sec-locations-of-emergency-controls"');
    const iEnv = html.indexOf('id="sec-environmental-concerns"');
    const iInspReport = html.indexOf('id="sec-inspection-report"');
    const iConclusion = html.indexOf('id="sec-conclusion"');

    return JSON.stringify({
      ok: true,
      meterTagFound: !!meterItem, panelTagFound: !!panelItem, waterTagFound: !!waterItem,
      hasLetter: html.includes('Dear Test Client'),
      hasIntroVerbatim: html.includes('We have inspected the major structural components and mechanical systems'),
      hasEnvVerbatim: html.includes('Environmental issues include but are not limited to radon'),
      hasMeterValue: html.includes('Outside, right side of the building'),
      hasPanelValue: html.includes('main electrical service panel is located at: Garage'),
      hasDisconnect: html.includes('main disconnect is incorporated into the electrical service panel'),
      hasWaterValue: html.includes('domestic water supply main shut-off is located at: At the well'),
      hasAge: html.includes('approximately 11 years old'),
      hasWeather: html.includes('Temperature: Approximately 85 degrees') && html.includes('weather was sunny'),
      order: { iExec, iDear, iToc, iIntroH, iInspReport, iConclusion, iEmerg, iEnv },
      orderOk: iExec >= 0 && iDear > iExec && iToc > iDear && iIntroH > iToc && iInspReport > iIntroH
        && iConclusion > iInspReport && iEmerg > iConclusion && iEnv > iEmerg,
      len: html.length,
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

        # Wait for the app to finish booting before we import its modules.
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
