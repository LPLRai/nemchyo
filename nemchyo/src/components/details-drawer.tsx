import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import ChatInfo from '@/app/chat-info';
import { useColors } from '@/lib/theme';

const Ctx = createContext<{ chatId: string | null; tab?: string; open: (id: string, tab?: string) => void; close: () => void }>({
  chatId: null,
  open: () => {},
  close: () => {},
});

export function DetailsDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ chatId: string | null; tab?: string }>({ chatId: null });
  return (
    <Ctx.Provider
      value={{
        chatId: state.chatId,
        tab: state.tab,
        open: (id, tab) => setState({ chatId: id, tab }),
        close: () => setState({ chatId: null }),
      }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDetailsDrawer() {
  return useContext(Ctx);
}

// Right-side slide-in panel for chat/group details on web (takes < half the
// screen). On mobile we navigate to the full chat-info route instead.
export function DetailsDrawer() {
  const { chatId, tab, close } = useDetailsDrawer();
  const theme = useColors();
  const tx = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    if (chatId) {
      tx.setValue(80);
      Animated.timing(tx, { toValue: 0, duration: 220, useNativeDriver: false }).start();
    }
  }, [chatId, tx]);

  return (
    <Modal visible={!!chatId} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.row}>
        <Pressable style={styles.backdrop} onPress={close} />
        <Animated.View
          style={[
            styles.panel,
            { backgroundColor: theme.bg, borderLeftColor: theme.border, transform: [{ translateX: tx }] },
          ]}>
          {chatId ? <ChatInfo chat={chatId} tab={tab} embedded onClose={close} /> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { width: '40%', minWidth: 360, maxWidth: 520, borderLeftWidth: 1 },
});
