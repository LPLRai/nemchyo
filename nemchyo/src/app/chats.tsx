import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { useAuth } from '@/lib/auth';
import { isMuted } from '@/lib/mute';
import { pb } from '@/lib/pb';
import { registerForPush } from '@/lib/push';
import { registerWebPush } from '@/lib/webpush';
import { shadow, useColors, useThemedStyles, type Colors } from '@/lib/theme';
import Conversation from './chat/[id]';

export default function Chats() {
  const { isValid, user } = useAuth();
  const router = useRouter();
  const theme = useColors();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 900; // desktop two-pane
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [muteMap, setMuteMap] = useState<Record<string, string>>({});
  const [membersMap, setMembersMap] = useState<Record<string, any[]>>({});
  const [lastMsgMap, setLastMsgMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Register for push once (no-op on web / in dev).
  useEffect(() => {
    registerForPush();
    registerWebPush(false); // web: re-subscribe silently if already allowed
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

  // On wide web, tapping a chat opens it in the side pane; on mobile it
  // navigates to the conversation route as before.
  const openChat = (cid: string) => {
    if (isWide) setSelectedId(cid);
    else router.push({ pathname: '/chat/[id]', params: { id: cid } });
  };

  const sortedChats = [...chats].sort((a, b) => {
    const ta = lastMsgMap[a.id]?.created || a.updated || '';
    const tb = lastMsgMap[b.id]?.created || b.updated || '';
    return tb.localeCompare(ta);
  });

  const listContent = loading ? (
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
      data={sortedChats}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ paddingVertical: 6 }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const isDirect = item.type === 'direct';
        const peer = isDirect ? (membersMap[item.id] || []).find((m) => m.user !== user?.id)?.expand?.user : null;
        const title = isDirect ? peer?.display_name || 'Direct message' : item.name || 'Untitled chat';
        const lm = lastMsgMap[item.id];
        const preview = lm ? lastPreview(lm, user?.id, isDirect) : labelForType(item.type);
        const time = lm ? formatTime(lm.created) : '';
        const active = isWide && item.id === selectedId;
        return (
          <Pressable
            style={({ pressed }) => [styles.row, (pressed || active) && { backgroundColor: theme.primarySoft }]}
            onPress={() => openChat(item.id)}>
            <Avatar user={isDirect ? peer : undefined} name={title} size={54} />
            <View style={{ flex: 1 }}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>{title}</Text>
                {time ? <Text style={styles.time}>{time}</Text> : null}
              </View>
              <View style={styles.rowBottom}>
                <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
                {isMuted(muteMap[item.id]) ? <Icon name="bell-off" size={15} color={theme.textFaint} /> : null}
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={() => router.push('/profile')} hitSlop={10} style={{ marginLeft: 4, marginRight: 12 }}>
              <Avatar user={user} size={32} />
            </Pressable>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center', paddingRight: Platform.OS === 'web' ? 16 : 0 }}>
              <Pressable onPress={() => router.push('/calendar')} hitSlop={10}>
                <Icon name="calendar" size={22} color="#fff" />
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

      {isWide ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={styles.sidebar}>
            {listContent}
            <Pressable style={styles.fab} onPress={() => router.push('/new-chat')} hitSlop={8}>
              <Text style={styles.fabIcon}>＋</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            {selectedId ? (
              <Conversation key={selectedId} chatId={selectedId} embedded />
            ) : (
              <View style={styles.emptyPane}>
                <Text style={styles.emptyPaneTitle}>Nemchyo</Text>
                <Text style={styles.emptyPaneText}>Select a conversation to start chatting.</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <>
          {listContent}
          <Pressable style={styles.fab} onPress={() => router.push('/new-chat')} hitSlop={8}>
            <Text style={styles.fabIcon}>＋</Text>
          </Pressable>
          <Text style={styles.footer}>Signed in as {user?.display_name || user?.email}</Text>
        </>
      )}
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
  if (m.type === 'system') return 'Pinned a message'; // no sender prefix
  const mine = m.sender === myId;
  const prefix = mine
    ? 'You: '
    : !isDirect && m.expand?.sender?.display_name
      ? m.expand.sender.display_name.split(' ')[0] + ': '
      : '';
  let body = '';
  if (m.deleted_for_everyone) body = 'deleted message';
  else if (m.type === 'image') body = '📷 Photo';
  else if (m.type === 'video') body = '🎬 Video';
  else if (m.type === 'voice') body = '🎤 Voice message';
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

const makeStyles = (theme: Colors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  sidebar: { width: 360, borderRightWidth: 1, borderRightColor: theme.border, backgroundColor: theme.bg },
  emptyPane: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.chatBg },
  emptyPaneTitle: { fontSize: 28, fontWeight: '800', color: theme.textFaint, letterSpacing: 0.5 },
  emptyPaneText: { fontSize: 15, color: theme.textFaint },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  emptyText: { fontSize: 14, color: theme.textFaint, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  name: { flex: 1, fontSize: 16.5, fontWeight: '700', color: theme.text },
  time: { fontSize: 12, color: theme.textFaint, fontWeight: '500' },
  preview: { flex: 1, fontSize: 14, color: theme.textMuted },
  muteIcon: { fontSize: 16 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginLeft: 90 },
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
