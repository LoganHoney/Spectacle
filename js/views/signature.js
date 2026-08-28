// Touch/stylus signature capture on a canvas, stored as a PNG data URL.

export function mountSignaturePad(host, { value, onChange }) {
  host.innerHTML = `
    <canvas class="sigpad"></canvas>
    <div class="row" style="margin-top:6px">
      <button type="button" class="btn sm ghost" data-clear>Clear</button>
      <span class="small muted" data-state style="margin-left:auto"></span>
    </div>`;
  const canvas = host.querySelector('canvas');
  const stateEl = host.querySelector('[data-state]');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasInk = !!value;
  let last = null;

  function fit() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--ink').trim() || '#0f172a';
    if (value) paintExisting(value);
    updateState();
  }

  function paintExisting(dataUrl) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
    img.src = dataUrl;
  }

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function start(e) { e.preventDefault(); drawing = true; last = pos(e); }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p; hasInk = true;
  }
  function end() {
    if (!drawing) return;
    drawing = false;
    updateState();
    onChange?.(canvas.toDataURL('image/png'));
  }

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  host.querySelector('[data-clear]').onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk = false;
    updateState();
    onChange?.('');
  };

  function updateState() {
    stateEl.textContent = hasInk ? 'Signed' : 'Not signed';
  }

  requestAnimationFrame(fit);
  window.addEventListener('resize', fit);
}
