import { useEffect, useState } from 'react';
import { pb } from './pb';

// Reactive auth state. Re-renders whenever the token changes (login, logout,
// or when the persisted token finishes loading on startup).
export function useAuth() {
  const [, setTick] = useState(0);
  useEffect(() => {
    return pb.authStore.onChange(() => setTick((n) => n + 1));
  }, []);
  return {
    pb,
    isValid: pb.authStore.isValid,
    user: pb.authStore.record as any,
  };
}
