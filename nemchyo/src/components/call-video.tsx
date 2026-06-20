import { StyleSheet, View } from 'react-native';

// Web stub — video calls render only in the native app for now.
export function CallVideo({ style }: { stream?: any; mirror?: boolean; style?: any }) {
  return <View style={[styles.placeholder, style]} />;
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: '#1F2937' },
});
