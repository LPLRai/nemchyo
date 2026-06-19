import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { isMuted } from '@/lib/mute';
import { pb } from '@/lib/pb';
import { registerForPush } from '@/lib/push';
import { PRIMARY } from './_layout';

export default function Chats() {
  const { isValid, user } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<any[]>([]);
  const [muteMap, setMuteMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Register for push once (no-op on web / in dev).
  useEffect(() => {
    registerForPush();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const list = await pb.collection('chats').getFullList({ sort: '-updated' });
          if (active) setChats(list);
          if (user?.id) {
            const mems = await pb
              .collection('chat_members')
              .getFullList({ filter: pb.filter('user = {:u}', { u: user.id }) });
            const map: Record<string, string> = {};
            mems.forEach((m: any) => {
              if (m.muted_until) map[m.chat] = m.muted_until;
            });
            if (active) setMuteMap(map);
          }
        } catch {
          /* ignore for MVP */
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [user?.id])
  );

  if (!isValid) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <Pressable onPress={() => router.push('/invite')} hitSlop={10}>
                <Text style={styles.logout}>Invite</Text>
              </Pressable>
              <Pressable onPress={() => pb.authStore.clear()} hitSlop={10}>
                <Text style={styles.logout}>Log out</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptyText}>Chats you are a member of will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#EEF2FF' }]}
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.name || '?').slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name || 'Untitled chat'}</Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {labelForType(item.type)}
                </Text>
              </View>
              {isMuted(muteMap[item.id]) ? <Text style={styles.muteIcon}>🔕</Text> : null}
            </Pressable>
          )}
        />
      )}

      <Text style={styles.footer}>Signed in as {user?.display_name || user?.email}</Text>
    </View>
  );
}

function labelForType(t: string) {
  switch (t) {
    case 'family': return 'Whole Family';
    case 'group': return 'Group';
    case 'direct': return 'Direct message';
    case 'announcement': return 'Announcements';
    default: return '';
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600', color: '#111827' },
  preview: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  muteIcon: { fontSize: 18 },
  logout: { color: '#fff', fontSize: 15, fontWeight: '600' },
  footer: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, paddingVertical: 8 },
});
