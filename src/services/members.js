import { listMembers, updateMember, demoMembers } from './member-repository.js';

// Compatibility facade for older views. New code should import member-repository.js.
export function getMembers() { return [...demoMembers]; }

export async function getAdminMembers(options = {}) {
  const result = await listMembers({ page: 1, pageSize: 50, ...options });
  return result.data;
}

export async function updateMemberAdmin(id, changes) {
  return updateMember(id, changes);
}

export async function saveMember() {
  throw new Error('Member creation must be implemented through the authenticated repository flow.');
}
