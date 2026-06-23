import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Avatar } from '@/components/avatar';
import { PB_URL } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';
import { PRIMARY } from './_layout';

export default function Profile() {
  const { isValid, user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState<string>(user?.display_name || '');
  const [about, setAbout] = useState<string>(user?.about || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!isValid) return <Redirect href="/" />;

  async function pickAvatar() {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const filename = asset.fileName || 'avatar.jpg';
      if (Platform.OS === 'web') {
        const form = new FormData();
        const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
        form.append('avatar', blob, filename);
        await pb.collection('users').update(user.id, form);
      } else {
        // Native: use expo-file-system's multipart uploader. Plain RN FormData
        // with { uri, name, type } silently fails to read the file on Android,
        // so the avatar never actually saved.
        let uploadUri = asset.uri;
        if (uploadUri && !uploadUri.startsWith('file://')) {
          try {
            const dest = (FileSystem.cacheDirectory || '') + `avatar_${Date.now()}.jpg`;
            await FileSystem.copyAsync({ from: uploadUri, to: dest });
            uploadUri = dest;
          } catch {
            /* fall back to the original uri */
          }
        }
        const up = await FileSystem.uploadAsync(`${PB_URL}/api/collections/users/records/${user.id}`, uploadUri, {
          httpMethod: 'PATCH',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'avatar',
          mimeType: asset.mimeType || 'image/jpeg',
          headers: pb.authStore.token ? { Authorization: pb.authStore.token } : {},
        });
        if (up.status >= 400) throw new Error(`Upload failed (${up.status})`);
      }
      await pb.collection('users').authRefresh(); // refresh authStore so the new avatar shows everywhere
    } catch (e: any) {
      Alert.alert("Couldn't update photo", e?.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await pb.collection('users').update(user.id, { display_name: name.trim(), about: about.trim() });
      await pb.collection('users').authRefresh();
      router.back();
    } catch {
      /* ignore for MVP */
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Your Profile' }} />

      <Pressable onPress={pickAvatar} style={styles.avatarWrap} disabled={uploading}>
        <Avatar user={user} name={name} size={104} />
        <View style={styles.editBadge}>
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.editBadgeText}>✎</Text>
          )}
        </View>
      </Pressable>
      <Text style={styles.hint}>Tap the photo to change it</Text>

      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor="#9CA3AF"
        maxLength={100}
      />

      <Text style={styles.label}>About</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={about}
        onChangeText={setAbout}
        placeholder="A short line about you (optional)"
        placeholderTextColor="#9CA3AF"
        multiline
        maxLength={200}
      />

      <Pressable style={[styles.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
      </Pressable>

      <Text style={styles.email}>Signed in as {user?.email}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', gap: 8 },
  avatarWrap: { marginTop: 8 },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: PRIMARY,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#F3F4F6',
  },
  editBadgeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { color: '#9CA3AF', fontSize: 13, marginBottom: 8 },
  label: { alignSelf: 'flex-start', color: '#6B7280', fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  save: {
    alignSelf: 'stretch',
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  email: { color: '#9CA3AF', fontSize: 12, marginTop: 16 },
});
