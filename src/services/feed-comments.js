const COMMENTS_KEY = 'viziunea.feed.comments.demo.v1';
function read() { try { return JSON.parse(localStorage.getItem(COMMENTS_KEY) || '[]'); } catch { return []; } }
function write(rows) { localStorage.setItem(COMMENTS_KEY, JSON.stringify(rows)); }

export function listComments(postKey) {
  return read().filter(comment => comment.postKey === postKey).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function addComment({ postKey, author, body, parentId = null, mentions = [] }) {
  const comment = { id: `demo-comment-${crypto.randomUUID()}`, postKey, authorEmail: author?.email || '', authorName: author?.user_metadata?.full_name || author?.email || 'Membru Viziunea', body: String(body || '').trim(), parentId, mentions, created_at: new Date().toISOString() };
  if (!comment.body) throw new Error('Scrie un comentariu înainte să îl trimiți.');
  write([comment, ...read()]);
  return comment;
}
