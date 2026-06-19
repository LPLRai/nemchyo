import { Platform } from 'react-native';
import { pb } from './pb';

// Redeem an invite: the backend creates the account and returns a login token,
// which we save so the relative is immediately (and permanently) signed in.
export async function redeemInvite(code: string, displayName?: string) {
  const res: any = await pb.send('/api/redeem-invite', {
    method: 'POST',
    body: { code, displayName },
  });
  pb.authStore.save(res.token, res.record);
  return res;
}

// Admin generates a one-time invite code (requires being logged in).
export async function createInvite(opts: { displayName?: string; role?: string } = {}) {
  const res: any = await pb.send('/api/create-invite', { method: 'POST', body: opts });
  return res.code as string;
}

// Build the shareable join link for a code.
export function buildJoinUrl(code: string) {
  const base =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'https://chat.sixfriendstrekking.com';
  return `${base}/join?code=${encodeURIComponent(code)}`;
}
