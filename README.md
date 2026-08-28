# Hernando Inspections

An offline-first home inspection CRM: clients & properties, a fully dynamic
inspection checklist, the Citizens 4-Point and OIR-B1-1892 Wind Mitigation
forms, photo/video capture, a pre-inspection agreement with signatures, and a
PDF-or-digital report builder. No server, no account, no internet connection
required once installed — everything is stored on the device it's used on.
The one optional exception is remote e-signing of the agreement, covered
below.

## Quick start (testing on this PC)

Double-click **Start.bat**. It launches a local server and opens the app in
your browser at `http://127.0.0.1:8420`. Good enough to click around and get
a feel for it, but read the next section before you rely on it in the field.
(The app deliberately skips the offline service worker when running on
`localhost`/`127.0.0.1`, so local edits always show up on a normal refresh —
no cache to fight with during testing.)

## Installing on your iPhone/iPad (what you'll actually use)

iOS requires a page to be served over **HTTPS** before Safari will let you
"Add to Home Screen" as an installable app, and it can't see a server running
on your PC's `localhost`. So this folder needs to live on a free HTTPS static
host. Takes about three minutes, one-time:

**Option A — GitHub Pages (recommended, free)**
1. Create a new GitHub repository and push this folder to it.
2. Repo Settings → Pages → Deploy from branch → `main` → `/ (root)` → Save.
3. GitHub gives you a URL like `https://yourname.github.io/reponame/`.

**Option B — Netlify or Cloudflare Pages (also free, drag-and-drop)**
1. Go to app.netlify.com (or pages.cloudflare.com) and drag this whole folder
   onto the upload area. No git needed.
2. You get an HTTPS URL immediately.

Then on the iPhone/iPad:
1. Open that URL in **Safari** (must be Safari, not Chrome — only Safari can
   install to the home screen on iOS).
2. Tap the Share icon → **Add to Home Screen**.
3. Open it from the home screen icon from now on. After that first load, the
   app works with airplane mode on — no signal needed on site.

Whenever you edit the code and redeploy, the app updates itself in the
background next time it's opened with a connection; it always finishes
serving whatever version is already cached first, so a job in progress is
never interrupted mid-use.

## Back up your data

Everything — clients, jobs, checklist answers, forms, photos, videos — lives
only in the browser storage on that one device. There is no cloud sync. If
the phone is lost, reset, or the app is uninstalled, that data is gone unless
you've backed it up.

**Setup → Export Full Backup** downloads one `.json` file containing
everything, photos included. Do this regularly (e.g. after each job, or
weekly), and keep the file somewhere durable — email it to yourself, save it
to iCloud/Google Drive/Files. **Setup → Restore from Backup** loads it back,
either merged into existing data or as a full replace (for restoring onto a
freshly installed app).

## Using the app

- **Clients** — the homeowner/buyer and their properties. A client can have
  multiple properties and multiple inspection jobs over time.
- **Contacts** (Setup → Manage Contacts) — repeat referral contacts (realtors,
  lenders, attorneys) saved once and picked from a job's **+ Add** button
  instead of retyped every time. Independent of Clients, since the same
  realtor shows up across many different clients' jobs.
- **Jobs** (Inspections) — created against a client + property, with one or
  more services (tap all that apply — a job can be a Full Inspection *and* a
  4-Point *and* Wind Mitigation at once) and a schedule. Each job gets its
  own copy of the checklist, so editing one job's template never touches
  another job or the master.
- **Checklist** — its own screen: a section list (Roof, Electrical,
  Plumbing, ...) you drill into. Wide screens show the section list and the
  open section side by side; on a phone, opening a section is a full-screen
  view with a back arrow to the list — no more one long scrolling page. Tap
  **+ Section** or **+ Item** at any point, in the field, to capture
  something the template didn't anticipate — new items are either
  **Narrative** (free text) or **Upick** (a pick list you define on the
  spot, e.g. brands/sizes) — it becomes part of that job permanently. Every
  item has a compact icon action bar instead of options sitting inline all
  the time: **Comment** (opens the note, pulling from your **Library** of
  canned comments filtered to that section first), **Summary** (☆ pulls it
  into the report's Executive Summary), **Level** (opens a severity picker —
  Info/Maintenance/Minor/Major/Safety — instead of showing all five always),
  **Later** (flags it to revisit, independent of severity), **Hide** (keeps
  the answer recorded but leaves it out of the client-facing report), and
  **Clear**.
