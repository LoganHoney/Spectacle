"""Verifies the built fillable Wind Mit PDF: enumerates all fields/types/radio
options, then actually fills a representative sample of values and re-reads
them back to confirm nothing collided or landed on the wrong widget.
"""
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache  # noqa: E402


def run_eval(ws, expr, timeout=25):
    eval_id = ws.call("Runtime.evaluate", {"expression": expr, "awaitPromise": True, "returnByValue": True})
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = ws.recv_frame(timeout=0.5)
        if msg == "TIMEOUT" or msg is None:
            continue
        if msg.get("id") == eval_id:
            return msg
    return None


def run_eval_retry(ws, expr, timeout=20, attempts=6):
    r = None
    for _ in range(attempts):
        r = run_eval(ws, expr, timeout)
        if r and not r.get('result', {}).get('exceptionDetails'):
            return r
        time.sleep(1.5)
    return r


def load_script(ws, src):
    expr = f"""
    new Promise((resolve, reject) => {{
      const s = document.createElement('script');
      s.src = '{src}';
      s.onload = () => resolve('loaded');
      s.onerror = () => reject(new Error('load error: {src}'));
      document.head.appendChild(s);
    }})
    """
    return run_eval_retry(ws, expr, 20)


def main():
    proc = start_edge()
    try:
        ws_url = get_ws_url()
        ws = WS(ws_url)
        disable_cache(ws)
        ws.call("Runtime.enable")
        ws.call("Page.enable")
        ws.call("Page.navigate", {"url": "http://127.0.0.1:8420/index.html"})
        time.sleep(4)

        print("load pdf-lib:", json.dumps(load_script(ws, '/tools/_formcheck/pdf-lib.min.js')))

        expr = """
        (async () => {
          const xhr = new XMLHttpRequest();
          const bytes = await new Promise((resolve, reject) => {
            xhr.open('GET', '/tools/_formcheck/oir-b1-1802-fillable.pdf', true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => resolve(xhr.response);
            xhr.onerror = () => reject(new Error('xhr error'));
            xhr.send();
          });
          const { PDFDocument } = window.PDFLib;
          const doc = await PDFDocument.load(bytes);
          const form = doc.getForm();
          const fields = form.getFields();
          const byType = {};
          const radioOptionCounts = {};
          const names = [];
          for (const f of fields) {
            const t = f.constructor.name;
            byType[t] = (byType[t] || 0) + 1;
            names.push(f.getName());
            if (t === 'PDFRadioGroup') radioOptionCounts[f.getName()] = f.getOptions();
          }

          // Fill a representative sample and read back.
          const errors = [];
          try { form.getTextField('owner_name').setText('Jane Test Owner'); } catch (e) { errors.push('owner_name: ' + e.message); }
          try { form.getTextField('owner_year_of_home').setText('1997'); } catch (e) { errors.push('owner_year_of_home: ' + e.message); }
          try { form.getRadioGroup('q1_answer').select('B'); } catch (e) { errors.push('q1_answer: ' + e.message); }
          try { form.getRadioGroup('q2_answer').select('Region 2'); } catch (e) { errors.push('q2_answer: ' + e.message); }
          try { form.getCheckBox('q4_inuse_Asphalt/Fiberglass Shingle').check(); } catch (e) { errors.push('q4_inuse: ' + e.message); }
          try { form.getRadioGroup('q5_answer').select('C'); } catch (e) { errors.push('q5_answer: ' + e.message); }
          try { form.getRadioGroup('q6_answer').select('B'); } catch (e) { errors.push('q6_answer: ' + e.message); }
          try { form.getCheckBox('q6_min_2').check(); } catch (e) { errors.push('q6_min_2: ' + e.message); }
          try { form.getRadioGroup('q7_answer').select('A'); } catch (e) { errors.push('q7_answer: ' + e.message); }
          try { form.getRadioGroup('q9_answer').select('X'); } catch (e) { errors.push('q9_answer: ' + e.message); }
          try { form.getRadioGroup('insp_qualification').select('home_inspector'); } catch (e) { errors.push('insp_qualification: ' + e.message); }

          const readback = {
            owner_name: form.getTextField('owner_name').getText(),
            q1_answer: form.getRadioGroup('q1_answer').getSelected(),
            q2_answer: form.getRadioGroup('q2_answer').getSelected(),
            q5_answer: form.getRadioGroup('q5_answer').getSelected(),
            q6_answer: form.getRadioGroup('q6_answer').getSelected(),
            q6_min_2: form.getCheckBox('q6_min_2').isChecked(),
            q7_answer: form.getRadioGroup('q7_answer').getSelected(),
            q9_answer: form.getRadioGroup('q9_answer').getSelected(),
            insp_qualification: form.getRadioGroup('insp_qualification').getSelected(),
          };

          return JSON.stringify({
            ok: true, count: fields.length, byType, radioOptionCounts, errors, readback,
            allNames: names,
          });
        })()
        """
        result = run_eval_retry(ws, expr, 30)
        try:
            val = json.loads(result['result']['result']['value'])
        except Exception as e:
            print("PARSE FAILED:", e)
            print(json.dumps(result, indent=2)[:3000])
            return
        with open(r'C:\Users\rockp\AppData\Local\Temp\formcheck\verify_result.json', 'w', encoding='utf-8') as f:
            json.dump(val, f, indent=2)
        print("count:", val['count'])
        print("byType:", val['byType'])
        print("errors:", val['errors'])
        print("readback:", json.dumps(val['readback'], indent=2))
        print("radioOptionCounts:", json.dumps(val['radioOptionCounts'], indent=2))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
