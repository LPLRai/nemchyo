import { pb } from './pb';
import { getIceServers } from './turn';

// Browser WebRTC. Uses the same PocketBase `call_signals` signaling as the
// native app, so native <-> web calls interoperate. (Native resolves
// webrtc.native.ts; this file is used on web.)
export const callsSupported =
  typeof RTCPeerConnection !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia;

type Callbacks = {
  onLocalStream?: (s: any) => void;
  onRemoteStream?: (s: any) => void;
  onState?: (s: 'connecting' | 'connected' | 'ended') => void;
};

type Opts = { callId: string; selfId: string; peerId: string; kind: 'audio' | 'video'; isCaller: boolean };

export class CallSession {
  o: Opts;
  cbs: Callbacks;
  pc: RTCPeerConnection | null = null;
  local: MediaStream | null = null;
  remote: MediaStream | null = null;
  audioEl: HTMLAudioElement | null = null;
  unsub: (() => void) | null = null;
  remoteSet = false;
  pending: RTCIceCandidate[] = [];
  ended = false;
  muted = false;
  camOff = false;

  constructor(o: Opts, cbs: Callbacks) {
    this.o = o;
    this.cbs = cbs;
  }

  async start() {
    this.cbs.onState?.('connecting');

    const iceServers = await getIceServers();
    this.pc = new RTCPeerConnection({ iceServers });

    try {
      this.local = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: this.o.kind === 'video',
      });
    } catch {
      this.end(); // permission denied / no device
      return;
    }
    this.cbs.onLocalStream?.(this.local);
    this.local.getTracks().forEach((t) => this.pc!.addTrack(t, this.local!));

    // Hidden sink so the remote audio always plays — the <video> elements are
    // muted (to avoid echo + double audio), so sound rides this element.
    try {
      this.audioEl = document.createElement('audio');
      this.audioEl.autoplay = true;
      (this.audioEl as any).playsInline = true;
      this.audioEl.style.display = 'none';
      document.body.appendChild(this.audioEl);
    } catch {}

    this.pc.addEventListener('track', (e: RTCTrackEvent) => {
      if (e.streams && e.streams[0]) {
        this.remote = e.streams[0];
        if (this.audioEl) {
          this.audioEl.srcObject = this.remote;
          this.audioEl.play?.().catch(() => {});
        }
        this.cbs.onRemoteStream?.(this.remote);
      }
    });
    this.pc.addEventListener('icecandidate', (e) => {
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
      const offer = await this.pc.createOffer();
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
        await this.pc!.setRemoteDescription(new RTCSessionDescription(s.payload));
        this.remoteSet = true;
        await this.flush();
        const answer = await this.pc!.createAnswer();
        await this.pc!.setLocalDescription(answer);
        this.send('answer', { type: answer.type, sdp: answer.sdp });
      } else if (s.type === 'answer') {
        await this.pc!.setRemoteDescription(new RTCSessionDescription(s.payload));
        this.remoteSet = true;
        await this.flush();
      } else if (s.type === 'candidate') {
        const c = new RTCIceCandidate(s.payload);
        if (this.remoteSet) await this.pc!.addIceCandidate(c);
        else this.pending.push(c);
      } else if (s.type === 'hangup') {
        this.end();
      }
    } catch {}
  }

  async flush() {
    for (const c of this.pending) {
      try {
        await this.pc!.addIceCandidate(c);
      } catch {}
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
    this.local?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
    return this.muted;
  }
  toggleCamera() {
    this.camOff = !this.camOff;
    this.local?.getVideoTracks().forEach((t) => (t.enabled = !this.camOff));
    return this.camOff;
  }
  switchCamera() {
    /* no-op on web (typically a single camera) */
  }

  async hangup() {
    this.send('hangup', {});
    this.end();
  }
  end() {
    if (this.ended) return;
    this.ended = true;
    try {
      this.unsub?.();
    } catch {}
    try {
      this.local?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      this.pc?.close();
    } catch {}
    try {
      this.audioEl?.remove();
    } catch {}
    this.cbs.onState?.('ended');
  }
}
