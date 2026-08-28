// Real PDF generation, client-side — no server, no build step. Vendors two
// standalone libraries (js/vendor/) loaded on demand, since most sessions
// never touch this: jsPDF assembles pages, html2canvas rasterizes the same
// report DOM already used for the in-app preview / HTML export.
//
// Captured one PDF page at a time (not one giant canvas for the whole
// report) on purpose — iOS Safari, the primary target device for this app,
// caps canvas area around 16M pixels, and a long report with many photos
// would blow past that in a single capture. Per-page capture keeps every
// canvas small regardless of report length.
//
// Known limitation: html2canvas rasterizes whatever's on screen and has no
// concept of print.css's `page-break-inside:avoid`, so a page boundary can
// land mid-item or mid-photo. Acceptable for v1; revisit if it's a problem
// in practice.

import * as media from '../core/media.js';
import { renderFullReport, renderFormReport } from './render.js';

let vendorPromise = null;
function loadVendor() {
  if (!vendorPromise) {
    // fetch()+inline-execute rather than a <script src> tag: a plain src tag's
    // onload/onerror timing proved flaky in testing (intermittently reporting
    // a load failure for a file that `fetch()` could read fine moments later),
    // and this way a real failure comes with an actual HTTP status instead of
    // an opaque "could not load" from the error event. Loaded one at a time,
    // not in parallel — two concurrent fetches for these intermittently failed
    // against the local dev server (serve.py) in testing; sequential is a
    // negligible cost for two local/cached files and avoids depending on that.
    vendorPromise = loadScript('js/vendor/jspdf.umd.min.js')
      .then(() => loadScript('js/vendor/html2canvas.min.js'));
  }
  return vendorPromise;
}

const loadedScripts = new Set();
async function loadScript(src) {
  if (loadedScripts.has(src)) return;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Could not load ${src} (HTTP ${res.status})`);
  const code = await res.text();
  const s = document.createElement('script');
  s.textContent = code;
  document.head.appendChild(s);
  loadedScripts.add(src);
}

function waitForImages(container) {
  const imgs = [...container.querySelectorAll('img')];
  return Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => {
    img.addEventListener('load', res, { once: true });
    img.addEventListener('error', res, { once: true }); // one broken photo shouldn't hang the whole PDF
  }))));
}

/** Builds a Blob (application/pdf) for the full report, or one insurance form if formId is given. */
export async function buildReportPdfBlob(hydrated, formId) {
  await loadVendor();
  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({ unit: 'px', format: 'letter' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const urlFor = (record, which) => media.objectUrl(record, which);
  const bodyHtml = formId ? await renderFormReport(hydrated, formId, urlFor) : await renderFullReport(hydrated, urlFor);

  const container = document.createElement('div');
  container.className = 'rp-root';
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${pageW}px;max-width:none;background:#fff;z-index:-1`;
  container.innerHTML = bodyHtml;
  document.body.appendChild(container);

  try {
    await waitForImages(container);
    const totalHeight = container.scrollHeight;
    let y = 0;
    let first = true;
    while (y < totalHeight) {
      const sliceH = Math.min(pageH, totalHeight - y);
      // eslint-disable-next-line no-await-in-loop
      const canvas = await window.html2canvas(container, {
        x: 0, y, width: pageW, height: sliceH,
        windowWidth: pageW, windowHeight: totalHeight,
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      if (!first) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, sliceH);
      y += sliceH;
      first = false;
    }
    return pdf.output('blob');
  } finally {
    container.remove();
  }
}
