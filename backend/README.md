# Remote signing backend

The rest of Hernando Inspections works with zero internet connection. This
folder is the one exception: a client signing the pre-inspection agreement on
their own device, before you arrive, has to hand that signature to something
reachable over the internet. That's what this is.

It's small on purpose: two free accounts, no credit card, ~10 minutes.

## What it is

- A tiny Python (Flask) web app with four endpoints: create a signing link,
  serve the signing page, accept the submitted signature, and let the app
  check whether it's been signed yet.
- Storage is [Upstash](https://upstash.com) Redis (free tier) — not a
  database on the server itself, because Render's free web service resets its
  disk and loses anything in memory every time it goes idle. Each record
  auto-expires after 30 days whether anyone cleans it up or not.
- Hosting is [Render](https://render.com) (free tier). The free tier spins
  the app down after 15 minutes with no traffic and takes ~20-30 seconds to
  wake back up on the next request — completely fine for something a client
  opens once.

## One-time setup

### 1. Push this project to GitHub

If you haven't already (you'll also want this for hosting the app itself —
see the main README). Render deploys from a GitHub repo.

### 2. Create the Upstash database (free)

1. Go to [upstash.com](https://upstash.com) → sign up (free, no card required).
2. Create a database → any region close to you → Type: **Regional**.
3. On the database's page, find **REST API** → copy the **`UPSTASH_REDIS_REST_URL`**
   and **`UPSTASH_REDIS_REST_TOKEN`** values. You'll paste these into Render next.

### 3. Deploy to Render (free)

1. Go to [render.com](https://render.com) → sign up (free) → connect your GitHub account.
2. **New +** → **Web Service** → pick this repository.
3. Render should detect `backend/render.yaml` and offer to use it — if so,
   accept it (it sets the root directory, build command, and start command
   for you). If it doesn't detect it automatically, set these manually:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Plan**: Free
4. Under **Environment**, add the two values from Upstash:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
5. Create the service. First deploy takes a few minutes. When it's live,
   Render gives you a URL like `https://hernando-inspections-signing.onrender.com`.

### 4. Point the app at it

In the app: **Setup → Remote Signing → Signing server URL** → paste that
Render URL. That's it — every job's Agreement screen now offers **Send Link
for Remote Signing**.

## Verifying it worked

Open `https://your-app.onrender.com/healthz` in a browser — you should see
`{"ok": true}`. If Upstash isn't configured correctly, creating a signing
link from the app will fail with a clear error rather than silently doing
nothing.

## What this does and doesn't do

- The link is a long random token — nobody can guess it, but anyone who has
  it can view and sign it. Only send it to the actual client, the same way
  you'd send any private document.
- There's no email/SMS sending built in. The app hands you the link and your
  phone's native Share sheet — you choose Mail, Messages, whatever. That was
  a deliberate call to avoid a second paid service and a second account.
- If you never deploy this, nothing else in the app is affected — the
  Agreement screen just won't show the remote-signing option, and everything
  still works via in-person signing or sharing an unsigned copy for the
  client to print.

## Local testing

`backend/tools/fake_upstash.py` is a tiny stand-in for the Upstash REST API,
used only to test `app.py` without needing real cloud credentials:

```
py backend/tools/fake_upstash.py 8987
UPSTASH_REDIS_REST_URL=http://127.0.0.1:8987 UPSTASH_REDIS_REST_TOKEN=test py backend/app.py
```
