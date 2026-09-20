import { createClient } from './supabase.js';
import { ADMIN_STORAGE_KEY } from './app-state.js';

const DEMO_MEMBERS = [
  { id:'m-001', name:'Ana Popescu', email:'ana.popescu@example.ro', city:'București', roles:['Creator'], interests:['Artă'], status:'Activ', registered:'12.06.26', active:'Acum' },
  { id:'m-002', name:'Mihai Ionescu', email:'mihai.ionescu@example.ro', city:'Cluj-Napoca', roles:['Trainer'], interests:['Educație'], status:'Activ', registered:'04.07.26', active:'Astăzi' },
  { id:'m-003', name:'Ioana Marinescu', email:'ioana.marinescu@example.ro', city:'Brașov', roles:['Participant'], interests:['Experiențe'], status:'Activ', registered:'21.08.26', active:'Ieri' },
  { id:'m-004', name:'Vlad Dumitru', email:'vlad.dumitru@example.ro', city:'București', roles:['Creator','Partner'], interests:['Proiecte'], status:'Activ', registered:'01.09.26', active:'15.09.26' },
  { id:'m-005', name:'Elena Radu', email:'elena.radu@example.ro', city:'Sibiu', roles:['Gazdă de spațiu'], interests:['Spații'], status:'În așteptare', registered:'08.09.26', active:'10.09.26' },
];

let clientPromise;
async function supabaseClient() {
  if (!clientPromise) clientPromise = createClient();
  return clientPromise;
}

function localMembers() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || '{}'); } catch {}
  return DEMO_MEMBERS.map(member => ({ ...member, ...(saved[member.email] || {}) }));
}

function matches(member, filters) {
  const query = String(filters.search || '').trim().toLocaleLowerCase('ro');
  const haystack = `${member.name} ${member.email}`.toLocaleLowerCase('ro');
  return (!query || haystack.includes(query)) &&
    (!filters.city || member.city === filters.city) &&
    (!filters.status || member.status === filters.status) &&
    (!filters.role || (member.roles || []).includes(filters.role));
}

export async function listMembers({ page = 1, pageSize = 25, ...filters } = {}) {
  const supabase = await supabaseClient();
  if (!supabase) {
    const all = localMembers().filter(member => matches(member, filters));
    const from = Math.max(0, (page - 1) * pageSize);
    return { data: all.slice(from, from + pageSize), count: all.length, page, pageSize, source: 'demo' };
  }
  let query = supabase.from('members').select('id,name,email,city,roles,interests,status,admin_note,created_at,updated_at', { count: 'exact' });
  if (filters.search) {
    const safeSearch = String(filters.search).replace(/[%,()]/g, ' ').trim();
    if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
  }
  if (filters.city) query = query.eq('city', filters.city);
  if (filters.status) query = query.eq('status', filters.status === 'Activ' ? 'active' : filters.status === 'În așteptare' ? 'pending' : 'rejected');
  if (filters.role) query = query.contains('roles', [filters.role]);
  const from = Math.max(0, (page - 1) * pageSize);
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: data || [], count: count || 0, page, pageSize, source: 'supabase' };
}

export async function updateMember(id, changes) {
  const supabase = await supabaseClient();
  if (!supabase || String(id).startsWith('m-')) return { ...changes, persisted: false };
  const payload = { ...changes };
  if (changes.status) payload.status = changes.status === 'Activ' ? 'active' : changes.status === 'În așteptare' ? 'pending' : 'rejected';
  if (changes.note !== undefined) { payload.admin_note = changes.note; delete payload.note; }
  const { data, error } = await supabase.from('members').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return { ...data, persisted: true };
}

export const demoMembers = DEMO_MEMBERS;
