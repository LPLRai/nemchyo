import * as Clipboard from 'expo-clipboard';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '@/lib/auth';
import { buildJoinUrl, createInvite } from '@/lib/invites';
import { PRIMARY } from './_layout';

export default function Invite() {
  const { isValid } = useAuth();
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isValid) return <Redirect href="/" />;

  async function generate() {
    setBusy(true);
    setError('');
    setCopied(false);
    setLink('');
    try {
      const code = await createInvite({ displayName: name.trim() || undefined });
      setLink(buildJoinUrl(code));
    } catch (e: any) {
      setError(e?.message || 'Could not create the invite.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await Clipboard.setStringAsync(link);
    setCopied(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Invite a family member</Text>
      <Text style={styles.help}>
        Generate a one-time link or QR code. They open it and they&apos;re in — no password needed.
      </Text>

      <Text style={styles.label}>Their name (optional)</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Uncle Ramesh"
        placeholderTextColor="#9CA3AF"
      />

      <Pressable
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        onPress={generate}
        disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate invite</Text>}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {link ? (
        <View style={styles.result}>
          <View style={styles.qrWrap}>
            <QRCode value={link} size={200} color="#111827" backgroundColor="#ffffff" />
          </View>
          <Text style={styles.linkLabel}>Or share this link:</Text>
          <Text selectable style={styles.link}>
            {link}
          </Text>
          <Pressable style={styles.copyBtn} onPress={copy}>
            <Text style={styles.copyText}>{copied ? '✓ Copied' : 'Copy link'}</Text>
          </Pressable>
          <Text style={styles.note}>This invite works once — generate a new one for each person.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 8, alignItems: 'stretch', maxWidth: 460, width: '100%', alignSelf: 'center' },
  heading: { fontSize: 22, fontWeight: '800', color: '#111827' },
  help: { fontSize: 14, color: '#6B7280', marginBottom: 12, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 14,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: '#DC2626', fontSize: 14, marginTop: 8 },
  result: { alignItems: 'center', gap: 10, marginTop: 24 },
  qrWrap: { padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  linkLabel: { fontSize: 13, color: '#6B7280', marginTop: 8 },
  link: { fontSize: 13, color: PRIMARY, textAlign: 'center' },
  copyBtn: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 4,
  },
  copyText: { color: PRIMARY, fontWeight: '700' },
  note: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 6 },
});
