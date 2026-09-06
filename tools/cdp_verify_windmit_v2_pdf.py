"""Verifies buildWindMitOfficialPdf() end-to-end against the new v2 master:
owner info, Q1's per-option year/permit-date split, Q2/Q3 single checkboxes,
Q4's per-row table with date-splitting, Q5/Q6 answers + other-desc +
min-conditions checkgroup, Q7 measurements, Q8 methods checkgroup, Q9's full
opening-protection grid + answer + sub-qualifier, inspector info +
qualification, and signature drawing.
"""
import base64
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache  # noqa: E402

URL = "http://127.0.0.1:8420/index.html"
ROOT_DIR = __file__.rsplit("\\tools\\", 1)[0]

TEST_VALUES = {
    "inspection_date": "2026-09-05",
    "owner_name": "Jane Homeowner",
    "contact_person": "John Agent",
    "address": "456 Test Ave",
    "home_phone": "352-555-0111",
    "city": "Brooksville",
    "zip": "34601",
    "work_phone": "352-555-0122",
    "county": "Hernando",
    "cell_phone": "352-555-0133",
    "insurance_co": "Acme Insurance",
    "policy_no": "WM-9999",
    "year_of_home": "2005",
    "stories": "2",
    "email": "jane@example.com",

    "q1_answer": "B",
    "q1_year_built": "2007",
    "q1_permit_date": "2007-03-15",

    "q2_answer": "Region 2",
    "q3_answer": "< 6:12",

    "q4_table": {
        "Asphalt/Fiberglass Shingle": {"inuse": True, "permit": "2010-06-01", "approval": "FL12345", "year": "2010"},
        "Metal": {"inuse": True, "approval": "FL99999", "year": "2018"},
    },
    "q4_2_answer": "A",

    "q5_answer": "F",
    "q5_other_desc": "Adhesive foam application, no nails",

    "q6_answer": "C",
    "q6_min_conditions": [
        "Single-strap connector wraps over truss/rafter, secured with ≥3 nails each side, free of visible severe corrosion",
    ],

    "q7_answer": "A",
    "q7_nonhip_len": "12",
    "q7_perimeter": "160",

    "q8_answer": "A",
    "q8_methods": [
        "Fully adhered polymer-modified bitumen underlayment (ASTM D1970)",
        "Entire roof deck underside covered",
    ],

    "q9_table": {
        "A — Cyclic pressure & 9 lb. large missile (4.5 lb. skylights)": {"win_entry": True, "garage_glazed": True},
        "N/A — no openings of this type": {"skylights": True},
    },
    "q9_answer": "A",
    "q9_sub": "1",

    "insp_name": "Bob Inspector",
    "insp_license_no": "HI7654321",
    "insp_company": "Hernando Inspections LLC",
    "insp_phone": "352-555-0199",
    "insp_qualification": "home_inspector",
    "insp_date": "2026-09-05",
    "owner_sign_date": "2026-09-05",
    "insp_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "owner_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
}


def evaluate(ws, expression, await_promise=True, timeout=60):
    mid = ws.call("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": await_promise})
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = ws.recv_frame(timeout=0.5)
        if msg == "TIMEOUT" or msg is None:
            continue
        if msg.get("id") == mid:
            return msg
    return {"error": "timeout"}


