import * as store from '../core/store.js';
import { html, raw, esc, on, setTopbar, fmtDate, today } from '../core/ui.js';
import { go } from '../core/router.js';

export async function dashboard(view) {
  const [jobs, clients, settings] = await Promise.all([
    store.listInspections(), store.listClients(), store.getSettings(),
  ]);

  const t = today();
  const byId = Object.fromEntries(clients.map((c) => [c.id, c]));
  const props = await Promise.all(jobs.map((j) => (j.propertyId ? store.getProperty(j.propertyId) : null)));
  const propById = {};
  jobs.forEach((j, i) => { propById[j.id] = props[i]; });

  const todays = jobs.filter((j) => j.scheduledAt === t && j.status !== 'Cancelled');
  const upcoming = jobs
    .filter((j) => j.scheduledAt && j.scheduledAt > t && j.status === 'Scheduled')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).slice(0, 5);
  const open = jobs.filter((j) => j.status === 'In Progress' || j.status === 'Report Draft');
  const recent = jobs.slice(0, 6);

  setTopbar({ title: settings.companyName || 'Dashboard', actions: [] });

  view.innerHTML = html`
    <h1>${greeting()}${settings.inspectorName ? `, ${settings.inspectorName.split(' ')[0]}` : ''}</h1>

    <div class="stat" style="margin:0 0 18px">
      <div class="s"><div class="n">${todays.length}</div><div class="l">Today</div></div>
      <div class="s"><div class="n">${open.length}</div><div class="l">Open jobs</div></div>
      <div class="s"><div class="n">${clients.length}</div><div class="l">Clients</div></div>
    </div>

    <button class="btn primary wide" data-new style="margin:0 0 18px">+ New Inspection</button>

    ${raw(todays.length ? `<h2>Today — ${esc(fmtDate(t))}</h2><div class="list">${todays.map(row).join('')}</div>` : '')}
    ${raw(open.length ? `<h2>In progress</h2><div class="list">${open.map(row).join('')}</div>` : '')}
    ${raw(upcoming.length ? `<h2>Upcoming</h2><div class="list">${upcoming.map(row).join('')}</div>` : '')}

    ${raw(!jobs.length ? `
      <div class="empty">
        <div class="big">&#9635;</div>
        <p><strong>No inspections yet.</strong></p>
        <p class="small">Create your first job, or set up your company details first so they flow onto every report and form.</p>
        <button class="btn ghost" data-settings style="margin-top:8px">Open Setup</button>
      </div>` : `<h2>Recent</h2><div class="list">${recent.map(row).join('')}</div>`)}
  `;

  function row(j) {
    const c = byId[j.clientId];
    const p = propById[j.id];
    const addr = p ? store.propertyLabel(p) : (c?.name || 'Untitled job');
    const when = j.scheduledAt ? fmtDate(j.scheduledAt) : 'Unscheduled';
    return `<a class="item" href="#/inspection/${j.id}">
      <div class="g">
        <div class="t">${esc(addr)}</div>
        <div class="s">${esc(c?.name || 'No client')} · ${esc(when)} · ${esc(store.formatServices(j.services))}</div>
      </div>
      <span class="pill ${statusCls(j.status)}">${esc(j.status)}</span>
      <span class="chev">&#8250;</span>
    </a>`;
  }

  on(view, 'click', '[data-new]', () => go('/inspection/new'));
  on(view, 'click', '[data-settings]', () => go('/settings'));
}

export function statusCls(status) {
  return { 'Scheduled': 'accent', 'In Progress': 'warn', 'Report Draft': 'warn', 'Delivered': 'ok', 'Cancelled': '' }[status] || '';
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
