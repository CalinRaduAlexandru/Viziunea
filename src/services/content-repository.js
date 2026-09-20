import { createClient } from './supabase.js';
import { DEMO_RESULTS, FEED_POSTS } from '../data/demo-content.js';

const TABLES = Object.freeze({ posts: 'community_posts', projects: 'projects', spaces: 'spaces', events: 'events' });
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
  if (kind === 'posts') return FEED_POSTS.map((post, index) => ({ id: `demo-post-${index + 1}`, title: post.title, body: post.body, post_type: 'update', city: post.city, interest: post.interest, status: 'published', created_at: post.time, author_name: post.author }));
  const category = kind === 'projects' ? 'proiecte' : kind === 'spaces' ? 'spatii' : kind === 'events' ? 'evenimente' : 'oameni';
  return (DEMO_RESULTS[category] || []).map((item, index) => ({ id: `demo-${kind}-${index + 1}`, title: item.title, description: item.desc, city: item.meta, status: 'published' }));
}
function applyFilters(rows, filters = {}) {
  const search = String(filters.search || '').trim().toLocaleLowerCase('ro');
  return rows.filter(row => {
    const text = `${row.title || ''} ${row.description || ''} ${row.body || ''} ${row.author_name || ''}`.toLocaleLowerCase('ro');
    return (!search || text.includes(search)) && (!filters.city || row.city === filters.city) && (!filters.interest || row.interest === filters.interest);
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
  if (interest && kind === 'posts') query = query.eq('interest', interest);
  const from = Math.max(0, (page - 1) * pageSize);
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: data || [], count: count || 0, page, pageSize, source: 'supabase' };
}
export const listPosts = options => listContent('posts', options);
export const listProjects = options => listContent('projects', options);
export const listSpaces = options => listContent('spaces', options);
export const listEvents = options => listContent('events', options);
