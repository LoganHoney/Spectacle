// Builds a fully self-contained HTML file (all photos/video embedded as
// base64 data URIs) that opens correctly in any browser with no app, no
// server and no network — the "digital report" deliverable.

import { renderFullReport, renderFormReport } from './render.js';
import { blobToDataUrl } from '../core/media.js';

let cachedCss = null;
async function printCss() {
  if (cachedCss) return cachedCss;
  const res = await fetch('css/print.css');
  cachedCss = await res.text();
  return cachedCss;
}

function shell(title, css, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  html,body{margin:0;background:#f4f5f7}
  ${css}
</style>
</head><body>
<div id="report-root" class="rp-root">${bodyHtml}</div>
</body></html>`;
}

// A handful of full-length iPhone videos can push a base64 export into the
// hundreds of MB and fail to build or share. Photos are already downscaled
// on capture and never approach this; only raw video blobs need a cap.
const MAX_EMBED_BYTES = 20 * 1024 * 1024;

/** urlFor callback that returns a data: URI so the file has zero external references. */
function dataUrlResolver() {
  const cache = new Map();
  return async (record, which) => {
    const blob = which === 'thumb' ? (record.thumb || record.blob) : record.blob;
    if (!blob) return '';
    if (record.kind === 'video' && which === 'full' && blob.size > MAX_EMBED_BYTES) return '';
    const key = `${record.id}:${which}`;
    if (!cache.has(key)) cache.set(key, await blobToDataUrl(blob));
    return cache.get(key);
  };
}

/**
 * The render functions call urlFor synchronously; media is embedded as data
 * URIs by pre-resolving every reference first, then swapping in a sync lookup.
 */
async function withResolvedMedia(hydrated, renderer, ...rest) {
  const resolve = dataUrlResolver();
  const seen = [];
  const collectingUrlFor = (record, which) => { seen.push([record, which]); return '__PENDING__'; };
  let html = await renderer(hydrated, ...rest, collectingUrlFor);

  const resolved = new Map();
  for (const [record, which] of seen) {
    resolved.set(`${record.id}:${which}`, await resolve(record, which));
  }
  // Re-render with a synchronous resolver now that every URL is known.
  const syncUrlFor = (record, which) => resolved.get(`${record.id}:${which}`) || '';
  html = await renderer(hydrated, ...rest, syncUrlFor);
  return html;
}

export async function buildFullReportHtml(hydrated) {
  const css = await printCss();
  const body = await withResolvedMedia(hydrated, renderFullReport);
  const title = reportTitle(hydrated);
  return shell(title, css, body);
}

export async function buildFormReportHtml(hydrated, formId) {
  const css = await printCss();
  const body = await withResolvedMedia(hydrated, renderFormReport, formId);
  const title = reportTitle(hydrated, formId);
  return shell(title, css, body);
}

function reportTitle(hydrated, suffix) {
  const addr = hydrated.property?.address || hydrated.client?.name || 'Inspection Report';
  return [addr, suffix].filter(Boolean).join(' — ');
}
