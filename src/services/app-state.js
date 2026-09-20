import { createClient } from './supabase.js';

export const PROFILE_STORAGE_KEY = 'viziunea.profile.demo.v1';
export const FEED_STORAGE_KEY = 'viziunea.feed.demo.v1';
export const ADMIN_STORAGE_KEY = 'viziunea.admin.members.demo.v1';

const DEFAULT_PROFILE = Object.freeze({
  roles: ['Creator', 'Participant'],
  interests: ['Artă', 'Experiențe'],
  city: 'București',
});

const DEFAULT_FEED = Object.freeze({
  interests: [...DEFAULT_PROFILE.interests],
  city: DEFAULT_PROFILE.city,
  radius: 50,
});

function readJson(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readProfile() {
  return { ...DEFAULT_PROFILE, ...(readJson(PROFILE_STORAGE_KEY, {}) || {}) };
}

export function readFeed(profile = readProfile()) {
  const saved = readJson(FEED_STORAGE_KEY, null);
  if (saved) return { ...DEFAULT_FEED, ...saved };
  const initial = { interests: [...profile.interests], city: profile.city, radius: DEFAULT_FEED.radius };
  writeJson(FEED_STORAGE_KEY, initial);
  return initial;
}

export const profileState = readProfile();
export const feedState = readFeed(profileState);

export function saveProfile(profile) {
  Object.assign(profileState, profile);
  writeJson(PROFILE_STORAGE_KEY, profileState);
  const savedMembers = readJson(ADMIN_STORAGE_KEY, {}) || {};
  savedMembers['zametheea@demo.viziunea.ro'] = {
    ...(savedMembers['zametheea@demo.viziunea.ro'] || {}),
    roles: profileState.roles,
    interests: profileState.interests,
    city: profileState.city,
  };
  writeJson(ADMIN_STORAGE_KEY, savedMembers);
}

export function saveFeed(feed) {
  Object.assign(feedState, feed);
  writeJson(FEED_STORAGE_KEY, feedState);
}

export function saveAdminMember(email, changes) {
  const savedMembers = readJson(ADMIN_STORAGE_KEY, {}) || {};
  savedMembers[email] = { ...(savedMembers[email] || {}), ...changes };
  writeJson(ADMIN_STORAGE_KEY, savedMembers);
}

export function mergeSavedAdminMembers(members) {
  const savedMembers = readJson(ADMIN_STORAGE_KEY, {}) || {};
  return members.map(member => ({ ...member, ...(savedMembers[member.email] || {}) }));
}

export async function saveProfileToSupabase(profile, user = null) {
  const supabase = await createClient();
  if (!supabase || !user?.id || String(user.id).startsWith('demo:')) return { persisted: false, mode: 'local-demo' };
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: user.user_metadata?.full_name || profile.displayName || '',
    city: profile.city || null,
    interests: profile.interests || [],
    roles: profile.roles || [],
  });
  if (error) throw error;
  const memberPayload = {
    name: user.user_metadata?.full_name || profile.displayName || user.email?.split('@')[0] || 'Membru Viziunea',
    email: String(user.email || '').trim().toLowerCase(),
    city: profile.city || null,
    roles: profile.roles || [],
    interests: profile.interests || [],
  };
  const { data: updatedMember, error: memberUpdateError } = await supabase.from('members').update(memberPayload).eq('id', user.id).select('id');
  if (memberUpdateError) throw memberUpdateError;
  if (!updatedMember?.length) {
    const { error: memberInsertError } = await supabase.from('members').insert({ id: user.id, ...memberPayload, role: 'member', status: 'pending' });
    if (memberInsertError) throw memberInsertError;
  }
  await supabase.from('profile_roles').delete().eq('profile_id', user.id);
  await supabase.from('profile_interests').delete().eq('profile_id', user.id);
  if (profile.roles?.length) {
    const { error: rolesError } = await supabase.from('profile_roles').insert(profile.roles.map(role => ({ profile_id: user.id, role })));
    if (rolesError) throw rolesError;
  }
  if (profile.interests?.length) {
    const { error: interestsError } = await supabase.from('profile_interests').insert(profile.interests.map(interest => ({ profile_id: user.id, interest })));
    if (interestsError) throw interestsError;
  }
  return { persisted: true, mode: 'supabase' };
}

export async function saveFeedToSupabase(feed, user = null) {
  const supabase = await createClient();
  if (!supabase || !user?.id || String(user.id).startsWith('demo:')) return { persisted: false, mode: 'local-demo' };
  const { error } = await supabase.from('feed_preferences').upsert({
    profile_id: user.id,
    city: feed.city || null,
    radius_km: Number(feed.radius) || 50,
    interests: feed.interests || [],
  });
  if (error) throw error;
  return { persisted: true, mode: 'supabase' };
}

export async function hydrateStateFromSupabase(user = null) {
  const supabase = await createClient();
  if (!supabase || !user?.id || String(user.id).startsWith('demo:')) return false;
  const [{ data: profile }, { data: feed }] = await Promise.all([
    supabase.from('profiles').select('display_name,city,roles,interests').eq('id', user.id).maybeSingle(),
    supabase.from('feed_preferences').select('city,radius_km,interests').eq('profile_id', user.id).maybeSingle(),
  ]);
  if (profile) {
    Object.assign(profileState, { displayName: profile.display_name || '', city: profile.city || profileState.city, roles: profile.roles || [], interests: profile.interests || [] });
    writeJson(PROFILE_STORAGE_KEY, profileState);
  }
  if (feed) {
    Object.assign(feedState, { city: feed.city || profileState.city, radius: feed.radius_km || 50, interests: feed.interests || [] });
    writeJson(FEED_STORAGE_KEY, feedState);
  } else if (profile) {
    Object.assign(feedState, { city: profileState.city, interests: [...profileState.interests] });
    writeJson(FEED_STORAGE_KEY, feedState);
  }
  return Boolean(profile || feed);
}
