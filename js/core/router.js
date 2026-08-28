// Hash router. Hash (not History API) so the app works from any subpath and
// survives being launched from the iOS home screen.

const routes = [];
let onChange = null;
let current = null;

export function route(pattern, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_m, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ rx, keys, handler, pattern });
}

export function start(handler) {
  onChange = handler;
  window.addEventListener('hashchange', resolve);
  resolve();
}

export function go(path, { replace = false } = {}) {
  if (replace) location.replace(`#${path.replace(/^#/, '')}`);
  else location.hash = path.replace(/^#/, '');
}

export const currentPath = () => (location.hash.replace(/^#/, '') || '/dashboard').split('?')[0];
export const currentQuery = () => new URLSearchParams((location.hash.split('?')[1]) || '');

async function resolve() {
  const path = currentPath();
  for (const r of routes) {
    const m = path.match(r.rx);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    for (const [k, v] of currentQuery()) params[k] = v;
    current = { path, pattern: r.pattern, params };
    onChange?.(current);
    try {
      await r.handler(params);
    } catch (err) {
      console.error('Route failed', path, err);
      document.getElementById('view').innerHTML =
        `<div class="empty"><div class="big">!</div><p>Something went wrong loading this screen.</p>
         <p class="small muted">${String(err.message || err)}</p></div>`;
    }
    window.scrollTo(0, 0);
    return;
  }
  go('/dashboard', { replace: true });
}

export const getCurrent = () => current;
