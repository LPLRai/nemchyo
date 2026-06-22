import { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

// Wraps a message row so swiping it toward the center triggers a reply, just
// like WhatsApp: received messages (on the left) swipe right; your own messages
// (on the right) swipe left. Uses PanResponder + Animated (RN core) so it works
// over-the-air with no extra native modules.
export function SwipeToReply({
  mine,
  onReply,
  children,
}: {
  mine: boolean;
  onReply: () => void;
  children: React.ReactNode;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const dir = mine ? -1 : 1; // -1 = swipe left (mine), +1 = swipe right (theirs)

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        const horizontal = Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 10;
        const rightDir = dir === 1 ? g.dx > 0 : g.dx < 0;
        return horizontal && rightDir;
      },
      onPanResponderMove: (_, g) => {
        let move = g.dx;
        if (dir === 1) move = Math.max(0, Math.min(move, 72));
        else move = Math.min(0, Math.max(move, -72));
        tx.setValue(move);
      },
      onPanResponderRelease: (_, g) => {
        const past = dir === 1 ? g.dx > 52 : g.dx < -52;
        if (past) onReply();
        Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const hintOpacity = tx.interpolate({
    inputRange: dir === 1 ? [0, 50] : [-50, 0],
    outputRange: dir === 1 ? [0, 1] : [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View>
      <Animated.View style={[styles.hint, mine ? styles.hintRight : styles.hintLeft, { opacity: hintOpacity }]}>
        <Text style={styles.hintIcon}>↩</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  hintLeft: { left: 8 },
  hintRight: { right: 8 },
  hintIcon: { fontSize: 20, color: '#6359F2' },
});
