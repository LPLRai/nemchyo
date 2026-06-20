// Web stub: native WebRTC calls aren't built for the web app yet.
// (Metro resolves webrtc.native.ts on iOS/Android; this file is used on web.)
export const callsSupported = false;

type Callbacks = {
  onLocalStream?: (s: any) => void;
  onRemoteStream?: (s: any) => void;
  onState?: (s: 'connecting' | 'connected' | 'ended') => void;
};

export class CallSession {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_opts: any, _cbs: Callbacks) {}
  async start() {}
  async hangup() {}
  end() {}
  toggleMute(): boolean {
    return false;
  }
  toggleCamera(): boolean {
    return false;
  }
  switchCamera() {}
}
