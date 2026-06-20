import { StyleSheet, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';

export function CallVideo({ stream, mirror, style }: { stream: any; mirror?: boolean; style?: any }) {
  if (!stream) return <View style={[styles.placeholder, style]} />;
  return (
    <RTCView streamURL={stream.toURL()} style={[styles.video, style]} objectFit="cover" mirror={!!mirror} />
  );
}

const styles = StyleSheet.create({
  video: { backgroundColor: '#000' },
  placeholder: { backgroundColor: '#1F2937' },
});
