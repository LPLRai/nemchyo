import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { IncomingCallWatcher } from '@/components/incoming-call-watcher';
import { theme } from '@/lib/theme';

export const PRIMARY = theme.primary;

export default function RootLayout() {
  // Auto-apply over-the-air updates on launch, so fixes land on the next open
  // without needing a manual double-relaunch.
  useEffect(() => {
    (async () => {
      try {
        if (Updates.isEnabled) {
          const u = await Updates.checkForUpdateAsync();
          if (u.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
          }
        }
      } catch {}
    })();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.primaryDark },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '800', fontSize: 18 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
        }}>
        <Stack.Screen name="index" options={{ title: 'Nemchyo' }} />
        <Stack.Screen name="join" options={{ title: 'Join Nemchyo' }} />
        <Stack.Screen name="link" options={{ title: 'Link a device' }} />
        <Stack.Screen name="link-device" options={{ title: 'Link a device' }} />
        <Stack.Screen name="chats" options={{ title: 'Nemchyo' }} />
        <Stack.Screen name="new-chat" options={{ title: 'New chat' }} />
        <Stack.Screen name="new-poll" options={{ title: 'Create Poll' }} />
        <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
        <Stack.Screen name="new-event" options={{ title: 'New event' }} />
        <Stack.Screen name="profile" options={{ title: 'Your Profile' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="chat-info" options={{ title: 'Details' }} />
        <Stack.Screen name="invite" options={{ title: 'Invite a member' }} />
        <Stack.Screen name="call/[id]" options={{ headerShown: false, animation: 'fade' }} />
      </Stack>
      <IncomingCallWatcher />
    </>
  );
}
