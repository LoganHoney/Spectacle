// Cloud account: email magic-link auth + (in a later phase) data sync. The
// anon key below is meant to be public — it's safe to ship in client code,
// same as it would be in any Supabase app; access control is enforced by the
// Row Level Security policies in supabase/schema.sql, not by hiding this key.
//
// Loads the vendored UMD build on first use (same lazy-load pattern as
// js/report/pdf.js) rather than at boot, since most of the app's day-to-day
// use — a job already in progress, fully offline — never touches this.

const SUPABASE_URL = 'PLACEHOLDER_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'PLACEHOLDER_SUPABASE_ANON_KEY';

let clientPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load ${src} (HTTP ${res.status})`);
        return res.text();
      })
      .then((code) => {
        const s = document.createElement('script');
        s.textContent = code;
        document.head.appendChild(s);
        resolve();
      })
      .catch(reject);
  });
}

/** Resolves to the shared Supabase client, loading the vendored library on first call. */
export function getClient() {
  if (!clientPromise) {
    clientPromise = loadScript('js/vendor/supabase.min.js').then(() => {
      if (isConfigured()) {
        return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
      }
      return null;
    });
  }
  return clientPromise;
}

export function isConfigured() {
  return !SUPABASE_URL.startsWith('PLACEHOLDER') && !SUPABASE_ANON_KEY.startsWith('PLACEHOLDER');
}

/** Sends a magic-link email. redirectTo defaults to this app's own URL, so the link brings the client back here signed in. */
export async function signInWithEmail(email) {
  const client = await getClient();
  if (!client) throw new Error('Cloud account isn\'t set up yet.');
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

export async function signOut() {
  const client = await getClient();
  if (!client) return;
  await client.auth.signOut();
}

/** Current session, or null if signed out. */
export async function getSession() {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Fires immediately with the current state, then again on every sign-in/sign-out. */
export async function onAuthChange(callback) {
  const client = await getClient();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
