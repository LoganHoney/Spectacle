"""Verifies buildRoofCertOfficialPdf() end-to-end: general info, both roof
tabs (predominant/secondary) including damage checkgroups and the Yes/No
radio fields, additional comments concatenation, and certification fields.
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
    "owner_name": "Jane Homeowner",
    "policy_no": "RC-4242",
    "address": "789 Roof Lane",
    "inspection_date": "2026-09-05",

    "roof_p_covering": "Concrete / Clay Tile",
    "roof_s_covering": "None",
    "roof_p_age": "15",
    "roof_p_remaining": "10+ years",
    "roof_p_permit_date": "2011-04-01",
    "roof_p_update_type": "Partial replacement",
    "roof_p_update_pct": "25",
    "roof_p_condition": "Satisfactory",
    "roof_s_condition": "Unsatisfactory",
    "roof_p_damage": ["Cracking", "Exposed felt"],
    "roof_s_damage": ["Visible hail damage"],
    "roof_damage_explain": "Predominant tile roof shows minor cracking near valleys",
    "roof_p_leaks": "No",
    "roof_s_leaks": "Yes",
    "roof_leaks_explain": "N/A",
    "roof_p_attic_evidence": "No",
    "roof_p_ceiling_evidence": "No",

    "additional_comments": "Roof in serviceable condition overall.",

    "insp_title": "Licensed Roofing Contractor",
    "insp_license_no": "CCC1234567",
    "insp_date": "2026-09-05",
    "insp_company": "Hernando Inspections LLC",
    "insp_license_type": "General Contractor",
    "insp_phone": "352-555-0177",
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

        with open(ROOT_DIR + r"\js\vendor\pdf-lib.min.js", "rb") as f:
            pdf_lib_b64 = base64.b64encode(f.read()).decode()
        with open(ROOT_DIR + r"\js\vendor\forms\roofcert-fillable.pdf", "rb") as f:
            master_b64 = base64.b64encode(f.read()).decode()

        r = evaluate(ws, f"""
            (async () => {{
              const localFiles = {{
                'js/vendor/pdf-lib.min.js': {{ b64: {json.dumps(pdf_lib_b64)}, type: 'text/javascript' }},
                'js/vendor/forms/roofcert-fillable.pdf': {{ b64: {json.dumps(master_b64)}, type: 'application/pdf' }},
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

              const {{ buildRoofCertOfficialPdf }} = await import('./js/report/roofCertPdfFill.js');
              const values = {json.dumps(TEST_VALUES)};
              const blob = await buildRoofCertOfficialPdf(values);
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

              const out = {
                owner_name: getText('ApplicantInsured Name'),
                policy_no: getText('ApplicationPolicy'),
                address: getText('Address Inspected'),
                roof_p_covering: getText('Covering material'),
                roof_p_remaining: getText('Remaining useful life years'),
                roof_p_update_partial: isChecked('Partial replacement'),
                roof_p_update_pct: getText('of replacement'),
                roof_p_condition_sat: isChecked('Satisfactory'),
                roof_s_condition_unsat: isChecked('Unsatisfactory explain below_2'),
                roof_p_damage_cracking: isChecked('Cracking'),
                roof_p_damage_felt: isChecked('Exposed felt'),
                roof_s_damage_hail: isChecked('Visible hail damage_2'),
                roof_p_leaks: (() => { try { return form.getRadioGroup('Any visible signs of leaks').getSelected(); } catch(e) { return '<err>'; } })(),
                roof_s_leaks: (() => { try { return form.getRadioGroup('Any visible signs of leaks_2').getSelected(); } catch(e) { return '<err>'; } })(),
                additional_comments: getText('Additional CommentsObservations use additional pages as needed'),
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
