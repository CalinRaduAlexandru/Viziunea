import { createClient } from './supabase.js';

const STORAGE_KEY = 'viziunea.members.v1';
const demoMembers = [
  { id:'m-001', name:'Ana Popescu', email:'ana.popescu@example.ro', city:'București', role:'creator', status:'Activ', createdAt:'2026-06-12' },
  { id:'m-002', name:'Mihai Ionescu', email:'mihai.ionescu@example.ro', city:'Cluj-Napoca', role:'student', status:'Activ', createdAt:'2026-07-04' },
  { id:'m-003', name:'Ioana Marinescu', email:'ioana.marinescu@example.ro', city:'Brașov', role:'member', status:'Activ', createdAt:'2026-08-21' },
  { id:'m-004', name:'Vlad Dumitru', email:'vlad.dumitru@example.ro', city:'București', role:'collaborator', status:'Activ', createdAt:'2026-09-01' },
  { id:'m-005', name:'Elena Radu', email:'elena.radu@example.ro', city:'Sibiu', role:'organizer', status:'Activ', createdAt:'2026-09-08' },
];
const supabase = await createClient();

export function getMembers() {
  try { const saved=localStorage.getItem(STORAGE_KEY); return saved ? JSON.parse(saved) : demoMembers; }
  catch { return demoMembers; }
}
export async function saveMember(input) {
  const record={id:crypto.randomUUID(),name:input.name.trim(),email:input.email.trim().toLowerCase(),city:input.city.trim(),role:input.role,status:'Activ',createdAt:new Date().toISOString()};
  if (supabase) {
    const {error}=await supabase.from('members').insert({name:record.name,email:record.email,city:record.city,role:record.role});
    if(error) throw error;
  } else {
    const members=getMembers();
    if(!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY,JSON.stringify(members));
    localStorage.setItem(STORAGE_KEY,JSON.stringify([...members,record]));
  }
  return record;
}
