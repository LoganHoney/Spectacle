# Roadmap to 1.0

Working checklist, not a spec. Pick one numbered item and give a targeted
prompt ("do 4.2 next") — that's the intended way to drive this file. Status
tags: ✅ done · 🟡 partial/needs verification · ⬜ not started.

## 1. UI
- ✅ Section-list drill-down nav (mobile single-screen + back arrow, desktop multi-pane)
- ✅ Per-comment action bar (Comment/Photo/Summary/Level/Later/Hide/Clear) + "Add flag" pattern
- ✅ Field badges showing which items feed 4-Point / Wind Mit
- ⬜ 1.1 Browse/search all past inspections (list view + filters — client, address, date range, status)
- ⬜ 1.2 Dashboard pass: upcoming jobs, overdue reports, quick stats
- ⬜ 1.3 Empty-state and error-state pass across views
- ⬜ 1.4 Accessibility pass (focus order, contrast, tap targets on the action bar)

## 2. Database / Data Model
- ✅ Versioned IndexedDB schema (`db.js`, additive upgrades)
- ✅ Stable cross-job `tag` field on template items (survives per-job cloning)
- ⬜ 2.1 Cross-property/cross-client inspection index — needed to power 1.1 and 5.1 (query by address or client across all jobs, not just within one client's property list)
- ⬜ 2.2 New object stores for expenses + invoices/payments (see 6)
- ⬜ 2.3 Extend `backup.js` export/import to cover any new stores as they're added

## 3. Core Inspection Functionality
- ✅ Checklist item types, severity, hide/flag, photo/video capture + annotation
- ✅ Cross-populate engine: tag → 4-Point/Wind Mit field, review-before-apply
- ✅ Fixed an app-wide bug: delegated click/input listeners (`on()` in `ui.js`) re-attached on every re-render instead of once, so a button could fire once per past render/visit — this is why "From library" needed ~10 taps on the X to fully close. `on()` is now idempotent per (element, event, selector); verified live via CDP.
- ✅ Fixed a bigger one: the master checklist template and comment library only ever seeded into local storage ONCE — code edits to `template.js`/`comments.js` never reached a device that had already opened the app. Added version-checked sync (`TEMPLATE_VERSION`, `COMMENTS_VERSION` in `store.seedIfEmpty()`) that refreshes on next load without touching in-progress jobs or a user's own custom comments. This likely means a lot of this session's earlier template/comment work never showed up on the real device until now.
- ✅ Double-tap guard on "Create Inspection" so a fast double-tap can't create two job records. IDs themselves were already crypto-random (2^64 space) — never realistically collide.
- ✅ Report signature now always pulled from Settings' saved signature — no per-job signing UI; verified live.
- ✅ Comment library UX: "Comment" now opens the library picker directly (was: free-text box first, library second) with a "write my own" fallback inside it; picker also has subgroup chips within each section (e.g. "Water Heater" inside Plumbing) defaulting to the tapped item's own subgroup, and ranks results by keyword relevance to the item's label when no search is typed. All verified live via CDP.
- ⬜ 3.1 Warn on duplicate/likely-repeat inspection at an address already in the system (surface prior report as reference)
- ⬜ 3.2 Template edit safety: confirm editing the master template mid-project doesn't silently orphan `tag` mappings

## 4. Report Writing
- ✅ Comment library: condition-range sets (new → end-of-life) for Roof/Electrical/Plumbing/HVAC, `{Fill:label}` syntax for variable facts, consistent "appeared to be... at the time of the inspection" hedging
- ✅ Layout: short `Label: Value` lines by default; age-type fields auto-render as a hedged estimate sentence instead of a bare value
- ✅ Condition-rated items (Acceptable/Marginal/Defective/...) always render as "appeared to be [x] at the time of the inspection", with Marginal/Defective adding a same-sentence licensed-trade referral — applied consistently in Executive Summary, Findings, and Full Inspection Detail. Verified live via CDP.
- 🟡 Needs live verification against the original Spectora sample PDF, section by section — planned as a section-by-section pass together, not a bulk pass
- ⬜ 4.1 Expand comment library + subgroups for Exterior, Interior, Structure, Garage, Safety to the same depth as Roof/Electrical/Plumbing/HVAC (user has ~15 exterior comments in mind already)
- ⬜ 4.2 PDF export fidelity pass (page breaks, photo grid layout, headers/footers repeating correctly)
- ⬜ 4.3 Consider whether other liability-sensitive fields beyond "age" need the same hedge treatment (e.g. remaining life estimates, square footage from pacing)
- ⬜ 4.4 Same hedge/trade-referral treatment for `yesno` items where "No" signals a deficiency (e.g. "in good working order? No") — currently only `condition`-type items get it
- ⬜ 4.5 4-Point and Wind Mitigation must be the actual insurer forms (OIR-B1-1802, Citizens 4-Point), not app-built replicas — needs the original blank PDFs re-uploaded so field names/positions can be matched exactly for real PDF fill-and-flatten, since the source files from earlier in this project aren't saved anywhere in the repo

## 5. CRM
- ✅ Clients, properties, contacts, repeat-contact picker
- ⬜ 5.1 "Other inspections at this address" / "past jobs for this client" surfaced on client & property pages (depends on 2.1)
- ⬜ 5.2 Lead/pipeline status beyond current inspection status chips (e.g. inquiry → scheduled → completed → invoiced)
- ⬜ 5.3 Communication log (optional — only if it earns its keep over just using email/text directly)

## 6. Expenses & Profit
- ⬜ Not started — net-new domain
- ⬜ 6.1 Data model: expense entries (category, amount, date, optional job link) and per-job price/invoice amount
- ⬜ 6.2 Entry UI: quick-add expense, quick-set job price
- ⬜ 6.3 Reporting: profit per job (price − linked expenses), rolled up by month/year
- ⬜ 6.4 Decide scope boundary up front — this is bookkeeping-lite, not full invoicing/accounting (no payment processing, no tax filing)

## Suggested sequencing
1. Verify the current batch live (3, 4) — in progress
2. 1.1 + 2.1 together (past-inspection reference is one feature spanning UI + data model)
3. 4.1 comment library depth
4. 4.2 export fidelity pass
5. 6 (Expenses & Profit v1)
6. Polish pass (1.2–1.4, 3.1–3.2)
