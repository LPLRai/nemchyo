import { Link, Redirect } from 'expo-router';
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
import { pb } from '@/lib/pb';
import { PRIMARY } from './_layout';

export default function Login() {
  const { isValid } = useAuth();
  const [email, setEmail] = useState('alice@test.local');
  const [password, setPassword] = useState('Test-1234!');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Already logged in (persisted token) -> straight into the chat list.
  if (isValid) return <Redirect href="/chats" />;

  async function onLogin() {
    setBusy(true);
    setError('');
    try {
      await pb.collection('users').authWithPassword(email.trim(), password);
      // Auth change triggers re-render -> the Redirect above takes over.
    } catch (e: any) {
      setError(e?.message || 'Login failed. Is the backend running?');
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
        <Text style={styles.subtitle}>Private family messaging</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
          onSubmitEditing={onLogin}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          onPress={onLogin}
          disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log in</Text>}
        </Pressable>

        <Link href="/join" asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.joinLink}>Have an invite? Join here →</Text>
          </Pressable>
        </Link>

        <Text style={styles.hint}>
          Dev accounts: alice@test.local · bob@test.local{'\n'}password: Test-1234!
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, gap: 12 },
  logo: { fontSize: 40, fontWeight: '800', color: PRIMARY, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 12 },
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
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  joinLink: { color: PRIMARY, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 14 },
  error: { color: '#DC2626', fontSize: 14, textAlign: 'center' },
  hint: { color: '#9CA3AF', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
