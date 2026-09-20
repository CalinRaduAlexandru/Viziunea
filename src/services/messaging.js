import { createClient } from './supabase.js';

const MESSAGES_KEY = 'viziunea.messages.demo.v1';
const NOTIFICATIONS_KEY = 'viziunea.notifications.demo.v1';
let clientPromise;
async function supabaseClient() { if (!clientPromise) clientPromise = createClient(); return clientPromise; }
function read(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function idFor(user) { return user?.email || user?.id || ''; }

export async function sendMessage({ from, to, body }) {
  const text = String(body || '').trim();
  if (!text) throw new Error('Scrie un mesaj înainte să îl trimiți.');
  const supabase = await supabaseClient();
  if (supabase && from?.id && to?.id && !String(from.id).startsWith('demo:') && !String(to.id).startsWith('demo:')) {
    const { data, error } = await supabase.from('messages').insert({ sender_id: from.id, recipient_id: to.id, body: text }).select().single();
    if (error) throw error;
    await supabase.from('notifications').insert({ user_id: to.id, type: 'message', title: `Mesaj nou de la ${from.user_metadata?.full_name || from.email}`, body: text, related_id: data.id });
    return { ...data, persisted: true, source: 'supabase' };
  }
  const message = { id: `demo-message-${crypto.randomUUID()}`, from: idFor(from), to: idFor(to), fromName: from?.user_metadata?.full_name || from?.email || 'Membru', toName: to?.user_metadata?.full_name || to?.email || 'Membru', body: text, created_at: new Date().toISOString(), read: false };
  write(MESSAGES_KEY, [message, ...read(MESSAGES_KEY)]);
  const notification = { id: `demo-notification-${crypto.randomUUID()}`, user: idFor(to), type: 'message', title: `Mesaj nou de la ${message.fromName}`, body: text, related_id: message.id, created_at: message.created_at, read: false };
  write(NOTIFICATIONS_KEY, [notification, ...read(NOTIFICATIONS_KEY)]);
  return { ...message, persisted: true, source: 'demo' };
}

export async function listMessages(user) {
  const supabase = await supabaseClient();
  if (supabase && user?.id && !String(user.id).startsWith('demo:')) {
    const { data, error } = await supabase.from('messages').select('*').or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).order('created_at', { ascending: true });
    if (error) throw error;
    return { data: data || [], source: 'supabase' };
  }
  const email = idFor(user);
  return { data: read(MESSAGES_KEY).filter(message => message.from === email || message.to === email).sort((a, b) => a.created_at.localeCompare(b.created_at)), source: 'demo' };
}

export async function listNotifications(user) {
  const supabase = await supabaseClient();
  if (supabase && user?.id && !String(user.id).startsWith('demo:')) {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) throw error;
    return { data: data || [], source: 'supabase' };
  }
  return { data: read(NOTIFICATIONS_KEY).filter(notification => notification.user === idFor(user)).sort((a, b) => b.created_at.localeCompare(a.created_at)), source: 'demo' };
}
