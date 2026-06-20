import { PermissionsAndroid, Platform } from 'react-native';
import {
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { pb } from './pb';
import { getIceServers } from './turn';

export const callsSupported = true;

type Callbacks = {
  onLocalStream?: (s: any) => void;
  onRemoteStream?: (s: any) => void;
  onState?: (s: 'connecting' | 'connected' | 'ended') => void;
};

type Opts = { callId: string; selfId: string; peerId: string; kind: 'audio' | 'video'; isCaller: boolean };

// One peer connection's worth of call. Signaling rides PocketBase realtime
// via the `call_signals` collection (offer/answer/ICE between the two users).
export class CallSession {
  o: Opts;
  cbs: Callbacks;
  pc: any = null;
  local: any = null;
  unsub: (() => void) | null = null;
  remoteSet = false;
  pending: any[] = [];
  ended = false;
  muted = false;
  camOff = false;

  constructor(o: Opts, cbs: Callbacks) {
    this.o = o;
    this.cbs = cbs;
  }

  async start() {
    this.cbs.onState?.('connecting');

    // Android needs a runtime camera/mic permission grant before getUserMedia,
    // otherwise the call silently stalls.
    if (Platform.OS === 'android') {
      try {
        const perms: any[] = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
        if (this.o.kind === 'video') perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        const res = await PermissionsAndroid.requestMultiple(perms);
        if (!Object.keys(res).every((k) => (res as any)[k] === 'granted')) {
          this.end();
          return;
        }
      } catch {
        this.end();
        return;
      }
    }

    const iceServers = await getIceServers();
    this.pc = new RTCPeerConnection({ iceServers });

    try {
      this.local = await mediaDevices.getUserMedia({
        audio: true,
        video: this.o.kind === 'video' ? { facingMode: 'user' } : false,
      });
    } catch {
      this.end();
      return;
    }
    this.cbs.onLocalStream?.(this.local);
    this.local.getTracks().forEach((t: any) => this.pc.addTrack(t, this.local));

    this.pc.addEventListener('track', (e: any) => {
      if (e.streams && e.streams[0]) this.cbs.onRemoteStream?.(e.streams[0]);
    });
    this.pc.addEventListener('icecandidate', (e: any) => {
      if (e.candidate) {
        this.send('candidate', {
          candidate: e.candidate.candidate,
          sdpMLineIndex: e.candidate.sdpMLineIndex,
          sdpMid: e.candidate.sdpMid,
        });
      }
    });
    this.pc.addEventListener('connectionstatechange', () => {
      const s = this.pc?.connectionState;
      if (s === 'connected') this.cbs.onState?.('connected');
      if (s === 'failed' || s === 'closed') this.end();
    });

    await this.attachSignals();

    if (this.o.isCaller) {
      const offer = await this.pc.createOffer({});
      await this.pc.setLocalDescription(offer);
      this.send('offer', { type: offer.type, sdp: offer.sdp });
    }
  }

  async attachSignals() {
    const filter = pb.filter('call = {:c} && to = {:me}', { c: this.o.callId, me: this.o.selfId });
    try {
      const existing = await pb.collection('call_signals').getFullList({ filter, sort: 'created' });
      for (const s of existing) await this.handle(s);
    } catch {}
    try {
      this.unsub = await pb.collection('call_signals').subscribe(
        '*',
        (e: any) => {
          if (e.action === 'create' && e.record.call === this.o.callId && e.record.to === this.o.selfId) {
            this.handle(e.record);
          }
        },
        { filter }
      );
    } catch {}
  }

  async handle(s: any) {
    try {
      if (s.type === 'offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(s.payload));
        this.remoteSet = true;
        await this.flush();
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.send('answer', { type: answer.type, sdp: answer.sdp });
      } else if (s.type === 'answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(s.payload));
        this.remoteSet = true;
        await this.flush();
      } else if (s.type === 'candidate') {
        const c = new RTCIceCandidate(s.payload);
        if (this.remoteSet) await this.pc.addIceCandidate(c);
        else this.pending.push(c);
      } else if (s.type === 'hangup') {
        this.end();
      }
    } catch {}
  }

  async flush() {
    for (const c of this.pending) {
      try { await this.pc.addIceCandidate(c); } catch {}
    }
    this.pending = [];
  }

  send(type: string, payload: any) {
    pb.collection('call_signals')
      .create({ call: this.o.callId, from: this.o.selfId, to: this.o.peerId, type, payload })
      .catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    this.local?.getAudioTracks().forEach((t: any) => (t.enabled = !this.muted));
    return this.muted;
  }
  toggleCamera() {
    this.camOff = !this.camOff;
    this.local?.getVideoTracks().forEach((t: any) => (t.enabled = !this.camOff));
    return this.camOff;
  }
  switchCamera() {
    this.local?.getVideoTracks().forEach((t: any) => {
      if (typeof t._switchCamera === 'function') t._switchCamera();
    });
  }

  async hangup() {
    this.send('hangup', {});
    this.end();
  }
  end() {
    if (this.ended) return;
    this.ended = true;
    try { this.unsub?.(); } catch {}
    try { this.local?.getTracks().forEach((t: any) => t.stop()); } catch {}
    try { this.pc?.close(); } catch {}
    this.cbs.onState?.('ended');
  }
}
