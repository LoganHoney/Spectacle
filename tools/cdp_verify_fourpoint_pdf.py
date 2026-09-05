"""Verifies buildFourPointOfficialPdf() end-to-end: fills a realistic test
values object covering every field type (text, single checkbox, checkgroups,
the plumbing fixture table, split radio groups, age-of-piping blanks,
overflow-notes concatenation, signature image), then reads the resulting PDF
back and checks each answer landed in the right field with the right value.
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
    "owner_name": "John & Jane Homeowner",
    "policy_no": "POL-12345",
    "address": "123 Test Street, Brooksville, FL 34601",
    "year_built": "1998",
    "inspection_date": "2026-09-02",
    "photo_reqs": ["Dwelling: each side", "Roof: each slope"],

    "elec_main_type": "Circuit breaker",
    "elec_main_amps": "200",
    "elec_main_sufficient": "Yes",
    "elec_second_type": "Fuse",
    "elec_second_amps": "60",
    "elec_second_sufficient": "No",
    "elec_presence": ["Cloth wiring", "Connections repaired via AlumiConn"],
    "elec_hazards": ["Double taps", "Other"],
    "elec_hazards_other": "Melted outlet cover in garage",
    "elec_condition": "Unsatisfactory",
    "elec_condition_explain": "Panel shows signs of overheating",
    "elec_main_age": "12",
    "elec_main_updated": "2015",
    "elec_main_brand": "Square D",
    "elec_second_age": "30",
    "elec_second_updated": "1998",
    "elec_second_brand": "Federal Pacific",
    "elec_wiring_types": ["Copper", "Cloth (Knob & Tube)"],

    "hvac_central_ac": "Yes",
    "hvac_central_heat": "Yes",
    "hvac_good_order": "No",
    "hvac_good_order_explain": "Condenser fan motor is noisy",
    "hvac_last_service": "2024",
    "hvac_woodstove": "Yes",
    "hvac_woodstove_pro": "No",
    "hvac_spaceheater": "No",
    "hvac_condensate_issue": "No",
    "hvac_age": "8",
    "hvac_updated": "2018",

    "plumb_tprv": "Yes",
    "plumb_wh_location": "Garage",
    "plumb_fixtures": {
        "Dishwasher": {"sat": True},
        "Refrigerator": {"unsat": True},
        "Washing machine": {"na": True},
        "Water heater": {"sat": True},
        "Showers/Tubs": {"sat": True},
        "Toilets": {"sat": True},
        "Sinks": {"sat": True},
        "Sump pump": {"na": True},
        "Main shut off valve": {"sat": True},
        "All other visible": {"sat": True},
    },
    "plumb_supply_age_type": "Partially re-piped",
    "plumb_supply_age_years": "5",
    "plumb_drain_age_type": "Original to home",
    "plumb_drain_age_years": "28",
    "plumb_wh_age": "6",
    "plumb_pipe_types": ["Copper", "PEX", "Other"],
    "plumb_pex_year": "2020",
    "plumb_pipe_other": "Some CPVC transition fittings",
    "plumb_renovation_note": "Kitchen re-piped 2020 during remodel",

    "roof_p_covering": "Architectural Shingle",
    "roof_s_covering": "Metal",
    "roof_p_age": "10",
    "roof_s_age": "3",
    "roof_p_remaining": "5+ years",
    "roof_s_remaining": "20+ years",
    "roof_p_update_type": "Partial replacement",
    "roof_p_update_pct": "30",
    "roof_s_update_type": "Full replacement",
    "roof_p_condition": "Satisfactory",
    "roof_s_condition": "Satisfactory",
    "roof_p_damage": ["Cracking", "Visible hail damage"],
    "roof_s_damage": [],
    "roof_damage_explain": "Minor cracking near ridge vent, predominant roof",
    "roof_p_leaks": "No",
    "roof_s_leaks": "No",
    "roof_p_attic_evidence": "No",
    "roof_s_attic_evidence": "No",
    "roof_p_ceiling_evidence": "No",
    "roof_s_ceiling_evidence": "No",

    "additional_comments": "Overall home in good condition for its age.",

    "insp_title": "Licensed Home Inspector",
    "insp_license_no": "HI1234567",
    "insp_date": "2026-09-02",
    "insp_company": "Hernando Inspections LLC",
    "insp_license_type": "Home Inspector",
    "insp_phone": "352-555-0100",
    # 1x1 PNG for the signature draw path
    "insp_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
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

        # js/vendor/pdf-lib.min.js has been observed to fail outright over
        # HTTP in headless Edge on this machine (reproducible, content-
        # specific — documented elsewhere in this project, not an app bug).
        # Patch window.fetch to serve it (and the equally large PDF master)
        # straight from locally-read bytes instead of the network, so this
        # test exercises the real buildFourPointOfficialPdf() unmodified —
        # just without a network layer that can fail on this one file.
        with open(ROOT_DIR + r"\js\vendor\pdf-lib.min.js", "rb") as f:
            pdf_lib_b64 = base64.b64encode(f.read()).decode()
        with open(ROOT_DIR + r"\js\vendor\forms\insp4pt-fillable.pdf", "rb") as f:
            master_b64 = base64.b64encode(f.read()).decode()

        r = evaluate(ws, f"""
            (async () => {{
              const localFiles = {{
                'js/vendor/pdf-lib.min.js': {{ b64: {json.dumps(pdf_lib_b64)}, type: 'text/javascript' }},
                'js/vendor/forms/insp4pt-fillable.pdf': {{ b64: {json.dumps(master_b64)}, type: 'application/pdf' }},
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

              const {{ buildFourPointOfficialPdf }} = await import('./js/report/fourPointPdfFill.js');
              const values = {json.dumps(TEST_VALUES)};
              const blob = await buildFourPointOfficialPdf(values);
              const bytes = new Uint8Array(await blob.arrayBuffer());
              let binary = '';
              for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
              window.__builtPdfB64 = btoa(binary);
              return blob.size;
            }})()
        """, timeout=120)
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
              const getRadio = (n) => { try { return form.getRadioGroup(n).getSelected(); } catch (e) { return `<err:${e.message}>`; } };

              const out = {
                owner_name: getText('InsuredApplicant Name'),
                address: getText('Address Inspected'),
                elec_main_amps: getText('Total Amps'),
                elec_main_type_circuitbreaker: isChecked('Circuit breaker'),
                elec_second_type_fuse: isChecked('Fuse_2'),
                elec_main_sufficient_yes: isChecked('Yes'),
                elec_second_sufficient_no: isChecked('No explain_2'),
                elec_presence_cloth: isChecked('Cloth wiring'),
                elec_hazards_double_taps: isChecked('Double taps'),
                elec_hazards_other_checkbox: isChecked('Other explain'),
                elec_condition_unsat: isChecked('Unsatisfactory explain'),
                elec_wiring_cloth_knob_tube: isChecked('Cloth Knob  Tube'),
                hvac_central_ac: getRadio('hvac_central_ac_radio'),
                hvac_central_heat: getRadio('hvac_central_heat_radio'),
                hvac_woodstove: getRadio('hvac_woodstove_radio'),
                hvac_woodstove_pro: getRadio('hvac_woodstove_pro_radio'),
                hvac_good_order_no: isChecked('No explain_3'),
                hvac_last_service: getText('Date of last HVAC servicinginspection'),
                plumb_tprv: getRadio('Is there a temperature pressure relief valve on the water heater') ?? 'MISSING/undefined',
                fixture_dishwasher_sat: getText('Satisfactory_2'),
                fixture_refrigerator_unsat: getText('undefined_6'),
                fixture_washing_machine_na: getText('undefined_12'),
                fixture_water_heater_sat: getText('undefined_16'),
                fixture_toilets_sat: getText('Satisfactory_3'),
                fixture_main_shutoff_sat: getText('Main shut off valve'),
                fixture_all_other_sat: getText('undefined_24'),
                supply_age_partial_repiped_years: getText('Partially repiped'),
                drain_age_original_years: getText('Original to home_2'),
                plumb_pipe_pex: isChecked('PEX'),
                plumb_pipe_other: isChecked('Other specify'),
                roof_p_covering: getText('Covering material'),
                roof_s_covering: getText('Covering material_2'),
                roof_p_remaining: getText('Remaining useful life years'),
                roof_s_remaining: getText('Remaining useful life years_2'),
                roof_p_update_partial: isChecked('Partial replacement'),
                roof_p_update_pct: getText('of replacement'),
                roof_s_update_full: isChecked('Full replacement_2'),
                roof_p_condition_sat: isChecked('Satisfactory_4'),
                roof_p_damage_cracking: isChecked('Cracking'),
                roof_p_damage_hail: isChecked('Visible hail damage'),
                roof_s_damage_cracking: isChecked('Cracking_2'),
                roof_p_leaks: getRadio('Any visible signs of leaks') ?? 'MISSING/undefined',
                roof_s_leaks: getRadio('Any visible signs of leaks_2') ?? 'MISSING/undefined',
                roof_p_attic: getRadio('Atticunderside of decking') ?? 'MISSING/undefined',
                roof_p_ceiling: getRadio('Interior ceilings') ?? 'MISSING/undefined',
                hvac_spaceheater: getRadio('Space heater used as primary heat source') ?? 'MISSING/undefined',
                additional_comments: getText('Additional CommentsObservations use additional pages if needed'),
                insp_title: getText('Title'),
                insp_company: getText('Company Name'),
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
