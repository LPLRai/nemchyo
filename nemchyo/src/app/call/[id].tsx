import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CallVideo } from '@/components/call-video';
import { Icon } from '@/components/icon';
import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';
import { CallSession, callsSupported } from '@/lib/webrtc';

type Phase = 'incoming' | 'connecting' | 'connected' | 'ended';

export default function CallScreen() {
  const { id, role, kind, peer, name } = useLocalSearchParams<{
    id: string;
    role: string;
    kind: string;
    peer: string;
    name: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();
  const isVideo = kind === 'video';

  const [phase, setPhase] = useState<Phase>(role === 'callee' ? 'incoming' : 'connecting');
  const [local, setLocal] = useState<any>(null);
  const [remote, setRemote] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const sessionRef = useRef<CallSession | null>(null);

  const close = useCallback(() => {
    sessionRef.current?.end();
    if (router.canGoBack()) router.back();
    else router.replace('/chats');
  }, [router]);

  // remote side ended/declined the call
  useEffect(() => {
    if (!id) return;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        unsub = await pb.collection('calls').subscribe(id as string, (e: any) => {
          const st = e.record?.status;
          if (st === 'ended' || st === 'declined' || st === 'missed') setPhase('ended');
        });
      } catch {}
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [id]);

  const startSession = useCallback(async () => {
    if (!user?.id || !id || sessionRef.current) return;
    const s = new CallSession(
      {
        callId: id as string,
        selfId: user.id,
        peerId: peer as string,
        kind: isVideo ? 'video' : 'audio',
        isCaller: role === 'caller',
      },
      {
        onLocalStream: setLocal,
        onRemoteStream: setRemote,
        onState: (st) => setPhase(st === 'ended' ? 'ended' : st),
      }
    );
    sessionRef.current = s;
    await s.start();
  }, [user?.id, id, peer, isVideo, role]);

  useEffect(() => {
    if (role === 'caller') startSession();
  }, [role, startSession]);

  useEffect(() => {
    if (phase === 'ended') {
      const t = setTimeout(close, 800);
      return () => clearTimeout(t);
    }
  }, [phase, close]);

  async function accept() {
    try {
      await pb.collection('calls').update(id as string, { status: 'ongoing', started: new Date().toISOString() });
    } catch {}
    setPhase('connecting');
    startSession();
  }
  async function decline() {
    try {
      await pb.collection('calls').update(id as string, { status: 'declined' });
    } catch {}
    setPhase('ended');
  }
  async function hangup() {
    try {
      await pb.collection('calls').update(id as string, { status: 'ended', ended: new Date().toISOString() });
    } catch {}
    sessionRef.current?.hangup();
    setPhase('ended');
  }

  if (!callsSupported) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.msg}>Calls are available in the Nemchyo app.</Text>
        <Pressable style={[styles.round, styles.decline]} onPress={close}>
          <Icon name="phone-off" size={26} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {isVideo && remote ? (
        <CallVideo stream={remote} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.audioBg]} />
      )}

      {isVideo && local && phase !== 'incoming' ? (
        <View style={styles.localWrap}>
          <CallVideo stream={local} mirror style={styles.localVideo} />
        </View>
      ) : null}

      <View style={styles.top}>
        <Text style={styles.name}>{name || 'Call'}</Text>
        <Text style={styles.status}>
          {phase === 'incoming'
            ? `Incoming ${isVideo ? 'video ' : ''}call…`
            : phase === 'connecting'
              ? role === 'caller'
                ? 'Calling…'
                : 'Connecting…'
              : phase === 'connected'
                ? 'Connected'
                : 'Call ended'}
        </Text>
        {phase === 'connecting' ? <ActivityIndicator color="#fff" style={{ marginTop: 10 }} /> : null}
      </View>

      <View style={styles.controls}>
        {phase === 'incoming' ? (
          <>
            <Pressable style={[styles.round, styles.decline]} onPress={decline}>
              <Icon name="phone-off" size={28} color="#fff" />
            </Pressable>
            <Pressable style={[styles.round, styles.accept]} onPress={accept}>
              <Icon name="phone" size={28} color="#fff" />
            </Pressable>
          </>
        ) : phase === 'ended' ? null : (
          <>
            <Pressable style={[styles.round, muted && styles.activeCtl]} onPress={() => setMuted(sessionRef.current?.toggleMute() ?? false)}>
              <Icon name={muted ? 'mic-off' : 'mic'} size={26} color="#fff" />
            </Pressable>
            {isVideo ? (
              <Pressable style={[styles.round, camOff && styles.activeCtl]} onPress={() => setCamOff(sessionRef.current?.toggleCamera() ?? false)}>
                <Icon name={camOff ? 'video-off' : 'video'} size={26} color="#fff" />
              </Pressable>
            ) : null}
            {isVideo ? (
              <Pressable style={styles.round} onPress={() => sessionRef.current?.switchCamera()}>
                <Icon name="switch-camera" size={24} color="#fff" />
              </Pressable>
            ) : null}
            <Pressable style={[styles.round, styles.decline]} onPress={hangup}>
              <Icon name="phone-off" size={26} color="#fff" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  center: { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', gap: 20 },
  msg: { color: '#fff', fontSize: 16 },
  audioBg: { backgroundColor: '#1F2937' },
  localWrap: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  localVideo: { width: '100%', height: '100%' },
  top: { position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center' },
  name: { color: '#fff', fontSize: 26, fontWeight: '800' },
  status: { color: '#D1D5DB', fontSize: 15, marginTop: 6 },
  controls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
  },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCtl: { backgroundColor: 'rgba(255,255,255,0.45)' },
  accept: { backgroundColor: '#16A34A' },
  decline: { backgroundColor: '#DC2626' },
  icon: { fontSize: 26 },
});
