import { Redirect, Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Avatar } from '@/components/avatar';
import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';
import { PRIMARY } from './_layout';

export default function NewChat() {
  const { isValid, user } = useAuth();
  const router = useRouter();
  const [people, setPeople] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const all = await pb.collection('users').getFullList({ sort: 'display_name' });
        if (active) setPeople(all.filter((u: any) => u.id !== user?.id));
      } catch {
        /* ignore */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (!isValid) return <Redirect href="/" />;

  const selectedIds = people.filter((p) => selected[p.id]).map((p) => p.id);
  const isGroup = selectedIds.length > 1;

  // Reuse an existing 1-to-1 chat with this person instead of making a duplicate.
  async function findDirectChat(peerId: string): Promise<string | null> {
    try {
      const directs = await pb.collection('chats').getFullList({ filter: 'type = "direct"' });
      for (const dc of directs) {
        const mems = await pb
          .collection('chat_members')
          .getFullList({ filter: pb.filter('chat = {:c}', { c: dc.id }) });
        const ids = mems.map((m: any) => m.user);
        if (ids.length === 2 && ids.includes(user.id) && ids.includes(peerId)) return dc.id;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  async function create() {
    if (selectedIds.length === 0 || creating) return;
    setCreating(true);
    try {
      if (selectedIds.length === 1) {
        const existing = await findDirectChat(selectedIds[0]);
        if (existing) {
          router.replace({ pathname: '/chat/[id]', params: { id: existing } });
          return;
        }
      }
      const type = isGroup ? 'group' : 'direct';
      const name = isGroup ? groupName.trim() || 'New group' : ''; // direct names are shown per-viewer
      const chat = await pb.collection('chats').create({ name, type, created_by: user.id });
      await pb.collection('chat_members').create({ chat: chat.id, user: user.id, role: 'owner' });
      for (const pid of selectedIds) {
        await pb.collection('chat_members').create({ chat: chat.id, user: pid, role: 'member' });
      }
      router.replace({ pathname: '/chat/[id]', params: { id: chat.id } });
    } catch {
      /* ignore for MVP */
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'New chat' }} />

      {isGroup ? (
        <View style={styles.groupNameWrap}>
          <TextInput
            style={styles.groupNameInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name"
            placeholderTextColor="#9CA3AF"
            maxLength={60}
          />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : people.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No one to chat with yet</Text>
          <Text style={styles.emptyText}>Invite family members first, then start a chat here.</Text>
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 90 }}
          renderItem={({ item }) => {
            const on = !!selected[item.id];
            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#EEF2FF' }]}
                onPress={() => setSelected((p) => ({ ...p, [item.id]: !p[item.id] }))}>
                <Avatar user={item} size={44} />
                <Text style={styles.name}>{item.display_name || item.email || 'Member'}</Text>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {selectedIds.length > 0 ? (
        <Pressable style={styles.createBtn} onPress={create} disabled={creating}>
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createText}>
              {isGroup ? `Create group · ${selectedIds.length} people` : 'Start chat'}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  groupNameWrap: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  groupNameInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 11 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  checkMark: { color: '#fff', fontSize: 15, fontWeight: '800' },
  createBtn: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  createText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
