import { useVideoPlayer, VideoView } from 'expo-video';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

// Full-screen in-app video player. Mounted only while a video is open, so the
// hook always has a real source.
export function VideoPlayerModal({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.bg}>
        <Pressable style={styles.close} onPress={onClose} hitSlop={14}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <VideoView style={styles.video} player={player} nativeControls contentFit="contain" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  close: {
    position: 'absolute',
    top: 46,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 26, fontWeight: '600' },
});
