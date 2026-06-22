import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { pb } from '@/lib/pb';
import { theme } from '@/lib/theme';

// Renders a poll that lives in the chat timeline (message.type === 'poll').
// Loads its own poll/options/votes and subscribes to votes for live results.
export function PollMessage({ messageId, mine, userId }: { messageId: string; mine: boolean; userId?: string }) {
  const [poll, setPoll] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);

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

  if (!poll) return <Text style={[styles.q, mine && { color: '#fff' }]}>📊 Poll</Text>;

  const total = votes.length;
  const myVotes = votes.filter((v) => v.user === userId).map((v) => v.option);

  async function vote(optionId: string) {
    if (!userId) return;
    const existing = votes.find((v) => v.option === optionId && v.user === userId);
    try {
      if (existing) {
        await pb.collection('poll_votes').delete(existing.id);
      } else {
        if (!poll.multiple) {
          const others = votes.filter((v) => v.user === userId);
          for (const o of others) await pb.collection('poll_votes').delete(o.id).catch(() => {});
        }
        await pb.collection('poll_votes').create({ poll: poll.id, option: optionId, user: userId });
      }
    } catch {}
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.q, mine && { color: '#fff' }]}>{poll.question}</Text>
      {poll.multiple ? <Text style={[styles.sub, mine && { color: '#E0E7FF' }]}>Select one or more</Text> : null}
      {options.map((o) => {
        const count = votes.filter((v) => v.option === o.id).length;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const voted = myVotes.includes(o.id);
        return (
          <Pressable
            key={o.id}
            onPress={() => vote(o.id)}
            style={[styles.opt, mine && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <View style={[styles.bar, { width: `${pct}%`, backgroundColor: mine ? 'rgba(255,255,255,0.28)' : theme.primarySoft }]} />
            <View style={styles.optRow}>
              <Text style={[styles.optText, mine && { color: '#fff' }]} numberOfLines={2}>
                {voted ? '☑ ' : '☐ '}
                {o.text}
              </Text>
              <Text style={[styles.optCount, mine && { color: '#E0E7FF' }]}>{count}</Text>
            </View>
          </Pressable>
        );
      })}
      <Text style={[styles.total, mine && { color: '#C7D2FE' }]}>
        {total} vote{total === 1 ? '' : 's'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 230 },
  q: { fontSize: 15.5, fontWeight: '700', color: theme.text, marginBottom: 6 },
  sub: { fontSize: 12, color: theme.textMuted, marginBottom: 6 },
  opt: { marginVertical: 3, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.04)', minHeight: 38, justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 10 },
  optRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9 },
  optText: { fontSize: 14.5, color: theme.text, flex: 1 },
  optCount: { fontSize: 13, fontWeight: '700', color: theme.textMuted, marginLeft: 8 },
  total: { fontSize: 12, color: theme.textMuted, marginTop: 4 },
});
