// Domain model + CRUD on top of db.js

import * as db from './db.js';
import { defaultTemplate, cloneTemplate } from '../report/template.js';
import { STARTER_COMMENTS, COMMENTS_VERSION } from '../report/comments.js';

export const uid = db.uid;

export const STATUS = ['Scheduled', 'In Progress', 'Report Draft', 'Delivered', 'Cancelled'];

export const SERVICE_TYPES = [
  'Full Home Inspection',
  '4-Point (Citizens)',
  'Wind Mitigation (OIR-B1-1802)',
  'Roof Certification',
  'Re-Inspection',
  'New Construction / Phase',
];

export const CONTACT_ROLES = ['Realtor / Agent', 'Lender', 'Attorney', 'Property Manager', 'Other'];

export const SEVERITY = [
  { v: 0, label: 'Info',        cls: 'sev-0' },
  { v: 1, label: 'Maintenance', cls: 'sev-1' },
  { v: 2, label: 'Minor',       cls: 'sev-2' },
  { v: 3, label: 'Major',       cls: 'sev-3' },
  { v: 4, label: 'Safety',      cls: 'sev-4' },
];

export const sevLabel = (v) => (SEVERITY.find((s) => s.v === Number(v)) || SEVERITY[0]).label;

export function formatServices(services) {
  return services?.length ? services.join(' + ') : '';
}

// ---------- settings ----------

const SETTINGS_DEFAULTS = {
  companyName: 'Hernando Inspections',
  inspectorName: '',
  inspectorTitle: 'Owner',
  license: '',
  licenseType: 'Florida Home Inspector (HI)',
  phone: '',
  email: 'hernandoinspections@gmail.com',
  website: '',
  addressLine: '',
  logoDataUrl: '',
  defaultFee: '',
  reportFooter: 'This report is the exclusive property of the inspection company and the client named herein.',
  agreementTemplate: '',
  emailTemplates: {},
  signingApiUrl: 'https://spectacle-1ipx.onrender.com',
  savedSignature: '',
  photoMaxEdge: 1600,
  photoQuality: 0.72,
  seededComments: false,
  // Home base for round-trip mileage — the "from" side of every job's route.
  hqAddress: '', hqCity: '', hqState: 'FL', hqZip: '', hqLat: null, hqLon: null,
  // Cents-free dollars-per-mile the IRS allows as a deduction — changes every
  // tax year, so this is never assumed/hardcoded; the admin section prompts
  // for it and shows where to look it up rather than guessing a figure.
  mileageRate: null,
};

