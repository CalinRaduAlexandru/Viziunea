import { createClient } from './supabase.js';

const CONVERSATIONS_KEY = 'viziunea.conversations.demo.v1';
const MESSAGES_KEY = 'viziunea.messages.demo.v1';
let clientPromise;
async function supabaseClient() { if (!clientPromise) clientPromise = createClient(); return clientPromise; }
const identity = user => user?.id || user?.email || '';
const demo = user => !user || !user.id || String(user.id).startsWith('demo:');
function read(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

export async function listConversations(user) {
  if (demo(user)) {
    const id = identity(user);
    const messages = read(MESSAGES_KEY).filter(message => message.from === id || message.to === id);
    const keys = [...new Set(messages.map(message => [message.from, message.to].filter(item => item !== id)[0]))];
    return keys.map(other => ({ id: `demo-conversation:${[id, other].sort().join('|')}`, kind: 'direct', other_profile_id: other, updated_at: messages.filter(message => message.from === other || message.to === other).at(-1)?.created_at || null }));
  }
  const supabase = await supabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('conversation_members').select('conversation_id, conversations(*)').eq('profile_id', user.id).order('joined_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => row.conversations).filter(Boolean);
}

export async function getOrCreateDirectConversation(user, otherProfileId) {
  if (demo(user)) return { id: `demo-conversation:${[identity(user), otherProfileId].sort().join('|')}`, kind: 'direct' };
  const supabase = await supabaseClient();
  if (!supabase) return getOrCreateDirectConversation({ id: `demo:${identity(user)}` }, otherProfileId);
  const { data: existing, error: lookupError } = await supabase.from('conversation_members').select('conversation_id').eq('profile_id', user.id);
  if (lookupError) throw lookupError;
  for (const row of existing || []) {
    const { data: members, error } = await supabase.from('conversation_members').select('profile_id').eq('conversation_id', row.conversation_id);
    if (!error && members?.length === 2 && members.some(member => member.profile_id === otherProfileId)) return { id: row.conversation_id, kind: 'direct' };
  }
  const { data: conversation, error } = await supabase.from('conversations').insert({ kind: 'direct', created_by: user.id }).select().single();
  if (error) throw error;
  const { error: membersError } = await supabase.from('conversation_members').insert([{ conversation_id: conversation.id, profile_id: user.id }, { conversation_id: conversation.id, profile_id: otherProfileId }]);
  if (membersError) throw membersError;
  return conversation;
}

export async function listConversationMessages(conversationId, user) {
  if (demo(user)) {
    const [, pair] = String(conversationId).split(':');
    const ids = pair?.split('|') || [];
    return read(MESSAGES_KEY).filter(message => ids.includes(message.from) && ids.includes(message.to)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  const supabase = await supabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

