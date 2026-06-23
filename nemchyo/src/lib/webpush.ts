import { Platform } from 'react-native';
import { PB_URL } from './config';
import { pb } from './pb';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// True only on a web browser that can actually do Web Push.
export function webPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

export function webPushPermission(): NotificationPermission | 'unsupported' {
  if (!webPushSupported()) return 'unsupported';
  return Notification.permission;
}

// Register the service worker + subscribe this browser for push.
// `prompt` requests permission (must be from a user gesture on iOS); otherwise
// we only (re)subscribe if permission was already granted.
export async function registerWebPush(prompt = false): Promise<boolean> {
  if (!webPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    let perm = Notification.permission;
    if (perm === 'default' && prompt) perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;

    const res = await fetch(`${PB_URL}/api/web-push-key`);
    const { key } = await res.json();
    if (!key) return false;

    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
    }
    const json: any = sub.toJSON();
    await pb.send('/api/register-web-push', {
      method: 'POST',
      body: { endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, ua: navigator.userAgent },
    });
    return true;
  } catch {
    return false; // blocked / unsupported / offline — fine
  }
}
