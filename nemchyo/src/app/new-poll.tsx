import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';
import { useColors, useThemedStyles, type Colors } from '@/lib/theme';

const DURATIONS = [
  { label: '1 hour', h: 1 },
  { label: '8 hours', h: 8 },
  { label: '1 day', h: 24 },
  { label: '3 days', h: 72 },
  { label: '1 week', h: 168 },
  { label: 'No limit', h: 0 },
];

export default function NewPoll() {
  const { chat } = useLocalSearchParams<{ chat: string }>();
  const { isValid, user } = useAuth();
  const router = useRouter();
  const theme = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<string[]>(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [durIdx, setDurIdx] = useState(2); // 1 day
  const [posting, setPosting] = useState(false);

  if (!isValid) return <Redirect href="/" />;

  const valid = question.trim().length > 0 && answers.filter((a) => a.trim()).length >= 2;

  async function post() {
    if (!valid || posting) return;
    setPosting(true);
    try {
      const q = question.trim();
      const opts = answers.map((a) => a.trim()).filter(Boolean);
      const dur = DURATIONS[durIdx];
      const closes_at = dur.h > 0 ? new Date(Date.now() + dur.h * 3600 * 1000).toISOString() : '';
      const msg = await pb.collection('messages').create({ chat, sender: user.id, type: 'poll', body: q });
      const poll = await pb.collection('polls').create({ message: msg.id, question: q, multiple, closes_at });
      for (let i = 0; i < opts.length; i++) {
        await pb.collection('poll_options').create({ poll: poll.id, text: opts[i], order: i });
      }
      router.back();
    } catch (e: any) {
      setPosting(false);
      Alert.alert("Couldn't create poll", e?.message || 'Please try again.');
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Create Poll',
          headerRight: () => (
            <Pressable onPress={post} disabled={!valid || posting} hitSlop={8}>
              <Text style={[styles.post, (!valid || posting) && { opacity: 0.4 }]}>Post</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Question</Text>
        <TextInput
          style={styles.qInput}
          placeholder="What question do you want to ask?"
          placeholderTextColor={theme.textFaint}
          value={question}
          onChangeText={setQuestion}
          maxLength={300}
        />

        <Text style={[styles.label, { marginTop: 20 }]}>Answers</Text>
        {answers.map((a, i) => (
          <View key={i} style={styles.answerRow}>
            <View style={styles.aField}>
              <TextInput
                style={styles.aInput}
                placeholder="Type your answer"
                placeholderTextColor={theme.textFaint}
                value={a}
                onChangeText={(t) => setAnswers((p) => p.map((x, j) => (j === i ? t : x)))}
                maxLength={200}
              />
            </View>
            {answers.length > 2 ? (
              <Pressable onPress={() => setAnswers((p) => p.filter((_, j) => j !== i))} hitSlop={8} style={styles.del}>
                <Text style={styles.delIcon}>🗑️</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {answers.length < 6 ? (
          <Pressable style={styles.addRow} onPress={() => setAnswers((p) => [...p, ''])}>
            <Text style={styles.addIcon}>＋</Text>
            <Text style={styles.addText}>Add another answer</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable style={styles.durRow} onPress={() => setDurIdx((i) => (i + 1) % DURATIONS.length)}>
          <Text style={styles.bottomLabel}>Duration</Text>
          <Text style={styles.durValue}>{DURATIONS[durIdx].label}  ›</Text>
        </Pressable>
        <Pressable style={styles.multiRow} onPress={() => setMultiple((m) => !m)}>
          <Text style={styles.bottomLabel}>Allow Multiple Answers</Text>
          <Text style={{ fontSize: 22, color: multiple ? theme.primary : theme.textFaint }}>{multiple ? '☑' : '☐'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  post: { color: theme.primary, fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '700', color: theme.textMuted, marginBottom: 8 },
  qInput: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: theme.text, borderWidth: 1, borderColor: theme.border },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  aField: { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16 },
  aInput: { fontSize: 15.5, color: theme.text, paddingVertical: 13 },
  del: { padding: 6 },
  delIcon: { fontSize: 20 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, marginTop: 2 },
  addIcon: { fontSize: 18, color: theme.textMuted },
  addText: { fontSize: 15.5, color: theme.textMuted, fontWeight: '600' },
  bottom: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 4 },
  durRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  multiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  bottomLabel: { fontSize: 16, fontWeight: '700', color: theme.text },
  durValue: { fontSize: 15, color: theme.textMuted, fontWeight: '600' },
});
