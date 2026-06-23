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
import { registerWebPush, webPushPermission } from '@/lib/webpush';
import { useColors, useTheme, useThemedStyles, type Colors } from '@/lib/theme';
import { PRIMARY } from './_layout';

export default function Profile() {
  const { isValid, user } = useAuth();
  const router = useRouter();
  const theme = useColors();
  const styles = useThemedStyles(makeStyles);
  const { scheme, toggle } = useTheme();
  const [name, setName] = useState<string>(user?.display_name || '');
  const [about, setAbout] = useState<string>(user?.about || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notifPerm, setNotifPerm] = useState(webPushPermission());

  if (!isValid) return <Redirect href="/" />;

  async function enableNotifications() {
    const ok = await registerWebPush(true);
    setNotifPerm(webPushPermission());
    if (!ok && webPushPermission() === 'denied') {
      Alert.alert('Notifications blocked', 'Allow notifications for this site in your browser settings, then try again.');
    }
  }

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
        placeholderTextColor={theme.textFaint}
        maxLength={100}
      />

      <Text style={styles.label}>About</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={about}
        onChangeText={setAbout}
        placeholder="A short line about you (optional)"
        placeholderTextColor={theme.textFaint}
        multiline
        maxLength={200}
      />

      <Pressable style={[styles.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
      </Pressable>

      <Pressable style={styles.toggleRow} onPress={toggle}>
        <Text style={styles.toggleLabel}>{scheme === 'dark' ? '🌙  Dark mode' : '☀️  Light mode'}</Text>
        <View style={[styles.track, scheme === 'dark' && styles.trackOn]}>
          <View style={[styles.knob, scheme === 'dark' && styles.knobOn]} />
        </View>
      </Pressable>

      {notifPerm === 'default' ? (
        <Pressable style={styles.linkBtn} onPress={enableNotifications}>
          <Text style={styles.linkBtnText}>🔔  Enable notifications</Text>
        </Pressable>
      ) : notifPerm === 'granted' ? (
        <Text style={styles.notifOn}>🔔 Notifications are on for this device</Text>
      ) : null}

      <Pressable style={styles.linkBtn} onPress={() => router.push('/link-device')}>
        <Text style={styles.linkBtnText}>＋  Link another device</Text>
      </Pressable>
      <Text style={styles.linkHint}>Use the same account on another phone or in a browser.</Text>

      <Text style={styles.email}>Signed in as {user?.email}</Text>
    </ScrollView>
  );
}

const makeStyles = (theme: Colors) => StyleSheet.create({
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
    borderColor: theme.bg,
  },
  editBadgeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { color: theme.textFaint, fontSize: 13, marginBottom: 8 },
  label: { alignSelf: 'flex-start', color: theme.textMuted, fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    alignSelf: 'stretch',
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
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
  toggleRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginTop: 12 },
  toggleLabel: { color: theme.text, fontSize: 15.5, fontWeight: '600' },
  track: { width: 48, height: 28, borderRadius: 14, backgroundColor: theme.border, padding: 3, justifyContent: 'center' },
  trackOn: { backgroundColor: PRIMARY },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
  linkBtn: { alignSelf: 'stretch', backgroundColor: theme.primarySoft, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  linkBtnText: { color: PRIMARY, fontWeight: '700', fontSize: 15.5 },
  linkHint: { color: theme.textFaint, fontSize: 12.5, textAlign: 'center', marginTop: 6 },
  notifOn: { color: theme.online, fontSize: 13.5, fontWeight: '600', textAlign: 'center', marginTop: 12 },
  email: { color: theme.textFaint, fontSize: 12, marginTop: 16 },
});
