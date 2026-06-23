import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { redeemDeviceLink } from '@/lib/invites';
import { useColors, useThemedStyles, type Colors } from '@/lib/theme';
import { PRIMARY } from './_layout';

// Accept a raw code or a full link URL (pull ?code=... out of it).
function extractCode(input: string): string {
  const s = input.trim();
  const m = s.match(/[?&]code=([^&\s#]+)/);
  return (m ? decodeURIComponent(m[1]) : s).toUpperCase();
}

export default function LinkRedeem() {
  const params = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const theme = useColors();
  const styles = useThemedStyles(makeStyles);
  const [code, setCode] = useState((params.code ?? '') as string);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tried = useRef(false);

  async function go(raw?: string) {
    const c = extractCode(raw ?? code);
    if (!c) {
      setError('Enter your link code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await redeemDeviceLink(c);
      router.replace('/chats');
    } catch (e: any) {
      setError(e?.message || 'That code is invalid or has expired.');
    } finally {
      setBusy(false);
    }
  }

  // Arrived from a scanned QR (URL carried ?code=) — redeem automatically once.
  useEffect(() => {
    if (params.code && !tried.current) {
      tried.current = true;
      go(params.code as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Link a device' }} />
      <View style={styles.card}>
        <Text style={styles.logo}>Nemchyo</Text>
        <Text style={styles.subtitle}>Sign in on this device</Text>
        <Text style={styles.help}>
          On a device that&apos;s already signed in, open Nemchyo → Profile → “Link a device”, then type the 6-character code here.
        </Text>

        <Text style={styles.label}>Link code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="e.g. MJK8NZ"
          placeholderTextColor="#9CA3AF"
          maxLength={24}
          onSubmitEditing={() => go()}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]} onPress={() => go()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Link this device</Text>}
        </Pressable>

        <Pressable hitSlop={8} onPress={() => router.replace('/')}>
          <Text style={styles.back}>← Back to log in</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Colors) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.bg },
  card: { width: '100%', maxWidth: 380, gap: 8 },
  logo: { fontSize: 40, fontWeight: '800', color: PRIMARY, textAlign: 'center' },
  subtitle: { fontSize: 16, color: theme.textMuted, textAlign: 'center' },
  help: { fontSize: 13.5, color: theme.textFaint, textAlign: 'center', marginTop: 8, marginBottom: 10, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    letterSpacing: 4,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  error: { color: '#DC2626', fontSize: 14, textAlign: 'center', marginTop: 8 },
  button: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  back: { color: theme.textMuted, fontSize: 14, textAlign: 'center', marginTop: 14, fontWeight: '600' },
});
