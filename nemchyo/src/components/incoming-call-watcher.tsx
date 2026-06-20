import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
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

  return null;
}
