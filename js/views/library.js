import * as store from '../core/store.js';
import { newSection, newItem, ITEM_TYPES, NEW_ITEM_TYPES } from '../report/template.js';
import { html, raw, esc, on, setTopbar, sheet, promptSheet, chooseSheet, confirmSheet, toast } from '../core/ui.js';

export async function libraryView(view) {
  setTopbar({ title: 'Library', actions: [] });
  let tab = 'comments';

  view.innerHTML = html`
    <div class="chip-row">
      <button class="chip" data-tab="comments" aria-pressed="true">Comments</button>
      <button class="chip" data-tab="template" aria-pressed="false">Master Template</button>
    </div>
    <div id="pane"></div>
  `;
  const pane = view.querySelector('#pane');

  on(view, 'click', '[data-tab]', (_e, el) => {
    tab = el.dataset.tab;
    view.querySelectorAll('[data-tab]').forEach((c) => c.setAttribute('aria-pressed', c === el));
    draw();
  });

  draw();

  async function draw() {
    if (tab === 'comments') await commentsPane(pane);
    else await templatePane(pane);
  }
}

// ---------------------------------------------------------------- comments

async function commentsPane(pane) {
  const comments = await store.listComments();
  const categories = ['All', ...new Set(comments.map((c) => c.category))];

  pane.innerHTML = html`
    <div class="note">These snippets appear when you tap <strong>From library</strong> on any checklist item in the field.</div>
    <div class="searchbar"><input type="text" id="q" placeholder="Search comments…"></div>
    <div class="chip-row" id="cats">${raw(categories.map((c, i) => `<button class="chip" data-c="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`).join(''))}</div>
    <button class="btn ghost wide" id="add" style="margin-bottom:12px">+ New Comment</button>
    <div class="list" id="rows"></div>
  `;

  let activeCat = 'All';
  const q = pane.querySelector('#q');
  const rows = pane.querySelector('#rows');

  function draw() {
    const term = q.value.trim().toLowerCase();
    const filtered = comments.filter((c) =>
      (activeCat === 'All' || c.category === activeCat) &&
      (!term || `${c.title} ${c.body}`.toLowerCase().includes(term)));
    rows.innerHTML = filtered.map((c) => `
      <div class="item" data-open="${c.id}">
        <div class="g">
          <div class="t">${esc(c.title)} <span class="pill">${esc(c.category)}</span>${c.subgroup ? ` <span class="pill accent">${esc(c.subgroup)}</span>` : ''}</div>
          <div class="s">${esc((c.body || '').slice(0, 90))}</div>
        </div>
        <span class="chev">&#8250;</span>
      </div>`).join('') || `<div class="empty small">No comments match.</div>`;
  }

  q.addEventListener('input', draw);
  on(pane.querySelector('#cats'), 'click', '[data-c]', (_e, el) => {
    activeCat = el.dataset.c;
    pane.querySelectorAll('#cats [data-c]').forEach((c) => c.setAttribute('aria-pressed', c === el));
    draw();
  });
  on(rows, 'click', '[data-open]', async (_e, el) => {
    const c = comments.find((x) => x.id === el.dataset.open);
    await editComment(c);
  });
  pane.querySelector('#add').onclick = () => editComment(store.newComment());

  async function editComment(comment) {
    const isNew = !comment.title && !comment.body;
    await sheet(isNew ? 'New Comment' : 'Edit Comment', (body, close) => {
      body.innerHTML = html`
        <label class="f"><span>Category</span><input type="text" data-k="category" value="${esc(comment.category)}" list="cat-list"></label>
        <datalist id="cat-list">${raw([...new Set(comments.map((c) => c.category))].map((c) => `<option value="${esc(c)}">`).join(''))}</datalist>
        <label class="f"><span>Subsection</span><input type="text" data-k="subgroup" value="${esc(comment.subgroup || '')}" list="sub-list" placeholder="e.g. Siding, Windows, Water Heater — optional"></label>
        <div class="note small" style="margin-bottom:8px">Groups this comment under a topic within its category, so "From library" on a specific item lands on just its 5-6 comments instead of the whole section. Leave blank to keep it in the general list.</div>
        <datalist id="sub-list">${raw([...new Set(comments.map((c) => c.subgroup).filter(Boolean))].map((c) => `<option value="${esc(c)}">`).join(''))}</datalist>
        <label class="f"><span>Title</span><input type="text" data-k="title" value="${esc(comment.title)}"></label>
        <div class="note small" style="margin-bottom:8px">For a fact that varies every job (age, capacity, a measurement), use <code>{Fill:years}</code> or <code>{Fill:gallons}</code> — you'll be prompted for the value when you insert it, instead of writing 15 versions of the same comment.</div>
        <label class="f"><span>Comment body</span><textarea data-k="body">${esc(comment.body)}</textarea></label>
        <label class="f"><span>Recommendation (optional)</span><textarea data-k="recommendation">${esc(comment.recommendation || '')}</textarea></label>
        <label class="f"><span>Default severity</span>
          <select data-k="severity">${raw(store.SEVERITY.map((s) => `<option value="${s.v}" ${s.v === comment.severity ? 'selected' : ''}>${esc(s.label)}</option>`).join(''))}</select></label>
        <div class="stack" style="margin-top:6px">
          <button class="btn primary wide" data-save>Save</button>
          ${raw(!isNew ? '<button class="btn danger wide" data-del>Delete</button>' : '')}
        </div>`;
      body.querySelector('[data-save]').onclick = async () => {
        const out = { ...comment };
        body.querySelectorAll('[data-k]').forEach((el) => { out[el.dataset.k] = el.dataset.k === 'severity' ? Number(el.value) : el.value.trim(); });
        if (!out.title || !out.body) { toast('Title and body are required'); return; }
        await store.saveComment(out);
        close(true);
      };
      const delBtn = body.querySelector('[data-del]');
      if (delBtn) delBtn.onclick = async () => {
        if (!await confirmSheet('Delete this comment?', 'It will be removed from the library.')) return;
        await store.deleteComment(comment.id);
        close(true);
      };
    }, { dismissible: false });
    await commentsPane(pane);
  }

  draw();
}

// ---------------------------------------------------------------- template

async function templatePane(pane) {
  const tpls = await store.listTemplates();
  const tpl = tpls.find((t) => t.builtIn) || tpls[0];
  if (!tpl) { pane.innerHTML = `<div class="empty small">No template found.</div>`; return; }

  pane.innerHTML = html`
    <div class="note">Editing here changes the starting checklist for every <strong>new</strong> inspection. Jobs already in progress keep their own copy — edit those from the job itself.</div>
    <div class="spread"><h2 style="margin-top:0">${esc(tpl.name)}</h2>
      <button class="btn sm ghost" data-add-section>+ Section</button></div>
    <div id="sections"></div>
  `;
  const host = pane.querySelector('#sections');
  const openSections = new Set();
  draw();
  bind(); // delegated listeners on the stable `host` — attach once, not per draw, or handlers fire once per past draw

  function draw() {
    host.innerHTML = tpl.sections.map((s) => `
      <details class="sec" data-s="${s.id}" ${openSections.has(s.id) ? 'open' : ''}>
        <summary><span>${esc(s.title)}</span><span class="count">${s.items.length} items</span></summary>
        <div class="body">
          <div class="opts">
            ${s.items.map((it) => `<button data-item="${it.id}">${esc(it.label)} <span class="small muted">— ${esc(ITEM_TYPES[it.type]?.label || it.type)}</span></button>`).join('')}
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn sm ghost" data-add-item="${s.id}">+ Item</button>
            <button class="btn sm ghost" data-rename="${s.id}">Rename</button>
            <button class="btn sm danger" data-del-section="${s.id}">Delete Section</button>
          </div>
        </div>
      </details>`).join('');
    host.querySelectorAll('.sec').forEach((det) => {
      det.addEventListener('toggle', () => {
        if (det.open) openSections.add(det.dataset.s);
        else openSections.delete(det.dataset.s);
      });
    });
  }

  function bind() {
    on(host, 'click', '[data-item]', async (_e, el) => {
      const item = findItem(el.dataset.item);
      const choice = await chooseSheet(item.label, [
        { value: 'rename', label: 'Rename' },
        { value: 'delete', label: 'Delete' },
      ]);
      if (choice === 'rename') {
        const label = await promptSheet('Rename Item', { value: item.label });
        if (label) { item.label = label; await persist(); }
      } else if (choice === 'delete') {
        if (!await confirmSheet('Delete this item?', 'It will no longer appear on new inspections.')) return;
        removeItem(item.id);
        await persist();
      }
    });
    on(host, 'click', '[data-add-item]', async (_e, el) => {
      const type = await chooseSheet('New Item Type', NEW_ITEM_TYPES.map((t) => ({ value: t.value, label: t.label, hint: t.hint })));
      if (!type) return;
      const label = await promptSheet('New Item', { placeholder: type === 'select' ? 'e.g. Water Heater Brand' : 'e.g. Well pump' });
      if (!label) return;
      let options = null;
      if (type === 'select') {
        const csv = await promptSheet('Pick List Options', { label: 'Options, separated by commas', placeholder: 'e.g. Trane, Carrier, Rheem, Lennox' });
        if (!csv) return;
        options = csv.split(',').map((s) => s.trim()).filter(Boolean);
        if (!options.length) return;
      }
      findSection(el.dataset.addItem).items.push(newItem(label, type, options));
      await persist();
    });
    on(host, 'click', '[data-rename]', async (_e, el) => {
      const section = findSection(el.dataset.rename);
      const title = await promptSheet('Rename Section', { value: section.title });
      if (title) { section.title = title; await persist(); }
    });
    on(host, 'click', '[data-del-section]', async (_e, el) => {
      if (!await confirmSheet('Delete this section?', 'It will no longer appear on new inspections.')) return;
      tpl.sections = tpl.sections.filter((s) => s.id !== el.dataset.delSection);
      await persist();
    });
  }

  pane.querySelector('[data-add-section]').onclick = async () => {
    const title = await promptSheet('New Section', { placeholder: 'e.g. Solar Array' });
    if (!title) return;
    const section = newSection(title);
    tpl.sections.push(section);
    openSections.add(section.id);
    await persist();
  };

  function findSection(id) { return tpl.sections.find((s) => s.id === id); }
  function findItem(id) { for (const s of tpl.sections) { const it = s.items.find((i) => i.id === id); if (it) return it; } return null; }
  function removeItem(id) { for (const s of tpl.sections) s.items = s.items.filter((i) => i.id !== id); }

  async function persist() {
    await store.saveTemplate(tpl);
    draw();
  }
}
