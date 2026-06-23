import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { pb } from '@/lib/pb';
import { useColors, useThemedStyles, type Colors } from '@/lib/theme';

function timeLeft(iso?: string): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Final results';
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}

// In-chat poll card: select an answer → Vote → live results, with a peek
// ("Show results") and per-poll close time.
export function PollMessage({ messageId, userId }: { messageId: string; userId?: string }) {
  const theme = useColors();
  const styles = useThemedStyles(makeStyles);
  const [poll, setPoll] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const p = await pb.collection('polls').getFirstListItem(pb.filter('message = {:m}', { m: messageId }));
        if (!active) return;
        setPoll(p);
        const [opts, vts] = await Promise.all([
          pb.collection('poll_options').getFullList({ filter: pb.filter('poll = {:p}', { p: p.id }), sort: 'order' }),
          pb.collection('poll_votes').getFullList({ filter: pb.filter('poll = {:p}', { p: p.id }) }),
        ]);
        if (!active) return;
        setOptions(opts);
        setVotes(vts);
        unsub = await pb.collection('poll_votes').subscribe('*', (e: any) => {
          if (e.record.poll !== p.id) return;
          setVotes((prev) => {
            if (e.action === 'delete') return prev.filter((v) => v.id !== e.record.id);
            if (prev.some((v) => v.id === e.record.id)) return prev;
            return [...prev, e.record];
          });
        });
      } catch {}
    })();
    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, [messageId]);

  if (!poll) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>📊 Poll</Text>
      </View>
    );
  }

  const total = votes.length;
  const myVotes = votes.filter((v) => v.user === userId).map((v) => v.option);
  const hasVoted = myVotes.length > 0;
  const closed = !!poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now();
  const resultsMode = hasVoted || showResults || closed;

  function toggle(optId: string) {
    if (poll.multiple) setSelected((s) => (s.includes(optId) ? s.filter((x) => x !== optId) : [...s, optId]));
    else setSelected([optId]);
  }

  async function submitVote() {
    if (selected.length === 0 || !userId) return;
    const picks = selected;
    setSelected([]);
    try {
      for (const optId of picks) {
        await pb.collection('poll_votes').create({ poll: poll.id, option: optId, user: userId });
      }
    } catch {}
  }

  async function removeVote() {
    const mine = votes.filter((v) => v.user === userId);
    try {
      for (const v of mine) await pb.collection('poll_votes').delete(v.id).catch(() => {});
    } catch {}
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{poll.question}</Text>
      <Text style={styles.subtitle}>
        {poll.multiple ? 'Select one or more answers' : 'Select one answer'}
      </Text>

      {options.map((o) => {
        const count = votes.filter((v) => v.option === o.id).length;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const votedThis = myVotes.includes(o.id);
        const selThis = selected.includes(o.id);

        if (resultsMode) {
          return (
            <View key={o.id} style={[styles.optResult, votedThis && styles.optResultMine]}>
              <View style={[styles.bar, { width: `${pct}%` }]} />
              <View style={styles.optResultRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optText}>{o.text}</Text>
                  <Text style={styles.optPct}>{pct}% · {count} vote{count === 1 ? '' : 's'}</Text>
                </View>
                {votedThis ? (
                  <View style={styles.check}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        }
        return (
          <Pressable key={o.id} onPress={() => toggle(o.id)} style={[styles.optSelect, selThis && styles.optSelectActive]}>
            <Text style={styles.optText}>{o.text}</Text>
            <View style={[styles.radio, selThis && styles.radioActive]}>
              {selThis ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        );
      })}

      {!resultsMode ? (
        <Pressable
          style={[styles.actionBtn, styles.voteBtn, selected.length === 0 && styles.voteBtnOff]}
          onPress={submitVote}
          disabled={selected.length === 0}>
          <Text style={[styles.voteText, selected.length === 0 && { color: '#C7C4E8' }]}>Vote</Text>
        </Pressable>
      ) : hasVoted && !closed ? (
        <Pressable style={[styles.actionBtn, styles.removeBtn]} onPress={removeVote}>
          <Text style={styles.removeText}>Remove Vote</Text>
        </Pressable>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {total} vote{total === 1 ? '' : 's'}
          {poll.closes_at ? ` · ${timeLeft(poll.closes_at)}` : ''}
        </Text>
        {!hasVoted && !closed ? (
          <Pressable onPress={() => setShowResults((s) => !s)} hitSlop={8}>
            <Text style={styles.footerLink}>{showResults ? 'Back to vote' : 'Show results'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (theme: Colors) => StyleSheet.create({
  card: { backgroundColor: theme.card, borderRadius: 16, padding: 16, ...{ shadowColor: '#2A1F6E', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 } },
  title: { fontSize: 18, fontWeight: '800', color: theme.text },
  subtitle: { fontSize: 13.5, color: theme.textMuted, marginTop: 3, marginBottom: 12 },
  optSelect: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F3F2F9', borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent',
    paddingHorizontal: 16, paddingVertical: 15, marginBottom: 10,
  },
  optSelectActive: { borderColor: theme.primary, backgroundColor: theme.primarySoft },
  optText: { fontSize: 15.5, fontWeight: '600', color: theme.text, flex: 1, paddingRight: 10 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#C4C2D6', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: theme.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.primary },
  optResult: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#F3F2F9', marginBottom: 10, minHeight: 54, justifyContent: 'center' },
  optResultMine: { borderWidth: 1.5, borderColor: theme.primary },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: theme.primarySoft },
  optResultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  optPct: { fontSize: 13, color: theme.textMuted, marginTop: 2, fontWeight: '600' },
  check: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  checkMark: { color: '#fff', fontSize: 15, fontWeight: '800' },
  actionBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 2 },
  voteBtn: { backgroundColor: theme.primary },
  voteBtnOff: { backgroundColor: '#DEDCF3' },
  voteText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  removeBtn: { backgroundColor: '#F3F2F9' },
  removeText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  footerText: { fontSize: 13, color: theme.textMuted },
  footerLink: { fontSize: 14, color: theme.primary, fontWeight: '700' },
});
