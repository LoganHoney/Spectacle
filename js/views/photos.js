// Reusable photo/video strip bound to an (inspectionId, slot) pair.

import * as media from '../core/media.js';
import { html, raw, esc, on, sheet, toast, confirmSheet } from '../core/ui.js';
import { annotatePhoto } from './annotate.js';

/**
 * @param {HTMLElement} host      container to render into
 * @param {object}      opts      { inspectionId, slot, label, onChange }
 */
export async function mountPhotos(host, { inspectionId, slot, label = 'Photos', onChange }) {
  host.classList.add('photo-host');

  async function render() {
    const items = (await media.mediaFor(inspectionId)).filter((m) => m.slot === slot);
    host.innerHTML = html`
      <div class="spread" style="margin:0 0 8px">
        <h3 style="margin:0">${label}${raw(items.length ? ` <span class="muted">(${items.length})</span>` : '')}</h3>
      </div>
      <div class="media-grid">
        ${items.map((m) => raw(`
          <div class="media-t" data-open="${m.id}">
            <img src="${media.objectUrl(m, 'thumb')}" alt="${esc(m.caption || 'inspection media')}" loading="lazy">
            ${m.kind === 'video' ? '<span class="badge">VIDEO</span>' : ''}
            ${m.annotations?.length ? '<span class="badge" style="right:4px;left:auto">MARKED</span>' : ''}
            ${m.caption ? `<div class="cap">${esc(m.caption)}</div>` : ''}
          </div>`))}
        <button class="addmedia" data-camera title="Take photo">&#43;</button>
        <button class="addmedia" data-library title="Choose from library">&#8942;</button>
      </div>`;
    onChange?.(items.length);
  }

  on(host, 'click', '[data-camera]', async () => {
    const files = await media.pickFiles({ accept: 'image/*,video/*', capture: true, multiple: false });
    if (files.length) await ingest(files);
  });

  on(host, 'click', '[data-library]', async () => {
    const files = await media.pickFiles({ accept: 'image/*,video/*', multiple: true });
    if (files.length) await ingest(files);
  });

  on(host, 'click', '[data-open]', async (_e, el) => {
    const items = (await media.mediaFor(inspectionId)).filter((m) => m.slot === slot);
    const item = items.find((m) => m.id === el.dataset.open);
    if (item) await viewer(item, render);
  });

  async function ingest(files) {
    toast(files.length > 1 ? `Adding ${files.length} files…` : 'Adding…', 60000);
    await media.addFiles(inspectionId, slot, files);
    toast(`Added ${files.length} ${files.length === 1 ? 'file' : 'files'}`);
    await render();
  }

  await render();
  return { refresh: render };
}

async function viewer(item, afterChange) {
  await sheet(item.kind === 'video' ? 'Video' : 'Photo', (body, close) => {
    const src = media.objectUrl(item, 'full');
    body.innerHTML = html`
      <div style="border-radius:12px;overflow:hidden;background:#000;margin:0 0 12px">
        ${raw(item.kind === 'video'
          ? `<video src="${src}" controls playsinline style="width:100%;max-height:52vh;display:block"></video>`
          : `<img src="${src}" style="width:100%;max-height:52vh;object-fit:contain;display:block">`)}
      </div>
      <label class="f"><span>Caption — printed under this ${item.kind === 'video' ? 'video' : 'photo'} in the report</span>
        <textarea data-cap placeholder="e.g. Cracked vent boot, north slope">${esc(item.caption || '')}</textarea></label>
      <div class="small muted" style="margin:0 0 12px">
        ${item.w ? `${item.w}×${item.h} · ` : ''}${media.humanBytes(item.bytes)}
      </div>
      <div class="stack">
        <button class="btn primary wide" data-save>Save caption</button>
        ${raw(item.kind === 'photo' ? `<button class="btn wide" data-annotate>${item.annotations?.length ? 'Edit Markup' : 'Annotate'}</button>` : '')}
        <button class="btn danger wide" data-del>Delete</button>
      </div>`;

    body.querySelector('[data-save]').onclick = async () => {
      item.caption = body.querySelector('[data-cap]').value.trim();
      await media.saveMedia(item);
      toast('Caption saved');
      close();
      afterChange?.();
    };
    body.querySelector('[data-annotate]')?.addEventListener('click', async () => {
      close();
      const saved = await annotatePhoto(item);
      if (saved) toast('Markup saved');
      afterChange?.();
    });
    body.querySelector('[data-del]').onclick = async () => {
      if (!await confirmSheet('Delete this file?', 'It will be removed from the report permanently.')) return;
      await media.deleteMedia(item.id);
      toast('Deleted');
      close();
      afterChange?.();
    };
  });
}
