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
import { useColors, useThemedStyles, type Colors } from '@/lib/theme';
import { PRIMARY } from './_layout';

export default function Invite() {
  const { isValid } = useAuth();
  const theme = useColors();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  if (!isValid) return <Redirect href="/" />;

  async function generate() {
    setBusy(true);
    setError('');
    setCopied('');
    setCode('');
    setLink('');
    try {
      const c = await createInvite({ displayName: name.trim() || undefined });
      setCode(c);
      setLink(buildJoinUrl(c));
    } catch (e: any) {
      setError(e?.message || 'Could not create the invite.');
    } finally {
      setBusy(false);
    }
  }

  async function copyValue(value: string, which: string) {
    await Clipboard.setStringAsync(value);
    setCopied(which);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Invite a family member</Text>
      <Text style={styles.help}>
        Generate a one-time invite. They open the link (browser) or enter the code in the app — no
        password needed.
      </Text>

      <Text style={styles.label}>Their name (optional)</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Uncle Ramesh"
        placeholderTextColor={theme.textFaint}
      />

      <Pressable
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        onPress={generate}
        disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate invite</Text>}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {code ? (
        <View style={styles.result}>
          <View style={styles.qrWrap}>
            <QRCode value={link} size={170} color="#111827" backgroundColor="#ffffff" />
          </View>

          <Text style={styles.sectionLabel}>INVITE CODE</Text>
          <View style={styles.codeBox}>
            <Text selectable style={styles.codeText}>
              {code}
            </Text>
          </View>
          <Pressable style={styles.copyBtn} onPress={() => copyValue(code, 'code')}>
            <Text style={styles.copyText}>{copied === 'code' ? '✓ Code copied' : 'Copy code'}</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>OR THE FULL LINK</Text>
          <Text selectable style={styles.link}>
            {link}
          </Text>
          <Pressable style={styles.copyBtn} onPress={() => copyValue(link, 'link')}>
            <Text style={styles.copyText}>{copied === 'link' ? '✓ Link copied' : 'Copy link'}</Text>
          </Pressable>

          <View style={styles.howto}>
            <Text style={styles.howtoText}>
              📱 <Text style={styles.bold}>In the app:</Text> they tap “Have an invite? Join here” and paste
              the code (or link).
            </Text>
            <Text style={styles.howtoText}>
              🌐 <Text style={styles.bold}>In a browser:</Text> they just tap the link.
            </Text>
          </View>
          <Text style={styles.note}>This invite works once — generate a new one per person.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (theme: Colors) => StyleSheet.create({
  container: { padding: 24, gap: 8, alignItems: 'stretch', maxWidth: 460, width: '100%', alignSelf: 'center' },
  heading: { fontSize: 22, fontWeight: '800', color: theme.text },
  help: { fontSize: 14, color: theme.textMuted, marginBottom: 12, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: theme.textMuted, marginTop: 8 },
  input: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.text,
  },
  button: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: theme.danger, fontSize: 14, marginTop: 8 },
  result: { alignItems: 'center', gap: 8, marginTop: 22 },
  qrWrap: { padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: theme.border },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: theme.textFaint, letterSpacing: 1, marginTop: 14 },
  codeBox: {
    backgroundColor: theme.primarySoft,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  codeText: { fontSize: 24, fontWeight: '800', color: PRIMARY, letterSpacing: 2, textAlign: 'center' },
  link: { fontSize: 13, color: PRIMARY, textAlign: 'center' },
  copyBtn: { backgroundColor: theme.primarySoft, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9, marginTop: 4 },
  copyText: { color: PRIMARY, fontWeight: '700' },
  howto: { backgroundColor: theme.card, borderRadius: 12, padding: 14, gap: 8, marginTop: 16, alignSelf: 'stretch' },
  howtoText: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },
  bold: { fontWeight: '700' },
  note: { fontSize: 12, color: theme.textFaint, textAlign: 'center', marginTop: 8 },
});
