import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, Stack, useLocalSearchParams, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { fileUrl } from '@/lib/files';
import { isMuted, MUTE_OPTIONS, muteLabel, muteUntilValue } from '@/lib/mute';
import { pb } from '@/lib/pb';
import { callsSupported } from '@/lib/webrtc';
import { PRIMARY } from '../_layout';

const REACT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function previewOf(m: any): string {
  if (!m) return '';
  if (m.deleted_for_everyone) return 'deleted message';
  if (m.type === 'image') return '📷 Photo';
  if (m.type === 'file') return '📄 ' + (m.file_name || 'File');
  return m.body || '';
}

// Shown instead of a crash if anything in this screen throws.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 14, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Couldn&apos;t open this chat</Text>
      <Text selectable style={{ color: '#6B7280', fontSize: 13 }}>
        {error?.message || String(error)}
      </Text>
      <Pressable
        onPress={retry}
        style={{ backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isValid, user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [reactions, setReactions] = useState<Record<string, any[]>>({});
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [membership, setMembership] = useState<any>(null);
  const [chatName, setChatName] = useState('Chat');
  const [muteVisible, setMuteVisible] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [actionTarget, setActionTarget] = useState<any>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;
    const filter = pb.filter('chat = {:id}', { id });
    let unsubMsg: (() => void) | undefined;
    let unsubReact: (() => void) | undefined;
    let active = true;

    (async () => {
      try {
        const chat = await pb.collection('chats').getOne(id);
        if (active) setChatName(chat.name || 'Chat');
      } catch {}
      if (user?.id) {
        try {
          const mem = await pb
            .collection('chat_members')
            .getFirstListItem(pb.filter('chat = {:c} && user = {:u}', { c: id, u: user.id }));
          if (active) setMembership(mem);
        } catch {}
      }
      try {
        const list = await pb
          .collection('messages')
          .getList(1, 200, { filter, sort: 'created', expand: 'sender,reply_to,reply_to.sender' });
        if (active) setMessages(list.items);
      } catch {}
      try {
        const rx = await pb
          .collection('reactions')
          .getFullList({ filter: pb.filter('message.chat = {:id}', { id }) });
        if (active) {
          const map: Record<string, any[]> = {};
          rx.forEach((r: any) => {
            (map[r.message] = map[r.message] || []).push(r);
          });
          setReactions(map);
        }
      } catch {}

      try {
      unsubMsg = await pb.collection('messages').subscribe(
        '*',
        (e) => {
          setMessages((prev) => {
            if (e.action === 'create') {
              if (prev.some((m) => m.id === e.record.id)) return prev;
              return [...prev, e.record];
            }
            if (e.action === 'update') return prev.map((m) => (m.id === e.record.id ? { ...m, ...e.record } : m));
            if (e.action === 'delete') return prev.filter((m) => m.id !== e.record.id);
            return prev;
          });
        },
        { filter, expand: 'sender,reply_to,reply_to.sender' }
      );

      // PocketBase only delivers reactions the user is allowed to view.
      unsubReact = await pb.collection('reactions').subscribe('*', (e) => {
        setReactions((prev) => {
          const mid = e.record.message;
          const arr = prev[mid] || [];
          if (e.action === 'create') {
            if (arr.some((x) => x.id === e.record.id)) return prev;
            return { ...prev, [mid]: [...arr, e.record] };
          }
          if (e.action === 'delete') return { ...prev, [mid]: arr.filter((x) => x.id !== e.record.id) };
          return prev;
        });
      });
      } catch (e) {
        /* realtime (SSE) unavailable — messages still load on open/refresh */
      }
    })();

    return () => {
      active = false;
      if (unsubMsg) unsubMsg();
      if (unsubReact) unsubReact();
    };
  }, [id, user?.id]);

  if (!isValid) return <Redirect href="/" />;

  const muted = isMuted(membership?.muted_until);

  async function startCall(callKind: 'audio' | 'video') {
    try {
      const members = await pb
        .collection('chat_members')
        .getFullList({ filter: pb.filter('chat = {:c}', { c: id }), expand: 'user' });
      const other = members.find((m: any) => m.user !== user.id);
      if (!other) return;
      const call = await pb
        .collection('calls')
        .create({ chat: id, caller: user.id, callee: other.user, kind: callKind, status: 'ringing' });
      router.push({
        pathname: '/call/[id]',
        params: {
          id: call.id,
          role: 'caller',
          kind: callKind,
          peer: other.user,
          name: other.expand?.user?.display_name || 'Member',
        },
      });
    } catch {}
  }

  async function setMute(minutes: number | null) {
    if (!membership) return;
    try {
      const updated = await pb
        .collection('chat_members')
        .update(membership.id, { muted_until: minutes === null ? '' : muteUntilValue(minutes) });
      setMembership(updated);
    } catch {}
    setMuteVisible(false);
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      if (editing) {
        const ed = editing;
        setEditing(null);
        await pb.collection('messages').update(ed.id, { body, edited_at: new Date().toISOString() });
      } else {
        const data: any = { chat: id, sender: user.id, type: 'text', body };
        if (replyTo) data.reply_to = replyTo.id;
        setReplyTo(null);
        await pb.collection('messages').create(data);
      }
    } catch {
      setText(body);
    }
  }

  async function toggleReaction(message: any, emoji: string) {
    setActionTarget(null);
    const mine = (reactions[message.id] || []).find((r) => r.emoji === emoji && r.user === user.id);
    try {
      if (mine) await pb.collection('reactions').delete(mine.id);
      else await pb.collection('reactions').create({ message: message.id, user: user.id, emoji });
    } catch {}
  }

  async function deleteForEveryone(message: any) {
    setActionTarget(null);
    try {
      await pb.collection('messages').update(message.id, { deleted_for_everyone: true, body: '' });
    } catch {}
  }

  function startReply(message: any) {
    setActionTarget(null);
    setEditing(null);
    setReplyTo(message);
  }
  function startEdit(message: any) {
    setActionTarget(null);
    setReplyTo(null);
    setEditing(message);
    setText(message.body || '');
  }
  async function copyMessage(message: any) {
    setActionTarget(null);
    try {
      await Clipboard.setStringAsync(message.body || '');
    } catch {}
  }

  function grouped(mid: string): [string, number][] {
    const g: Record<string, number> = {};
    (reactions[mid] || []).forEach((r) => (g[r.emoji] = (g[r.emoji] || 0) + 1));
    return Object.entries(g);
  }

  async function uploadAsset(asset: any, kind: 'image' | 'file') {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('chat', String(id));
      form.append('sender', user.id);
      form.append('type', kind);
      const caption = text.trim();
      if (caption) {
        form.append('body', caption);
        setText('');
      }
      const name = asset.fileName || asset.name || (kind === 'image' ? 'photo.jpg' : 'file');
      form.append('file_name', name);
      if (Platform.OS === 'web') {
        const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
        form.append('file', blob, name);
      } else {
        form.append('file', { uri: asset.uri, name, type: asset.mimeType || 'application/octet-stream' } as any);
      }
      await pb.collection('messages').create(form);
    } catch {
    } finally {
      setUploading(false);
    }
  }
  async function pickImage() {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) uploadAsset(res.assets[0], 'image');
  }
  async function pickFile() {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!res.canceled && res.assets?.[0]) uploadAsset(res.assets[0], 'file');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: chatName,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              {callsSupported ? (
                <Pressable onPress={() => startCall('audio')} hitSlop={8}>
                  <Text style={{ fontSize: 19 }}>📞</Text>
                </Pressable>
              ) : null}
              {callsSupported ? (
                <Pressable onPress={() => startCall('video')} hitSlop={8}>
                  <Text style={{ fontSize: 19 }}>🎥</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setMuteVisible(true)} hitSlop={10}>
                <Text style={{ fontSize: 20 }}>{muted ? '🔕' : '🔔'}</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      {muted ? (
        <View style={styles.mutedBanner}>
          <Text style={styles.mutedText}>{muteLabel(membership?.muted_until)} · you won&apos;t get notifications</Text>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.sender === user?.id;
          const name = item.expand?.sender?.display_name || (mine ? 'You' : 'Member');
          const deleted = item.deleted_for_everyone;
          const isImage = !deleted && item.file && item.type === 'image';
          const isFile = !deleted && item.file && item.type !== 'image';
          const parent = item.reply_to ? item.expand?.reply_to || messages.find((m) => m.id === item.reply_to) : null;
          const groups = grouped(item.id);

          return (
            <View style={[styles.row, mine ? styles.right : styles.left]}>
              <View style={{ maxWidth: '80%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <Pressable
                  onLongPress={() => !deleted && setActionTarget(item)}
                  delayLongPress={250}
                  style={[styles.bubble, mine ? styles.mine : styles.theirs, isImage && styles.bubbleMedia]}>
                  {!mine && !deleted && <Text style={styles.sender}>{name}</Text>}

                  {parent ? (
                    <View style={[styles.quote, mine && { borderLeftColor: '#C7D2FE' }]}>
                      <Text style={[styles.quoteName, mine && { color: '#C7D2FE' }]} numberOfLines={1}>
                        {parent.expand?.sender?.display_name || (parent.sender === user?.id ? 'You' : 'Member')}
                      </Text>
                      <Text style={[styles.quoteText, mine && { color: '#E0E7FF' }]} numberOfLines={1}>
                        {previewOf(parent)}
                      </Text>
                    </View>
                  ) : null}

                  {deleted ? (
                    <Text style={[styles.deleted, mine && { color: '#E0E7FF' }]}>🚫 This message was deleted</Text>
                  ) : isImage ? (
                    <Pressable onPress={() => Linking.openURL(fileUrl(item, item.file))}>
                      <Image source={{ uri: fileUrl(item, item.file, { thumb: '600x0' }) }} style={styles.image} contentFit="cover" />
                      {item.body ? <Text style={[styles.caption, mine && { color: '#fff' }]}>{item.body}</Text> : null}
                    </Pressable>
                  ) : isFile ? (
                    <Pressable style={styles.fileCard} onPress={() => Linking.openURL(fileUrl(item, item.file))}>
                      <Text style={styles.fileIcon}>📄</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fileName, mine && { color: '#fff' }]} numberOfLines={1}>{item.file_name || 'Document'}</Text>
                        <Text style={[styles.fileHint, mine && { color: '#E0E7FF' }]}>Tap to open</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <Text style={[styles.body, mine && { color: '#fff' }]}>{item.body}</Text>
                  )}

                  {!deleted && item.edited_at ? (
                    <Text style={[styles.edited, mine && { color: '#C7D2FE' }]}>edited</Text>
                  ) : null}
                </Pressable>

                {groups.length > 0 ? (
                  <View style={styles.reactRow}>
                    {groups.map(([emoji, count]) => {
                      const reactedByMe = (reactions[item.id] || []).some((r) => r.emoji === emoji && r.user === user?.id);
                      return (
                        <Pressable
                          key={emoji}
                          onPress={() => toggleReaction(item, emoji)}
                          style={[styles.reactChip, reactedByMe && styles.reactChipMine]}>
                          <Text style={styles.reactChipText}>{emoji} {count}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {uploading ? (
        <View style={styles.uploadBar}>
          <ActivityIndicator color={PRIMARY} size="small" />
          <Text style={styles.uploadText}>Uploading…</Text>
        </View>
      ) : null}

      {replyTo ? (
        <View style={styles.composerBar}>
          <View style={styles.composerLine} />
          <View style={{ flex: 1 }}>
            <Text style={styles.composerTitle}>Replying to {replyTo.expand?.sender?.display_name || (replyTo.sender === user?.id ? 'yourself' : 'member')}</Text>
            <Text style={styles.composerPreview} numberOfLines={1}>{previewOf(replyTo)}</Text>
          </View>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={8}><Text style={styles.composerX}>✕</Text></Pressable>
        </View>
      ) : null}
      {editing ? (
        <View style={styles.composerBar}>
          <View style={[styles.composerLine, { backgroundColor: '#F59E0B' }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.composerTitle}>Editing message</Text>
            <Text style={styles.composerPreview} numberOfLines={1}>{previewOf(editing)}</Text>
          </View>
          <Pressable onPress={() => { setEditing(null); setText(''); }} hitSlop={8}><Text style={styles.composerX}>✕</Text></Pressable>
        </View>
      ) : null}

      <View style={styles.inputBar}>
        {!editing && (
          <>
            <Pressable style={styles.attachBtn} onPress={pickImage} disabled={uploading} hitSlop={6}><Text style={styles.attachIcon}>📷</Text></Pressable>
            <Pressable style={styles.attachBtn} onPress={pickFile} disabled={uploading} hitSlop={6}><Text style={styles.attachIcon}>📎</Text></Pressable>
          </>
        )}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={editing ? 'Edit message' : 'Message'}
          placeholderTextColor="#9CA3AF"
          multiline
        />
        <Pressable style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.85 }]} onPress={send}>
          <Text style={styles.sendText}>{editing ? 'Save' : 'Send'}</Text>
        </Pressable>
      </View>

      {/* Mute sheet */}
      <Modal visible={muteVisible} transparent animationType="fade" onRequestClose={() => setMuteVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMuteVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Mute notifications</Text>
            {muted ? (
              <Pressable style={styles.sheetRow} onPress={() => setMute(null)}>
                <Text style={[styles.sheetRowText, { color: PRIMARY, fontWeight: '700' }]}>🔔 Turn on notifications</Text>
              </Pressable>
            ) : (
              MUTE_OPTIONS.map((o) => (
                <Pressable key={o.label} style={styles.sheetRow} onPress={() => setMute(o.minutes)}>
                  <Text style={styles.sheetRowText}>{o.label}</Text>
                </Pressable>
              ))
            )}
            <Pressable style={styles.sheetCancel} onPress={() => setMuteVisible(false)}><Text style={styles.sheetCancelText}>Cancel</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Message actions sheet */}
      <Modal visible={!!actionTarget} transparent animationType="fade" onRequestClose={() => setActionTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setActionTarget(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.emojiRow}>
              {REACT_EMOJIS.map((em) => (
                <Pressable key={em} onPress={() => actionTarget && toggleReaction(actionTarget, em)} style={styles.emojiBtn}>
                  <Text style={{ fontSize: 26 }}>{em}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.sheetRow} onPress={() => actionTarget && startReply(actionTarget)}><Text style={styles.sheetRowText}>↩️  Reply</Text></Pressable>
            {actionTarget?.body ? (
              <Pressable style={styles.sheetRow} onPress={() => actionTarget && copyMessage(actionTarget)}><Text style={styles.sheetRowText}>📋  Copy</Text></Pressable>
            ) : null}
            {actionTarget?.sender === user?.id && actionTarget?.type === 'text' ? (
              <Pressable style={styles.sheetRow} onPress={() => actionTarget && startEdit(actionTarget)}><Text style={styles.sheetRowText}>✏️  Edit</Text></Pressable>
            ) : null}
            {actionTarget?.sender === user?.id ? (
              <Pressable style={styles.sheetRow} onPress={() => actionTarget && deleteForEveryone(actionTarget)}><Text style={[styles.sheetRowText, { color: '#DC2626' }]}>🗑️  Delete for everyone</Text></Pressable>
            ) : null}
            <Pressable style={styles.sheetCancel} onPress={() => setActionTarget(null)}><Text style={styles.sheetCancelText}>Cancel</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mutedBanner: { backgroundColor: '#FEF3C7', paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' },
  mutedText: { color: '#92400E', fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMedia: { padding: 4, paddingBottom: 6 },
  mine: { backgroundColor: PRIMARY, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  sender: { fontSize: 12, fontWeight: '700', color: PRIMARY, marginBottom: 2 },
  body: { fontSize: 15, color: '#111827', lineHeight: 20 },
  caption: { fontSize: 14, color: '#111827', lineHeight: 19, paddingHorizontal: 8, paddingTop: 6 },
  image: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#E5E7EB' },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180 },
  fileIcon: { fontSize: 26 },
  fileName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  fileHint: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  deleted: { fontSize: 14, fontStyle: 'italic', color: '#6B7280' },
  edited: { fontSize: 10, color: '#9CA3AF', marginTop: 3, alignSelf: 'flex-end' },
  quote: { borderLeftWidth: 3, borderLeftColor: PRIMARY, paddingLeft: 8, marginBottom: 5, opacity: 0.95 },
  quoteName: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  quoteText: { fontSize: 12, color: '#6B7280' },
  reactRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  reactChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  reactChipMine: { backgroundColor: '#EEF2FF', borderColor: PRIMARY },
  reactChipText: { fontSize: 13 },
  uploadBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  uploadText: { color: '#6B7280', fontSize: 13 },
  composerBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFB', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  composerLine: { width: 3, height: 32, backgroundColor: PRIMARY, borderRadius: 2 },
  composerTitle: { fontSize: 12, fontWeight: '700', color: '#374151' },
  composerPreview: { fontSize: 12, color: '#6B7280' },
  composerX: { fontSize: 16, color: '#6B7280', paddingHorizontal: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  attachBtn: { paddingHorizontal: 4, paddingVertical: 10 },
  attachIcon: { fontSize: 22 },
  input: { flex: 1, maxHeight: 120, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#111827' },
  sendBtn: { backgroundColor: PRIMARY, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 12, paddingBottom: 24 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', paddingVertical: 10 },
  sheetRow: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10 },
  sheetRowText: { fontSize: 16, color: '#111827', textAlign: 'center' },
  sheetCancel: { paddingVertical: 14, marginTop: 6 },
  sheetCancelText: { fontSize: 16, color: '#6B7280', textAlign: 'center', fontWeight: '600' },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  emojiBtn: { padding: 6 },
});
