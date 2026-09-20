import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('canonical profile migration exists and preserves legacy data during transition', async () => {
  const sql = await read('supabase/migrations/001_canonical_profiles.sql');
  assert.match(sql, /alter table public\.profiles add column if not exists email/);
  assert.match(sql, /insert into public\.profiles/);
  assert.match(sql, /where exists \(select 1 from auth\.users/);
});

test('social and conversation persistence are represented in migrations', async () => {
  const sql = await read('supabase/migrations/002_social_graph.sql');
  for (const table of ['post_saves', 'post_likes', 'post_comments', 'comment_mentions', 'conversations', 'conversation_members']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(sql, /conversation_id uuid/);
});

test('application uses the canonical profile repository boundary', async () => {
  const main = await read('src/main.js');
  const repository = await read('src/services/profile-repository.js');
  assert.match(main, /services\/profile-repository\.js/);
  assert.match(repository, /member-repository\.js/);
});

test('production persistence modules do not expose service_role credentials', async () => {
  const config = await read('src/config.js');
  assert.doesNotMatch(config, /service_role\s*=/i);
});
