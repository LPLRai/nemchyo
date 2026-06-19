import AsyncStorage from '@react-native-async-storage/async-storage';
import PocketBase, { AsyncAuthStore } from 'pocketbase';
import { PB_URL } from './config';

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
