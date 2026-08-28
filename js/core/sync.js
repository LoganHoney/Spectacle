// Cloud sync — Phase 2, Settings only for now (clients/inspections/photos
// come in later phases). Local IndexedDB stays the source of truth for
// offline use; this is a best-effort side-channel on top of it, never a
// requirement for the app to work.

import * as supabaseClient from './supabaseClient.js';
import * as store from './store.js';

/** Pulls the cloud copy of settings down and merges it into local storage. Returns true if a cloud copy existed. */
export async function pullSettingsFromCloud() {
  const client = await supabaseClient.getClient();
  const session = await supabaseClient.getSession();
  if (!client || !session) return false;
  const { data, error } = await client.from('settings').select('data').eq('user_id', session.user.id).maybeSingle();
  if (error) throw error;
  if (data?.data && Object.keys(data.data).length) {
    await store.saveSettings(data.data);
    return true;
  }
  return false;
}

/** Pushes the current local settings up to the cloud (upsert — creates the row on first push). */
export async function pushSettingsToCloud() {
  const client = await supabaseClient.getClient();
  const session = await supabaseClient.getSession();
  if (!client || !session) return;
  const settings = await store.getSettings();
  const { error } = await client.from('settings').upsert({ user_id: session.user.id, data: settings, updated_at: Date.now() });
  if (error) throw error;
}

/** Call right after a successful sign-in: pulls existing cloud settings down, or seeds the cloud with this device's local settings if the account is brand new. */
export async function syncSettingsOnSignIn() {
  const hadCloudData = await pullSettingsFromCloud();
  if (!hadCloudData) await pushSettingsToCloud();
}
