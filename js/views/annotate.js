// Full-screen photo markup: arrows, boxes and circles drawn over a photo,
// then flattened into the stored image. The pristine capture always survives
// as `record.originalBlob`, and the shapes are kept as normalized (0–1)
// coordinates in `record.annotations` so a markup can be reopened and
// adjusted later without ever re-compressing an already-annotated image.

import * as media from '../core/media.js';
import { on, toast } from '../core/ui.js';

const COLORS = ['#f97316', '#dc2626', '#facc15', '#2563eb', '#ffffff'];
const TOOLS = [
  { key: 'arrow', label: '↗ Arrow' },
  { key: 'rect', label: '▭ Box' },
  { key: 'circle', label: '◯ Circle' },
];

/** Resolves true if saved, false if cancelled. */
export function annotatePhoto(record) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'anno-overlay';
    overlay.innerHTML = `
      <div class="anno-topbar">
        <button class="anno-btn" data-cancel>Cancel</button>
        <div class="anno-title">Annotate Photo</div>
        <button class="anno-btn anno-save" data-save>Save</button>
      </div>
      <div class="anno-canvaswrap"><canvas class="anno-canvas"></canvas></div>
      <div class="anno-toolbar">
        <div class="anno-row anno-tools">
          ${TOOLS.map((t, i) => `<button class="anno-tool" data-tool="${t.key}" aria-pressed="${i === 0}">${t.label}</button>`).join('')}
        </div>
        <div class="anno-row">
          <div class="anno-colors">
            ${COLORS.map((c, i) => `<button class="anno-color" data-color="${c}" style="background:${c}" aria-pressed="${i === 0}" aria-label="color"></button>`).join('')}
          </div>
          <div class="anno-spacer"></div>
          <button class="anno-btn anno-sm" data-undo>Undo</button>
          <button class="anno-btn anno-sm" data-clear>Clear</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const canvas = overlay.querySelector('.anno-canvas');
    const ctx = canvas.getContext('2d');
    const wrap = overlay.querySelector('.anno-canvaswrap');

    let tool = TOOLS[0].key;
    let color = COLORS[0];
    let shapes = (record.annotations || []).map((s) => ({ ...s }));
    let drawing = false;
    let start = null;
    let liveShape = null;
    let naturalW = 0;
    let naturalH = 0;
    let dispW = 0;
    let dispH = 0;

    const srcUrl = URL.createObjectURL(record.originalBlob || record.blob);
    const img = new Image();
    img.onload = () => { naturalW = img.naturalWidth; naturalH = img.naturalHeight; fitCanvas(); redraw(); };
    img.onerror = () => { toast('Could not load photo for annotation'); cleanup(false); };
    img.src = srcUrl;

    function fitCanvas() {
      const maxW = wrap.clientWidth, maxH = wrap.clientHeight;
      const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
      dispW = Math.max(1, Math.round(naturalW * scale));
      dispH = Math.max(1, Math.round(naturalH * scale));
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.style.width = `${dispW}px`;
      canvas.style.height = `${dispH}px`;
      canvas.width = dispW * dpr;
      canvas.height = dispH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function redraw() {
      ctx.clearRect(0, 0, dispW, dispH);
      ctx.drawImage(img, 0, 0, dispW, dispH);
      for (const s of shapes) drawShape(ctx, s, dispW, dispH);
      if (liveShape) drawShape(ctx, liveShape, dispW, dispH);
    }

    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    function onStart(e) {
      e.preventDefault();
      start = pos(e);
      drawing = true;
    }
    function onMove(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      liveShape = { type: tool, x1: start.x / dispW, y1: start.y / dispH, x2: p.x / dispW, y2: p.y / dispH, color };
      redraw();
    }
    function onEnd(e) {
      if (!drawing) return;
      drawing = false;
      if (liveShape) {
        const dx = Math.abs(liveShape.x2 - liveShape.x1) * dispW;
        const dy = Math.abs(liveShape.y2 - liveShape.y1) * dispH;
        if (dx > 5 || dy > 5) shapes.push(liveShape); // ignore an accidental tap
      }
      liveShape = null;
      redraw();
    }

    canvas.addEventListener('pointerdown', onStart);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });

    const onResize = () => { fitCanvas(); redraw(); };
    window.addEventListener('resize', onResize);

    on(overlay, 'click', '[data-tool]', (_e, el) => {
      tool = el.dataset.tool;
      overlay.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', b === el));
    });
    on(overlay, 'click', '[data-color]', (_e, el) => {
      color = el.dataset.color;
      overlay.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', b === el));
    });
    overlay.querySelector('[data-undo]').onclick = () => { shapes.pop(); redraw(); };
    overlay.querySelector('[data-clear]').onclick = () => {
      if (!shapes.length) return;
      shapes = [];
      redraw();
    };
    overlay.querySelector('[data-cancel]').onclick = () => cleanup(false);
    overlay.querySelector('[data-save]').onclick = async () => {
      const saveBtn = overlay.querySelector('[data-save]');
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
      try {
        await bakeAndSave();
        cleanup(true);
      } catch (err) {
        console.error(err);
        toast('Could not save annotation');
        saveBtn.disabled = false; saveBtn.textContent = 'Save';
      }
    };

    async function bakeAndSave() {
      const full = document.createElement('canvas');
      full.width = naturalW; full.height = naturalH;
      const fctx = full.getContext('2d');
      fctx.drawImage(img, 0, 0, naturalW, naturalH);
      for (const s of shapes) drawShape(fctx, s, naturalW, naturalH);
      const blob = await new Promise((res) => full.toBlob(res, 'image/jpeg', 0.85));
      if (!blob) throw new Error('Could not render annotated image');

      const scale = Math.min(1, 300 / Math.max(naturalW, naturalH));
      const tcanvas = document.createElement('canvas');
      tcanvas.width = Math.max(1, Math.round(naturalW * scale));
      tcanvas.height = Math.max(1, Math.round(naturalH * scale));
      tcanvas.getContext('2d').drawImage(full, 0, 0, tcanvas.width, tcanvas.height);
      const thumb = await new Promise((res) => tcanvas.toBlob(res, 'image/jpeg', 0.6));

      if (!record.originalBlob) record.originalBlob = record.blob; // back-fill photos captured before this feature
      record.blob = blob;
      record.thumb = thumb || record.thumb;
      record.annotations = shapes;
      record.bytes = blob.size;
      await media.saveMedia(record);
      media.releaseUrls(`${record.id}:`);
    }

    function cleanup(saved) {
      window.removeEventListener('resize', onResize);
      URL.revokeObjectURL(srcUrl);
      document.body.style.overflow = '';
      overlay.remove();
      resolve(saved);
    }
  });
}

function drawShape(ctx, s, w, h) {
  const x1 = s.x1 * w, y1 = s.y1 * h, x2 = s.x2 * w, y2 = s.y2 * h;
  const lw = Math.max(2.5, w * 0.007);
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (s.type === 'rect') {
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  } else if (s.type === 'circle') {
    ctx.beginPath();
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.type === 'arrow') {
    drawArrow(ctx, x1, y1, x2, y2, lw);
  }
}

function drawArrow(ctx, x1, y1, x2, y2, lw) {
  const headLen = Math.max(14, lw * 4.2);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}
