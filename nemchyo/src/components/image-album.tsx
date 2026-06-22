import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const GAP = 3;
const W = 240; // album block width

function Cell({
  uri,
  w,
  h,
  more,
  onPress,
}: {
  uri: string;
  w: number;
  h: number;
  more?: number;
  onPress: () => void;
}) {
  return (
    <Pressable style={{ width: w, height: h, borderRadius: 8, overflow: 'hidden', backgroundColor: '#D6D3E8' }} onPress={onPress}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      {more && more > 0 ? (
        <View style={styles.more}>
          <Text style={styles.moreText}>+{more}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// A WhatsApp-style grid for 2+ photos sent together. `thumbs` are the (up to 4)
// preview URLs; `total` is how many there really are; tapping opens the viewer.
export function ImageAlbum({
  thumbs,
  total,
  onOpen,
}: {
  thumbs: string[];
  total: number;
  onOpen: (i: number) => void;
}) {
  const extra = total - 4;
  const half = (W - GAP) / 2;

  if (total === 2) {
    return (
      <View style={styles.album}>
        <Cell uri={thumbs[0]} w={half} h={168} onPress={() => onOpen(0)} />
        <Cell uri={thumbs[1]} w={half} h={168} onPress={() => onOpen(1)} />
      </View>
    );
  }
  if (total === 3) {
    return (
      <View style={[styles.album, { flexDirection: 'column' }]}>
        <Cell uri={thumbs[0]} w={W} h={120} onPress={() => onOpen(0)} />
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <Cell uri={thumbs[1]} w={half} h={half} onPress={() => onOpen(1)} />
          <Cell uri={thumbs[2]} w={half} h={half} onPress={() => onOpen(2)} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.album}>
      {[0, 1, 2, 3].map((i) => (
        <Cell key={i} uri={thumbs[i]} w={half} h={half} more={i === 3 ? extra : 0} onPress={() => onOpen(i)} />
      ))}
    </View>
  );
}

// Full-screen, swipeable photo viewer. `onForward` (optional) gets the index of
// the photo currently on screen.
export function ImageViewer({
  uris,
  index,
  onClose,
  onForward,
}: {
  uris: string[] | null;
  index: number;
  onClose: () => void;
  onForward?: (i: number) => void;
}) {
  const [current, setCurrent] = useState(index);
  const { width, height } = Dimensions.get('window');
  useEffect(() => setCurrent(index), [index, uris]);
  if (!uris) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={14}>
            <Text style={styles.icon}>✕</Text>
          </Pressable>
          <Text style={styles.count}>{uris.length > 1 ? `${current + 1} / ${uris.length}` : ''}</Text>
          {onForward ? (
            <Pressable onPress={() => onForward(current)} hitSlop={14}>
              <Text style={styles.icon}>↪</Text>
            </Pressable>
          ) : (
            <View style={{ width: 26 }} />
          )}
        </View>
        <FlatList
          data={uris}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(_, i) => String(i)}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Pressable style={{ width, height }} onPress={onClose}>
              <Image source={{ uri: item }} style={{ width, height }} contentFit="contain" />
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  album: { width: W, flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  more: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  moreText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  bg: { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 46,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  icon: { color: '#fff', fontSize: 26, fontWeight: '600' },
  count: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
