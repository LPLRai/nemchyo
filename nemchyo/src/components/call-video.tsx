import { useEffect, useRef } from 'react';
import { View } from 'react-native';

// Web: render the MediaStream in a real <video>. These elements are muted on
// purpose — the web CallSession plays remote audio through a hidden <audio>
// sink, so the video shows picture only (no echo, no double audio).
export function CallVideo({ stream, mirror, style }: { stream?: any; mirror?: boolean; style?: any }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream || null;
    if (stream) el.play?.().catch(() => {}); // some browsers won't autoplay a late-set srcObject
  }, [stream]);

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        style={
          {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: mirror ? 'scaleX(-1)' : undefined,
          } as any
        }
      />
    </View>
  );
}
