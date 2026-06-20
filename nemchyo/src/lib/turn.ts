import { pb } from './pb';

// ICE servers (STUN + TURN) for WebRTC, fetched from the authenticated server
// endpoint so the TURN credentials never live in the app bundle.
export async function getIceServers(): Promise<any[]> {
  try {
    const res: any = await pb.send('/api/turn-credentials', { method: 'POST', body: {} });
    if (res?.iceServers?.length) return res.iceServers;
  } catch {
    /* fall through */
  }
  return [{ urls: 'stun:stun.l.google.com:19302' }];
}