- **Insurance Forms** — Citizens 4-Point (Form Insp4pt 03/25) and OIR-B1-1802
  Wind Mitigation, rebuilt field-for-field from real blank copies, with
  per-question photo slots. Answers that overlap with the client/property are
  pre-filled, and the 4-Point has a **Copy from Inspection** button that pulls
  matching roof/electrical/HVAC/plumbing answers from the checklist (with a
  review step — nothing applies until you approve it). If the client already
  signed the pre-inspection agreement on this job, the Wind Mit homeowner
  signature reuses it automatically instead of needing a second signature.
- **Inspection Agreement** — every job has an Agreement screen built from
  your contract text (Setup → Pre-Inspection Agreement), with merge fields
  filled in automatically. Sign it in person (inspector + up to two clients),
  or send a link for the client to sign remotely on their own device — see
  **Remote Signing** below.
- **Report** — from a job, tap **Report** for the full narrative report
  (Executive Summary first, then the full findings), or open a form's report
  from its own screen. Three ways to deliver it:
  - **Print / Save PDF** — opens the system print dialog; "Save to Files" or
    print to a physical printer.
  - **Export Digital Copy** — downloads a single self-contained `.html`
    file (photos and video embedded) that opens correctly in any browser,
    forever, with no app installed.
  - **Share** (iOS) — hands that same file straight to Mail, Messages,
    AirDrop, or Files via the native share sheet, pre-filled with the
    subject/message from your **Email Templates** (Setup) — the most
    reliable path on iPhone/iPad, since Safari's plain download button is
    unreliable inside an installed home-screen app.
- **Library** (Setup → Manage Library) — your reusable defect comments, and
  the **master checklist template** used for every new job going forward.
  Editing the master template never rewrites a job already in progress.
- **Photo annotation** — open any photo and tap Annotate for arrow/box/circle
  markup with a color picker. The original capture is always kept underneath,
  so reopening a markup lets you adjust it rather than starting over.
- **Copy from Inspection** (4-Point form) — on a full inspection, roof,
  electrical, HVAC and plumbing checklist items feed the 4-Point form's
  matching fields. Tap **Copy from Inspection** on the 4-Point screen to
  review the suggestions and pick which ones to apply — nothing is written
  until you approve it. For a standalone 4-Point (no full checklist), the
  button just won't find anything to suggest and the form works exactly like
  before. The Wind Mitigation form's roof section is structured too
  differently from the checklist for a reliable auto-copy, so that one stays
  manual entry for now.

## Remote signing (the one online feature)

Everything above works with the device in airplane mode. Having a client
sign the agreement on *their own device* before you arrive is the one thing
that fundamentally can't — it needs somewhere online to hand the signature
back to you. That's what [backend/](backend/) is: a small, free-tier server
you deploy once. Full deploy steps are in **backend/README.md**; once it's
running, paste its URL into **Setup → Remote Signing**, and every job's
Agreement screen gets a **Send Link for Remote Signing** option. Skip it
entirely and the app is unaffected — sign in person or share a copy instead.

## Keeping the insurance forms current

The 4-Point and Wind Mitigation forms in [js/forms/fourpoint.js](js/forms/fourpoint.js)
and [js/forms/windmit.js](js/forms/windmit.js) are built as faithful working
replicas of the current OIR forms — not a fillable copy of the official PDF.
Carriers generally accept a well-formatted equivalent, but:

- The Office of Insurance Regulation periodically revises OIR-B1-1892 —
  check you're working from the current revision before relying on it for a
  policy application.
- If you later want pixel-identical official PDFs instead (e.g. a carrier
  insists on the literal form), that's a scoped addition: install Node.js,
  add `pdf-lib`, and map each field id already used here (they mirror the
  printed form's numbering, e.g. `q3_answer`) onto the real PDF's AcroForm
  fields. The data model doesn't need to change for that upgrade.

## Project layout

```
index.html, css/            app shell + report print stylesheet
js/core/                    IndexedDB storage, media capture/compression, router, UI helpers, backup, merge fields
js/report/                  checklist template, comment library, agreement text, email templates, report renderer + export
js/forms/                   4-Point and Wind Mitigation form definitions + shared form engine
js/views/                   one file per screen
sw.js, manifest.webmanifest offline caching + installability (skipped on localhost — see Quick Start)
backend/                    optional remote-signing server — see backend/README.md
tools/gen_icons.py          regenerates icons/*.png (no image libraries required)
serve.py, Start.bat         local test server (desktop browser only — see iOS section above)
```

No build step, no npm, no external dependencies — every file is plain
ES modules loaded directly by the browser, which is what makes "no internet
required" actually true.
