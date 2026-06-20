import AsyncStorage from '@react-native-async-storage/async-storage';
import PocketBase, { AsyncAuthStore } from 'pocketbase';
import { Platform } from 'react-native';
import RNEventSource from 'react-native-sse';
import { PB_URL } from './config';

// PocketBase realtime (live messages) uses Server-Sent Events via a global
// `EventSource`. Browsers have one; React Native does not — so polyfill it,
// otherwise opening a chat (which subscribes) throws in the native app.
if (Platform.OS !== 'web' && !(globalThis as any).EventSource) {
  (globalThis as any).EventSource = RNEventSource as any;
}

// Persist the auth token across restarts. On native this uses AsyncStorage
// (Keystore/Keychain-backed); on web it uses localStorage. This is what makes
// the "set up once, never log in again" experience work.
const store = new AsyncAuthStore({
  save: async (serialized) => AsyncStorage.setItem('pb_auth', serialized),
  initial: AsyncStorage.getItem('pb_auth'),
  clear: async () => AsyncStorage.removeItem('pb_auth'),
});

export const pb = new PocketBase(PB_URL, store);

// React re-renders can fire overlapping requests; don't let the SDK auto-cancel them.
pb.autoCancellation(false);
