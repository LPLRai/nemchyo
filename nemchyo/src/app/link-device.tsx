import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { buildLinkUrl, createDeviceLink } from '@/lib/invites';
import { useAuth } from '@/lib/auth';
import { shadow, theme } from '@/lib/theme';

export default function LinkDevice() {
  const { isValid } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  async function gen() {
    setLoading(true);
    try {
      const r = await createDeviceLink();
      setCode(r.code);
      setExpiresAt(new Date(r.expiresAt).getTime());
    } catch {
      setCode(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    gen();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!isValid) return <Redirect href="/" />;

  const secsLeft = code ? Math.max(0, Math.round((expiresAt - now) / 1000)) : 0;
  const expired = !!code && secsLeft <= 0;
  const mmss = `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Link a device' }} />
      <Text style={styles.title}>Add another device</Text>
      <Text style={styles.sub}>
        On your other phone or browser, open Nemchyo and choose “Link a device”, then enter this code — or scan the QR with a camera.
      </Text>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 50 }} />
      ) : !code ? (
        <>
          <Text style={styles.err}>Couldn’t create a code. Check your connection.</Text>
          <Pressable style={styles.btn} onPress={gen}>
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={[styles.qrCard, expired && { opacity: 0.25 }]}>
            <QRCode value={buildLinkUrl(code)} size={196} color={theme.text} backgroundColor="#ffffff" />
          </View>
          <Text style={[styles.code, expired && { color: theme.textFaint }]}>{code}</Text>
          <Text style={[styles.timer, expired && { color: theme.danger }]}>
            {expired ? 'This code expired' : `Expires in ${mmss}`}
          </Text>
          <Pressable style={styles.btn} onPress={gen}>
            <Text style={styles.btnText}>{expired ? 'Generate new code' : 'New code'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 8 },
  sub: { fontSize: 14.5, color: theme.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 340 },
  qrCard: { backgroundColor: '#fff', padding: 18, borderRadius: 20, marginTop: 28, ...shadow.md },
  code: { fontSize: 34, fontWeight: '800', color: theme.text, letterSpacing: 8, marginTop: 22, marginLeft: 8 },
  timer: { fontSize: 14, color: theme.textMuted, marginTop: 8, fontWeight: '600' },
  err: { fontSize: 15, color: theme.danger, textAlign: 'center', marginTop: 40 },
  btn: { backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 30, marginTop: 24, ...shadow.sm },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
