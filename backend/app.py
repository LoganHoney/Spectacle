"""Hernando Inspections — remote signing backend.

The PWA is otherwise fully offline; this is the one piece that necessarily
needs a live server, because a client signing an agreement on their own
device before the inspector arrives has to hand that signature back to
someone reachable over the internet.

Storage is Upstash Redis (REST API, free tier, no expiry on the account
itself — individual records carry their own TTL so nothing accumulates
forever). The web process itself is stateless and disposable, which matters
because Render's free tier spins the instance down after 15 minutes of
inactivity and loses anything kept only in memory or on local disk.
"""
import base64
import html
import json
import os
import secrets
import time

import requests
from flask import Flask, jsonify, request, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

UPSTASH_URL = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
RECORD_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days — plenty for a document nobody signs in a month, they've moved on
REPORT_TTL_SECONDS = 60 * 60 * 24 * 90  # 90 days — a finished report/PDF may get referenced by an insurer for a while
MAX_REPORT_BYTES = 15 * 1024 * 1024  # generous for a photo-heavy report; keeps one bad upload from being disproportionate on a free Upstash tier


def _redis(command):
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        raise RuntimeError("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not configured")
    resp = requests.post(
        UPSTASH_URL, headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
        json=command, timeout=10,
    )
    resp.raise_for_status()
    return resp.json().get("result")


def record_key(token):
    return f"agreement:{token}"


def report_key(token):
    return f"report:{token}"


def save_record(token, record):
    _redis(["SET", record_key(token), json.dumps(record), "EX", str(RECORD_TTL_SECONDS)])


def load_record(token):
    raw = _redis(["GET", record_key(token)])
    return json.loads(raw) if raw else None


def delete_record(token):
    _redis(["DEL", record_key(token)])


@app.get("/")
def index():
    return jsonify({"service": "hernando-inspections-signing", "status": "ok"})


@app.get("/healthz")
def healthz():
    return jsonify({"ok": True})


# ---------------------------------------------------------------- API (called by the PWA)

