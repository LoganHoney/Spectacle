import * as store from '../core/store.js';
import { html, raw, esc, on, setTopbar, sheet, toast, confirmSheet } from '../core/ui.js';

export async function contactsView(view) {
  setTopbar({ title: 'Contacts', actions: [{ label: '+ New', onClick: () => openContactForm() }] });

  const contacts = await store.listContacts();

  view.innerHTML = html`
    <div class="note">Repeat referral contacts — realtors, lenders, attorneys — saved once so you can pick them on a job instead of retyping. Separate from Clients, since the same realtor works with many different clients.</div>
    <div class="searchbar"><input type="text" id="q" placeholder="Search contacts…"></div>
    <div class="list" id="rows">${raw(contacts.map(row).join(''))}</div>
    ${raw(!contacts.length ? emptyState() : '')}
  `;

  function row(c) {
    return `<div class="item" data-open="${c.id}" style="cursor:pointer">
      <div class="g">
        <div class="t">${esc(c.name || 'Unnamed contact')} <span class="pill">${esc(c.role)}</span></div>
        <div class="s">${esc([c.company, c.phone, c.email].filter(Boolean).join(' · ') || 'No details')}</div>
      </div>
      <span class="chev">&#8250;</span>
    </div>`;
  }

  function emptyState() {
    return `<div class="empty"><div class="big">&#9679;</div><p><strong>No contacts yet.</strong></p>
      <p class="small">Add a realtor, lender, or other repeat contact to pick them quickly on future jobs.</p></div>`;
  }

  const q = view.querySelector('#q');
  q.addEventListener('input', () => {
    const term = q.value.trim().toLowerCase();
    const filtered = !term ? contacts : contacts.filter((c) =>
      [c.name, c.company, c.phone, c.email, c.role].join(' ').toLowerCase().includes(term));
    view.querySelector('#rows').innerHTML = filtered.map(row).join('') || `<div class="empty"><p class="small">No matches.</p></div>`;
  });

  on(view, 'click', '[data-open]', async (_e, el) => {
    const c = contacts.find((x) => x.id === el.dataset.open);
    await openContactForm(c);
  });

  async function openContactForm(existing) {
    const c = await editContactSheet(existing || store.newContact());
    if (c) {
      await store.saveContact(c);
      toast('Contact saved');
    }
    contactsView(view); // refresh either way — a delete inside the sheet needs this too
  }
}

export function editContactSheet(contact) {
  return sheet(contact.name ? 'Edit Contact' : 'New Contact', (body, close) => {
    body.innerHTML = html`
      <label class="f"><span>Name</span><input type="text" data-k="name" value="${esc(contact.name)}"></label>
      <label class="f"><span>Role</span>
        <select data-k="role">${raw(store.CONTACT_ROLES.map((r) => `<option ${r === contact.role ? 'selected' : ''}>${esc(r)}</option>`).join(''))}</select></label>
      <label class="f"><span>Company</span><input type="text" data-k="company" value="${esc(contact.company)}"></label>
      <div class="grid2">
        <label class="f"><span>Phone</span><input type="tel" data-k="phone" value="${esc(contact.phone)}"></label>
        <label class="f"><span>Email</span><input type="email" data-k="email" value="${esc(contact.email)}"></label>
      </div>
      <label class="f"><span>Notes</span><textarea data-k="notes">${esc(contact.notes)}</textarea></label>
      <div class="stack" style="margin-top:6px">
        <button class="btn primary wide" data-save>Save Contact</button>
        ${raw(contact.name ? '<button class="btn danger wide" data-del>Delete Contact</button>' : '')}
      </div>`;
    body.querySelector('[data-save]').onclick = () => {
      const out = { ...contact };
      body.querySelectorAll('[data-k]').forEach((el) => { out[el.dataset.k] = el.value.trim(); });
      if (!out.name) { toast('Name is required'); return; }
      close(out);
    };
    body.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!await confirmSheet('Delete this contact?', 'It will be removed from your contact list. Jobs that already reference it keep the name they had at the time.')) return;
      await store.deleteContact(contact.id);
      close(null);
      toast('Contact deleted');
    });
  }, { dismissible: false });
}
