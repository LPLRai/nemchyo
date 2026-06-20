import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { avatarUrl } from '@/lib/files';
import { theme } from '@/lib/theme';

const FALLBACK_BG = theme.primary;

// Round avatar: shows the user's photo, or their initial on a colored disc.
export function Avatar({
  user,
  name,
  size = 40,
}: {
  user?: any;
  name?: string;
  size?: number;
}) {
  const uri = avatarUrl(user);
  const label = (name || user?.display_name || user?.email || '?').trim().slice(0, 1).toUpperCase() || '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E5E7EB' }}
        contentFit="cover"
      />
    );
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.42) }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: FALLBACK_BG, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});
