import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { useAuth } from '@/lib/auth';
import { isMuted } from '@/lib/mute';
import { pb } from '@/lib/pb';
import { registerForPush } from '@/lib/push';
import { shadow, theme } from '@/lib/theme';

export default function Chats() {
  const { isValid, user } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<any[]>([]);
  const [muteMap, setMuteMap] = useState<Record<string, string>>({});
  const [membersMap, setMembersMap] = useState<Record<string, any[]>>({});
  const [lastMsgMap, setLastMsgMap] = useState<Record<string, any>>({});
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
          if (user?.id && list.length) {
            // All members of my chats in one query — drives the mute badge and,
            // for direct chats, showing the other person's name + avatar.
            const orf = list.map((c: any) => `chat = "${c.id}"`).join(' || ');
            const allMems = await pb.collection('chat_members').getFullList({ filter: orf, expand: 'user' });
            const mmap: Record<string, any[]> = {};
            const mute: Record<string, string> = {};
            allMems.forEach((m: any) => {
              (mmap[m.chat] = mmap[m.chat] || []).push(m);
              if (m.user === user.id && m.muted_until) mute[m.chat] = m.muted_until;
            });
            // Latest message per chat (one query) for the preview line + ordering.
            const lmap: Record<string, any> = {};
            try {
              const msgs = await pb
                .collection('messages')
                .getList(1, 100, { filter: orf, sort: '-created', expand: 'sender' });
              msgs.items.forEach((m: any) => {
                if (!lmap[m.chat]) lmap[m.chat] = m;
              });
            } catch {}
            if (active) {
              setMembersMap(mmap);
              setMuteMap(mute);
              setLastMsgMap(lmap);
            }
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
          headerLeft: () => (
            <Pressable onPress={() => router.push('/profile')} hitSlop={10} style={{ marginLeft: 4 }}>
              <Avatar user={user} size={32} />
            </Pressable>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
              <Pressable onPress={() => router.push('/calendar')} hitSlop={10}>
                <Text style={{ fontSize: 20 }}>📅</Text>
              </Pressable>
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
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptyText}>Chats you are a member of will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={[...chats].sort((a, b) => {
            const ta = lastMsgMap[a.id]?.created || a.updated || '';
            const tb = lastMsgMap[b.id]?.created || b.updated || '';
            return tb.localeCompare(ta);
          })}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingVertical: 6 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const isDirect = item.type === 'direct';
            const peer = isDirect
              ? (membersMap[item.id] || []).find((m) => m.user !== user?.id)?.expand?.user
              : null;
            const title = isDirect ? peer?.display_name || 'Direct message' : item.name || 'Untitled chat';
            const lm = lastMsgMap[item.id];
            const preview = lm ? lastPreview(lm, user?.id, isDirect) : labelForType(item.type);
            const time = lm ? formatTime(lm.created) : '';
            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.primarySoft }]}
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}>
                <Avatar user={isDirect ? peer : undefined} name={title} size={54} />
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>{title}</Text>
                    {time ? <Text style={styles.time}>{time}</Text> : null}
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
                    {isMuted(muteMap[item.id]) ? <Text style={styles.muteIcon}>🔕</Text> : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/new-chat')} hitSlop={8}>
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>

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

function lastPreview(m: any, myId?: string, isDirect?: boolean): string {
  const mine = m.sender === myId;
  const prefix = mine
    ? 'You: '
    : !isDirect && m.expand?.sender?.display_name
      ? m.expand.sender.display_name.split(' ')[0] + ': '
      : '';
  let body = '';
  if (m.deleted_for_everyone) body = 'deleted message';
  else if (m.type === 'image') body = '📷 Photo';
  else if (m.type === 'file') body = '📄 ' + (m.file_name || 'File');
  else body = m.body || '';
  return prefix + body;
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  emptyText: { fontSize: 14, color: theme.textFaint, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 11 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 },
  name: { flex: 1, fontSize: 16.5, fontWeight: '700', color: theme.text },
  time: { fontSize: 12, color: theme.textFaint, fontWeight: '500' },
  preview: { flex: 1, fontSize: 13.5, color: theme.textMuted },
  muteIcon: { fontSize: 16 },
  separator: { height: 1, backgroundColor: theme.border, marginLeft: 84 },
  logout: { color: '#fff', fontSize: 15, fontWeight: '600' },
  footer: { textAlign: 'center', color: theme.textFaint, fontSize: 12, paddingVertical: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 38,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },
  fabIcon: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 },
});
