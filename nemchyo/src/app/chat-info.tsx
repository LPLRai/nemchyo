import { Image } from 'expo-image';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Avatar } from '@/components/avatar';
import { ImageViewer } from '@/components/image-album';
import { VideoPlayerModal } from '@/components/video-player';
import { useAuth } from '@/lib/auth';
import { fileUrl } from '@/lib/files';
import { buildLinkUrl, createDeviceLinkFor } from '@/lib/invites';
import { pb } from '@/lib/pb';
import { useColors, useThemedStyles, type Colors } from '@/lib/theme';

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
  const styles = useThemedStyles(makeStyles);
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
  const theme = useColors();
  const styles = useThemedStyles(makeStyles);
  const [chatRec, setChatRec] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [pins, setPins] = useState<any[]>([]);
  const [linkMsgs, setLinkMsgs] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('Members');
  const [viewer, setViewer] = useState<{ uris: string[]; index: number } | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<{ name: string; code: string; loading: boolean } | null>(null);

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
  // Family admins can mint a sign-in code for a member who lost their device.
  const canRecover = chatRec && chatRec.type === 'family' && (myRole === 'owner' || myRole === 'admin');

  async function genRecovery(member: any) {
    const nm = member.expand?.user?.display_name || 'Member';
    setRecovery({ name: nm, code: '', loading: true });
    try {
      const r = await createDeviceLinkFor(member.user);
      setRecovery({ name: nm, code: r.code, loading: false });
    } catch (e: any) {
      setRecovery(null);
      Alert.alert("Couldn't create a code", e?.message || 'Please try again.');
    }
  }

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

      <View style={styles.tabBody}>
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
                {canRecover && item.user !== user?.id ? (
                  <Pressable style={styles.recoverBtn} onPress={() => genRecovery(item)}>
                    <Text style={styles.recoverBtnText}>Sign-in code</Text>
                  </Pressable>
                ) : null}
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

      <Modal visible={!!recovery} transparent animationType="fade" onRequestClose={() => setRecovery(null)}>
        <Pressable style={styles.recBackdrop} onPress={() => setRecovery(null)}>
          <Pressable style={styles.recCard} onPress={() => {}}>
            <Text style={styles.recTitle}>Sign-in code for {recovery?.name}</Text>
            {recovery?.loading ? (
              <ActivityIndicator color={theme.primary} style={{ marginVertical: 28 }} />
            ) : recovery ? (
              <>
                <View style={styles.recQr}>
                  <QRCode value={buildLinkUrl(recovery.code)} size={150} color={theme.text} backgroundColor="#ffffff" />
                </View>
                <Text style={styles.recCode}>{recovery.code}</Text>
                <Text style={styles.recHint}>
                  On {recovery.name}&apos;s device, open Nemchyo → “Link this one” and enter this code (or scan the QR). Valid for 30 minutes.
                </Text>
              </>
            ) : null}
            <Pressable style={styles.recDone} onPress={() => setRecovery(null)}>
              <Text style={styles.recDoneText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ImageViewer uris={viewer?.uris ?? null} index={viewer?.index ?? 0} onClose={() => setViewer(null)} />
      {videoUri ? <VideoPlayerModal uri={videoUri} onClose={() => setVideoUri(null)} /> : null}
    </View>
  );
}

const makeStyles = (theme: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, alignItems: Platform.OS === 'web' ? 'center' : 'stretch' },
  head: { alignItems: 'center', paddingVertical: 18, gap: 6, width: '100%', maxWidth: 640 },
  name: { fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 6 },
  sub: { fontSize: 14, color: theme.textMuted },
  tabBody: { flex: 1, width: '100%', maxWidth: 640 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border, paddingHorizontal: 6, width: '100%', maxWidth: 640 },
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
  recoverBtn: { backgroundColor: '#EEF0FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  recoverBtnText: { color: theme.primary, fontSize: 13, fontWeight: '700' },
  recBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  recCard: { backgroundColor: '#fff', borderRadius: 22, padding: 22, alignItems: 'center', width: '100%', maxWidth: 340 },
  recTitle: { fontSize: 17, fontWeight: '800', color: theme.text, textAlign: 'center' },
  recQr: { backgroundColor: '#fff', padding: 12, borderRadius: 14, marginTop: 18, borderWidth: 1, borderColor: theme.border },
  recCode: { fontSize: 30, fontWeight: '800', letterSpacing: 7, color: theme.text, marginTop: 16, marginLeft: 7 },
  recHint: { fontSize: 13, color: theme.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 18 },
  recDone: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 40, borderRadius: 12, backgroundColor: theme.primary },
  recDoneText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
