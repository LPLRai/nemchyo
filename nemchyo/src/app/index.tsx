import { Link, Redirect, useRouter } from 'expo-router';
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
import { shadow, useColors, useThemedStyles, type Colors } from '@/lib/theme';

export default function Login() {
  const { isValid } = useAuth();
  const router = useRouter();
  const theme = useColors();
  const styles = useThemedStyles(makeStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Already logged in (persisted token) -> straight into the chat list.
  if (isValid) return <Redirect href="/chats" />;

  async function onLogin() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await pb.collection('users').authWithPassword(email.trim(), password);
      router.replace('/chats'); // explicit navigation (don't rely only on re-render)
    } catch (e: any) {
      setError(e?.message || 'Login failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>N</Text>
        </View>
        <Text style={styles.logo}>Nemchyo</Text>
        <Text style={styles.subtitle}>Private messaging, just for family</Text>
      </View>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={theme.textFaint}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={theme.textFaint}
          onSubmitEditing={onLogin}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.9 }]}
          onPress={onLogin}
          disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log in</Text>}
        </Pressable>

        <Link href="/join" asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.joinLink}>Have an invite? Join here →</Text>
          </Pressable>
        </Link>
        <Link href="/link" asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.linkDevice}>Already on another device? Link this one →</Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Colors) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.bg },
  hero: { alignItems: 'center', marginBottom: 28 },
  logoMark: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    ...shadow.lg,
  },
  logoMarkText: { color: '#fff', fontSize: 44, fontWeight: '800' },
  logo: { fontSize: 34, fontWeight: '800', color: theme.text, letterSpacing: 0.3 },
  subtitle: { fontSize: 15, color: theme.textMuted, marginTop: 4 },
  card: {
    width: '100%',
    maxWidth: 380,
    gap: 12,
    backgroundColor: theme.card,
    borderRadius: 24,
    padding: 22,
    ...shadow.md,
  },
  input: {
    backgroundColor: '#F4F4FA',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.text,
  },
  button: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    ...shadow.sm,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  joinLink: { color: theme.primary, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 10 },
  linkDevice: { color: theme.textMuted, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  error: { color: theme.danger, fontSize: 14, textAlign: 'center' },
});
