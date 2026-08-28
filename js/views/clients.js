import * as store from '../core/store.js';
import { html, raw, esc, on, setTopbar, sheet, toast, confirmSheet, fmtDate, debounce } from '../core/ui.js';
import { go } from '../core/router.js';
import { statusCls } from './dashboard.js';
import { searchAddress } from '../core/geocode.js';

export async function clientList(view) {
  const clients = await store.listClients();
  setTopbar({ title: 'Clients', actions: [{ label: '+ New', onClick: () => openClientForm() }] });

  view.innerHTML = html`
    <div class="searchbar"><input type="text" id="q" placeholder="Search clients…"></div>
    <div class="list" id="rows">${raw(clients.map(row).join(''))}</div>
    ${raw(!clients.length ? emptyState() : '')}
  `;

  function row(c) {
    return `<a class="item" href="#/client/${c.id}">
      <div class="g">
        <div class="t">${esc(c.name || 'Unnamed client')}</div>
        <div class="s">${esc(c.phone || c.email || 'No contact info')}</div>
      </div>
      <span class="chev">&#8250;</span>
    </a>`;
  }

  function emptyState() {
    return `<div class="empty"><div class="big">&#9679;</div><p><strong>No clients yet.</strong></p>
      <p class="small">Add a client to start scheduling inspections.</p></div>`;
  }

  const q = view.querySelector('#q');
  q.addEventListener('input', () => {
    const term = q.value.trim().toLowerCase();
    const filtered = !term ? clients : clients.filter((c) =>
      [c.name, c.phone, c.email, c.mailingAddress].join(' ').toLowerCase().includes(term));
    view.querySelector('#rows').innerHTML = filtered.map(row).join('') || `<div class="empty"><p class="small">No matches.</p></div>`;
  });

  async function openClientForm() {
    const c = await editClientSheet(store.newClient());
    if (c) { await store.saveClient(c); go(`/client/${c.id}`); }
  }
}

export async function clientDetail(view, { id }) {
  const client = await store.getClient(id);
  if (!client) { go('/clients', { replace: true }); return; }
  const [properties, jobs] = await Promise.all([store.propertiesFor(id), store.inspectionsFor(id)]);
  jobs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  setTopbar({
    title: client.name || 'Client', back: true,
    actions: [{ label: 'Edit', onClick: () => editClient() }],
  });

  view.innerHTML = html`
    <div class="card">
      <div class="kv">
        ${raw(client.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(client.phone)}">${esc(client.phone)}</a></dd>` : '')}
        ${raw(client.altPhone ? `<dt>Alt phone</dt><dd><a href="tel:${esc(client.altPhone)}">${esc(client.altPhone)}</a></dd>` : '')}
        ${raw(client.email ? `<dt>Email</dt><dd><a href="mailto:${esc(client.email)}">${esc(client.email)}</a></dd>` : '')}
        ${raw(client.mailingAddress ? `<dt>Mailing</dt><dd>${esc(client.mailingAddress)}</dd>` : '')}
        ${raw(client.referredBy ? `<dt>Referred by</dt><dd>${esc(client.referredBy)}</dd>` : '')}
      </div>
      ${raw(client.notes ? `<div class="hr"></div><p class="small">${esc(client.notes)}</p>` : '')}
    </div>

    <div class="spread"><h2 style="margin-top:0">Properties</h2>
      <button class="btn sm ghost" data-add-prop>+ Add</button></div>
    <div class="list" id="props">${raw(properties.map(propRow).join('') || `<div class="empty small">No properties on file.</div>`)}</div>

    <div class="spread"><h2>Inspections</h2>
      <button class="btn sm primary" data-new-job>+ New</button></div>
    <div class="list">${raw(jobs.map(jobRow).join('') || `<div class="empty small">No inspections yet.</div>`)}</div>

    <div class="hr"></div>
    <button class="btn danger wide" data-del>Delete Client</button>
  `;

  function propRow(p) {
    return `<div class="item" data-prop="${p.id}" style="cursor:pointer">
      <div class="g"><div class="t">${esc(store.propertyLabel(p))}</div>
      <div class="s">${esc(p.yearBuilt ? `Built ${p.yearBuilt}` : '')}${p.sqft ? ` · ${esc(p.sqft)} sqft` : ''}</div></div>
      <span class="chev">&#8250;</span></div>`;
  }
  function jobRow(j) {
    const when = j.scheduledAt ? fmtDate(j.scheduledAt) : 'Unscheduled';
    return `<a class="item" href="#/inspection/${j.id}">
      <div class="g"><div class="t">${esc(store.formatServices(j.services) || 'Inspection')}</div>
      <div class="s">${esc(when)}</div></div>
      <span class="pill ${statusCls(j.status)}">${esc(j.status)}</span>
      <span class="chev">&#8250;</span></a>`;
  }

  on(view, 'click', '[data-prop]', async (_e, el) => {
    const p = properties.find((x) => x.id === el.dataset.prop);
    const updated = await editPropertySheet(p, id);
    if (updated) { await store.saveProperty(updated); go(`/client/${id}`); }
  });

  view.querySelector('[data-add-prop]').onclick = async () => {
    const p = await editPropertySheet(store.newProperty({ clientId: id }), id);
    if (p) { await store.saveProperty(p); go(`/client/${id}`); }
  };

  view.querySelector('[data-new-job]').onclick = async () => {
    go(`/inspection/new?client=${id}${properties[0] ? `&property=${properties[0].id}` : ''}`);
  };

  view.querySelector('[data-del]').onclick = async () => {
    if (!await confirmSheet('Delete this client?', 'This also deletes their properties and every inspection job on file, including photos. This cannot be undone.')) return;
    await store.deleteClient(id);
    toast('Client deleted');
    go('/clients');
  };

  async function editClient() {
    const updated = await editClientSheet(client);
    if (updated) { await store.saveClient(updated); go(`/client/${id}`); }
  }
}

