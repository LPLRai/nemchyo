import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';

// Mounted at the root: whenever a call is rung at me, jump to the full-screen
// call screen (works app-wide while the app is open).
export function IncomingCallWatcher() {
  const { isValid, user } = useAuth();
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!isValid || !user?.id) return;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        unsub = await pb.collection('calls').subscribe('*', async (e: any) => {
          if (e.action !== 'create') return;
          const c = e.record;
          if (c.callee !== user.id || c.status !== 'ringing' || handled.current === c.id) return;
          handled.current = c.id;
          let nm = 'Someone';
          try {
            nm = (await pb.collection('users').getOne(c.caller)).display_name || 'Someone';
          } catch {}
          router.push({
            pathname: '/call/[id]',
            params: { id: c.id, role: 'callee', kind: c.kind, peer: c.caller, name: nm },
          });
        });
      } catch {}
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [isValid, user?.id, router]);

  // Polling safety net: the realtime (SSE) socket can silently die — e.g. the
  // Cloudflare tunnel drops an idle connection — and then an incoming-call
  // event never arrives. So every few seconds we also actively ask "is anyone
  // ringing me right now?". Dedupes against the realtime path via `handled`,
  // so a call is only ever opened once.
  useEffect(() => {
    if (!isValid || !user?.id) return;
    let stopped = false;
    async function poll() {
      if (stopped) return;
      try {
        const list = await pb.collection('calls').getList(1, 3, {
          filter: pb.filter('callee = {:u} && status = "ringing"', { u: user.id }),
          sort: '-created',
        });
        // Only fresh rings (last 90s) — ignore stale/abandoned call rows.
        const c = list.items.find((x: any) => Date.now() - new Date(x.created).getTime() < 90000);
        if (c && handled.current !== c.id) {
          handled.current = c.id;
          let nm = 'Someone';
          try {
            nm = (await pb.collection('users').getOne(c.caller)).display_name || 'Someone';
          } catch {}
          router.push({
            pathname: '/call/[id]',
            params: { id: c.id, role: 'callee', kind: c.kind, peer: c.caller, name: nm },
          });
        }
      } catch {}
    }
    const iv = setInterval(poll, 4000);
    poll();
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, [isValid, user?.id, router]);

  // Tapping a call push (app was closed/backgrounded) opens the call screen.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    function handle(resp: any) {
      const d = resp?.notification?.request?.content?.data;
      if (d?.type === 'call' && d.callId) {
        router.push({
          pathname: '/call/[id]',
          params: { id: d.callId, role: 'callee', kind: d.kind, peer: d.peer, name: d.name },
        });
      }
    }
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r) handle(r);
      })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [router]);

  return null;
}
