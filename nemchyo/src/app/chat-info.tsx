import { Image } from 'expo-image';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { ImageViewer } from '@/components/image-album';
import { VideoPlayerModal } from '@/components/video-player';
import { useAuth } from '@/lib/auth';
import { fileUrl } from '@/lib/files';
import { pb } from '@/lib/pb';
import { theme } from '@/lib/theme';

const TABS = ['Members', 'Media', 'Pins', 'Links', 'Files'] as const;
type Tab = (typeof TABS)[number];

function extractUrls(text: string): string[] {
  return text.match(/(https?:\/\/[^\s]+)/gi) || [];
}

function previewMsg(m: any): string {
  if (!m) return '';
  if (m.deleted_for_everyone) return 'deleted message';
  if (m.type === 'image') return '📷 Photo';
  if (m.type === 'video') return '🎬 Video';
  if (m.type === 'voice') return '🎵 Voice message';
  if (m.type === 'file') return '📄 ' + (m.file_name || 'File');
  if (m.type === 'poll') return '📊 ' + (m.body || 'Poll');
  return m.body || '';
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export default function ChatInfo() {
  const { chat } = useLocalSearchParams<{ chat: string }>();
  const { isValid, user } = useAuth();
  const router = useRouter();
  const [chatRec, setChatRec] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [pins, setPins] = useState<any[]>([]);
  const [linkMsgs, setLinkMsgs] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('Members');
  const [viewer, setViewer] = useState<{ uris: string[]; index: number } | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  useEffect(() => {
    if (!chat) return;
    const f = pb.filter('chat = {:c}', { c: chat });
    (async () => {
      try { setChatRec(await pb.collection('chats').getOne(chat)); } catch {}
      try { setMembers(await pb.collection('chat_members').getFullList({ filter: f, expand: 'user' })); } catch {}
      try {
        setMedia(await pb.collection('messages').getFullList({
          filter: pb.filter('chat = {:c} && (type = "image" || type = "video")', { c: chat }),
          sort: '-created',
        }));
      } catch {}
      try {
        setFiles(await pb.collection('messages').getFullList({
          filter: pb.filter('chat = {:c} && type = "file"', { c: chat }),
          sort: '-created',
        }));
      } catch {}
      try {
        setLinkMsgs(await pb.collection('messages').getFullList({
          filter: pb.filter('chat = {:c} && body ~ "http"', { c: chat }),
          sort: '-created',
          expand: 'sender',
        }));
      } catch {}
      try {
        setPins(await pb.collection('pins').getFullList({ filter: f, sort: '-created', expand: 'message,message.sender' }));
      } catch {}
    })();
  }, [chat]);

  const links = useMemo(
    () =>
      linkMsgs.flatMap((m, mi) =>
        extractUrls(m.body || '').map((url, ui) => ({
          url,
          who: m.expand?.sender?.display_name || (m.sender === user?.id ? 'You' : 'Member'),
          key: `${mi}-${ui}`,
        }))
      ),
    [linkMsgs, user?.id]
  );

  if (!isValid) return <Redirect href="/" />;

  const isDirect = chatRec?.type === 'direct';
  const peer = isDirect ? members.find((m) => m.user !== user?.id)?.expand?.user : null;
  const title = isDirect ? peer?.display_name || 'Chat' : chatRec?.name || 'Chat';
  const myRole = members.find((m) => m.user === user?.id)?.role;
  const canDelete = chatRec && chatRec.type !== 'direct' && chatRec.type !== 'family' && (myRole === 'owner' || myRole === 'admin');

  function deleteGroup() {
    Alert.alert('Delete group?', 'This permanently deletes the group and all its messages for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await pb.send('/api/delete-chat', { method: 'POST', body: { chat } });
            try {
              router.dismiss(2);
            } catch {
              router.replace('/chats');
            }
          } catch (e: any) {
            Alert.alert("Couldn't delete", e?.message || 'Please try again.');
          }
        },
      },
    ]);
  }

  function openMedia(item: any) {
    if (item.type === 'video') {
      setVideoUri(fileUrl(item, item.file));
      return;
    }
    const imgs = media.filter((m) => m.type === 'image');
    const idx = imgs.findIndex((m) => m.id === item.id);
    setViewer({ uris: imgs.map((m) => fileUrl(m, m.file)), index: Math.max(0, idx) });
  }

  // Jump back to the chat at this pinned message (Discord-style).
  function openPin(item: any) {
    const msg = item.expand?.message;
    if (!msg) return;
    router.navigate({ pathname: '/chat/[id]', params: { id: String(chat), jump: msg.id, jumpAt: String(Date.now()) } });
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Details' }} />

      <View style={styles.head}>
        <Avatar user={isDirect ? peer : undefined} name={title} size={76} />
        <Text style={styles.name}>{title}</Text>
        <Text style={styles.sub}>{isDirect ? peer?.email || 'Direct message' : `${members.length} members`}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={styles.tab}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {tab === t ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'Members' ? (
          <FlatList
            data={members}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Avatar user={item.expand?.user} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.expand?.user?.display_name || 'Member'}</Text>
                  {item.role !== 'member' ? <Text style={styles.rowSub}>{item.role}</Text> : null}
                </View>
              </View>
            )}
            ListEmptyComponent={<Empty text="No members" />}
          />
        ) : null}

        {tab === 'Media' ? (
          <FlatList
            key="media"
            data={media}
            numColumns={3}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <Pressable style={styles.cell} onPress={() => openMedia(item)}>
                <Image source={{ uri: fileUrl(item, item.file, { thumb: '300x300' }) }} style={styles.cellImg} contentFit="cover" />
                {item.type === 'video' ? (
                  <View style={styles.playOverlay}>
                    <Text style={styles.playIcon}>▶</Text>
                  </View>
                ) : null}
              </Pressable>
            )}
            ListEmptyComponent={<Empty text="No media yet" />}
          />
        ) : null}

        {tab === 'Pins' ? (
          <FlatList
            data={pins}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => {
              const msg = item.expand?.message;
              const isImg = msg && msg.type === 'image' && msg.file && !msg.deleted_for_everyone;
              const isVid = msg && msg.type === 'video' && msg.file && !msg.deleted_for_everyone;
              return (
                <Pressable style={styles.row} onPress={() => openPin(item)}>
                  <Avatar user={msg?.expand?.sender} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{msg?.expand?.sender?.display_name || 'Member'}</Text>
                    <Text style={styles.rowSub} numberOfLines={2}>{previewMsg(msg)}</Text>
                    <Text style={styles.jumpHint}>Tap to view in chat ›</Text>
                  </View>
                  {isImg ? (
                    <Image source={{ uri: fileUrl(msg, msg.file, { thumb: '120x120' }) }} style={styles.pinThumb} contentFit="cover" />
                  ) : isVid ? (
                    <View style={[styles.pinThumb, styles.pinVideo]}>
                      <Text style={styles.pinPlayIcon}>▶</Text>
                    </View>
                  ) : (
                    <Text style={styles.endIcon}>📌</Text>
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={<Empty text="No pinned messages" />}
          />
        ) : null}

        {tab === 'Links' ? (
          <FlatList
            data={links}
            keyExtractor={(l) => l.key}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => Linking.openURL(item.url)}>
                <Text style={styles.startIcon}>🔗</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkUrl} numberOfLines={1}>{item.url}</Text>
                  <Text style={styles.rowSub}>Shared by {item.who}</Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={<Empty text="No links" />}
          />
        ) : null}

        {tab === 'Files' ? (
          <FlatList
            data={files}
            keyExtractor={(f) => f.id}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => Linking.openURL(fileUrl(item, item.file))}>
                <Text style={styles.startIcon}>📄</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.file_name || 'Document'}</Text>
                  <Text style={styles.rowSub}>Tap to open</Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={<Empty text="No files" />}
          />
        ) : null}
      </View>

      {canDelete ? (
        <Pressable style={styles.deleteBtn} onPress={deleteGroup}>
          <Text style={styles.deleteText}>🗑️  Delete group</Text>
        </Pressable>
      ) : null}

      <ImageViewer uris={viewer?.uris ?? null} index={viewer?.index ?? 0} onClose={() => setViewer(null)} />
      {videoUri ? <VideoPlayerModal uri={videoUri} onClose={() => setVideoUri(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  head: { alignItems: 'center', paddingVertical: 18, gap: 6 },
  name: { fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 6 },
  sub: { fontSize: 14, color: theme.textMuted },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border, paddingHorizontal: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabText: { fontSize: 14, color: theme.textMuted, fontWeight: '600' },
  tabTextActive: { color: theme.primary, fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: -1, height: 2.5, left: 12, right: 12, backgroundColor: theme.primary, borderRadius: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.border },
  rowName: { fontSize: 16, fontWeight: '600', color: theme.text },
  rowSub: { fontSize: 13, color: theme.textMuted, marginTop: 1 },
  startIcon: { fontSize: 22 },
  endIcon: { fontSize: 16 },
  jumpHint: { fontSize: 12, color: theme.primary, marginTop: 3, fontWeight: '600' },
  pinThumb: { width: 46, height: 46, borderRadius: 8, backgroundColor: '#ECEAF6' },
  pinVideo: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F2937' },
  pinPlayIcon: { color: '#fff', fontSize: 16 },
  linkUrl: { fontSize: 14.5, color: theme.primary, fontWeight: '600' },
  cell: { flex: 1 / 3, aspectRatio: 1, padding: 1.5 },
  cellImg: { flex: 1, borderRadius: 4, backgroundColor: '#E5E7EB' },
  playOverlay: { position: 'absolute', inset: 1.5, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#fff', fontSize: 26, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: theme.textFaint },
  deleteBtn: { margin: 16, paddingVertical: 15, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center' },
  deleteText: { color: '#DC2626', fontSize: 16, fontWeight: '700' },
});
