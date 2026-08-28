import * as db from './core/db.js';
import * as store from './core/store.js';
import { $$ } from './core/ui.js';
import { route, start, currentPath, go } from './core/router.js';

import { dashboard } from './views/dashboard.js';
import { clientList, clientDetail } from './views/clients.js';
import { contactsView } from './views/contacts.js';
import { inspectionList } from './views/inspections.js';
import { newInspectionFlow, inspectionWorkspace } from './views/inspection.js';
import { checklistNav } from './views/checklist-nav.js';
import { formView } from './views/forms-view.js';
import { agreementView } from './views/agreement.js';
import { reportView } from './views/report.js';
import { libraryView } from './views/library.js';
import { settingsView } from './views/settings.js';

const view = document.getElementById('view');

route('/dashboard', () => dashboard(view));
route('/clients', () => clientList(view));
route('/client/:id', (p) => clientDetail(view, p));
route('/inspections', () => inspectionList(view));
route('/inspection/new', (p) => newInspectionFlow(view, p));
route('/inspection/:id', (p) => inspectionWorkspace(view, p));
route('/inspection/:id/checklist', (p) => checklistNav(view, p));
route('/inspection/:id/checklist/:sectionId', (p) => checklistNav(view, p));
route('/inspection/:id/form/:formId', (p) => formView(view, p));
route('/inspection/:id/agreement', (p) => agreementView(view, p));
route('/inspection/:id/report', (p) => reportView(view, p));
route('/library', () => libraryView(view));
route('/contacts', () => contactsView(view));
route('/settings', () => settingsView(view));

function updateTabbar() {
  const path = currentPath();
  $$('.tab').forEach((tab) => {
    const target = tab.dataset.route.replace('#', '');
    const section = '/' + target.split('/')[1];
    tab.classList.toggle('active', path === target || path.startsWith(section));
  });
}

$$('.tab').forEach((tab) => {
  tab.addEventListener('click', (e) => { e.preventDefault(); go(tab.dataset.route.replace('#', '')); });
});

async function boot() {
  try {
    await db.open();
    await store.seedIfEmpty();
    await db.requestPersistence();
  } catch (err) {
    console.error('Startup failed', err);
    document.getElementById('boot').innerHTML =
      `<div class="boot-mark">!</div><div class="boot-text">Could not open local storage.<br>${String(err.message || err)}</div>`;
    return;
  }

  document.getElementById('boot').hidden = true;
  document.getElementById('topbar').hidden = false;
  document.getElementById('tabbar').hidden = false;
  view.hidden = false;

  start(updateTabbar);

  // The local dev server (serve.py) fights active development: the SW cache-first
  // strategy means edits never show up until a hard refresh — and testing over the
  // LAN from a phone hits the exact same problem the moment the served files change.
  // Never register it on localhost/127.0.0.1 or a private LAN address, and proactively
  // clear out any registration left over from an earlier session so a dev device can't
  // get stuck stale again. Only a real public HTTPS deploy gets the offline SW.
  const h = location.hostname;
  const isLocalDev = h === 'localhost' || h === '127.0.0.1'
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)
    || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h);
  if ('serviceWorker' in navigator) {
    if (isLocalDev) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    } else {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker registration failed', err));
    }
  }
}

boot().catch((err) => {
  console.error('Unhandled startup error', err);
  const boot_ = document.getElementById('boot');
  if (boot_) {
    boot_.hidden = false;
    boot_.innerHTML = `<div class="boot-mark">!</div><div class="boot-text">Something went wrong starting the app.<br>${String(err?.message || err)}</div>`;
  }
});
