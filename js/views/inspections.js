import * as store from '../core/store.js';
import { html, raw, esc, on, setTopbar, fmtDate } from '../core/ui.js';
import { go } from '../core/router.js';
import { statusCls } from './dashboard.js';

export async function inspectionList(view) {
  const jobs = await store.listInspections();
  const clients = Object.fromEntries((await store.listClients()).map((c) => [c.id, c]));
  const props = {};
  await Promise.all(jobs.map(async (j) => { if (j.propertyId) props[j.id] = await store.getProperty(j.propertyId); }));

  setTopbar({ title: 'Inspections', actions: [{ label: '+ New', onClick: () => go('/inspection/new') }] });

  view.innerHTML = html`
    <div class="chip-row" id="filters">
      ${raw(['All', ...store.STATUS].map((s, i) => `<button class="chip" data-s="${esc(s)}" aria-pressed="${i === 0}">${esc(s)}</button>`).join(''))}
    </div>
    <div class="list" id="rows"></div>
  `;

  const rowsEl = view.querySelector('#rows');
  const filtersEl = view.querySelector('#filters');

  function draw(status) {
    const filtered = status === 'All' ? jobs : jobs.filter((j) => j.status === status);
    rowsEl.innerHTML = filtered.map(row).join('') ||
      `<div class="empty"><div class="big">&#9635;</div><p class="small">No inspections in this status.</p></div>`;
  }

  function row(j) {
    const c = clients[j.clientId];
    const p = props[j.id];
    const title = p ? store.propertyLabel(p) : (c?.name || 'Untitled job');
    const when = j.scheduledAt ? fmtDate(j.scheduledAt) : 'Unscheduled';
    return `<a class="item" href="#/inspection/${j.id}">
      <div class="g">
        <div class="t">${esc(title)}</div>
        <div class="s">${esc(c?.name || 'No client')} · ${esc(when)}</div>
      </div>
      <span class="pill ${statusCls(j.status)}">${esc(j.status)}</span>
      <span class="chev">&#8250;</span>
    </a>`;
  }

  on(filtersEl, 'click', '.chip', (_e, el) => {
    filtersEl.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === el));
    draw(el.dataset.s);
  });

  draw('All');
}
