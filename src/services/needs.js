import { createClient } from './supabase.js';
import { NEEDS_KEY, demoNeeds, readList, writeList } from './demo-data.js';

const supabase = await createClient();
const safeFields = 'id,intent,query,city,county,region,country,location_preference,max_distance_km,remote_ok,domain,value_type,status,created_at,updated_at';
function anonymousSummary(value='') {
  const summary=String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email eliminat]').replace(/https?:\/\/\S+/gi,'[link eliminat]').replace(/\+?[0-9][0-9 ().-]{6,}[0-9]/g,'[telefon eliminat]').trim();
  return summary.length>=2?summary:'Caut o soluție pentru o nevoie în comunitate.';
}

export async function createNeed(input, user) {
  if (!user) throw new Error('Autentificarea este necesară pentru a salva o nevoie.');
  const record = {
    intent:input.intent || 'unsure', query:String(input.query || '').trim(),
    city:String(input.city || '').trim(), county:String(input.county || '').trim(), region:String(input.region || '').trim(), country:String(input.country || 'România').trim(),
    location_preference:input.location_preference || 'flexible', max_distance_km:input.max_distance_km ? Number(input.max_distance_km) : null,
    remote_ok:Boolean(input.remote_ok), domain:input.domain || null, value_type:input.value_type || null,
  };
  if (supabase) {
    const { data, error } = await supabase.from('needs').insert(record).select(safeFields).single();
    if (error) throw error;
    return data;
  }
  const row = { ...record, community_summary:anonymousSummary(record.query), id:`demo-need-${crypto.randomUUID()}`, requester_id:user.id, status:'open', created_at:new Date().toISOString() };
  const needs = readList(NEEDS_KEY,demoNeeds);
  writeList(NEEDS_KEY,[row,...needs]);
  return row;
}

export async function getCommunityNeeds() {
  if (supabase) {
    const { data, error } = await supabase.from('community_needs').select('id,intent,query,city,county,region,country,location_preference,max_distance_km,remote_ok,created_at').order('created_at',{ascending:false});
    if (error) throw error;
    return data || [];
  }
  return readList(NEEDS_KEY,demoNeeds).filter(need=>need.status==='open').map(({requester_id,...safe})=>({...safe,query:safe.community_summary || anonymousSummary(safe.query)}));
}

export async function getMyNeeds(user) {
  if (!user) return [];
  if (supabase) {
    const { data, error } = await supabase.from('needs').select(safeFields).eq('requester_id',user.id).order('created_at',{ascending:false});
    if (error) throw error;
    return data || [];
  }
  return readList(NEEDS_KEY,demoNeeds).filter(need=>need.requester_id===user.id);
}

export async function getNeed(id) {
  if (supabase) {
    const { data, error } = await supabase.from('community_needs').select('id,intent,query,city,county,region,country,location_preference,max_distance_km,remote_ok,created_at').eq('id',id).maybeSingle();
    if (error) throw error;
    return data;
  }
  const need=readList(NEEDS_KEY,demoNeeds).find(row=>row.id===id);
  if(!need)return null;
  const {requester_id,...safe}=need;
  return {...safe,query:safe.community_summary || anonymousSummary(safe.query)};
}

export async function getAllNeeds() {
  if (supabase) {
    const { data, error } = await supabase.from('needs').select(safeFields).order('created_at',{ascending:false});
    if (error) throw error;
    return data || [];
  }
  return readList(NEEDS_KEY,demoNeeds);
}

export async function setNeedStatus(id,status,user) {
  if (!['open','resolved','closed'].includes(status)) throw new Error('Status necunoscut.');
  if (supabase) {
    const { error } = await supabase.rpc('set_need_status',{target_id:id,requested_status:status});
    if (error) throw error;
    const { data, error:readError } = await supabase.from('needs').select(safeFields).eq('id',id).single();
    if (readError) throw readError;
    return data;
  }
  const needs = readList(NEEDS_KEY,demoNeeds);
  const index = needs.findIndex(need=>need.id===id && (!user || need.requester_id===user.id));
  if (index<0) throw new Error('Nevoia nu a fost găsită.');
  needs[index] = {...needs[index],status,updated_at:new Date().toISOString()};
  writeList(NEEDS_KEY,needs);
  return needs[index];
}
