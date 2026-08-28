// Tiny render + interaction helpers. No framework, no build step.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Tagged template that escapes interpolations. Use `raw()` to opt out. */
export function html(strings, ...vals) {
  return strings.reduce((out, s, i) => {
    if (i === 0) return s;
    const v = vals[i - 1];
    const chunk = v && v.__raw ? v.value
      : Array.isArray(v) ? v.map((x) => (x && x.__raw ? x.value : esc(x))).join('')
        : esc(v);
    return out + chunk + s;
  }, '');
}

export const raw = (value) => ({ __raw: true, value: value ?? '' });

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Delegated listener registry, keyed per-root so a second `on()` call for the
// same (event, selector) REPLACES the first instead of stacking another one.
// `view`/`host`/`pane` containers are long-lived DOM nodes reused across many
// renders and, for top-level views, across every navigation back to that
// screen for the life of the session — without this, each visit/render added
// one more listener, so a single tap could fire a handler (and open a sheet)
// once per past visit.
const delegated = new WeakMap();

export function on(root, event, selector, handler) {
  const key = `${event}::${selector}`;
  let forRoot = delegated.get(root);
  if (!forRoot) { forRoot = new Map(); delegated.set(root, forRoot); }
  const prev = forRoot.get(key);
  if (prev) root.removeEventListener(event, prev);
  const listener = (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  };
  root.addEventListener(event, listener);
  forRoot.set(key, listener);
}

let toastTimer;
export function toast(message, ms = 2100) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/**
 * Bottom sheet. `build(body, close)` fills the content element.
 * Resolves with whatever `close(value)` is called with.
 */
export function sheet(title, build, { dismissible = true } = {}) {
  return new Promise((resolve) => {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = html`<div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-h"><h2 style="margin:0;font-size:18px">${title}</h2>
      <button class="x" aria-label="Close">&#10005;</button></div>
      <div class="sheet-body"></div></div>`;
    document.getElementById('modal-root').appendChild(bg);
    document.body.style.overflow = 'hidden';

    const close = (value) => {
      document.body.style.overflow = '';
      bg.remove();
      resolve(value);
    };
    bg.querySelector('.x').onclick = () => close(undefined);
    if (dismissible) bg.addEventListener('click', (e) => { if (e.target === bg) close(undefined); });
    build(bg.querySelector('.sheet-body'), close);
  });
}

export function confirmSheet(title, message, { danger = true, okLabel = 'Delete' } = {}) {
  return sheet(title, (body, close) => {
    body.innerHTML = html`<p class="muted">${message}</p>
      <div class="stack" style="margin-top:16px">
        <button class="btn wide ${raw(danger ? 'danger' : 'primary')}" data-ok>${okLabel}</button>
        <button class="btn wide ghost" data-cancel>Cancel</button>
      </div>`;
    body.querySelector('[data-ok]').onclick = () => close(true);
    body.querySelector('[data-cancel]').onclick = () => close(false);
  }).then((v) => v === true);
}

export function promptSheet(title, { label = '', value = '', placeholder = '', multiline = false, okLabel = 'Save' } = {}) {
  return sheet(title, (body, close) => {
    body.innerHTML = html`<label class="f"><span>${label}</span>
      ${raw(multiline
        ? `<textarea data-in placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
        : `<input type="text" data-in value="${esc(value)}" placeholder="${esc(placeholder)}">`)}
      </label>
      <button class="btn primary wide" data-ok>${okLabel}</button>`;
    const input = body.querySelector('[data-in]');
    body.querySelector('[data-ok]').onclick = () => close(input.value.trim());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !multiline) close(input.value.trim()); });
    setTimeout(() => input.focus(), 60);
  });
}

/** Choice list. options: [{value,label,hint}] */
export function chooseSheet(title, options, { current = null } = {}) {
  return sheet(title, (body, close) => {
    body.innerHTML = html`<div class="opts">${options.map((o) => raw(
      `<button data-v="${esc(o.value)}" aria-pressed="${o.value === current}">
        <div style="font-weight:650">${esc(o.label)}</div>
        ${o.hint ? `<div class="small muted">${esc(o.hint)}</div>` : ''}
      </button>`))}</div>`;
    on(body, 'click', '[data-v]', (_e, el) => close(el.dataset.v));
  });
}

export function fmtDate(value) {
  if (!value) return '';
  const d = typeof value === 'number' ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Save-on-idle: field edits shouldn't hit IndexedDB on every keystroke. */
export function debounce(fn, ms = 500) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
  return wrapped;
}

export function setTopbar({ title, back = false, actions = [] }) {
  document.getElementById('tb-title').textContent = title;
  const backBtn = document.getElementById('btn-back');
  backBtn.hidden = !back;
  backBtn.onclick = () => (typeof back === 'function' ? back() : history.back());
  const bar = document.getElementById('tb-actions');
  bar.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.textContent = a.label;
    b.onclick = a.onClick;
    bar.appendChild(b);
  }
}

/** Download a Blob. On iOS this opens the share sheet via a normal link tap. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}

export function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'untitled';
}
