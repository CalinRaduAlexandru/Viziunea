import { createClient } from './supabase.js';

const BUCKET = 'post-images';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function extension(type) {
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Imaginea nu a putut fi citită.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadPostImage(file, user) {
  if (!file) return null;
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Alege o imagine JPG, PNG sau WebP.');
  if (file.size > MAX_IMAGE_SIZE) throw new Error('Imaginea trebuie să aibă maximum 10 MB.');

  const supabase = await createClient();
  if (supabase && user?.id && !String(user.id).startsWith('demo:')) {
    const path = `${user.id}/${crypto.randomUUID()}.${extension(file.type)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  // Demo mode keeps a small local preview so the feature also works without auth/Storage.
  return readAsDataUrl(file);
}

export const postImageLimits = Object.freeze({ maxBytes: MAX_IMAGE_SIZE, types: [...ALLOWED_TYPES] });
