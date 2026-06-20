import { useEffect, useState } from 'react';
import { pb } from './pb';

// Reactive auth state held in real React state, so re-renders reliably reflect
// login/logout (reading pb.authStore directly in render is not tracked by the
// React Compiler and goes stale in optimized release builds).
export function useAuth() {
  const [auth, setAuth] = useState(() => ({
    isValid: pb.authStore.isValid,
    user: pb.authStore.record as any,
  }));

  useEffect(() => {
    // fireImmediately (2nd arg) also syncs the async-loaded persisted token.
    return pb.authStore.onChange(() => {
      setAuth({ isValid: pb.authStore.isValid, user: pb.authStore.record as any });
    }, true);
  }, []);

  return { pb, isValid: auth.isValid, user: auth.user };
}
