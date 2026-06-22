import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function fmt(sec: number) {
  if (!sec || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// A WhatsApp-style voice note bubble: play/pause + progress + time.
export function VoiceMessage({ uri, mine }: { uri: string; mine: boolean }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const playing = !!status?.playing;
  const dur = status?.duration || 0;
  const pos = status?.currentTime || 0;
  const pct = dur > 0 ? Math.min(1, pos / dur) : 0;
  const color = mine ? '#fff' : '#6359F2';

  function toggle() {
    try {
      if (playing) {
        player.pause();
      } else {
        if (dur > 0 && pos >= dur - 0.2) player.seekTo(0);
        player.play();
      }
    } catch {}
  }

  return (
    <View style={styles.row}>
      <Pressable onPress={toggle} hitSlop={8} style={styles.btn}>
        <Text style={[styles.icon, { color }]}>{playing ? '❚❚' : '▶'}</Text>
      </Pressable>
      <View style={[styles.track, { backgroundColor: mine ? 'rgba(255,255,255,0.35)' : '#D6D3E8' }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.time, { color: mine ? '#E0E7FF' : '#6B7280' }]}>{fmt(playing || pos > 0 ? pos : dur)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180, paddingVertical: 2 },
  btn: { width: 26, alignItems: 'center' },
  icon: { fontSize: 17, fontWeight: '700' },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  time: { fontSize: 12, minWidth: 32 },
});
