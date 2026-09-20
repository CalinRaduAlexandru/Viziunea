import { createClient } from './supabase.js';
import { DEMO_RESULTS, FEED_POSTS } from '../data/demo-content.js';

const TABLES = Object.freeze({ posts: 'community_posts', projects: 'projects', spaces: 'spaces', events: 'events' });
const LOCAL_POSTS_KEY = 'viziunea.community.posts.demo.v1';
let clientPromise;
async function supabaseClient() {
  if (!clientPromise) clientPromise = createClient();
  return clientPromise;
}
function paginate(rows, page, pageSize) {
  const from = Math.max(0, (page - 1) * pageSize);
  return { data: rows.slice(from, from + pageSize), count: rows.length, page, pageSize, source: 'demo' };
}
function demoRows(kind) {
  if (kind === 'posts') return FEED_POSTS.map((post, index) => ({ id: `demo-post-${index + 1}`, title: post.title, body: post.body, post_type: 'update', city: post.city, interest: post.interest, interests: [post.interest], status: 'published', created_at: post.time, author_name: post.author }));
  const category = kind === 'projects' ? 'proiecte' : kind === 'spaces' ? 'spatii' : kind === 'events' ? 'evenimente' : 'oameni';
  return (DEMO_RESULTS[category] || []).map((item, index) => ({ id: `demo-${kind}-${index + 1}`, title: item.title, description: item.desc, city: item.meta, status: 'published' }));
}
function applyFilters(rows, filters = {}) {
  const search = String(filters.search || '').trim().toLocaleLowerCase('ro');
  return rows.filter(row => {
    const text = `${row.title || ''} ${row.description || ''} ${row.body || ''} ${row.author_name || ''}`.toLocaleLowerCase('ro');
    return (!search || text.includes(search)) && (!filters.city || row.city === filters.city) && (!filters.interest || (row.interests || [row.interest]).includes(filters.interest));
  });
}
export async function listContent(kind, { page = 1, pageSize = 25, search = '', city = '', interest = '' } = {}) {
  const table = TABLES[kind];
  if (!table) throw new Error(`Unknown content type: ${kind}`);
  const supabase = await supabaseClient();
  if (!supabase) return paginate(applyFilters(demoRows(kind), { search, city, interest }), page, pageSize);
  let query = supabase.from(table).select('*', { count: 'exact' }).eq('status', 'published');
  if (search) query = query.ilike('title', `%${String(search).replace(/[%,()]/g, ' ')}%`);
  if (city) query = query.eq('city', city);
  if (interest && kind === 'posts') query = query.contains('interests', [interest]);
  const from = Math.max(0, (page - 1) * pageSize);
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: data || [], count: count || 0, page, pageSize, source: 'supabase' };
}
export const listPosts = options => listContent('posts', options);
export const listProjects = options => listContent('projects', options);
export const listSpaces = options => listContent('spaces', options);
export const listEvents = options => listContent('events', options);

export async function createPost(input, user = null) {
  const payload = {
    title: String(input.title || '').trim(),
    body: String(input.body || '').trim(),
    post_type: input.post_type || 'update',
    city: input.city || null,
    interests: Array.isArray(input.interests) ? input.interests.filter(Boolean) : [],
    interest: Array.isArray(input.interests) ? input.interests[0] || null : null,
    event_date: input.event_date || null,
    entity_type: input.entity_type || 'person',
    representation_type: input.representation_type || 'proposal',
    represented_name: input.represented_name || null,
    contact_method: input.contact_method || null,
    contact_value: input.contact_value || null,
    status: 'pending',
  };
  if (!payload.title || !payload.body) throw new Error('Completează titlul și descrierea.');
  const supabase = await supabaseClient();
  if (supabase && user?.id && !String(user.id).startsWith('demo:')) {
    const { data, error } = await supabase.from(TABLES.posts).insert({ ...payload, author_id: user.id }).select().single();
    if (error) throw error;
    return { ...data, persisted: true, source: 'supabase' };
  }
  const record = { ...payload, id: `demo-post-${crypto.randomUUID()}`, author_name: user?.user_metadata?.full_name || 'Zametheea', created_at: new Date().toISOString() };
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(LOCAL_POSTS_KEY) || '[]'); } catch {}
  localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify([record, ...saved]));
  return { ...record, persisted: true, source: 'demo' };
}