function editClientSheet(client) {
  return sheet(client.name ? 'Edit Client' : 'New Client', (body, close) => {
    body.innerHTML = html`
      <label class="f"><span>Full name</span><input type="text" data-k="name" value="${esc(client.name)}"></label>
      <div class="grid2">
        <label class="f"><span>Phone</span><input type="tel" data-k="phone" value="${esc(client.phone)}"></label>
        <label class="f"><span>Alt phone</span><input type="tel" data-k="altPhone" value="${esc(client.altPhone)}"></label>
      </div>
      <label class="f"><span>Email</span><input type="email" data-k="email" value="${esc(client.email)}"></label>
      <label class="f"><span>Mailing address</span><input type="text" data-k="mailingAddress" value="${esc(client.mailingAddress)}"></label>
      <label class="f"><span>Referred by</span><input type="text" data-k="referredBy" value="${esc(client.referredBy)}"></label>
      <label class="f"><span>Notes</span><textarea data-k="notes">${esc(client.notes)}</textarea></label>
      <button class="btn primary wide" data-save>Save Client</button>`;
    body.querySelector('[data-save]').onclick = () => {
      const out = { ...client };
      body.querySelectorAll('[data-k]').forEach((el) => { out[el.dataset.k] = el.value.trim(); });
      if (!out.name) { toast('Name is required'); return; }
      close(out);
    };
  }, { dismissible: false });
}

function editPropertySheet(p) {
  return sheet(p.address ? 'Edit Property' : 'New Property', (body, close) => {
    body.innerHTML = html`
      <label class="f"><span>Street address</span><input type="text" data-k="address" value="${esc(p.address)}" autocomplete="off"></label>
      <div class="opts" data-address-suggestions style="margin:-6px 0 10px"></div>
      <div class="grid2">
        <label class="f"><span>City</span><input type="text" data-k="city" value="${esc(p.city)}"></label>
        <label class="f"><span>Zip</span><input type="text" data-k="zip" value="${esc(p.zip)}"></label>
      </div>
      <div class="grid2">
        <label class="f"><span>County</span><input type="text" data-k="county" value="${esc(p.county)}"></label>
        <label class="f"><span>State</span><input type="text" data-k="state" value="${esc(p.state)}"></label>
      </div>
      <div class="grid2">
        <label class="f"><span>Year built</span><input type="number" data-k="yearBuilt" value="${esc(p.yearBuilt)}"></label>
        <label class="f"><span>Square footage</span><input type="number" data-k="sqft" value="${esc(p.sqft)}"></label>
      </div>
      <div class="grid2">
        <label class="f"><span>Stories</span><input type="number" data-k="stories" value="${esc(p.stories)}"></label>
        <label class="f"><span>Structure type</span>
          <select data-k="structureType">${raw(['Single Family', 'Duplex', 'Townhouse', 'Condominium Unit', 'Manufactured / Mobile Home'].map((o) =>
            `<option ${o === p.structureType ? 'selected' : ''}>${esc(o)}</option>`).join(''))}</select></label>
      </div>
      <label class="f"><span>Foundation</span>
        <select data-k="foundation">${raw(['Slab on grade', 'Stem wall', 'Crawlspace', 'Pier & beam', 'Basement'].map((o) =>
          `<option ${o === p.foundation ? 'selected' : ''}>${esc(o)}</option>`).join(''))}</select></label>
      <button class="btn primary wide" data-save>Save Property</button>`;

    const addressEl = body.querySelector('[data-k="address"]');
    const suggestionsEl = body.querySelector('[data-address-suggestions]');
    let candidates = [];
    const runSearch = debounce(async (query) => {
      candidates = await searchAddress(query);
      suggestionsEl.innerHTML = candidates.map((c, i) =>
        `<button type="button" data-suggestion="${i}">${esc(c.address || c.label)}<div class="small muted">${esc([c.city, c.state, c.zip].filter(Boolean).join(', '))}</div></button>`).join('');
    }, 500);
    addressEl.addEventListener('input', () => {
      suggestionsEl.innerHTML = '';
      if (addressEl.value.trim().length >= 5) runSearch(addressEl.value);
    });
    on(suggestionsEl, 'click', '[data-suggestion]', (_e, el) => {
      const c = candidates[Number(el.dataset.suggestion)];
      if (!c) return;
      addressEl.value = c.address || addressEl.value;
      const setIf = (key, val) => { if (val) body.querySelector(`[data-k="${key}"]`).value = val; };
      setIf('city', c.city);
      setIf('state', c.state);
      setIf('zip', c.zip);
      setIf('county', c.county);
      suggestionsEl.innerHTML = '';
    });

    body.querySelector('[data-save]').onclick = () => {
      const out = { ...p };
      body.querySelectorAll('[data-k]').forEach((el) => { out[el.dataset.k] = el.value.trim(); });
      if (!out.address) { toast('Street address is required'); return; }
      close(out);
    };
  }, { dismissible: false });
}

export { editClientSheet, editPropertySheet };
