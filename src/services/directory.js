import { createClient } from './supabase.js';
import { DIRECTORY_KEY, demoDirectory, readList, writeList } from './demo-data.js';

const supabase = await createClient();
export const DIRECTORY_TYPES = ['person','project','space','course','service','experience','resource','initiative'];
export const DIRECTORY_DOMAINS = ['art','education','tourism','creative_services','cultural_intervention'];
export const VALUE_TYPES = ['people_skills','knowledge','opportunities','experiences_services','resources_infrastructure','signals_action'];
export const LOCATION_MODES = ['fixed','travels','remote','hybrid','location_independent'];
export const SERVICE_SCOPES = ['city','nearby','county','region','national','international','online'];
export const SEARCH_SCOPES = ['city','nearby','county','region','national','online'];

export function normalizeText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

export async function getDirectoryItems({ includeUnpublished = false } = {}) {
  if (supabase) {
    let query = supabase.from('directory_items').select('*');
    if (!includeUnpublished) query = query.eq('status','published');
    const { data, error } = await query.order('created_at',{ascending:false});
    if (error) throw error;
    return data || [];
  }
  const saved = readList(DIRECTORY_KEY, []);
  const items = [...demoDirectory, ...saved.filter(item => !demoDirectory.some(seed => seed.id === item.id))];
  return includeUnpublished ? items : items.filter(item => item.status === 'published');
}

export async function saveDirectoryItem(input) {
  const item = { ...input, slug:input.slug || normalizeText(input.title).replaceAll(' ','-'), status:input.status || 'published', tags:Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(',').map(tag=>tag.trim()).filter(Boolean) };
  if (supabase) {
    const { data, error } = await supabase.from('directory_items').upsert(item,{onConflict:'slug'}).select().single();
    if (error) throw error;
    return data;
  }
  const saved = readList(DIRECTORY_KEY, []);
  const record = { ...item, id:item.id || `demo-item-${crypto.randomUUID()}`, created_at:item.created_at || new Date().toISOString() };
  writeList(DIRECTORY_KEY,[record,...saved.filter(existing=>existing.id!==record.id&&existing.slug!==record.slug)]);
  return record;
}

const broadValueByIntent = {
  create:['people_skills','opportunities','resources_infrastructure'],
  find:['experiences_services','resources_infrastructure','people_skills'],
  offer:['people_skills','opportunities','resources_infrastructure'],
  learn:['knowledge','people_skills'],
  participate:['experiences_services','opportunities','signals_action'],
  organize:['resources_infrastructure','experiences_services','people_skills'],
  unsure:[],
};

function lexicalScore(item, query, intent) {
  const q = normalizeText(query);
  const title = normalizeText(item.title);
  const tags = (item.tags || []).map(normalizeText);
  const description = normalizeText(item.description);
  const tokens = q.split(' ').filter(token=>token.length>1);
  let score = 0;
  if (q && title === q) score += 110;
  if (q && title.includes(q)) score += 86;
  if (q && tags.some(tag=>tag === q || tag.includes(q) || q.includes(tag))) score += 90;
  for (const token of tokens) {
    if (title.split(' ').includes(token)) score += 18;
    if (tags.some(tag=>tag.split(' ').includes(token))) score += 15;
    if (description.includes(token)) score += 3;
  }
  const metadata = normalizeText(`${item.domain} ${item.value_type} ${item.item_type} ${item.location_label||''} ${item.city||''} ${item.county||''} ${item.region||''} ${item.country||''}`);
  for (const token of tokens) if (metadata.includes(token)) score += 2;
  if ((broadValueByIntent[intent] || []).includes(item.value_type)) score += 3;
  return score;
}

function declaresPlaceInQuery(item, query) {
  const q = normalizeText(query);
  return [item.location_label,item.city,item.county,item.region].filter(Boolean).some(place=>normalizeText(place).length>2 && q.includes(normalizeText(place)));
}

