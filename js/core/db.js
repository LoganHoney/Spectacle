// IndexedDB wrapper. Everything lives on-device; nothing leaves the phone.

const DB_NAME = 'hernando-inspections';
const DB_VERSION = 2;

export const STORES = {
  clients:     { keyPath: 'id', indexes: [['name', 'name'], ['createdAt', 'createdAt']] },
  properties:  { keyPath: 'id', indexes: [['clientId', 'clientId']] },
  inspections: { keyPath: 'id', indexes: [['clientId', 'clientId'], ['status', 'status'], ['scheduledAt', 'scheduledAt'], ['updatedAt', 'updatedAt']] },
  media:       { keyPath: 'id', indexes: [['inspectionId', 'inspectionId'], ['slot', 'slot']] },
  templates:   { keyPath: 'id', indexes: [['name', 'name']] },
  comments:    { keyPath: 'id', indexes: [['category', 'category']] },
  contacts:    { keyPath: 'id', indexes: [['name', 'name'], ['role', 'role']] },
  settings:    { keyPath: 'key' },
};

let _db = null;

export function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      for (const [name, spec] of Object.entries(STORES)) {
        let store;
        if (!db.objectStoreNames.contains(name)) {
          store = db.createObjectStore(name, { keyPath: spec.keyPath });
        } else {
          store = e.target.transaction.objectStore(name);
        }
        for (const [idxName, keyPath] of (spec.indexes || [])) {
          if (!store.indexNames.contains(idxName)) store.createIndex(idxName, keyPath, { unique: false });
        }
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      _db.onversionchange = () => { _db.close(); _db = null; };
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database is open in another tab. Close it and reload.'));
  });
}

function tx(store, mode = 'readonly') {
  return open().then((db) => db.transaction(store, mode).objectStore(store));
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function get(store, key) {
  return wrap((await tx(store)).get(key));
}

export async function all(store) {
  return wrap((await tx(store)).getAll());
}

export async function byIndex(store, index, value) {
  const s = await tx(store);
  return wrap(s.index(index).getAll(IDBKeyRange.only(value)));
}

export async function put(store, value) {
  const s = await tx(store, 'readwrite');
  await wrap(s.put(value));
  return value;
}

export async function putMany(store, values) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const s = t.objectStore(store);
    for (const v of values) s.put(v);
    t.oncomplete = () => resolve(values.length);
    t.onerror = () => reject(t.error);
  });
}

export async function del(store, key) {
  return wrap((await tx(store, 'readwrite')).delete(key));
}

export async function delWhere(store, index, value) {
  const rows = await byIndex(store, index, value);
  const s = await tx(store, 'readwrite');
  for (const r of rows) s.delete(r.id);
  return rows.length;
}

export async function clear(store) {
  return wrap((await tx(store, 'readwrite')).clear());
}

export async function count(store) {
  return wrap((await tx(store)).count());
}

/** Ask the browser not to evict our data. iOS honours this for installed PWAs. */
export async function requestPersistence() {
  if (!navigator.storage?.persist) return { supported: false };
  const already = await navigator.storage.persisted();
  const granted = already || await navigator.storage.persist();
  let usage = null;
  try { usage = await navigator.storage.estimate(); } catch { /* not fatal */ }
  return { supported: true, granted, usage };
}

export function uid(prefix = '') {
  const rnd = crypto.getRandomValues(new Uint8Array(8));
  const hex = [...rnd].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}${Date.now().toString(36)}${hex}`;
}
