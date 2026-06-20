import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { IncomingCallWatcher } from '@/components/incoming-call-watcher';

export const PRIMARY = '#4F46E5';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: PRIMARY },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#F3F4F6' },
        }}>
        <Stack.Screen name="index" options={{ title: 'Nemchyo' }} />
        <Stack.Screen name="join" options={{ title: 'Join Nemchyo' }} />
        <Stack.Screen name="chats" options={{ title: 'Nemchyo' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="invite" options={{ title: 'Invite a member' }} />
        <Stack.Screen name="call/[id]" options={{ headerShown: false, animation: 'fade' }} />
      </Stack>
      <IncomingCallWatcher />
    </>
  );
}
