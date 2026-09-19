import { createClient } from './supabase.js';

const DEMO_USER_KEY = 'viziunea.demo-user.v1';
const supabase = await createClient();

export function isSupabaseConfigured() { return Boolean(supabase); }

export async function getCurrentUser() {
  try { const demoUser = JSON.parse(localStorage.getItem(DEMO_USER_KEY) || 'null'); if (demoUser) return demoUser; } catch {}
  if (!supabase) {
    try { return JSON.parse(localStorage.getItem(DEMO_USER_KEY) || 'null'); }
    catch { return null; }
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.user || null;
}

export async function signInWithEmail(email, displayName = '') {
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith('@demo.viziunea.ro')) {
    const user = { id:`demo:${normalized}`, email:normalized, user_metadata:{ full_name:displayName.trim() } };
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
    return { mode:'demo', user };
  }
  if (!supabase) {
    const user = { id:`demo:${normalized}`, email:normalized, user_metadata:{ full_name:displayName.trim() } };
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
    return { mode:'demo', user };
  }
  const redirectTo = new URL('../../auth/', import.meta.url).href;
  const { error } = await supabase.auth.signInWithOtp({ email:normalized, options:{ emailRedirectTo:redirectTo, shouldCreateUser:true, data:{ full_name:displayName.trim() } } });
  if (error) throw error;
  return { mode:'otp', user:null };
}

export async function signOut() {
  localStorage.removeItem(DEMO_USER_KEY);
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function isStaff(user = null) {
  if (!supabase) return true; // Explicitly marked demo mode; no production admin access exists here.
  user ||= await getCurrentUser();
  if (!user) return false;
  const { data, error } = await supabase.from('staff_users').select('role').eq('user_id', user.id).maybeSingle();
  if (error) return false;
  return Boolean(data);
}
