import { createClient } from './supabase.js';

const SAVES_KEY = 'viziunea.post-saves.demo.v1';
const LIKES_KEY = 'viziunea.post-likes.demo.v1';
const COMMENTS_KEY = 'viziunea.post-comments.demo.v1';
let clientPromise;
async function supabaseClient() { if (!clientPromise) clientPromise = createClient(); return clientPromise; }
const identity = user => user?.id || user?.email || '';
const demo = user => !user || !user.id || String(user.id).startsWith('demo:');
function read(key, fallback = []) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

export async function listSavedPostIds(user) {
  if (demo(user)) return read(SAVES_KEY).filter(row => row.profile_id === identity(user)).map(row => row.post_id);
  const supabase = await supabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('post_saves').select('post_id').eq('profile_id', user.id).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => row.post_id);
}

export async function togglePostSave(user, postId, saved) {
  if (demo(user)) {
    const rows = read(SAVES_KEY).filter(row => !(row.profile_id === identity(user) && row.post_id === postId));
    if (saved) rows.unshift({ profile_id: identity(user), post_id: postId, created_at: new Date().toISOString() });
    write(SAVES_KEY, rows);
    return { saved, source: 'demo' };
  }
  const supabase = await supabaseClient();
  if (!supabase) return { saved, source: 'demo' };
  if (saved) {
    const { error } = await supabase.from('post_saves').upsert({ profile_id: user.id, post_id: postId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('post_saves').delete().eq('profile_id', user.id).eq('post_id', postId);
    if (error) throw error;
  }
  return { saved, source: 'supabase' };
}

export async function listPostComments(postId, user = null) {
  if (demo(user)) return read(COMMENTS_KEY).filter(comment => comment.post_id === postId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const supabase = await supabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('post_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addPostComment({ postId, authorId, body, parentId = null }, user = null) {
  const text = String(body || '').trim();
  if (!text) throw new Error('Scrie un comentariu înainte să îl trimiți.');
  if (demo(user)) {
    const comment = { id: `demo-comment-${crypto.randomUUID()}`, post_id: postId, author_id: authorId || identity(user), body: text, parent_id: parentId, created_at: new Date().toISOString() };
    write(COMMENTS_KEY, [comment, ...read(COMMENTS_KEY)]);
    return comment;
  }
  const supabase = await supabaseClient();
  if (!supabase) return addPostComment({ postId, authorId, body: text, parentId }, { id: `demo:${authorId}` });
  const { data, error } = await supabase.from('post_comments').insert({ post_id: postId, author_id: user.id, body: text, parent_id: parentId }).select().single();
  if (error) throw error;
  return data;
}

export async function togglePostLike(user, postId, liked) {
  if (demo(user)) {
    const rows = read(LIKES_KEY).filter(row => !(row.profile_id === identity(user) && row.post_id === postId));
    if (liked) rows.unshift({ profile_id: identity(user), post_id: postId, created_at: new Date().toISOString() });
    write(LIKES_KEY, rows);
    return { liked, source: 'demo' };
  }
  const supabase = await supabaseClient();
  if (!supabase) return { liked, source: 'demo' };
  const query = supabase.from('post_likes');
  const result = liked ? await query.upsert({ profile_id: user.id, post_id: postId }) : await query.delete().eq('profile_id', user.id).eq('post_id', postId);
  if (result.error) throw result.error;
  return { liked, source: 'supabase' };
}
