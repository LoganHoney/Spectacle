// Cloud account: email magic-link auth + (in a later phase) data sync. The
// anon key below is meant to be public — it's safe to ship in client code,
// same as it would be in any Supabase app; access control is enforced by the
// Row Level Security policies in supabase/schema.sql, not by hiding this key.
//
// Loads the vendored UMD build on first use (same lazy-load pattern as
// js/report/pdf.js) rather than at boot, since most of the app's day-to-day
// use — a job already in progress, fully offline — never touches this.

const SUPABASE_URL = 'https://jkijvjpyygiplulubkns.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpraWp2anB5eWdpcGx1bHVia25zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4Nzg1NTUsImV4cCI6MjEwMzQ1NDU1NX0.EXaTXWFXSFnclWc7D-WqfwBDuHuWY-3BHL98nE9iN_c';

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

// TEMPORARY, by explicit request: no email verification at all — typing an
// email creates-or-signs-into that account immediately using this fixed
// shared password, so "prove you own this email" is skipped entirely. Anyone
// who knows (or guesses) an email used here can access that account's data.
// Requires "Confirm email" turned OFF in Supabase (Authentication ->
// Providers -> Email), or signUp below will sit unconfirmed and unusable.
// To harden this later: switch back to signInWithOtp (still in git history)
// or add a real per-user password, and turn "Confirm email" back on.
const QUICK_ACCESS_PASSWORD = 'hernando-quick-access-2026';

/** Creates the account on first use, signs in on every use after — no link, no verification step. */
export async function signInQuick(email) {
  const client = await getClient();
  if (!client) throw new Error('Cloud account isn\'t set up yet.');

  const signIn = await client.auth.signInWithPassword({ email, password: QUICK_ACCESS_PASSWORD });
  if (!signIn.error) return signIn.data.session;

  const signUp = await client.auth.signUp({ email, password: QUICK_ACCESS_PASSWORD });
  if (signUp.error) throw signUp.error;
  if (!signUp.data.session) {
    throw new Error('Account created but not signed in — check that "Confirm email" is turned off in Supabase.');
  }
  return signUp.data.session;
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
