// Admin: round-trip mileage, income, and expenses — the numbers a solo
// inspector needs at tax time. Job fees (inspection.fee/.paid) and mileage
// (inspection.roundTripMiles) already live on each job; this view is where
// they get aggregated by year, alongside a simple ledger for everything
// else money-related (business expenses, and income that isn't a job fee).

import * as store from '../core/store.js';
import { roundTripMiles } from '../core/routing.js';
import { html, raw, esc, on, setTopbar, sheet, toast, confirmSheet, downloadBlob, fmtDate } from '../core/ui.js';
import { go } from '../core/router.js';
import { mountPhotos } from './photos.js';

// Receipt photos reuse the media store's (inspectionId, slot) pattern —
// a transaction isn't a job, but passing its own id as that key scopes
// photos to it just as well without a schema change.
const RECEIPT_SLOT = 'receipt';

function yearOf(dateStr) {
  return dateStr ? Number(String(dateStr).slice(0, 4)) : null;
}

function money(n) {
  return `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function adminView(view, { year: yearParam } = {}) {
  setTopbar({ title: 'Admin', back: () => go('/settings'), actions: [] });

  const [settings, inspections, clients, properties, transactions] = await Promise.all([
    store.getSettings(),
    store.listInspections(),
    store.listClients(),
    Promise.resolve(null), // properties fetched per-inspection below (no bulk list helper)
    store.listTransactions(),
  ]);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const propertyCache = new Map();
  async function propertyFor(inspection) {
    if (!inspection.propertyId) return null;
    if (!propertyCache.has(inspection.propertyId)) propertyCache.set(inspection.propertyId, await store.getProperty(inspection.propertyId));
    return propertyCache.get(inspection.propertyId);
  }
  // Warm the cache before first render so property addresses are available synchronously below.
  await Promise.all(inspections.map(propertyFor));

  const jobDate = (i) => i.inspectedAt || i.scheduledAt || '';
  const years = new Set();
  for (const i of inspections) { const y = yearOf(jobDate(i)); if (y) years.add(y); }
  for (const t of transactions) { const y = yearOf(t.date); if (y) years.add(y); }
  years.add(new Date().getFullYear());
  const yearList = [...years].sort((a, b) => b - a);
  let year = Number(yearParam) || new Date().getFullYear();
  if (!years.has(year)) years.add(year);

  await render();

  async function render() {
    const yearInspections = inspections.filter((i) => yearOf(jobDate(i)) === year).sort((a, b) => jobDate(b).localeCompare(jobDate(a)));
    const yearTx = transactions.filter((t) => yearOf(t.date) === year);

    const jobIncome = yearInspections.filter((i) => i.paid).reduce((s, i) => s + (Number(i.fee) || 0), 0);
    const miscIncome = yearTx.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalIncome = jobIncome + miscIncome;
    const totalExpenses = yearTx.filter((t) => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalMiles = yearInspections.reduce((s, i) => s + (Number(i.roundTripMiles) || 0), 0);
    const mileageValue = settings.mileageRate != null ? totalMiles * Number(settings.mileageRate) : null;
    const net = totalIncome - totalExpenses;

    const hqReady = settings.hqLat != null && settings.hqLon != null;
    const missingMileageCount = yearInspections.filter((i) => i.roundTripMiles == null && (i.propertyId)).length;

    view.innerHTML = html`
      <div class="row wrap" style="gap:8px;margin-bottom:14px">
        <select data-year style="flex:0 0 auto">
          ${raw(yearList.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join(''))}
        </select>
        <span class="spacer"></span>
        <button class="btn sm ghost" data-export>Export CSV</button>
      </div>

      <div class="card stack">
        <h3 style="margin:0">Summary — ${year}</h3>
        <div class="kv">
          <dt>Income (job fees paid)</dt><dd>${money(jobIncome)}</dd>
          ${raw(miscIncome ? `<dt>Income (other)</dt><dd>${money(miscIncome)}</dd>` : '')}
          <dt>Total income</dt><dd><strong>${money(totalIncome)}</strong></dd>
          <dt>Expenses</dt><dd>${money(totalExpenses)}</dd>
          <dt>Net</dt><dd><strong>${money(net)}</strong></dd>
          <dt>Mileage</dt><dd>${totalMiles.toFixed(1)} mi${mileageValue != null ? ` (${money(mileageValue)} deduction)` : ' (set a mileage rate in Setup to see the deduction value)'}</dd>
        </div>
      </div>

      ${raw(!hqReady ? `<div class="note warn" style="margin-top:14px">No home base address located yet — <a href="#/settings">set one in Setup</a> so round-trip mileage can calculate automatically.</div>` : '')}
      ${raw(hqReady && missingMileageCount ? `<button class="btn wide" data-calc-all style="margin-top:14px">Calculate mileage for ${missingMileageCount} job${missingMileageCount === 1 ? '' : 's'} missing it</button>` : '')}

      <div class="spread" style="margin-top:22px"><h2 style="margin:0">Jobs — ${year}</h2></div>
      <div class="list">
        ${raw(yearInspections.map((i) => jobRow(i)).join('') || '<div class="empty small">No jobs this year.</div>')}
      </div>

      <div class="spread" style="margin-top:22px">
        <h2 style="margin:0">Income & Expenses</h2>
        <button class="btn sm primary" data-add-tx>+ Add</button>
      </div>
      <div class="list">
        ${raw(yearTx.map((t) => txRow(t)).join('') || '<div class="empty small">No other income or expenses logged for this year.</div>')}
      </div>
    `;

    function jobRow(i) {
      const client = clientById.get(i.clientId);
      const property = propertyCache.get(i.propertyId);
      const label = property ? store.propertyLabel(property) : (client?.name || 'Job');
      return `<a class="item" href="#/inspection/${i.id}">
        <div class="g"><div class="t">${esc(label)}</div>
          <div class="s">${esc(fmtDate(jobDate(i)))} · ${i.fee ? money(i.fee) : 'No fee set'}${i.paid ? '' : ' (unpaid)'}</div></div>
        <span class="pill ${i.roundTripMiles != null ? 'ok' : ''}">${i.roundTripMiles != null ? `${Number(i.roundTripMiles).toFixed(1)} mi` : 'No mileage'}</span>
      </a>`;
    }

    function txRow(t) {
      return `<div class="item" data-tx="${t.id}" style="cursor:pointer">
        <div class="g"><div class="t">${esc(t.description || t.category)}</div>
          <div class="s">${esc(fmtDate(t.date))} · ${esc(t.category)}</div></div>
        <span class="pill ${t.type === 'income' ? 'ok' : 'bad'}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</span>
      </div>`;
    }

    bind();
  }

  function bind() {
    view.querySelector('[data-year]').onchange = (e) => {
      year = Number(e.target.value);
      render();
    };

    view.querySelector('[data-export]').onclick = () => exportCsv();

    view.querySelector('[data-calc-all]')?.addEventListener('click', async () => {
      toast('Calculating mileage…', 15000);
      const yearInspections = inspections.filter((i) => yearOf(jobDate(i)) === year && i.roundTripMiles == null && i.propertyId);
      let done = 0;
      for (const i of yearInspections) {
        const property = propertyCache.get(i.propertyId);
        if (!property?.lat || !property?.lon) continue;
        // Sequential, not Promise.all — same reasoning as geocode.js: a free
        // public routing endpoint, keep the request rate gentle.
        // eslint-disable-next-line no-await-in-loop
        const miles = await roundTripMiles({ lat: settings.hqLat, lon: settings.hqLon }, { lat: property.lat, lon: property.lon });
        if (miles != null) {
          i.roundTripMiles = miles;
          // eslint-disable-next-line no-await-in-loop
          await store.saveInspection(i);
          done += 1;
        }
      }
      toast(done ? `Calculated mileage for ${done} job${done === 1 ? '' : 's'}` : 'Could not calculate mileage — check property addresses have a located coordinate');
      render();
    });

    on(view, 'click', '[data-tx]', async (_e, el) => {
      const t = transactions.find((x) => x.id === el.dataset.tx);
      if (!t) return;
      await editTransaction(t);
    });

    view.querySelector('[data-add-tx]').onclick = async () => {
      const isCurrentYear = year === new Date().getFullYear();
      await editTransaction(store.newTransaction(isCurrentYear ? {} : { date: `${year}-01-01` }));
    };
  }

  async function editTransaction(t) {
    const isNew = !transactions.includes(t);
    const result = await sheet(isNew ? 'Add Entry' : 'Edit Entry', (body, close) => {
      body.innerHTML = html`
        <div class="opts" data-type-toggle>
          <button data-v="expense" aria-pressed="${t.type === 'expense'}">Expense</button>
          <button data-v="income" aria-pressed="${t.type === 'income'}">Income</button>
        </div>
        <label class="f"><span>Date</span><input type="date" data-date value="${esc(t.date || '')}"></label>
        <label class="f"><span>Amount ($)</span><input type="number" step="0.01" inputmode="decimal" data-amount value="${esc(t.amount || '')}"></label>
        <label class="f"><span>Category</span>
          <select data-category>${raw(store.EXPENSE_CATEGORIES.map((c) => `<option ${c === t.category ? 'selected' : ''}>${esc(c)}</option>`).join(''))}</select></label>
        <label class="f"><span>Description</span><input type="text" data-description value="${esc(t.description || '')}" placeholder="e.g. Ladder, ProLab renewal"></label>
        <div class="photo-slot" data-photos style="margin-top:10px"></div>
        <button class="btn primary wide" data-save style="margin-top:6px">Save</button>
        ${raw(!isNew ? '<button class="btn danger wide" data-delete style="margin-top:8px">Delete</button>' : '')}
      `;
      mountPhotos(body.querySelector('[data-photos]'), { inspectionId: t.id, slot: RECEIPT_SLOT, label: 'Receipt Photo' });
      let type = t.type;
      on(body, 'click', '[data-type-toggle] [data-v]', (_e, el) => {
        type = el.dataset.v;
        body.querySelectorAll('[data-type-toggle] [data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === type));
      });
      body.querySelector('[data-save]').onclick = () => {
        const amount = Number(body.querySelector('[data-amount]').value);
        const date = body.querySelector('[data-date]').value;
        if (!date) { toast('Date is required'); return; }
        if (!amount) { toast('Amount is required'); return; }
        close({
          action: 'save',
          value: {
            ...t, type, date, amount,
            category: body.querySelector('[data-category]').value,
            description: body.querySelector('[data-description]').value.trim(),
          },
        });
      };
      body.querySelector('[data-delete]')?.addEventListener('click', async () => {
        if (!await confirmSheet('Delete this entry?', 'It will be removed permanently.')) return;
        close({ action: 'delete' });
      });
    }, { dismissible: true });

    if (!result) return;
    if (result.action === 'delete') {
      await store.deleteTransaction(t.id);
      const idx = transactions.findIndex((x) => x.id === t.id);
      if (idx >= 0) transactions.splice(idx, 1);
      toast('Entry deleted');
    } else {
      await store.saveTransaction(result.value);
      const idx = transactions.findIndex((x) => x.id === t.id);
      if (idx >= 0) transactions[idx] = result.value; else transactions.push(result.value);
      toast('Saved');
    }
    render();
  }

  function exportCsv() {
    const yearInspections = inspections.filter((i) => yearOf(jobDate(i)) === year);
    const yearTx = transactions.filter((t) => yearOf(t.date) === year);
    const rows = [['Date', 'Type', 'Category/Client', 'Description', 'Amount', 'Miles']];
    for (const i of yearInspections.sort((a, b) => jobDate(a).localeCompare(jobDate(b)))) {
      const client = clientById.get(i.clientId);
      const property = propertyCache.get(i.propertyId);
      rows.push([jobDate(i), 'Job Income', client?.name || '', property ? store.propertyLabel(property) : '', i.paid ? (i.fee || 0) : 0, i.roundTripMiles ?? '']);
    }
    for (const t of yearTx.sort((a, b) => (a.date || '').localeCompare(b.date || ''))) {
      rows.push([t.date, t.type === 'income' ? 'Other Income' : 'Expense', t.category, t.description, t.type === 'expense' ? -Math.abs(t.amount) : t.amount, '']);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `income-expenses-${year}.csv`);
    toast('CSV saved');
  }
}
