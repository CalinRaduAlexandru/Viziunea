import { createClient } from './supabase.js';
import { NEEDS_KEY, NOTIFICATIONS_KEY, SUGGESTIONS_KEY, demoNeeds, readList, writeList } from './demo-data.js';

const supabase = await createClient();

export async function submitSuggestion(input,user) {
  if (!user) throw new Error('Autentificarea este necesară pentru a trimite o sugestie.');
  const record = {
    need_id:input.need_id, suggestion_type:input.suggestion_type,
    name:String(input.name || '').trim(), description:String(input.description || '').trim(),
    contact_url:String(input.contact_url || '').trim() || null, note:String(input.note || '').trim() || null,
  };
  if (supabase) {
    const { data, error } = await supabase.from('suggestions').insert(record).select('id,need_id,suggestion_type,name,description,contact_url,note,status,created_at').single();
    if (error) throw error;
    return data;
  }
  const row={...record,id:`demo-suggestion-${crypto.randomUUID()}`,submitted_by:user.id,status:'pending',created_at:new Date().toISOString()};
  const rows=readList(SUGGESTIONS_KEY,[]);writeList(SUGGESTIONS_KEY,[row,...rows]);return row;
}

export async function getMySuggestions(user) {
  if (!user) return [];
  if (supabase) {
    const { data, error } = await supabase.from('suggestions').select('id,need_id,suggestion_type,name,description,contact_url,note,status,created_at,reviewed_at').eq('submitted_by',user.id).order('created_at',{ascending:false});
    if (error) throw error;
    return data || [];
  }
  return readList(SUGGESTIONS_KEY,[]).filter(row=>row.submitted_by===user.id);
}

export async function getApprovedSuggestionsForNeed(needId) {
  if (supabase) {
    const { data, error } = await supabase.from('suggestions').select('id,need_id,suggestion_type,name,description,contact_url,note,status,created_at,reviewed_at').eq('need_id',needId).eq('status','approved').order('reviewed_at',{ascending:false});
    if (error) throw error;
    return data || [];
  }
  return readList(SUGGESTIONS_KEY,[]).filter(row=>row.need_id===needId && row.status==='approved');
}

export async function getPendingSuggestions() {
  if (supabase) {
    const { data, error } = await supabase.from('suggestions').select('id,need_id,submitted_by,suggestion_type,name,description,contact_url,note,status,created_at').eq('status','pending').order('created_at',{ascending:true});
    if (error) throw error;
    return data || [];
  }
  return readList(SUGGESTIONS_KEY,[]).filter(row=>row.status==='pending');
}

export async function moderateSuggestion(id,status) {
  if (!['approved','rejected'].includes(status)) throw new Error('Acțiune de moderare invalidă.');
  if (supabase) {
    const { data, error } = await supabase.from('suggestions').update({status,reviewed_at:new Date().toISOString()}).eq('id',id).select('id,need_id,status').single();
    if (error) throw error;
    return data;
  }
  const suggestions=readList(SUGGESTIONS_KEY,[]);
  const index=suggestions.findIndex(row=>row.id===id);
  if(index<0)throw new Error('Sugestia nu a fost găsită.');
  const updated={...suggestions[index],status,reviewed_at:new Date().toISOString()};
  suggestions[index]=updated;writeList(SUGGESTIONS_KEY,suggestions);
  if(status==='approved'){
    const need=readList(NEEDS_KEY,demoNeeds).find(row=>row.id===updated.need_id);
    if(need){
      const notifications=readList(NOTIFICATIONS_KEY,[]);
      notifications.unshift({id:`demo-notification-${crypto.randomUUID()}`,user_id:need.requester_id,need_id:need.id,suggestion_id:updated.id,title:'A apărut o sugestie pentru nevoia ta',body:`Echipa Viziunea a aprobat sugestia „${updated.name}”.`,created_at:new Date().toISOString(),read_at:null});
      writeList(NOTIFICATIONS_KEY,notifications);
    }
  }
  return updated;
}
