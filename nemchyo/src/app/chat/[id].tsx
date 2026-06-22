import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, Stack, useLocalSearchParams, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { ImageAlbum, ImageViewer } from '@/components/image-album';
import { SwipeToReply } from '@/components/swipe-to-reply';
import { VideoPlayerModal } from '@/components/video-player';
import { VoiceMessage } from '@/components/voice-message';
import { useAuth } from '@/lib/auth';
import { PB_URL } from '@/lib/config';
import { fileUrl } from '@/lib/files';
import { isMuted, MUTE_OPTIONS, muteLabel, muteUntilValue } from '@/lib/mute';
import { pb } from '@/lib/pb';
import { shadow, theme } from '@/lib/theme';
import { callsSupported } from '@/lib/webrtc';
import { PRIMARY } from '../_layout';

const REACT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Best-effort MIME type from a filename — pickers sometimes omit it, and a
// missing/wrong type is a common reason an upload silently fails on Android.
function fmtMs(ms?: number): string {
  const s = Math.floor((ms || 0) / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function guessMime(name: string, fallback: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime',
    m4a: 'audio/m4a', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav',
    pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext] || fallback;
}

function previewOf(m: any): string {
  if (!m) return '';
  if (m.deleted_for_everyone) return 'deleted message';
  if (m.type === 'image') return '📷 Photo';
  if (m.type === 'file') return '📄 ' + (m.file_name || 'File');
  return m.body || '';
}

// Collapse runs of consecutive photos from the same sender into one album item
// (WhatsApp-style), leaving everything else as individual messages.
function buildRenderData(msgs: any[]): any[] {
  const out: any[] = [];
  let i = 0;
  const isPhoto = (m: any) => m.file && m.type === 'image' && !m.deleted_for_everyone;
  while (i < msgs.length) {
    const m = msgs[i];
    if (isPhoto(m)) {
      const group = [m];
      let j = i + 1;
      while (j < msgs.length && isPhoto(msgs[j]) && msgs[j].sender === m.sender) {
        group.push(msgs[j]);
        j++;
      }
      if (group.length >= 2) {
        out.push({ _album: true, id: 'album_' + group[0].id, sender: m.sender, items: group, expand: m.expand });
        i = j;
        continue;
      }
    }
    out.push(m);
    i++;
  }
  return out;
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

// Shows "X is typing…" for any other member whose typing_until is still in the
// future. Self-contained ticker so it expires on its own without re-rendering
// the whole message list.
function TypingIndicator({ members, meId }: { members: any[]; meId?: string }) {
  const [, setNow] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1500);
    return () => clearInterval(iv);
  }, []);
  const now = Date.now();
  const names = members
    .filter((m) => m.user !== meId && m.typing_until && new Date(m.typing_until).getTime() > now)
    .map((m) => m.expand?.user?.display_name || 'Someone');
  if (names.length === 0) return null;
  const label =
    names.length === 1
      ? `${names[0]} is typing…`
      : `${names.slice(0, 2).join(', ')}${names.length > 2 ? ' and others' : ''} are typing…`;
  return (
    <View style={styles.typingBar}>
      <Text style={styles.typingText}>{label}</Text>
    </View>
  );
}

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isValid, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([]);
  const [reactions, setReactions] = useState<Record<string, any[]>>({});
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [membership, setMembership] = useState<any>(null);
  const [chatName, setChatName] = useState('Chat');
  const [chatType, setChatType] = useState('');
  const [muteVisible, setMuteVisible] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reactBar, setReactBar] = useState<{ id: string; y: number } | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardChats, setForwardChats] = useState<any[]>([]);
  const [callPick, setCallPick] = useState<{ kind: 'audio' | 'video'; members: any[] } | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [viewer, setViewer] = useState<{ uris: string[]; index: number } | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const listRef = useRef<FlatList>(null);
  const lastReadWrite = useRef(0);
  const lastTypingWrite = useRef(0);

  useEffect(() => {
    if (!id) return;
    const filter = pb.filter('chat = {:id}', { id });
    let unsubMsg: (() => void) | undefined;
    let unsubReact: (() => void) | undefined;
    let unsubMembers: (() => void) | undefined;
    let active = true;

    (async () => {
      try {
        const chat = await pb.collection('chats').getOne(id);
        if (active) {
          setChatName(chat.name || '');
          setChatType(chat.type || '');
        }
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
        const all = await pb.collection('chat_members').getFullList({ filter, expand: 'user' });
        if (active) setMembers(all);
      } catch {}
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

      // Members' read-position + typing state (drives read receipts + "typing…").
      unsubMembers = await pb.collection('chat_members').subscribe(
        '*',
        (e) => {
          if (e.record.chat !== id) return;
          setMembers((prev) => {
            if (e.action === 'delete') return prev.filter((m) => m.id !== e.record.id);
            const idx = prev.findIndex((m) => m.id === e.record.id);
            if (idx === -1) return [...prev, e.record];
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...e.record };
            return copy;
          });
        },
        { filter, expand: 'user' }
      );
      } catch (e) {
        /* realtime (SSE) unavailable — messages still load on open/refresh */
      }
    })();

    return () => {
      active = false;
      if (unsubMsg) unsubMsg();
      if (unsubReact) unsubReact();
      if (unsubMembers) unsubMembers();
    };
  }, [id, user?.id]);

  // Mark the chat read (my last_read_at) when it opens and as new messages
  // arrive while I'm looking at it. Throttled so it isn't spammed.
  useEffect(() => {
    if (membership?.id && messages.length > 0) markRead();
  }, [messages.length, membership?.id]);

  if (!isValid) return <Redirect href="/" />;

  const muted = isMuted(membership?.muted_until);
  const isDirectChat = chatType === 'direct';
  const headerPeer = isDirectChat ? members.find((m) => m.user !== user?.id)?.expand?.user : null;
  const headerName = isDirectChat ? headerPeer?.display_name || 'Chat' : chatName || 'Chat';
  const renderData = useMemo(() => buildRenderData(messages), [messages]);
  const selectionMode = selectedIds.length > 0;
  const selMsgs = messages.filter((m) => selectedIds.includes(m.id));
  const oneSel = selMsgs.length === 1 ? selMsgs[0] : null;
  const allOwnSel = selMsgs.length > 0 && selMsgs.every((m) => m.sender === user?.id);

  // Position the floating reaction bar near where the finger pressed, but always
  // fully on screen (the bar itself is full-width, so it never overflows sideways).
  const REACT_BAR_H = 56;
  const headerOffset = insets.top + 56; // nav header height ≈ status bar + 56
  let reactTop = 8;
  if (reactBar) {
    const winH = Dimensions.get('window').height;
    reactTop = reactBar.y - headerOffset - REACT_BAR_H - 10; // above the press
    if (reactTop < 8) reactTop = reactBar.y - headerOffset + 16; // too high → show below
    reactTop = Math.max(8, Math.min(reactTop, winH - headerOffset - REACT_BAR_H - 120));
  }

  async function startCall(callKind: 'audio' | 'video') {
    try {
      const members = await pb
        .collection('chat_members')
        .getFullList({ filter: pb.filter('chat = {:c}', { c: id }), expand: 'user' });
      // Everyone in the chat except me, who actually has a user record.
      const others = members.filter((m: any) => m.user && m.user !== user?.id);
      if (others.length === 0) return; // no one to call
      if (others.length === 1) {
        placeCall(others[0], callKind); // 1-to-1 chat: ring them directly
      } else {
        // Group chat: ask who to call so we ring the right person — not just
        // whoever happens to be first in the member list.
        setCallPick({ kind: callKind, members: others });
      }
    } catch {}
  }

  async function placeCall(member: any, callKind: 'audio' | 'video') {
    setCallPick(null);
    try {
      const call = await pb
        .collection('calls')
        .create({ chat: id, caller: user?.id, callee: member.user, kind: callKind, status: 'ringing' });
      router.push({
        pathname: '/call/[id]',
        params: {
          id: call.id,
          role: 'caller',
          kind: callKind,
          peer: member.user,
          name: member.expand?.user?.display_name || 'Member',
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
    stopTyping();
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

  async function markRead() {
    if (!membership?.id) return;
    const now = Date.now();
    if (now - lastReadWrite.current < 1500) return; // throttle
    lastReadWrite.current = now;
    try {
      await pb.collection('chat_members').update(membership.id, { last_read_at: new Date().toISOString() });
    } catch {}
  }

  // Signal "I'm typing" (debounced to one write per few seconds).
  function handleType(t: string) {
    setText(t);
    if (!membership?.id || editing) return;
    const now = Date.now();
    if (now - lastTypingWrite.current < 3000) return;
    lastTypingWrite.current = now;
    pb.collection('chat_members')
      .update(membership.id, { typing_until: new Date(now + 6000).toISOString() })
      .catch(() => {});
  }

  function stopTyping() {
    lastTypingWrite.current = 0;
    if (membership?.id) {
      pb.collection('chat_members').update(membership.id, { typing_until: '' }).catch(() => {});
    }
  }

  // A message of mine counts as "read" once every other member's last_read_at is
  // at or after the moment it was sent.
  function readByAll(message: any): boolean {
    const created = new Date(message.created).getTime();
    const others = members.filter((m) => m.user !== user?.id);
    if (others.length === 0) return false;
    return others.every((m) => m.last_read_at && new Date(m.last_read_at).getTime() >= created);
  }

  async function toggleReaction(message: any, emoji: string) {
    exitSelection();
    const mine = (reactions[message.id] || []).find((r) => r.emoji === emoji && r.user === user.id);
    try {
      if (mine) await pb.collection('reactions').delete(mine.id);
      else await pb.collection('reactions').create({ message: message.id, user: user.id, emoji });
    } catch {}
  }

  async function deleteForEveryone(message: any) {
    exitSelection();
    try {
      await pb.collection('messages').update(message.id, { deleted_for_everyone: true, body: '' });
    } catch {}
  }

  function startReply(message: any) {
    exitSelection();
    setEditing(null);
    setReplyTo(message);
  }
  function startEdit(message: any) {
    exitSelection();
    setReplyTo(null);
    setEditing(message);
    setText(message.body || '');
  }
  async function copyMessage(message: any) {
    exitSelection();
    try {
      await Clipboard.setStringAsync(message.body || '');
    } catch {}
  }

  // ---- selection mode (long-press → select; tap toggles more) --------------
  function enterSelection(message: any) {
    setSelectedIds((prev) => (prev.includes(message.id) ? prev : [...prev, message.id]));
  }
  // Long-press anywhere on a message row: select it and pop the reaction bar
  // near where the finger pressed.
  function onMsgLongPress(message: any, e: any) {
    if (message.deleted_for_everyone) return;
    enterSelection(message);
    setReactBar({ id: message.id, y: e?.nativeEvent?.pageY ?? 0 });
  }
  function toggleSelect(message: any) {
    setReactBar(null);
    setSelectedIds((prev) =>
      prev.includes(message.id) ? prev.filter((x) => x !== message.id) : [...prev, message.id]
    );
  }
  function exitSelection() {
    setReactBar(null);
    setSelectedIds([]);
  }

  async function openForward() {
    try {
      const cs = await pb.collection('chats').getFullList({ sort: '-updated' });
      setForwardChats(cs);
    } catch {}
    setForwardOpen(true);
  }

  async function deleteSelected() {
    const own = messages.filter((m) => selectedIds.includes(m.id) && m.sender === user?.id);
    exitSelection();
    for (const m of own) {
      try {
        await pb.collection('messages').update(m.id, { deleted_for_everyone: true, body: '' });
      } catch {}
    }
  }

  // Forward the selected messages into another chat (text re-sent; files are
  // downloaded then re-uploaded with the native uploader).
  async function forwardTo(chatId: string) {
    setForwardOpen(false);
    const msgs = messages.filter((m) => selectedIds.includes(m.id) && !m.deleted_for_everyone);
    exitSelection();
    for (const m of msgs) {
      try {
        if (m.file) {
          const safe = (m.file_name || 'file').replace(/[^\w.\-]/g, '_');
          const tmp = (FileSystem.cacheDirectory || '') + `fwd_${Date.now()}_${safe}`;
          const dl = await FileSystem.downloadAsync(fileUrl(m, m.file), tmp);
          const params: Record<string, string> = {
            chat: chatId,
            sender: String(user.id),
            type: m.type,
            file_name: m.file_name || 'file',
          };
          if (m.body) params.body = m.body;
          await FileSystem.uploadAsync(`${PB_URL}/api/collections/messages/records`, dl.uri, {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'file',
            parameters: params,
            headers: pb.authStore.token ? { Authorization: pb.authStore.token } : {},
          });
        } else if (m.body) {
          await pb.collection('messages').create({ chat: chatId, sender: user.id, type: 'text', body: m.body });
        }
      } catch {}
    }
  }

  function grouped(mid: string): [string, number][] {
    const g: Record<string, number> = {};
    (reactions[mid] || []).forEach((r) => (g[r.emoji] = (g[r.emoji] || 0) + 1));
    return Object.entries(g);
  }

  async function uploadAsset(asset: any, kind: 'image' | 'video' | 'file' | 'voice', caption = '') {
    setUploading(true);
    try {
      const defaultName =
        kind === 'image' ? 'photo.jpg' : kind === 'video' ? 'video.mp4' : kind === 'voice' ? 'voice.m4a' : 'file';
      const name = asset.fileName || asset.name || defaultName;
      const fallback = kind === 'image' ? 'image/jpeg' : kind === 'voice' ? 'audio/m4a' : 'application/octet-stream';
      const type = asset.mimeType || guessMime(name, fallback);

      if (Platform.OS === 'web') {
        const form = new FormData();
        form.append('chat', String(id));
        form.append('sender', user.id);
        form.append('type', kind);
        form.append('file_name', name);
        if (caption) form.append('body', caption);
        const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
        form.append('file', blob, name);
        await pb.collection('messages').create(form);
        return;
      }

      // Native: use expo-file-system's native multipart uploader. The plain
      // RN FormData + fetch path silently failed to read the picked file.
      const params: Record<string, string> = {
        chat: String(id),
        sender: String(user.id),
        type: kind,
        file_name: name,
      };
      if (caption) params.body = caption;
      // The native uploader needs a readable file:// path; some pickers hand back
      // a content:// URI, so copy it into the app cache first.
      let uploadUri: string = asset.uri;
      if (uploadUri && !uploadUri.startsWith('file://')) {
        try {
          const dest = (FileSystem.cacheDirectory || '') + `up_${Date.now()}_${name.replace(/[^\w.\-]/g, '_')}`;
          await FileSystem.copyAsync({ from: uploadUri, to: dest });
          uploadUri = dest;
        } catch {
          /* fall back to the original uri */
        }
      }
      const res = await FileSystem.uploadAsync(`${PB_URL}/api/collections/messages/records`, uploadUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: type,
        parameters: params,
        headers: pb.authStore.token ? { Authorization: pb.authStore.token } : {},
      });
      if (res.status >= 400) {
        let serverMsg = '';
        let data: any = null;
        try {
          const j = JSON.parse(res.body);
          serverMsg = j.message || '';
          data = j.data;
        } catch {}
        const err: any = new Error(serverMsg || 'Upload failed');
        err.status = res.status;
        err.response = { data };
        throw err;
      }
    } catch (e: any) {
      // Surface the real cause: HTTP status + server message + per-field errors.
      const status = e?.status ?? 0;
      const msg = e?.response?.message || e?.message || e?.code || e?.name || String(e) || 'Unknown error';
      const data = e?.response?.data || e?.data;
      let fields = '';
      if (data && typeof data === 'object') {
        fields = Object.entries(data)
          .map(([k, v]: any) => `${k}: ${(v as any)?.message || v}`)
          .join(', ');
      }
      // "v6" tag confirms which bundle is running.
      Alert.alert("Couldn't send", `v6 [${status}] ${msg}${fields ? '\n' + fields : ''}`);
    } finally {
      setUploading(false);
    }
  }

  async function pickFromLibrary() {
    setAttachOpen(false);
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Allow photo access to send photos or videos.');
          return;
        }
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });
      if (!res.canceled && res.assets?.length) {
        const cap = text.trim();
        if (cap) setText('');
        // Upload one at a time so order is preserved; caption goes on the first only.
        for (let i = 0; i < res.assets.length; i++) {
          const a = res.assets[i];
          await uploadAsset(a, a.type === 'video' ? 'video' : 'image', i === 0 ? cap : '');
        }
      }
    } catch (e: any) {
      Alert.alert("Couldn't open the gallery", e?.message || 'Please try again.');
    }
  }

  async function takePhoto() {
    setAttachOpen(false);
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Allow camera access to take a photo.');
          return;
        }
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!res.canceled && res.assets?.[0]) {
        const cap = text.trim();
        if (cap) setText('');
        uploadAsset(res.assets[0], 'image', cap);
      }
    } catch (e: any) {
      Alert.alert("Couldn't open the camera", e?.message || 'Please try again.');
    }
  }

  async function pickDocument() {
    setAttachOpen(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!res.canceled && res.assets?.[0]) {
        const cap = text.trim();
        if (cap) setText('');
        uploadAsset(res.assets[0], 'file', cap);
      }
    } catch (e: any) {
      Alert.alert("Couldn't open files", e?.message || 'Please try again.');
    }
  }

  async function startRecording() {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow microphone access to record a voice message.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e: any) {
      Alert.alert("Couldn't record", e?.message || 'Please try again.');
    }
  }

  async function stopAndSendVoice() {
    setRecording(false);
    try {
      await recorder.stop();
    } catch {}
    const uri = recorder.uri;
    if (uri) uploadAsset({ uri, fileName: 'voice.m4a', mimeType: 'audio/m4a' }, 'voice');
  }

  async function cancelRecording() {
    setRecording(false);
    try {
      await recorder.stop();
    } catch {}
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top + (Platform.OS === 'ios' ? 44 : 56)}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Avatar user={isDirectChat ? headerPeer : undefined} name={headerName} size={32} />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }} numberOfLines={1}>
                {headerName}
              </Text>
            </View>
          ),
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

      {selectionMode ? (
        <View style={styles.selBarWrap}>
          <View style={styles.selBar}>
            <Pressable onPress={exitSelection} hitSlop={10}>
              <Text style={styles.selX}>✕</Text>
            </Pressable>
            <Text style={styles.selCount}>{selectedIds.length} selected</Text>
            <View style={{ flex: 1 }} />
            {oneSel && !oneSel.deleted_for_everyone ? (
              <Pressable onPress={() => oneSel && startReply(oneSel)} hitSlop={8}>
                <Text style={styles.selAction}>Reply</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={openForward} hitSlop={8}>
              <Text style={styles.selAction}>Forward</Text>
            </Pressable>
            {oneSel?.body ? (
              <Pressable onPress={() => oneSel && copyMessage(oneSel)} hitSlop={8}>
                <Text style={styles.selAction}>Copy</Text>
              </Pressable>
            ) : null}
            {oneSel && oneSel.sender === user?.id && oneSel.type === 'text' ? (
              <Pressable onPress={() => oneSel && startEdit(oneSel)} hitSlop={8}>
                <Text style={styles.selAction}>Edit</Text>
              </Pressable>
            ) : null}
            {allOwnSel ? (
              <Pressable onPress={deleteSelected} hitSlop={8}>
                <Text style={[styles.selAction, { color: '#FCA5A5' }]}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {muted ? (
        <View style={styles.mutedBanner}>
          <Text style={styles.mutedText}>{muteLabel(membership?.muted_until)} · you won&apos;t get notifications</Text>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={renderData}
        style={styles.list}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          if (item._album) {
            const mineA = item.sender === user?.id;
            const nameA = item.expand?.sender?.display_name || (mineA ? 'You' : 'Member');
            const full = item.items.map((m: any) => fileUrl(m, m.file));
            const thumbs = item.items.slice(0, 4).map((m: any) => fileUrl(m, m.file, { thumb: '600x0' }));
            return (
              <View style={[styles.row, mineA ? styles.right : styles.left, { alignItems: 'flex-end', gap: 6 }]}>
                {!mineA ? <Avatar user={item.expand?.sender} name={nameA} size={28} /> : null}
                <View style={{ alignItems: mineA ? 'flex-end' : 'flex-start' }}>
                  {!mineA ? <Text style={[styles.sender, { marginLeft: 2 }]}>{nameA}</Text> : null}
                  <ImageAlbum
                    thumbs={thumbs}
                    total={item.items.length}
                    onOpen={(idx) => setViewer({ uris: full, index: idx })}
                  />
                </View>
              </View>
            );
          }
          const mine = item.sender === user?.id;
          const name = item.expand?.sender?.display_name || (mine ? 'You' : 'Member');
          const deleted = item.deleted_for_everyone;
          const isImage = !deleted && item.file && item.type === 'image';
          const isVoice = !deleted && item.file && item.type === 'voice';
          const isVideo = !deleted && item.file && item.type === 'video';
          const isFile = !deleted && item.file && !isImage && !isVoice && !isVideo;
          const parent = item.reply_to ? item.expand?.reply_to || messages.find((m) => m.id === item.reply_to) : null;
          const groups = grouped(item.id);
          const isSel = selectedIds.includes(item.id);

          return (
            <Pressable
              onLongPress={(e) => onMsgLongPress(item, e)}
              onPress={() => selectionMode && toggleSelect(item)}
              delayLongPress={260}
              style={[styles.row, mine ? styles.right : styles.left, { alignItems: 'flex-end', gap: 6 }, isSel && styles.rowSelected]}>
              {!mine ? <Avatar user={item.expand?.sender} name={name} size={28} /> : null}
              <SwipeToReply mine={mine} onReply={() => { if (!selectionMode && !deleted) startReply(item); }}>
              <View style={{ maxWidth: '80%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs, isImage && styles.bubbleMedia]}>
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
                    <Pressable onLongPress={(e) => onMsgLongPress(item, e)} delayLongPress={260} onPress={() => (selectionMode ? toggleSelect(item) : setViewer({ uris: [fileUrl(item, item.file)], index: 0 }))}>
                      <Image source={{ uri: fileUrl(item, item.file, { thumb: '600x0' }) }} style={styles.image} contentFit="cover" />
                      {item.body ? <Text style={[styles.caption, mine && { color: '#fff' }]}>{item.body}</Text> : null}
                    </Pressable>
                  ) : isVoice ? (
                    <View>
                      <VoiceMessage uri={fileUrl(item, item.file)} mine={mine} />
                      {item.body ? <Text style={[styles.caption, mine && { color: '#fff' }, { paddingHorizontal: 0 }]}>{item.body}</Text> : null}
                    </View>
                  ) : isVideo ? (
                    <Pressable style={styles.fileCard} onLongPress={(e) => onMsgLongPress(item, e)} delayLongPress={260} onPress={() => (selectionMode ? toggleSelect(item) : setVideoUri(fileUrl(item, item.file)))}>
                      <Text style={styles.fileIcon}>🎬</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fileName, mine && { color: '#fff' }]} numberOfLines={1}>{item.file_name || 'Video'}</Text>
                        <Text style={[styles.fileHint, mine && { color: '#E0E7FF' }]}>Tap to play</Text>
                      </View>
                    </Pressable>
                  ) : isFile ? (
                    <Pressable style={styles.fileCard} onLongPress={(e) => onMsgLongPress(item, e)} delayLongPress={260} onPress={() => (selectionMode ? toggleSelect(item) : Linking.openURL(fileUrl(item, item.file)))}>
                      <Text style={styles.fileIcon}>📄</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fileName, mine && { color: '#fff' }]} numberOfLines={1}>{item.file_name || 'Document'}</Text>
                        <Text style={[styles.fileHint, mine && { color: '#E0E7FF' }]}>Tap to open</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <Text style={[styles.body, mine && { color: '#fff' }]}>{item.body}</Text>
                  )}

                  {!deleted && (item.edited_at || mine) ? (
                    <View style={styles.metaRow}>
                      {item.edited_at ? (
                        <Text style={[styles.edited, mine && { color: '#C7D2FE' }]}>edited</Text>
                      ) : null}
                      {mine ? (
                        <Text style={[styles.tick, readByAll(item) && styles.tickRead]}>
                          {readByAll(item) ? '✓✓' : '✓'}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>

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
              </SwipeToReply>
            </Pressable>
          );
        }}
      />

      {uploading ? (
        <View style={styles.uploadBar}>
          <ActivityIndicator color={PRIMARY} size="small" />
          <Text style={styles.uploadText}>Uploading…</Text>
        </View>
      ) : null}

      <TypingIndicator members={members} meId={user?.id} />

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

      {recording ? (
        <View style={styles.inputBar}>
          <Pressable style={styles.attachBtn} onPress={cancelRecording} hitSlop={6}>
            <Text style={[styles.attachIcon, { color: '#DC2626' }]}>🗑️</Text>
          </Pressable>
          <View style={styles.recPill}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>Recording…  {fmtMs(recState.durationMillis)}</Text>
          </View>
          <Pressable style={styles.sendBtn} onPress={stopAndSendVoice}>
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputBar}>
          {!editing ? (
            <Pressable style={styles.attachBtn} onPress={() => inputRef.current?.focus()} hitSlop={6}>
              <Text style={styles.attachIcon}>😊</Text>
            </Pressable>
          ) : null}
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={handleType}
            placeholder={editing ? 'Edit message' : 'Message'}
            placeholderTextColor="#9CA3AF"
            multiline
          />
          {!editing ? (
            <>
              <Pressable style={styles.attachBtn} onPress={() => setAttachOpen(true)} disabled={uploading} hitSlop={6}>
                <Text style={styles.attachIcon}>📎</Text>
              </Pressable>
              <Pressable style={styles.attachBtn} onPress={takePhoto} disabled={uploading} hitSlop={6}>
                <Text style={styles.attachIcon}>📷</Text>
              </Pressable>
            </>
          ) : null}
          {text.trim() || editing ? (
            <Pressable style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.85 }]} onPress={send}>
              <Text style={styles.sendIcon}>{editing ? '✓' : '➤'}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.micBtn} onPress={startRecording}>
              <Text style={styles.micIcon}>🎤</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Attachment options */}
      <Modal visible={attachOpen} transparent animationType="fade" onRequestClose={() => setAttachOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAttachOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Send</Text>
            <Pressable style={styles.sheetRow} onPress={pickFromLibrary}>
              <Text style={styles.sheetRowText}>🖼️  Photo or Video</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={takePhoto}>
              <Text style={styles.sheetRowText}>📷  Take Photo</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={pickDocument}>
              <Text style={styles.sheetRowText}>📄  Document</Text>
            </Pressable>
            <Pressable style={styles.sheetCancel} onPress={() => setAttachOpen(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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

      {/* Who to call (group chats) */}
      <Modal visible={!!callPick} transparent animationType="fade" onRequestClose={() => setCallPick(null)}>
        <Pressable style={styles.backdrop} onPress={() => setCallPick(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {callPick?.kind === 'video' ? '🎥  Video call — who?' : '📞  Voice call — who?'}
            </Text>
            {callPick?.members.map((m: any) => (
              <Pressable key={m.id} style={styles.sheetRow} onPress={() => callPick && placeCall(m, callPick.kind)}>
                <Text style={styles.sheetRowText}>{m.expand?.user?.display_name || 'Member'}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.sheetCancel} onPress={() => setCallPick(null)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Forward to a chat */}
      <Modal visible={forwardOpen} transparent animationType="fade" onRequestClose={() => setForwardOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setForwardOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Forward to…</Text>
            {forwardChats.map((c) => (
              <Pressable key={c.id} style={styles.sheetRow} onPress={() => forwardTo(c.id)}>
                <Text style={styles.sheetRowText}>{c.name || (c.type === 'direct' ? 'Direct message' : 'Chat')}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.sheetCancel} onPress={() => setForwardOpen(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ImageViewer
        uris={viewer?.uris ?? null}
        index={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />

      {videoUri ? <VideoPlayerModal uri={videoUri} onClose={() => setVideoUri(null)} /> : null}

      {reactBar && oneSel && !oneSel.deleted_for_everyone ? (
        <View pointerEvents="box-none" style={styles.reactFloatWrap}>
          <View style={[styles.reactFloat, { top: reactTop }]}>
            {REACT_EMOJIS.map((em) => (
              <Pressable key={em} onPress={() => oneSel && toggleReaction(oneSel, em)} hitSlop={6} style={styles.reactFloatBtn}>
                <Text style={{ fontSize: 28 }}>{em}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mutedBanner: { backgroundColor: '#FEF3C7', paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' },
  mutedText: { color: '#92400E', fontSize: 12, fontWeight: '600' },
  rowSelected: { backgroundColor: 'rgba(99,89,242,0.12)', marginVertical: -3, paddingVertical: 3 },
  reactFloatWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },
  reactFloat: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#fff', borderRadius: 30, paddingVertical: 8, paddingHorizontal: 8, ...shadow.lg },
  reactFloatBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  selBarWrap: { backgroundColor: theme.primaryDark },
  selBar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 14, paddingVertical: 10 },
  selX: { color: '#fff', fontSize: 20, fontWeight: '700' },
  selCount: { color: '#fff', fontSize: 16, fontWeight: '700' },
  selAction: { color: '#fff', fontSize: 14, fontWeight: '600' },
  selEmojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: theme.primarySoft },
  list: { flex: 1, backgroundColor: theme.chatBg },
  row: { flexDirection: 'row' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, ...shadow.sm },
  bubbleMedia: { padding: 4, paddingBottom: 6 },
  mine: { backgroundColor: theme.primary, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: theme.bubbleTheirs, borderBottomLeftRadius: 6 },
  sender: { fontSize: 12.5, fontWeight: '700', color: theme.primary, marginBottom: 2 },
  body: { fontSize: 15.5, color: theme.text, lineHeight: 21 },
  caption: { fontSize: 14, color: '#111827', lineHeight: 19, paddingHorizontal: 8, paddingTop: 6 },
  image: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#E5E7EB' },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180 },
  fileIcon: { fontSize: 26 },
  fileName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  fileHint: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  deleted: { fontSize: 14, fontStyle: 'italic', color: '#6B7280' },
  edited: { fontSize: 10, color: '#9CA3AF' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  tick: { fontSize: 11, color: '#C7D2FE', fontWeight: '700' },
  tickRead: { color: '#FFFFFF' },
  typingBar: { paddingHorizontal: 16, paddingTop: 5, paddingBottom: 3, backgroundColor: theme.chatBg },
  typingText: { fontSize: 12.5, color: theme.primary, fontStyle: 'italic', fontWeight: '600' },
  quote: { borderLeftWidth: 3, borderLeftColor: PRIMARY, paddingLeft: 8, marginBottom: 5, opacity: 0.95 },
  quoteName: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  quoteText: { fontSize: 12, color: '#6B7280' },
  reactRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  reactChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 3, ...shadow.sm },
  reactChipMine: { backgroundColor: theme.primarySoft, borderColor: theme.primary },
  reactChipText: { fontSize: 13 },
  uploadBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  uploadText: { color: '#6B7280', fontSize: 13 },
  composerBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.primarySoft, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border },
  composerLine: { width: 3, height: 32, backgroundColor: PRIMARY, borderRadius: 2 },
  composerTitle: { fontSize: 12, fontWeight: '700', color: '#374151' },
  composerPreview: { fontSize: 12, color: '#6B7280' },
  composerX: { fontSize: 16, color: '#6B7280', paddingHorizontal: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.border },
  attachBtn: { paddingHorizontal: 3, paddingVertical: 10 },
  attachIcon: { fontSize: 22 },
  input: { flex: 1, maxHeight: 120, backgroundColor: '#F0F0F7', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, fontSize: 15.5, color: theme.text },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  sendIcon: { color: '#fff', fontWeight: '700', fontSize: 18, marginLeft: 2 },
  micBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  micIcon: { fontSize: 22 },
  recPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEE2E2', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#DC2626' },
  recText: { color: '#991B1B', fontSize: 14, fontWeight: '600' },
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