@app.post("/api/agreements")
def create_agreement():
    body = request.get_json(force=True, silent=True) or {}
    required = ["agreementText"]
    missing = [f for f in required if not body.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    token = secrets.token_urlsafe(24)
    record = {
        "token": token,
        "createdAt": int(time.time() * 1000),
        "status": "pending",
        "propertyAddress": body.get("propertyAddress", ""),
        "clientName": body.get("clientName", ""),
        "companyName": body.get("companyName", ""),
        "inspectorName": body.get("inspectorName", ""),
        "agreementText": body.get("agreementText", ""),
        "customer1NamePrefill": body.get("customer1Name", ""),
        "customer2NamePrefill": body.get("customer2Name", ""),
        "customer1Name": "", "customer1Signature": "", "customer1SignedAt": None,
        "customer2Name": "", "customer2Signature": "", "customer2SignedAt": None,
    }
    save_record(token, record)
    sign_url = f"{request.url_root.rstrip('/')}/sign/{token}"
    return jsonify({"token": token, "signUrl": sign_url})


@app.get("/api/agreements/<token>/status")
def agreement_status(token):
    record = load_record(token)
    if not record:
        return jsonify({"error": "not found"}), 404
    return jsonify(record)


@app.delete("/api/agreements/<token>")
def delete_agreement(token):
    delete_record(token)
    return jsonify({"ok": True})


# ---------------------------------------------------------------- reports (finished PDF, hosted so it has a shareable link)

@app.post("/api/reports")
def create_report():
    body = request.get_json(force=True, silent=True) or {}
    data_b64 = body.get("dataBase64") or ""
    if not data_b64:
        return jsonify({"error": "Missing dataBase64"}), 400
    if len(data_b64) > MAX_REPORT_BYTES * 4 // 3 + 1024:  # base64 is ~4/3 the size of the raw bytes
        return jsonify({"error": "Report is too large to host"}), 413

    token = secrets.token_urlsafe(24)
    record = {
        "dataBase64": data_b64,
        "contentType": body.get("contentType") or "application/pdf",
        "filename": body.get("filename") or "inspection-report.pdf",
        "createdAt": int(time.time() * 1000),
    }
    _redis(["SET", report_key(token), json.dumps(record), "EX", str(REPORT_TTL_SECONDS)])
    view_url = f"{request.url_root.rstrip('/')}/report/{token}"
    return jsonify({"token": token, "viewUrl": view_url})


@app.get("/report/<token>")
def view_report(token):
    raw = _redis(["GET", report_key(token)])
    if not raw:
        return Response(NOT_FOUND_HTML, mimetype="text/html", status=404)
    record = json.loads(raw)
    try:
        data = base64.b64decode(record["dataBase64"])
    except Exception:
        return Response(NOT_FOUND_HTML, mimetype="text/html", status=404)
    resp = Response(data, mimetype=record.get("contentType", "application/pdf"))
    resp.headers["Content-Disposition"] = f'inline; filename="{record.get("filename", "report.pdf")}"'
    return resp


# ---------------------------------------------------------------- signing page (opened by the client)

@app.get("/sign/<token>")
def sign_page(token):
    record = load_record(token)
    if not record:
        return Response(NOT_FOUND_HTML, mimetype="text/html", status=404)
    if record["status"] == "signed":
        return Response(ALREADY_SIGNED_HTML, mimetype="text/html")
    return Response(render_sign_page(record), mimetype="text/html")


@app.post("/sign/<token>")
def submit_signature(token):
    record = load_record(token)
    if not record:
        return jsonify({"error": "not found"}), 404
    if record["status"] == "signed":
        return jsonify({"error": "already signed"}), 409

    body = request.get_json(force=True, silent=True) or {}
    if not body.get("customer1Signature") or not body.get("customer1Name"):
        return jsonify({"error": "A name and signature are required"}), 400

    now = int(time.time() * 1000)
    record["status"] = "signed"
    record["customer1Name"] = body.get("customer1Name", "")
    record["customer1Signature"] = body.get("customer1Signature", "")
    record["customer1SignedAt"] = now
    if body.get("customer2Signature"):
        record["customer2Name"] = body.get("customer2Name", "")
        record["customer2Signature"] = body.get("customer2Signature", "")
        record["customer2SignedAt"] = now
    save_record(token, record)
    return jsonify({"ok": True})


NOT_FOUND_HTML = """<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Not found</title>
<style>body{font:16px -apple-system,sans-serif;padding:40px 20px;text-align:center;color:#334}</style></head>
<body><h2>This link isn't valid.</h2><p>It may have expired or already been used. Contact your inspector for a new one.</p></body></html>"""

ALREADY_SIGNED_HTML = """<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Already signed</title>
<style>body{font:16px -apple-system,sans-serif;padding:40px 20px;text-align:center;color:#334}</style></head>
<body><h2>This agreement has already been signed.</h2><p>Thank you — your inspector has the signed copy.</p></body></html>"""


def render_sign_page(record):
    e = html.escape
    addr = e(record.get("propertyAddress") or "")
    company = e(record.get("companyName") or "Home Inspection")
    text = e(record.get("agreementText") or "")
    c1_prefill = e(record.get("customer1NamePrefill") or "")
    c2_prefill = e(record.get("customer2NamePrefill") or "")
    token = e(record["token"])

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inspection Agreement — {addr}</title>
<style>
  :root{{--ink:#1a1a1a;--muted:#5b6472;--line:#dfe3e8;--accent:#2563eb}}
  body{{margin:0;background:#f4f5f7;font:16px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink)}}
  .wrap{{max-width:720px;margin:0 auto;padding:24px 18px 60px}}
  h1{{font-size:20px;margin:0 0 4px}}
  .sub{{color:var(--muted);font-size:13px;margin:0 0 20px}}
  .doc{{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;
    max-height:46vh;overflow-y:auto;font:15px/1.65 Georgia,'Times New Roman',serif;white-space:pre-wrap;margin-bottom:20px}}
  label{{display:block;font-size:13px;font-weight:600;color:var(--muted);margin:14px 0 5px}}
  input[type=text]{{width:100%;box-sizing:border-box;min-height:44px;padding:10px 12px;border-radius:10px;
    border:1px solid var(--line);font-size:16px}}
  .sigpad{{width:100%;height:150px;border:1.5px dashed #b6bfcc;border-radius:10px;background:#fafbfc;touch-action:none;display:block}}
  .row{{display:flex;gap:8px;align-items:center;margin-top:6px}}
  button{{font:inherit;cursor:pointer}}
  .clear{{background:none;border:1px solid var(--line);border-radius:8px;padding:6px 12px;font-size:13px;color:var(--muted)}}
  .toggle{{background:none;border:0;color:var(--accent);font-size:13px;font-weight:600;padding:8px 0;text-align:left}}
  .submit{{width:100%;min-height:50px;border:0;border-radius:12px;background:var(--accent);color:#fff;
    font-size:16px;font-weight:700;margin-top:24px}}
  .submit:disabled{{opacity:.5}}
  .card{{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px}}
  .err{{color:#b91c1c;font-size:13px;margin-top:8px;display:none}}
  .ok{{display:none;text-align:center;padding:40px 10px}}
</style></head>
<body><div class="wrap">
  <h1>Inspection Agreement</h1>
  <div class="sub">{company}{(' · ' + addr) if addr else ''}</div>
  <div class="doc">{text}</div>

  <div class="card">
    <strong>Client Signature</strong>
    <label>Your full name</label>
    <input type="text" id="c1name" value="{c1_prefill}" placeholder="Full name">
    <label>Sign below</label>
    <canvas class="sigpad" id="c1pad"></canvas>
    <div class="row"><button type="button" class="clear" data-clear="c1pad">Clear</button></div>
  </div>

  <button type="button" class="toggle" id="addSecond">+ Add a second signer (co-buyer/co-owner)</button>
  <div class="card" id="c2card" style="display:none">
    <strong>Second Signature</strong>
    <label>Full name</label>
    <input type="text" id="c2name" value="{c2_prefill}" placeholder="Full name">
    <label>Sign below</label>
    <canvas class="sigpad" id="c2pad"></canvas>
    <div class="row"><button type="button" class="clear" data-clear="c2pad">Clear</button></div>
  </div>

  <button type="button" class="submit" id="submitBtn">Sign & Submit</button>
  <div class="err" id="err"></div>
  <div class="ok" id="ok"><h2>Signed — thank you.</h2><p>Your inspector has been notified.</p></div>
</div>

<script>
(function() {{
  const TOKEN = "{token}";
  function mountPad(canvas) {{
    const ctx = canvas.getContext('2d');
    let drawing = false, last = null, hasInk = false;
    function fit() {{
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a1a1a';
    }}
    function pos(e) {{
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return {{ x: t.clientX - rect.left, y: t.clientY - rect.top }};
    }}
    function start(e) {{ e.preventDefault(); drawing = true; last = pos(e); }}
    function move(e) {{
      if (!drawing) return; e.preventDefault();
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; hasInk = true;
    }}
    function end() {{ drawing = false; }}
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    canvas.addEventListener('touchstart', start, {{passive:false}});
    canvas.addEventListener('touchmove', move, {{passive:false}});
    canvas.addEventListener('touchend', end);
    requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    return {{
      clear: () => {{ ctx.clearRect(0,0,canvas.width,canvas.height); hasInk = false; }},
      isEmpty: () => !hasInk,
      dataUrl: () => canvas.toDataURL('image/png'),
    }};
  }}

  const c1pad = mountPad(document.getElementById('c1pad'));
  const c2pad = mountPad(document.getElementById('c2pad'));

  document.querySelectorAll('[data-clear]').forEach((btn) => {{
    btn.addEventListener('click', () => {{
      (btn.dataset.clear === 'c1pad' ? c1pad : c2pad).clear();
    }});
  }});

  document.getElementById('addSecond').addEventListener('click', (e) => {{
    document.getElementById('c2card').style.display = 'block';
    e.target.style.display = 'none';
  }});

  document.getElementById('submitBtn').addEventListener('click', async () => {{
    const err = document.getElementById('err');
    err.style.display = 'none';
    const c1name = document.getElementById('c1name').value.trim();
    if (!c1name || c1pad.isEmpty()) {{
      err.textContent = 'Please enter your name and sign above.';
      err.style.display = 'block';
      return;
    }}
    const body = {{ customer1Name: c1name, customer1Signature: c1pad.dataUrl() }};
    const c2visible = document.getElementById('c2card').style.display !== 'none';
    if (c2visible && !c2pad.isEmpty()) {{
      const c2name = document.getElementById('c2name').value.trim();
      if (c2name) {{ body.customer2Name = c2name; body.customer2Signature = c2pad.dataUrl(); }}
    }}
    document.getElementById('submitBtn').disabled = true;
    try {{
      const res = await fetch(location.pathname, {{
        method: 'POST', headers: {{'Content-Type':'application/json'}}, body: JSON.stringify(body),
      }});
      if (!res.ok) throw new Error('Server error');
      document.querySelector('.wrap').querySelectorAll(':scope > *:not(.ok)').forEach((el) => el.style.display='none');
      document.getElementById('ok').style.display = 'block';
    }} catch (e) {{
      err.textContent = 'Could not submit — check your connection and try again.';
      err.style.display = 'block';
      document.getElementById('submitBtn').disabled = false;
    }}
  }});
}})();
</script>
</body></html>"""


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