export async function getSettings() {
  const rows = await db.all('settings');
  const out = { ...SETTINGS_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(key, value) {
  return db.put('settings', { key, value });
}

export async function saveSettings(patch) {
  for (const [k, v] of Object.entries(patch)) await setSetting(k, v);
  return getSettings();
}

// ---------- clients ----------

export function newClient(p = {}) {
  return {
    id: uid('c_'), name: '', email: '', phone: '', altPhone: '',
    mailingAddress: '', referredBy: '', notes: '',
    createdAt: Date.now(), updatedAt: Date.now(), ...p,
  };
}

export const listClients = () => db.all('clients').then((r) => r.sort(byName));
export const getClient = (id) => db.get('clients', id);
export const saveClient = (c) => db.put('clients', { ...c, updatedAt: Date.now() });

export async function deleteClient(id) {
  const jobs = await db.byIndex('inspections', 'clientId', id);
  for (const j of jobs) await deleteInspection(j.id);
  await db.delWhere('properties', 'clientId', id);
  return db.del('clients', id);
}

// ---------- properties ----------

export function newProperty(p = {}) {
  return {
    id: uid('p_'), clientId: '', address: '', city: '', state: 'FL', zip: '', county: 'Hernando',
    yearBuilt: '', sqft: '', stories: '1', structureType: 'Single Family',
    foundation: 'Slab on grade', occupancy: 'Owner occupied', utilitiesOn: 'Yes',
    lat: null, lon: null,          // set when the address is picked from autocomplete — feeds round-trip mileage
    createdAt: Date.now(), ...p,
  };
}

export const getProperty = (id) => db.get('properties', id);
export const saveProperty = (p) => db.put('properties', p);
export const propertiesFor = (clientId) => db.byIndex('properties', 'clientId', clientId);

export function propertyLabel(p) {
  if (!p) return 'No property';
  const l2 = [p.city, p.state, p.zip].filter(Boolean).join(' ');
  return [p.address, l2].filter(Boolean).join(', ') || 'Untitled property';
}

// ---------- inspections ----------

export async function activeMasterTemplate() {
  const tpls = await db.all('templates');
  const builtIn = tpls.find((t) => t.builtIn) || tpls[0];
  return builtIn || defaultTemplate();
}

export async function newInspection(p = {}) {
  const master = await activeMasterTemplate();
  const tpl = cloneTemplate(master);
  return {
    id: uid('i_'),
    clientId: '', propertyId: '',
    services: ['Full Home Inspection'],
    status: 'Scheduled',
    scheduledAt: '', scheduledTime: '',
    inspectedAt: '',
    fee: '', paid: false,
    roundTripMiles: null,         // auto-computed (HQ <-> property, via routing.js) when both have coordinates; always editable
    weather: '', tempF: '', groundCond: '', attendees: '',
    jobContacts: [],              // [contactId, ...] — realtors/lenders/etc. picked from the saved Contacts list
    inspectorName: '',
    summaryNote: '',
    template: tpl,               // snapshot — safe to edit per job in the field
    data: {},                    // { [itemId]: { value, comment, severity, na } }
    findings: {},                // { [sectionId]: [ {id,title,body,severity,location} ] }
    forms: {},                   // { fourpoint: {...}, windmit: {...} }
    signature: '',
    agreement: null,             // { text, inspectorSignature, inspectorSignedAt, customer1..., customer2..., sentAt }
    createdAt: Date.now(), updatedAt: Date.now(),
    ...p,
  };
}

export const getInspection = (id) => db.get('inspections', id);
export const listInspections = () => db.all('inspections').then((r) => r.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
export const inspectionsFor = (clientId) => db.byIndex('inspections', 'clientId', clientId);

export function saveInspection(i) {
  return db.put('inspections', { ...i, updatedAt: Date.now() });
}

export async function deleteInspection(id) {
  await db.delWhere('media', 'inspectionId', id);
  return db.del('inspections', id);
}

/** Everything needed to render one job, in one call. */
export async function hydrate(inspectionId) {
  const inspection = await getInspection(inspectionId);
  if (!inspection) return null;
  const [client, property, media, settings, jobContacts] = await Promise.all([
    inspection.clientId ? getClient(inspection.clientId) : null,
    inspection.propertyId ? getProperty(inspection.propertyId) : null,
    db.byIndex('media', 'inspectionId', inspectionId),
    getSettings(),
    contactsFor(inspection),
  ]);
  media.sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
  return { inspection, client, property, media, settings, jobContacts };
}

// ---------- contacts ----------
// Repeat referral contacts — realtors, lenders, attorneys — saved once and
// picked per job instead of retyped. Independent of Clients, since the same
// realtor shows up across many different clients' jobs.

export function newContact(p = {}) {
  return { id: uid('ct_'), name: '', role: CONTACT_ROLES[0], company: '', phone: '', email: '', notes: '', createdAt: Date.now(), ...p };
}

export const listContacts = () => db.all('contacts').then((r) => r.sort((a, b) => a.name.localeCompare(b.name)));
export const getContact = (id) => db.get('contacts', id);
export const saveContact = (c) => db.put('contacts', c);
export const deleteContact = (id) => db.del('contacts', id);

/** Resolves an inspection's `jobContacts` id list into full contact records, in order. */
export async function contactsFor(inspection) {
  const ids = inspection.jobContacts || [];
  if (!ids.length) return [];
  const found = await Promise.all(ids.map((id) => db.get('contacts', id)));
  return found.filter(Boolean);
}

export function formatContact(c) {
  if (!c) return '';
  const parts = [c.name];
  if (c.company) parts.push(`(${c.company})`);
  return parts.join(' ');
}

// ---------- comment library ----------

export function newComment(p = {}) {
  return { id: uid('cm_'), category: 'General', title: '', body: '', severity: 2, uses: 0, createdAt: Date.now(), ...p };
}

export const listComments = () => db.all('comments').then((r) => r.sort((a, b) => (b.uses || 0) - (a.uses || 0) || a.title.localeCompare(b.title)));
export const getComment = (id) => db.get('comments', id);
export const saveComment = (c) => db.put('comments', c);
export const deleteComment = (id) => db.del('comments', id);

export async function bumpCommentUse(id) {
  const c = await db.get('comments', id);
  if (c) await db.put('comments', { ...c, uses: (c.uses || 0) + 1 });
}

// ---------- transactions (admin: misc income & expenses) ----------
// Job fees (inspection.fee/.paid) and mileage (inspection.roundTripMiles)
// are the two big, already-existing per-job numbers — this store is only
// for everything *else* money-related: business expenses, and income that
// isn't a job fee (e.g. a referral bonus). The admin view combines both
// sources rather than duplicating job fees in here.

export const EXPENSE_CATEGORIES = [
  'Vehicle / Fuel', 'Insurance (E&O/GL)', 'Licensing & CE', 'Tools & Equipment',
  'Software & Subscriptions', 'Marketing', 'Office & Supplies', 'Phone & Internet', 'Other',
];

export function newTransaction(p = {}) {
  return {
    id: uid('tx_'), type: 'expense', date: today(), amount: '', category: 'Other',
    description: '', inspectionId: '', createdAt: Date.now(), ...p,
  };
}

export const listTransactions = () => db.all('transactions').then((r) => r.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
export const saveTransaction = (t) => db.put('transactions', t);

export async function deleteTransaction(id) {
  // Receipt photos are stored in the shared `media` store keyed by this id in
  // its `inspectionId` field (a transaction isn't a job, but reusing that
  // existing index avoids a schema change) — same cleanup-on-delete pattern
  // as deleteInspection.
  await db.delWhere('media', 'inspectionId', id);
  return db.del('transactions', id);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- templates ----------

export const listTemplates = () => db.all('templates');
export const getTemplate = (id) => db.get('templates', id);
export const saveTemplate = (t) => db.put('templates', t);
export const deleteTemplate = (id) => db.del('templates', id);

// ---------- bootstrap ----------

export async function seedIfEmpty() {
  const s = await getSettings();
  const seededVersion = s.commentsVersion || (s.seededComments ? 1 : 0);
  if (seededVersion < COMMENTS_VERSION) {
    // Upsert by (category + title) rather than wipe-and-reseed: an inspector's
    // own custom comments (no matching starter) are left alone, and an existing
    // starter comment keeps its id/uses/createdAt (so its usage-sort position
    // and any {Fill} history survive) while its content refreshes to match code.
    const existing = await db.all('comments');
    const byKey = new Map(existing.map((c) => [`${c.category}::${c.title}`, c]));
    for (const starter of STARTER_COMMENTS) {
      const match = byKey.get(`${starter.category}::${starter.title}`);
      await db.put('comments', match
        ? { ...match, ...starter, id: match.id, uses: match.uses, createdAt: match.createdAt }
        : newComment(starter));
    }
    await setSetting('commentsVersion', COMMENTS_VERSION);
  }
  const tpls = await db.all('templates');
  const builtIn = tpls.find((t) => t.builtIn);
  if (!builtIn) {
    const t = await defaultTemplate();
    await db.put('templates', { ...t, id: 'tpl_default', name: 'Standard Home Inspection', builtIn: true });
  } else {
    const fresh = await defaultTemplate();
    if ((builtIn.version || 0) < fresh.version) {
      // The code-defined checklist changed since this device last seeded — refresh
      // the built-in master so new inspections pick it up. Jobs already in progress
      // are untouched (each holds its own cloned snapshot, see cloneTemplate). Any
      // custom sections/items an inspector added directly to the master are lost —
      // same tradeoff the Library's "Master Template" editor already documents:
      // edits there only ever affected new inspections, never past ones.
      await db.put('templates', { ...fresh, id: builtIn.id, name: builtIn.name, builtIn: true });
    }
  }
}

function byName(a, b) { return (a.name || '').localeCompare(b.name || ''); }
