// Per-section checklist rendering: one section's items, each with a value
// control and a compact icon action bar (Comment / Summary / Level / Later /
// Hide / Clear) instead of every option sitting inline all the time. This
// module renders ONE section into a host — see checklist-nav.js for the
// section-list ↔ section-detail navigation shell that hosts it.

import * as store from '../core/store.js';
import { newItem, NEW_ITEM_TYPES, CONDITION_OPTIONS, YESNO_OPTIONS } from '../report/template.js';
import { html, raw, esc, on, sheet, chooseSheet, promptSheet, toast, debounce } from '../core/ui.js';
import { mountPhotos } from './photos.js';
import { slotKey } from '../forms/engine.js';
import { TAGGED_FOR_FORMS } from '../forms/crosspopulate.js';
import * as media from '../core/media.js';

const FORM_BADGE = { fourpoint: '4-Pt', windmit: 'Wind Mit' };

const NEEDS_ATTENTION = new Set(['Marginal', 'Defective', 'No']);

// Local, offline keyword match — no network/LLM available in this app — used to
// rank the comment library by relevance to whichever item "From library" was
// opened from, so e.g. "TPR valve & discharge piping" floats the TPR comment
// above other Water Heater comments instead of the inspector hunting for it.
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'present', 'observed', 'condition', 'conditions',
  'system', 'systems', 'required', 'where', 'at', 'in', 'on', 'to', 'for', 'with', 'type', 'types', 'per']);

function keywords(text) {
  return [...new Set(String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w)))];
}

function relevance(itemWords, comment) {
  const title = comment.title.toLowerCase();
  const body = (comment.body || '').toLowerCase();
  let score = 0;
  for (const w of itemWords) {
    if (title.includes(w)) score += 3;
    else if (body.includes(w)) score += 1;
  }
  return score;
}

export function isFlagged(inspection, item) {
  const r = inspection.data[item.id];
  if (!r) return false;
  return NEEDS_ATTENTION.has(r.value) || (r.severity != null && Number(r.severity) >= 2);
}

/**
 * Renders and binds interactivity for one section's items.
 * @param {HTMLElement} host
 * @param {object} inspection  live object (mutated in place, caller saves)
 * @param {object} section     the specific section within inspection.template.sections
 * @param {Function} onDirty   called after every change so caller can persist
 * @param {Function} [onSectionChange] called when items are added/moved, in case the host needs to refresh counts elsewhere
 */
