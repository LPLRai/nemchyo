import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { useAuth } from '@/lib/auth';
import { redeemInvite } from '@/lib/invites';
import { PRIMARY } from './_layout';

// Accept either a raw code or a full join URL (pull ?code=... out of it).
function extractCode(input: string): string {
  const s = input.trim();
  const m = s.match(/[?&]code=([^&\s#]+)/);
  return m ? decodeURIComponent(m[1]) : s;
}

export default function Join() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { isValid } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState((params.code ?? '') as string);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (isValid) return <Redirect href="/chats" />;

  const hasCode = !!params.code;

  async function join() {
    const codeValue = extractCode(code);
    if (!codeValue) {
      setError('Please enter your invite code or link.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await redeemInvite(codeValue, name.trim() || undefined);
      router.replace('/chats');
    } catch (e: any) {
      setError(e?.message || 'That invite is invalid or has already been used.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>Nemchyo</Text>
        <Text style={styles.subtitle}>{hasCode ? "You've been invited 🎉" : 'Join your family'}</Text>

        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Grandma"
          placeholderTextColor="#9CA3AF"
        />

        {!hasCode && (
          <>
            <Text style={styles.label}>Invite code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              placeholder="Paste your code or invite link"
              placeholderTextColor="#9CA3AF"
            />
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          onPress={join}
          disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Join</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, gap: 8 },
  logo: { fontSize: 40, fontWeight: '800', color: PRIMARY, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
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
  error: { color: '#DC2626', fontSize: 14, textAlign: 'center', marginTop: 8 },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
