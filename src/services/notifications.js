import { createClient } from './supabase.js';
import { NOTIFICATIONS_KEY, readList, writeList } from './demo-data.js';

const supabase = await createClient();

export async function getNotifications(user) {
  if (!user) return [];
  if (supabase) {
    const { data, error } = await supabase.from('notifications').select('id,need_id,suggestion_id,title,body,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false});
    if (error) throw error;
    return data || [];
  }
  return readList(NOTIFICATIONS_KEY,[]).filter(item=>item.user_id===user.id);
}

export async function markNotificationRead(id,user) {
  if (!user) return;
  if (supabase) {
    const { error } = await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id);
    if (error) throw error;
    return;
  }
  const rows=readList(NOTIFICATIONS_KEY,[]).map(item=>item.id===id&&item.user_id===user.id?{...item,read_at:new Date().toISOString()}:item);
  writeList(NOTIFICATIONS_KEY,rows);
}