export function mountSectionItems(host, inspection, section, onDirty, onSectionChange) {
  const save = debounce(() => onDirty(inspection), 500);
  let commentLib = null;

  render();
  bind(); // delegated listeners on the stable `host` — attach once, not per render, or clicks fire once per past render

  function render() {
    host.innerHTML = html`
      ${raw(section.intro ? `<p class="small muted" style="margin-top:0">${esc(section.intro)}</p>` : '')}
      <div class="stack">${raw(section.items.map((it) => itemHtml(it)).join(''))}</div>
      <button class="btn ghost wide" data-add-item style="margin-top:6px">+ Item</button>
    `;
    host.querySelectorAll('[data-photos]').forEach((el) => {
      mountPhotos(el, { inspectionId: inspection.id, slot: slotKey('item', el.dataset.photos), label: 'Photos' });
    });
  }

  function itemHtml(item) {
    const r = inspection.data[item.id] || {};
    const flagged = isFlagged(inspection, item);
    const isNarrative = item.type === 'narrative';
    const showNote = !!(r.comment || r.noteOpen);
    return `<div class="finding ${flagged ? `sev-${r.severity || 2}` : ''} ${r.hidden ? 'finding-hidden' : ''}" data-item="${item.id}">
      <div class="spread">
        <div class="ft">${esc(item.label)}${badges(r, item)}</div>
        <button class="btn sm ghost" data-item-menu="${item.id}" aria-label="Item options">&#8942;</button>
      </div>
      ${item.hint ? `<div class="small muted" style="margin:-2px 0 8px">${esc(item.hint)}</div>` : ''}
      ${valueControl(item, r)}
      ${actionBar(item, r)}
      ${isNarrative ? '' : (showNote ? noteBlock(item, r) : '')}
      <div class="photo-slot" data-photos="${item.id}" style="margin-top:10px"></div>
    </div>`;
  }

  function badges(r, item) {
    let out = '';
    const forms = item.tag && TAGGED_FOR_FORMS.get(item.tag);
    if (forms) for (const f of forms) out += ` <span class="pill accent" title="Also feeds the ${f === 'fourpoint' ? '4-Point' : 'Wind Mitigation'} form">${FORM_BADGE[f] || f}</span>`;
    if (r.needsReview) out += ` <span class="pill warn">Review</span>`;
    if (r.hidden) out += ` <span class="pill">Hidden</span>`;
    return out;
  }

  function actionBar(item, r) {
    const levelLabel = r.severity != null ? store.sevLabel(r.severity) : 'Level';
    return `<div class="actionbar">
      <button class="abtn" data-comment="${item.id}" aria-pressed="${!!(r.comment || r.noteOpen)}">
        <span class="ic">&#128172;</span><span class="lb">Comment</span>
      </button>
      <button class="abtn" data-sumtoggle="${item.id}" aria-pressed="${!!r.inSummary}">
        <span class="ic">${r.inSummary ? '&#9733;' : '&#9734;'}</span><span class="lb">Summary</span>
      </button>
      <button class="abtn${r.severity != null ? ` abtn-sev-${r.severity}` : ''}" data-level="${item.id}">
        <span class="ic">&#9888;</span><span class="lb">${esc(levelLabel)}</span>
      </button>
      <button class="abtn" data-later="${item.id}" aria-pressed="${!!r.needsReview}">
        <span class="ic">&#128278;</span><span class="lb">Later</span>
      </button>
      <button class="abtn" data-hide="${item.id}" aria-pressed="${!!r.hidden}">
        <span class="ic">&#128683;</span><span class="lb">Hide</span>
      </button>
      <button class="abtn abtn-danger" data-clear="${item.id}">
        <span class="ic">&#128465;</span><span class="lb">Clear</span>
      </button>
    </div>`;
  }

  function valueControl(item, r) {
    switch (item.type) {
      case 'condition':
      case 'yesno':
      case 'select': {
        const options = item.options || (item.type === 'yesno' ? YESNO_OPTIONS : CONDITION_OPTIONS);
        return `<div class="seg" data-seg="${item.id}">
          ${options.map((o) => `<button data-v="${esc(o)}" aria-pressed="${o === r.value}">${esc(o)}</button>`).join('')}
        </div>`;
      }
      case 'checkgroup': {
        const cur = new Set(Array.isArray(r.value) ? r.value : []);
        return `<div class="opts" data-checkgroup="${item.id}">
          ${(item.options || []).map((o) => `<button data-v="${esc(o)}" aria-pressed="${cur.has(o)}">${esc(o)}</button>`).join('')}
        </div>`;
      }
      case 'number':
        return `<input type="number" data-val="${item.id}" value="${esc(r.value ?? '')}" inputmode="decimal">`;
      case 'text':
        return `<input type="text" data-val="${item.id}" value="${esc(r.value ?? '')}">`;
      case 'narrative':
      default:
        return `<textarea data-val="${item.id}" placeholder="Notes…">${esc(r.value ?? '')}</textarea>`;
    }
  }

  function noteBlock(item, r) {
    return `<div style="margin-top:9px">
      <div class="row" style="margin-bottom:6px;justify-content:flex-end">
        <button class="btn sm ghost" data-from-library="${item.id}">From library</button>
      </div>
      <textarea data-note="${item.id}" placeholder="Describe the deficiency and recommendation…">${esc(r.comment || '')}</textarea>
    </div>`;
  }

  function bind() {
    on(host, 'click', '[data-add-item]', async () => {
      const item = await addItemFlow();
      if (!item) return;
      section.items.push(item);
      save(); render(); onSectionChange?.();
    });

    on(host, 'click', '[data-item-menu]', async (_e, el) => {
      const itemId = el.dataset.itemMenu;
      const item = findItem(itemId);
      if (!item) return;
      const choice = await chooseSheet(item.label, [
        { value: 'rename', label: 'Rename item' },
        ...(item.custom ? [{ value: 'delete', label: 'Delete item entirely', hint: 'Removes it from this job’s checklist, not just its response' }] : []),
      ]);
      if (choice === 'rename') {
        const label = await promptSheet('Rename Item', { label: 'Item label', value: item.label });
        if (label) { item.label = label; save(); render(); }
      } else if (choice === 'delete') {
        section.items = section.items.filter((i) => i.id !== itemId);
        delete inspection.data[itemId];
        save(); render(); onSectionChange?.();
      }
    });

    on(host, 'click', '[data-seg] [data-v]', (_e, el) => {
      const itemId = el.closest('[data-seg]').dataset.seg;
      setValue(itemId, el.dataset.v);
      render();
    });

    on(host, 'click', '[data-checkgroup] [data-v]', (_e, el) => {
      const itemId = el.closest('[data-checkgroup]').dataset.checkgroup;
      const r = ensure(itemId);
      const set = new Set(Array.isArray(r.value) ? r.value : []);
      set.has(el.dataset.v) ? set.delete(el.dataset.v) : set.add(el.dataset.v);
      r.value = [...set];
      el.setAttribute('aria-pressed', set.has(el.dataset.v));
      save();
    });

    on(host, 'click', '[data-comment]', async (_e, el) => {
      const itemId = el.dataset.comment;
      const r = ensure(itemId);
      // Picking a pre-saved comment is the normal workflow, not typing one from
      // scratch — so the first tap goes straight to the library. Once there's
      // already a comment on this item, tapping again opens the text box instead
      // (to review/edit/append), with "From library" still there to add more.
      if (!r.comment && !r.noteOpen) {
        await pickFromLibrary(itemId);
        return;
      }
      r.noteOpen = true;
      render();
      host.querySelector(`[data-note="${itemId}"]`)?.focus();
    });

    on(host, 'click', '[data-sumtoggle]', (_e, el) => {
      const r = ensure(el.dataset.sumtoggle);
      r.inSummary = !r.inSummary;
      save(); render();
    });

    on(host, 'click', '[data-later]', (_e, el) => {
      const r = ensure(el.dataset.later);
      r.needsReview = !r.needsReview;
      save(); render();
    });

    on(host, 'click', '[data-hide]', (_e, el) => {
      const r = ensure(el.dataset.hide);
      r.hidden = !r.hidden;
      save(); render();
    });

    on(host, 'click', '[data-level]', async (_e, el) => {
      const itemId = el.dataset.level;
      const r = ensure(itemId);
      const choice = await chooseSheet('Severity', [
        { value: 'clear', label: 'No flag' },
        ...store.SEVERITY.map((s) => ({ value: String(s.v), label: s.label })),
      ], { current: r.severity != null ? String(r.severity) : 'clear' });
      if (choice === undefined) return;
      if (choice === 'clear') delete r.severity;
      else r.severity = Number(choice);
      save(); render();
    });

    on(host, 'click', '[data-clear]', (_e, el) => {
      delete inspection.data[el.dataset.clear];
      save(); render();
    });

    on(host, 'click', '[data-from-library]', async (_e, el) => {
      await pickFromLibrary(el.dataset.fromLibrary);
    });

    on(host, 'input', '[data-val]', (e, el) => setValue(el.dataset.val, el.value));

    on(host, 'input', '[data-note]', (e, el) => {
      const r = ensure(el.dataset.note);
      r.comment = el.value;
      save();
    });

    // 'blur' doesn't bubble, so it can't be caught by this delegated
    // listener on `host` — 'focusout' is the bubbling equivalent.
    on(host, 'focusout', '[data-note]', async (_e, el) => {
      await syncCommentToLibrary(el.dataset.note, findItem(el.dataset.note));
    });
  }

  /**
   * Keeps the comment library growing with whatever the inspector actually
   * types, without ever touching a comment picked FROM the library — that
   * text often has {Fill:...} placeholders already resolved to this job's
   * specific value (e.g. "23 years"), and overwriting the reusable
   * template's body with that would corrupt it for every future job. Only
   * text that started from scratch (r.libraryCommentId unset) is eligible:
   * first save creates a new library entry and remembers its id on this
   * response; later edits to the same response update that same entry
   * instead of creating duplicates. An emptied comment is left alone
   * either way — never deletes or blanks an existing library entry.
   */
  async function syncCommentToLibrary(itemId, item) {
    const r = inspection.data[itemId];
    const text = (r?.comment || '').trim();
    if (!text || !item) return;
    if (r.libraryCommentId) {
      const existing = await store.getComment(r.libraryCommentId);
      if (existing && existing.body !== text) {
        await store.saveComment({ ...existing, body: text });
        commentLib = null; // stale — refetch next time the library sheet opens
      }
      return;
    }
    const created = store.newComment({
      category: section.title,
      ...(item.group ? { subgroup: item.group } : {}),
      title: item.label,
      body: text,
      severity: r.severity ?? 2,
    });
    await store.saveComment(created);
    r.libraryCommentId = created.id;
    commentLib = null;
    save();
    toast('Saved to comment library');
  }

  function setValue(itemId, value) {
    const r = ensure(itemId);
    r.value = value;
    if (NEEDS_ATTENTION.has(value) && r.severity == null) r.severity = 2;
    save();
  }

  function ensure(itemId) {
    return inspection.data[itemId] || (inspection.data[itemId] = {});
  }

  function findItem(id) { return section.items.find((i) => i.id === id); }

  async function addItemFlow() {
    const type = await chooseSheet('New Item Type', NEW_ITEM_TYPES.map((t) => ({ value: t.value, label: t.label, hint: t.hint })));
    if (!type) return null;
    const label = await promptSheet('New Item', { label: 'Item label', placeholder: type === 'select' ? 'e.g. Water Heater Brand' : 'e.g. Detached Shed' });
    if (!label) return null;
    let options = null;
    if (type === 'select') {
      const csv = await promptSheet('Pick List Options', { label: 'Options, separated by commas', placeholder: 'e.g. Trane, Carrier, Rheem, Lennox' });
      if (!csv) return null;
      options = csv.split(',').map((s) => s.trim()).filter(Boolean);
      if (!options.length) return null;
    }
    return newItem(label, type, options);
  }

  async function pickFromLibrary(itemId) {
    if (!commentLib) commentLib = await store.listComments();
    const item = findItem(itemId);
    // The section title usually matches a comment category (Roof, Electrical, ...) —
    // land there first so a section with its own presaved set feels instant, not searched.
    const defaultCategory = commentLib.find((c) => c.category.toLowerCase() === section.title.toLowerCase())
      ? section.title : 'All';
    // Within that category, most items also have their own subgroup (e.g. "Water
    // Heater" inside Plumbing) — land straight on the handful of comments for
    // THIS fixture instead of every comment in the section.
    const defaultGroup = item?.group || 'All';
    const itemWords = keywords(item?.label);
    const choice = await sheet('Comment Library', (body, close) => {
      const categories = ['All', ...new Set(commentLib.map((c) => c.category))];
      body.innerHTML = html`
        <input type="text" data-q placeholder="Search comments…" style="margin-bottom:10px">
        <div class="chip-row" data-cats>${raw(categories.map((c) => `<button class="chip" data-c="${esc(c)}" aria-pressed="${c === defaultCategory}">${esc(c)}</button>`).join(''))}</div>
        <div class="chip-row" data-groups style="margin-top:6px"></div>
        <div class="opts" data-list style="max-height:44vh;overflow:auto"></div>
        <button class="btn ghost wide sm" data-custom style="margin-top:10px">&#9998; None of these — write my own</button>`;
      const list = body.querySelector('[data-list]');
      const groupsRow = body.querySelector('[data-groups]');
      let activeCat = defaultCategory;
      let activeGroup = defaultGroup;

      const drawGroups = () => {
        const inCat = commentLib.filter((c) => activeCat === 'All' || c.category === activeCat);
        const groups = [...new Set(inCat.map((c) => c.subgroup).filter(Boolean))];
        if (!groups.length) { groupsRow.innerHTML = ''; activeGroup = 'All'; return; }
        if (activeGroup !== 'All' && !groups.includes(activeGroup)) activeGroup = 'All';
        groupsRow.innerHTML = ['All', ...groups].map((g) =>
          `<button class="chip sm" data-g="${esc(g)}" aria-pressed="${g === activeGroup}">${esc(g)}</button>`).join('');
      };
      const draw = (term) => {
        const t = (term || '').toLowerCase();
        const filtered = commentLib.filter((c) =>
          (activeCat === 'All' || c.category === activeCat) &&
          (activeGroup === 'All' || c.subgroup === activeGroup) &&
          (!t || `${c.title} ${c.category} ${c.subgroup || ''} ${c.body}`.toLowerCase().includes(t)));
        // No search typed yet — rank by how closely each comment's own words match
        // this specific item's label (e.g. opening from "TPR valve & discharge
        // piping" floats the TPR comment above general water-heater ones), so the
        // closest fit is the first thing tapped rather than something to hunt for.
        if (!t && itemWords.length) filtered.sort((a, b) => relevance(itemWords, b) - relevance(itemWords, a));
        list.innerHTML = filtered.slice(0, 60).map((c) => `
          <button data-c="${c.id}">
            <span class="k">[${esc(c.subgroup || c.category)}]</span>${esc(c.title)}
            <div class="small muted" style="margin-top:2px">${esc((c.body || '').slice(0, 110))}${c.body?.length > 110 ? '…' : ''}</div>
          </button>`).join('') || '<div class="empty small">No matches in this subsection — try "All" above.</div>';
      };
      drawGroups();
      draw('');
      body.querySelector('[data-q]').addEventListener('input', (e) => draw(e.target.value));
      on(body.querySelector('[data-cats]'), 'click', '[data-c]', (_e, el) => {
        activeCat = el.dataset.c;
        body.querySelectorAll('[data-cats] [data-c]').forEach((b) => b.setAttribute('aria-pressed', b === el));
        drawGroups();
        draw(body.querySelector('[data-q]').value);
      });
      on(groupsRow, 'click', '[data-g]', (_e, el) => {
        activeGroup = el.dataset.g;
        groupsRow.querySelectorAll('[data-g]').forEach((b) => b.setAttribute('aria-pressed', b === el));
        draw(body.querySelector('[data-q]').value);
      });
      on(list, 'click', '[data-c]', (_e, el) => close(commentLib.find((c) => c.id === el.dataset.c)));
      body.querySelector('[data-custom]').onclick = () => close('__custom__');
    });
    if (!choice) return;
    if (choice === '__custom__') {
      const r = ensure(itemId);
      r.noteOpen = true;
      save(); render();
      host.querySelector(`[data-note="${itemId}"]`)?.focus();
      return;
    }
    const filledBody = await resolveFillIns(choice.body);
    if (filledBody === null) return; // cancelled a fill-in prompt — don't insert a half-finished comment
    const filledRecommendation = choice.recommendation ? await resolveFillIns(choice.recommendation) : '';
    const r = ensure(itemId);
    r.comment = r.comment ? `${r.comment}\n\n${filledBody}` : filledBody;
    r.severity = choice.severity ?? r.severity ?? 2;
    r.noteOpen = true;
    if (filledRecommendation) r.comment += `\n\nRecommendation: ${filledRecommendation}`;
    await store.bumpCommentUse(choice.id);
    save(); render();
    toast('Comment inserted');
  }

  /**
   * Fill-in-the-blank comments use `{Fill:label}` (or bare `{Fill}`) placeholders —
   * e.g. "Approximately {Fill:years} years old." Prompts once per placeholder and
   * substitutes the answer; returns null if the inspector backs out of any prompt.
   */
  async function resolveFillIns(text) {
    const placeholders = [...new Set([...text.matchAll(/\{Fill(?::([^}]+))?\}/g)].map((m) => m[0]))];
    let out = text;
    for (const token of placeholders) {
      const label = token.match(/\{Fill:?([^}]*)\}/)?.[1] || 'value';
      const value = await promptSheet('Fill In', { label: `Enter ${label}`, placeholder: label });
      if (value === undefined || value === '') return null;
      out = out.split(token).join(value);
    }
    return out;
  }

  return { refresh: render };
}

export async function checklistPhotoCount(inspectionId) {
  const all = await media.mediaFor(inspectionId);
  return new Set(all.map((m) => m.slot)).size;
}
