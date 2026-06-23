import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { pb } from './pb';

// The chat the user is currently looking at — set by the chat screen so we can
// suppress redundant notifications for messages they're already reading.
let activeChatId: string | null = null;
export function setActiveChat(id: string | null) {
  activeChatId = id;
}

// How notifications behave when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data: any = notification?.request?.content?.data || {};
    const inThisChat = !!data?.chatId && data.chatId === activeChatId;
    const show = !inThisChat; // don't notify for the chat you're already in
    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show,
      shouldSetBadge: show,
    };
  },
});

let registered = false;

// Register this device's Expo push token with the backend.
// No-ops gracefully in dev/web (real delivery needs the native build + FCM creds).
export async function registerForPush() {
  if (registered) return;
  try {
    if (Platform.OS === 'web') return; // web push needs separate VAPID setup
    if (!Device.isDevice) return; // simulators often can't get a token

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Calls',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 1000, 500, 1000],
      });
    }

    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await pb.send('/api/register-device', {
      method: 'POST',
      body: { token, platform: Platform.OS },
    });
    registered = true;
  } catch {
    // Missing projectId / FCM creds in dev — expected; activates in the native build.
  }
}
