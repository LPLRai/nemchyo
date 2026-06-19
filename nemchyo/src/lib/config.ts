import { Platform } from 'react-native';

// The deployed server (used by production builds: the APK and the web/PWA export).
const PROD_URL = 'https://chat.sixfriendstrekking.com';

// Local dev backend (used under `expo start`):
// - Web / this PC:            http://127.0.0.1:8090
// - Android EMULATOR:         http://10.0.2.2:8090  (emulator's alias for the host)
// - Physical phone (Expo Go): set this to your PC's LAN IP, e.g. http://192.168.1.50:8090
const DEV_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8090' : 'http://127.0.0.1:8090';

// __DEV__ is true under `expo start`, false in production builds.
export const PB_URL = __DEV__ ? DEV_URL : PROD_URL;
