// Whole-database export/import. Since everything lives only on this device,
// this file *is* the backup strategy — losing the device without one of
// these means losing every job.

import * as db from './db.js';
import { blobToDataUrl, dataUrlToBlob } from './media.js';

const FORMAT = 'hernando-inspections-backup';
const VERSION = 1;

export async function exportBackup(onProgress) {
  const stores = ['clients', 'properties', 'inspections', 'media', 'templates', 'comments', 'settings'];
  const out = { format: FORMAT, version: VERSION, exportedAt: Date.now(), stores: {} };
  let i = 0;
  for (const name of stores) {
    const rows = await db.all(name);
    if (name === 'media') {
      out.stores.media = await Promise.all(rows.map(async (m) => ({
        ...m,
        blob: m.blob ? await blobToDataUrl(m.blob) : null,
        thumb: m.thumb ? await blobToDataUrl(m.thumb) : null,
        __blob: true,
      })));
    } else {
      out.stores[name] = rows;
    }
    i += 1;
    onProgress?.(i, stores.length);
  }
  return out;
}

export async function exportBackupBlob(onProgress) {
  const data = await exportBackup(onProgress);
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export async function importBackup(json, { mode = 'merge', onProgress } = {}) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (data.format !== FORMAT) throw new Error('This file is not a Hernando Inspections backup.');

  const names = Object.keys(data.stores);
  if (mode === 'replace') {
    for (const name of names) await db.clear(name);
  }

  let i = 0;
  for (const name of names) {
    let rows = data.stores[name];
    if (name === 'media') {
      rows = await Promise.all(rows.map(async (m) => ({
        ...m,
        blob: m.blob ? await dataUrlToBlob(m.blob) : null,
        thumb: m.thumb ? await dataUrlToBlob(m.thumb) : null,
      })));
    }
    if (rows.length) await db.putMany(name, rows);
    i += 1;
    onProgress?.(i, names.length);
  }
  return { stores: names, counts: Object.fromEntries(names.map((n) => [n, data.stores[n].length])) };
}

export function readFileAsJson(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => { try { resolve(JSON.parse(fr.result)); } catch (e) { reject(e); } };
    fr.onerror = () => reject(fr.error);
    fr.readAsText(file);
  });
}
