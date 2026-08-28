// Photo + video capture, compression and blob storage.
// Images are downscaled before storage — a 12MP iPhone shot is ~4MB raw and
// ~250KB at 1600px/q0.72, which is the difference between 40 photos and 400
// fitting in the device's storage budget.

import * as db from './db.js';
import { getSettings } from './store.js';

const urlCache = new Map();

export function newMedia(p = {}) {
  return {
    id: db.uid('m_'), inspectionId: '', slot: '', kind: 'photo',
    blob: null, thumb: null, caption: '', w: 0, h: 0, bytes: 0,
    // originalBlob is the untouched capture — annotating never destroys it, so
    // "start over" and re-editing a markup are always possible. `blob` itself
    // becomes the annotated flattened image once annotations exist, since
    // every display site (report, export, grid) just shows `blob` as-is.
    originalBlob: null, annotations: [],
    order: Date.now(), createdAt: Date.now(), ...p,
  };
}

/** Open the OS picker/camera. `capture` true = jump straight to the rear camera on iOS. */
export function pickFiles({ accept = 'image/*,video/*', multiple = true, capture = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (multiple && !capture) input.multiple = true;
    if (capture) input.capture = 'environment';
    input.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.appendChild(input);
    let done = false;
    const finish = (files) => { if (done) return; done = true; input.remove(); resolve(files); };
    input.addEventListener('change', () => finish([...(input.files || [])]));
    // iOS fires no event if the user cancels; clean up when focus returns.
    window.addEventListener('focus', () => setTimeout(() => finish([]), 900), { once: true });
    input.click();
  });
}

export async function addFiles(inspectionId, slot, files, onProgress) {
  const settings = await getSettings();
  const saved = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    try {
      const rec = await processFile(files[i], settings);
      if (!rec) continue;
      rec.inspectionId = inspectionId;
      rec.slot = slot;
      rec.order = Date.now() + i;
      await db.put('media', rec);
      saved.push(rec);
    } catch (err) {
      console.warn('Skipped file', files[i]?.name, err);
    }
  }
  onProgress?.(files.length, files.length);
  return saved;
}

async function processFile(file, settings) {
  if (!file || !file.size) return null;
  if (file.type.startsWith('video/')) {
    const thumb = await videoThumb(file).catch(() => null);
    return newMedia({ kind: 'video', blob: file, thumb, bytes: file.size, caption: '' });
  }
  if (!file.type.startsWith('image/')) return null;
  const { blob, w, h } = await compressImage(file, settings.photoMaxEdge, settings.photoQuality);
  const thumb = await compressImage(file, 300, 0.6).then((r) => r.blob).catch(() => null);
  return newMedia({ kind: 'photo', blob, originalBlob: blob, thumb, w, h, bytes: blob.size });
}

async function compressImage(file, maxEdge, quality) {
  const bmp = await decode(file);
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not encode image');
  return { blob, w, h };
}

async function decode(file) {
  // createImageBitmap honours EXIF orientation on iOS 15+; the <img> path is the fallback.
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unsupported image format')); };
    img.src = url;
  });
}

function videoThumb(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'metadata';
    const cleanup = () => URL.revokeObjectURL(url);
    const fail = () => { cleanup(); reject(new Error('no thumb')); };
    video.onloadeddata = () => {
      try { video.currentTime = Math.min(0.5, (video.duration || 1) / 4); } catch { fail(); }
    };
    video.onseeked = () => {
      const scale = Math.min(1, 300 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale) || 300;
      canvas.height = Math.round(video.videoHeight * scale) || 200;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => { cleanup(); b ? resolve(b) : reject(new Error('no thumb')); }, 'image/jpeg', 0.6);
    };
    video.onerror = fail;
    video.src = url;
  });
}

// ---------- reading ----------

export const mediaFor = (inspectionId) =>
  db.byIndex('media', 'inspectionId', inspectionId)
    .then((r) => r.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));

export function mediaInSlot(media, slot) {
  return media.filter((m) => m.slot === slot);
}

/** Object URLs are cached so re-renders don't leak a URL per paint. */
export function objectUrl(record, which = 'thumb') {
  const blob = which === 'thumb' ? (record.thumb || record.blob) : record.blob;
  if (!blob) return '';
  const key = `${record.id}:${which}`;
  if (!urlCache.has(key)) urlCache.set(key, URL.createObjectURL(blob));
  return urlCache.get(key);
}

export function releaseUrls(prefix = '') {
  for (const [key, url] of urlCache) {
    if (!prefix || key.startsWith(prefix)) { URL.revokeObjectURL(url); urlCache.delete(key); }
  }
}

export const saveMedia = (m) => db.put('media', m);

export async function deleteMedia(id) {
  releaseUrls(`${id}:`);
  return db.del('media', id);
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

export function humanBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}
