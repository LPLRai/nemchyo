import { PB_URL } from './config';

// Build a URL for a record's file (optionally a thumbnail size).
//
// NOTE: message files currently serve publicly at their (random, unguessable)
// URLs — PocketBase's view-rule file protection isn't gating them for this
// collection. Acceptable for the MVP (URLs are only shared with members through
// the app), but members-only file access (a token-gated serving hook) is a
// hardening step to do before real deployment.
export function fileUrl(
  record: { id: string; collectionName?: string },
  filename: string,
  opts?: { thumb?: string; token?: string }
) {
  const collection = record.collectionName || 'messages';
  const params = new URLSearchParams();
  if (opts?.thumb) params.set('thumb', opts.thumb);
  if (opts?.token) params.set('token', opts.token);
  const q = params.toString();
  return `${PB_URL}/api/files/${collection}/${record.id}/${filename}${q ? '?' + q : ''}`;
}

// URL for a user's avatar (PocketBase's built-in `avatar` file field on the
// `users` collection), or null when they haven't set one — callers fall back to
// showing their initial instead.
export function avatarUrl(user?: { id?: string; avatar?: string } | null): string | null {
  if (!user?.id || !user.avatar) return null;
  return fileUrl({ id: user.id, collectionName: 'users' }, user.avatar);
}
