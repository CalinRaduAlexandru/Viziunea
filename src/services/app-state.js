import { createClient } from './supabase.js';

export const PROFILE_STORAGE_KEY = 'viziunea.profile.demo.v1';
export const FEED_STORAGE_KEY = 'viziunea.feed.demo.v1';
export const FEED_INTEREST_OVERRIDE_KEY = 'viziunea.feed.interests.customized.v1';
export const ADMIN_STORAGE_KEY = 'viziunea.admin.members.demo.v1';
const ACCOUNT_PROFILE_PREFIX = 'viziunea.profile.account.v1:';
const ACCOUNT_FEED_PREFIX = 'viziunea.feed.account.v1:';
let activeProfileEmail = 'zametheea@demo.viziunea.ro';

const DEFAULT_PROFILE = Object.freeze({
  roles: ['Creator', 'Participant'],
  interests: ['Artă', 'Experiențe'],
  city: 'București',
  useProfileDefaults: false,
});

const DEFAULT_FEED = Object.freeze({
  interests: [...DEFAULT_PROFILE.interests],
  city: DEFAULT_PROFILE.city,
  radius: 100,
});

const DEMO_ACCOUNT_DEFAULTS = Object.freeze({
  'zametheea@demo.viziunea.ro': { displayName: 'Zametheea Popescu', roles: ['Creator', 'Participant'], interests: ['Artă', 'Experiențe'], city: 'București', profileContact: 'zametheea@demo.viziunea.ro', profileAbout: 'Construiesc punți între oameni, idei și oportunități care pot crește comunitatea.', profileAvailability: true, profileContactMethod: 'whatsapp', profileContactPhone: '+40 744 321 907' },
  'radu.calin@demo.viziunea.ro': { displayName: 'Radu Călin', roles: ['Creator', 'Participant'], interests: ['Artă', 'Proiecte'], city: 'București', profileContact: 'radu.calin@demo.viziunea.ro', profileAbout: 'Lucrez la proiecte creative și caut oameni cu care să construiesc idei locale.', profileAvailability: true, profileContactMethod: 'platform', profileContactPhone: '' },
});

const accountKey = (prefix, email = activeProfileEmail) => `${prefix}${String(email || '').trim().toLowerCase()}`;
const accountDefaults = (email = activeProfileEmail) => ({ ...DEFAULT_PROFILE, ...(DEMO_ACCOUNT_DEFAULTS[String(email || '').trim().toLowerCase()] || {}) });

function readJson(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readProfile() {
  return { ...accountDefaults(), ...(readJson(accountKey(ACCOUNT_PROFILE_PREFIX), readJson(PROFILE_STORAGE_KEY, {})) || {}) };
}

export function readFeed(profile = readProfile()) {
  const saved = readJson(accountKey(ACCOUNT_FEED_PREFIX), readJson(FEED_STORAGE_KEY, null));
  if (saved) return { ...DEFAULT_FEED, ...saved };
  const initial = { interests: [...profile.interests], city: profile.city, radius: DEFAULT_FEED.radius };
  writeJson(FEED_STORAGE_KEY, initial);
  writeJson(accountKey(ACCOUNT_FEED_PREFIX), initial);
  return initial;
}

export const profileState = readProfile();
export const feedState = readFeed(profileState);

export function selectDemoAccount(email) {
  activeProfileEmail = String(email || 'zametheea@demo.viziunea.ro').trim().toLowerCase();
  const profile = { ...accountDefaults(activeProfileEmail), ...(readJson(accountKey(ACCOUNT_PROFILE_PREFIX), {}) || {}) };
  const feed = readJson(accountKey(ACCOUNT_FEED_PREFIX), null) || { interests: [...(profile.interests || [])], city: profile.city || 'București', radius: 100 };
  for (const key of Object.keys(profileState)) delete profileState[key];
  Object.assign(profileState, profile);
  for (const key of Object.keys(feedState)) delete feedState[key];
  Object.assign(feedState, feed);
  feedInterestsCustomized = Boolean(readJson(accountKey(FEED_INTEREST_OVERRIDE_KEY + ':'), false));
  return { profile: profileState, feed: feedState };
}

export let feedInterestsCustomized = Boolean(readJson(FEED_INTEREST_OVERRIDE_KEY, false));

export function syncFeedInterestsFromProfile(profile = profileState) {
  if (feedInterestsCustomized) return false;
  feedState.interests = [...(profile.interests || [])];
  writeJson(FEED_STORAGE_KEY, feedState);
  writeJson(accountKey(ACCOUNT_FEED_PREFIX), feedState);
  return true;
}

export function setFeedInterestsCustomized(value = true) {
  feedInterestsCustomized = Boolean(value);
  writeJson(FEED_INTEREST_OVERRIDE_KEY, feedInterestsCustomized);
  writeJson(accountKey(FEED_INTEREST_OVERRIDE_KEY + ':'), feedInterestsCustomized);
}

export function saveProfile(profile) {
  Object.assign(profileState, profile);
  writeJson(PROFILE_STORAGE_KEY, profileState);
  writeJson(accountKey(ACCOUNT_PROFILE_PREFIX), profileState);
  const savedMembers = readJson(ADMIN_STORAGE_KEY, {}) || {};
  savedMembers[activeProfileEmail] = {
    ...(savedMembers[activeProfileEmail] || {}),
    roles: profileState.roles,
    interests: profileState.interests,
    city: profileState.city,
  };
  writeJson(ADMIN_STORAGE_KEY, savedMembers);
}

export function saveFeed(feed) {
  Object.assign(feedState, feed);
  writeJson(FEED_STORAGE_KEY, feedState);
  writeJson(accountKey(ACCOUNT_FEED_PREFIX), feedState);
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
    email: String(user.email || '').trim().toLowerCase(),
    city: profile.city || null,
    interests: profile.interests || [],
    roles: profile.roles || [],
  });
  if (error) throw error;
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
    radius_km: Number(feed.radius) || 100,
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
    writeJson(accountKey(ACCOUNT_PROFILE_PREFIX), profileState);
  }
  if (feed) {
    Object.assign(feedState, { city: feed.city || profileState.city, radius: feed.radius_km || 100, interests: feed.interests || [] });
    writeJson(FEED_STORAGE_KEY, feedState);
    writeJson(accountKey(ACCOUNT_FEED_PREFIX), feedState);
  } else if (profile) {
    Object.assign(feedState, { city: profileState.city });
  }
  if (profile) syncFeedInterestsFromProfile(profileState);
  return Boolean(profile || feed);
}
