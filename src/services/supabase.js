// Add the public project URL and anon key in src/config.js to enable the hosted database.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export async function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_')) return null;
  // Dynamic import keeps the demo deployable without a build step when Supabase is not configured.
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
  return createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
}
