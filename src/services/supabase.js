// Add the public project URL and anon key in src/config.js to enable the hosted database.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

let clientPromise;
export async function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_')) return null;
  if (!clientPromise) {
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2').then(({createClient}) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    ).catch(error => { console.warn('Supabase client unavailable; using demo mode.',error); clientPromise = null; return null; });
  }
  return clientPromise;
}
