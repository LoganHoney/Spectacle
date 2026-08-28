import * as supabaseClient from '../core/supabaseClient.js';
import * as sync from '../core/sync.js';
import { html, raw, esc, setTopbar, toast } from '../core/ui.js';
import { go } from '../core/router.js';

export async function accountView(view) {
  setTopbar({ title: 'Account', back: () => go('/settings') });

  if (!supabaseClient.isConfigured()) {
    view.innerHTML = html`
      <div class="empty">
        <div class="big">&#9729;</div>
        <p><strong>Cloud account isn't set up yet.</strong></p>
        <p class="small">This is being wired up — nothing to do here yet.</p>
      </div>`;
    return;
  }

  draw();

  async function draw() {
    view.innerHTML = html`<div class="empty small">Checking sign-in status…</div>`;
    const session = await supabaseClient.getSession();
    if (session) drawSignedIn(session);
    else drawSignedOut();
  }

  function drawSignedIn(session) {
    view.innerHTML = html`
      <div class="card stack">
        <div class="small muted">Signed in as</div>
        <div style="font-weight:700;font-size:16px">${esc(session.user.email)}</div>
      </div>
      <div class="note small">Settings now sync to this account across every device you sign into. Clients, inspections, and photos are next — those still stay local-only for the moment.</div>
      <button class="btn danger wide" data-sign-out style="margin-top:14px">Sign Out</button>
    `;
    view.querySelector('[data-sign-out]').onclick = async () => {
      await supabaseClient.signOut();
      toast('Signed out');
      draw();
    };
  }

  function drawSignedOut() {
    view.innerHTML = html`
      <div class="card stack">
        <label class="f"><span>Email address</span><input type="email" inputmode="email" autocapitalize="off" autocorrect="off" data-email placeholder="you@example.com"></label>
        <button class="btn primary wide" data-continue>Continue</button>
      </div>
      <div class="note small">No verification step right now — entering an email signs straight into that account. This is a temporary, deliberately loose setup; tighten it later before this is used by anyone but you.</div>
    `;
    const emailEl = view.querySelector('[data-email]');
    view.querySelector('[data-continue]').onclick = async () => {
      const email = emailEl.value.trim();
      if (!email || !email.includes('@')) { toast('Enter a valid email address'); return; }
      toast('Signing in…', 10000);
      try {
        await supabaseClient.signInQuick(email);
        await sync.syncSettingsOnSignIn();
        toast('Signed in — settings synced');
        draw();
      } catch (err) {
        console.error(err);
        toast(`Could not sign in: ${err.message}`);
      }
    };
  }
}
