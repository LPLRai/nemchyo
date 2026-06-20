import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { IncomingCallWatcher } from '@/components/incoming-call-watcher';
import { theme } from '@/lib/theme';

export const PRIMARY = theme.primary;

export default function RootLayout() {
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
        <Stack.Screen name="chats" options={{ title: 'Nemchyo' }} />
        <Stack.Screen name="new-chat" options={{ title: 'New chat' }} />
        <Stack.Screen name="profile" options={{ title: 'Your Profile' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="invite" options={{ title: 'Invite a member' }} />
        <Stack.Screen name="call/[id]" options={{ headerShown: false, animation: 'fade' }} />
      </Stack>
      <IncomingCallWatcher />
    </>
  );
}