function geography(item, { city = '', county = '', region = '', country = 'România', scope = 'city', remoteOk = true, locationPreference = 'flexible' } = {}, query = '') {
  const mode = item.location_mode || 'location_independent';
  const sameCountry = !country || normalizeText(item.country) === normalizeText(country);
  const sameCity = sameCountry && city && normalizeText(item.city) === normalizeText(city);
  const sameCounty = sameCountry && county && normalizeText(item.county) === normalizeText(county);
  const sameRegion = sameCountry && region && normalizeText(item.region) === normalizeText(region);
  const explicitlyRequested = declaresPlaceInQuery(item,query);
  if (explicitlyRequested) return { allowed:true, bonus:34, reason:'Locație menționată în căutare' };
  if (mode === 'remote') return { allowed:remoteOk, bonus:0, reason:'Disponibil remote' };
  if (mode === 'location_independent') return { allowed:true, bonus:0, reason:'Locația nu contează' };
  if (mode === 'hybrid' && remoteOk) return { allowed:true, bonus:sameCity?22:sameCounty?15:0, reason:sameCity?'Local și remote':'Poate fi remote' };
  if (!city && !county && !region) return { allowed:true, bonus:0, reason:'' };
  if (!city && county && sameCounty) return { allowed:true, bonus:24, reason:'În județul tău' };
  if (!city && !county && region && sameRegion) return { allowed:true, bonus:18, reason:'În regiunea ta' };
  if (sameCity) return { allowed:true, bonus:32, reason:'În orașul tău' };
  if (scope === 'city') return { allowed:false, bonus:0, reason:'' };
  if (mode === 'fixed') {
    if (scope === 'nearby' && (sameCounty || (sameRegion && item.service_area_scope === 'nearby'))) return { allowed:true, bonus:20, reason:sameCounty?'În județul tău':'Zonă apropiată declarată' };
    if (scope === 'county' && sameCounty) return { allowed:true, bonus:14, reason:'În județul tău' };
    if (scope === 'region' && (sameRegion || (sameCounty && !region))) return { allowed:true, bonus:9, reason:'În regiunea ta' };
    // A fixed experience or place stays local even when the user opens wider scopes.
    return { allowed:false, bonus:0, reason:'' };
  }
  if (mode === 'travels') {
    const locallyReachable = sameCounty || (sameRegion && (item.travel_radius_km || item.service_area_scope==='nearby'));
    if (scope === 'nearby' && locallyReachable && (item.service_area_scope!=='city' || sameCity || item.travel_radius_km)) return { allowed:true, bonus:20, reason:item.travel_radius_km?`Se deplasează (rază declarată ${item.travel_radius_km} km)`:'Se deplasează în zonă' };
    if (scope === 'county' && sameCounty) return { allowed:true, bonus:14, reason:'În județul tău' };
    if (scope === 'region' && sameRegion && ['region','national'].includes(item.service_area_scope)) return { allowed:true, bonus:9, reason:item.service_area_scope==='region'?'În regiunea ta':'Acoperire națională declarată' };
    if (scope === 'national' && (item.service_area_scope==='international' || (sameCountry && item.service_area_scope==='national'))) return { allowed:true, bonus:3, reason:item.service_area_scope==='international'?'Acoperire internațională declarată':'Acoperire națională declarată' };
    return { allowed:false, bonus:0, reason:'' };
  }
  if (mode === 'hybrid') {
    if (scope === 'nearby' && sameCounty) return { allowed:true, bonus:18, reason:'Local sau remote' };
    if (scope === 'county' && sameCounty) return { allowed:true, bonus:14, reason:'În județul tău sau remote' };
    if (scope === 'region' && (sameRegion || item.service_area_scope==='national')) return { allowed:true, bonus:9, reason:sameRegion?'În regiunea ta sau remote':'Acoperire națională declarată' };
    if (scope === 'national' && sameCountry && item.service_area_scope === 'national') return { allowed:true, bonus:3, reason:'Hibrid, acoperire națională' };
  }
  if (scope === 'online' && (mode === 'remote' || mode === 'location_independent' || (mode === 'hybrid' && remoteOk))) return { allowed:true, bonus:0, reason:'Disponibil online' };
  if (!sameCountry && scope !== 'national') return { allowed:false, bonus:0, reason:'' };
  return { allowed:false, bonus:0, reason:'' };
}

export async function searchDirectory({ query, intent = 'unsure', city = '', county = '', region = '', country = 'România', scope = 'city', remoteOk = true, locationPreference = 'flexible', limit = 5 }) {
  const items = await getDirectoryItems();
  const normalizedCity=normalizeText(city);
  const inferredLocation=items.find(item=>normalizeText(item.city)===normalizedCity);
  const effectiveCounty=county || inferredLocation?.county || '';
  const effectiveRegion=region || inferredLocation?.region || '';
  const ranked = items.map(item=>{
    const textScore = lexicalScore(item,query,intent);
    const allowRemote = remoteOk && !['fixed','travels'].includes(locationPreference);
    const geo = geography(item,{city,county:effectiveCounty,region:effectiveRegion,country,scope,remoteOk:allowRemote,locationPreference},query);
    const geoWeight={experience:1.45,space:1.35,person:1.2,service:1.1,course:.95,resource:.85,project:.8,initiative:.4}[item.item_type]||1;
    return { item, score:textScore+geo.bonus*geoWeight, textScore, geography:geo };
  }).filter(result=>result.textScore>=18 && result.geography.allowed)
    .sort((a,b)=>b.score-a.score || String(a.item.title).localeCompare(String(b.item.title),'ro'));
  return ranked.slice(0,limit);
}