def drain_console(ws, seconds=1.0):
    end = time.time() + seconds
    out = []
    while time.time() < end:
        msg = ws.recv_frame(timeout=0.3)
        if msg == "TIMEOUT" or msg is None:
            continue
        m = msg.get("method")
        if m == "Runtime.exceptionThrown":
            ex = msg["params"]["exceptionDetails"]
            out.append(f"[EXCEPTION] {ex.get('exception', {}).get('description') or ex.get('text')}")
        elif m == "Runtime.consoleAPICalled":
            p = msg["params"]
            args = [a.get("value", a.get("description", "")) for a in p.get("args", [])]
            out.append(f"[console.{p['type']}] " + " ".join(str(a) for a in args))
    return out


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
        print("boot errors:", drain_console(ws, 1.0))

        # pdf-lib.min.js and the target master both fetched via network in
        # this environment have been intermittently flaky (documented
        # elsewhere this session) — patch window.fetch to serve them from
        # locally-read bytes so this test exercises the real
        # buildWindMitOfficialPdf() unmodified, without depending on network
        # reliability for these two large files.
        with open(ROOT_DIR + r"\js\vendor\pdf-lib.min.js", "rb") as f:
            pdf_lib_b64 = base64.b64encode(f.read()).decode()
        with open(ROOT_DIR + r"\js\vendor\forms\oir-b1-1802-fillable-v2.pdf", "rb") as f:
            master_b64 = base64.b64encode(f.read()).decode()

        r = evaluate(ws, f"""
            (async () => {{
              const localFiles = {{
                'js/vendor/pdf-lib.min.js': {{ b64: {json.dumps(pdf_lib_b64)}, type: 'text/javascript' }},
                'js/vendor/forms/oir-b1-1802-fillable-v2.pdf': {{ b64: {json.dumps(master_b64)}, type: 'application/pdf' }},
              }};
              const realFetch = window.fetch.bind(window);
              window.fetch = (url, ...rest) => {{
                const key = Object.keys(localFiles).find((k) => String(url).endsWith(k));
                if (!key) return realFetch(url, ...rest);
                const {{ b64, type }} = localFiles[key];
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                return Promise.resolve(new Response(bytes, {{ status: 200, headers: {{ 'Content-Type': type }} }}));
              }};

              const {{ buildWindMitOfficialPdf }} = await import('./js/report/windmitPdfFill.js');
              const values = {json.dumps(TEST_VALUES)};
              const blob = await buildWindMitOfficialPdf(values);
              const bytes = new Uint8Array(await blob.arrayBuffer());
              let binary = '';
              for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
              window.__builtPdfB64 = btoa(binary);
              return blob.size;
            }})()
        """, timeout=45)
        val = r.get("result", {}).get("result", {}).get("value")
        exc = r.get("result", {}).get("exceptionDetails")
        print("build result value:", val)
        if exc:
            print("build EXCEPTION:", json.dumps(exc, indent=2)[:2500])
        print("build console:", drain_console(ws, 0.5))

        checks_expr = """
            (async () => {
              const { PDFDocument } = window.PDFLib;
              const binary = atob(window.__builtPdfB64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              const doc = await PDFDocument.load(bytes);
              const form = doc.getForm();

              const getText = (n) => { try { return form.getTextField(n).getText(); } catch (e) { return `<err:${e.message}>`; } };
              const isChecked = (n) => { try { return form.getCheckBox(n).isChecked(); } catch (e) { return `<err:${e.message}>`; } };
              const getDA = (n) => { try { return form.getTextField(n).acroField.getDefaultAppearance(); } catch (e) { return `<err:${e.message}>`; } };

              const out = {
                owner_name: getText('Owner Name'),
                address: getText('Address'),
                q1_answer_B: isChecked('B Code in force at time of permit application was the FBC 2007 and later Year Built'),
                q1_answer_A_notChecked: isChecked('A Code in force at time of permit application was the FBC 2001  2004 Year Built'),
                q1_year_built_B: getText('For homes built in 20072008'),
                q1_permit_mm: getText('provide a permit application with a date after 1282006 Building Permit Application Date MMDDYYYY'),
                q1_permit_dd: getText('undefined_3'),
                q1_permit_yyyy: getText('undefined_4'),
                q2_region2: isChecked('Region 2 130 mph  139 mph'),
                q3_lessThan: isChecked('Less than  612'),
                q4_asphalt_inuse: isChecked('AsphaltFiberglass'),
                q4_asphalt_mm: getText('Application Date'),
                q4_asphalt_dd: getText('undefined_6'),
                q4_asphalt_yyyy: getText('undefined_7'),
                q4_asphalt_approval: getText('Approval 1'),
                q4_metal_inuse: isChecked('Metal'),
                q4_metal_approval: getText('2_2'),
                q4_2_answer_A: isChecked('A All roof coverings listed above meet the FBC with a FBC or MiamiDade Product Approval listing current at the time of installation'),
                q5_answer_F: isChecked('F Other'),
                q5_other_desc: getText('all panel joints etc'),
                q6_answer_C: isChecked('C Single Wraps'),
                q6_min_condition_2: isChecked('2 Metal connectors consisting of a single strap that wraps over the trussrafter are secured to the side of the wall andor'),
                q7_answer_A: isChecked('A Hip Roof'),
                q7_nonhip_len: getText('Total length of nonhip features'),
                q7_perimeter: getText('feet Total roof system perimeter'),
                q8_answer_A: isChecked('A Sealed Roof Deck also called SWR'),
                q8_method_1: isChecked('Fully adhered polymermodified bitumen roofing underlayment complying with ASTM D1970'),
                q8_method_5: isChecked('check here if entire roof deck underside covered'),
                q9_grid_A_winentry: getText('Windows or Entry DoorsVerified cyclic pressure  large missile 9 lb for windows doors45 lb for skylights'),
                q9_grid_A_garageglazed: getText('Garage DoorsVerified cyclic pressure  large missile 9 lb for windows doors45 lb for skylights'),
                q9_grid_NA_skylights: getText('SkylightsNot applicable  there are no openings of this type on the structure'),
                q9_answer_A: isChecked('A Exterior Openings Cyclic Pressure and 9lb Large Missile 45 lb for skylights only All glazed openings are protected at a'),
                q9_sub_A1: isChecked('A1 All nonglazed openings classified as A in the table above or no nonglazed openings exist'),
                insp_name: getText('Qualified Inspector Name'),
                insp_license_type: getText('License Type'),
                insp_qualification_home: isChecked('Home inspector licensed under Section 4688314 Florida Statutes who has completed the statutory number of hours of hurricane mitigation training'),
                print_name_I: getText('I'),
                da_ownerName: getDA('Owner Name'),
                da_q9grid: getDA('Windows or Entry DoorsVerified cyclic pressure  large missile 9 lb for windows doors45 lb for skylights'),
              };
              return JSON.stringify(out, null, 2);
            })()
        """
        r = evaluate(ws, checks_expr, timeout=30)
        val = r.get("result", {}).get("result", {}).get("value")
        print(val if isinstance(val, str) else json.dumps(r, indent=2)[:3000])
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
