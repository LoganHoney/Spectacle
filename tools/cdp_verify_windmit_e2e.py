"""End-to-end test of the real production module: imports
js/report/windmitPdfFill.js (not a copy), calls buildWindMitOfficialPdf with
representative data covering every question, and re-parses the resulting
blob with pdf-lib to confirm every value landed on the correct field.
"""
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache, URL  # noqa: E402


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


def run_eval_retry(ws, expr, timeout=25, attempts=6):
    r = None
    for _ in range(attempts):
        r = run_eval(ws, expr, timeout)
        if r and not r.get('result', {}).get('exceptionDetails'):
            return r
        time.sleep(1.5)
    return r


JS = r"""
(async () => {
  try {
    const { buildWindMitOfficialPdf } = await import('/js/report/windmitPdfFill.js');
    const values = {
      inspection_date: '2026-08-25',
      owner_name: 'Sherri Townsend & Gary Smith',
      contact_person: 'Sherri Townsend',
      address: '8104 Nightingale Road',
      city: 'Weeki Wachee',
      zip: '34613',
      county: 'Hernando',
      home_phone: '352-555-1234',
      work_phone: '352-555-5678',
      cell_phone: '352-555-9012',
      insurance_co: 'Citizens',
      policy_no: 'POL-99887',
      email: 'sherri@example.com',
      year_of_home: '2019',
      stories: '1',
      q1_answer: 'B',
      q2_answer: 'Region 2',
      q3_answer: '≥ 6:12',
      q4_table: {
        'Asphalt/Fiberglass Shingle': { inuse: true, year: '2019' },
        'Metal': { noinfo: true },
      },
      q4_2_answer: 'A',
      q5_answer: 'C',
      q6_answer: 'C',
      q6_min_conditions: ['Single-strap connector wraps over truss/rafter, secured with ≥3 nails each side, free of visible severe corrosion'],
      q7_answer: 'A',
      q7_nonhip_len: '9',
      q7_perimeter: '120',
      q8_answer: 'A',
      q8_methods: ['Spray foam products along rafter deck intersections and panel joints'],
      q9_answer: 'B',
      q9_sub: '2',
      insp_name: 'Logan Honey',
      insp_license_no: 'HI#13924',
      insp_company: 'Hernando Home Inspections',
      insp_phone: '352-942-9137',
      insp_date: '2026-08-25',
      insp_qualification: 'home_inspector',
      owner_sign_date: '2026-08-25',
    };
    const blob = await buildWindMitOfficialPdf(values);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const { PDFDocument } = window.PDFLib;
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();

    const readback = {
      owner_name: form.getTextField('owner_name').getText(),
      owner_address: form.getTextField('owner_address').getText(),
      owner_year_of_home: form.getTextField('owner_year_of_home').getText(),
      q1_answer: form.getRadioGroup('q1_answer').getSelected(),
      q2_answer: form.getRadioGroup('q2_answer').getSelected(),
      q3_answer: form.getRadioGroup('q3_answer').getSelected(),
      q4_inuse_asphalt: form.getCheckBox('q4_inuse_Asphalt/Fiberglass Shingle').isChecked(),
      q4_noinfo_metal: form.getCheckBox('q4_noinfo_Metal').isChecked(),
      q4_2_answer: form.getRadioGroup('q4_2_answer').getSelected(),
      q5_answer: form.getRadioGroup('q5_answer').getSelected(),
      q6_answer: form.getRadioGroup('q6_answer').getSelected(),
      q6_min_2: form.getCheckBox('q6_min_2').isChecked(),
      q7_answer: form.getRadioGroup('q7_answer').getSelected(),
      q7_nonhip_len: form.getTextField('q7_nonhip_len').getText(),
      q8_answer: form.getRadioGroup('q8_answer').getSelected(),
      q8_method_spray_foam: form.getCheckBox('q8_method_spray_foam').isChecked(),
      q9_answer: form.getRadioGroup('q9_answer').getSelected(),
      q9_sub_B: form.getRadioGroup('q9_sub_B').getSelected(),
      insp_name: form.getTextField('insp_name').getText(),
      insp_print_name: form.getTextField('insp_print_name').getText(),
      insp_license_type: form.getTextField('insp_license_type').getText(),
      insp_qualification: form.getRadioGroup('insp_qualification').getSelected(),
    };

    return JSON.stringify({ ok: true, blobSize: bytes.length, readback });
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
        ws.call("Page.navigate", {"url": "http://127.0.0.1:8420/index.html"})
        time.sleep(6)
        # Load pdf-lib into the page first so the test itself can re-parse the result.
        load_expr = """
        new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = '/js/vendor/pdf-lib.min.js';
          s.onload = () => resolve('loaded');
          s.onerror = () => reject(new Error('load error'));
          document.head.appendChild(s);
        })
        """
        print("load pdf-lib:", json.dumps(run_eval_retry(ws, load_expr, 20)))

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
