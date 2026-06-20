/// <reference path="../pb_data/types.d.ts" />

// POST /api/turn-credentials (authed): ICE servers (STUN + TURN) for WebRTC calls.
// TURN credentials are read from environment variables set on the server, so they
// never live in the repo or the client bundle — only logged-in users can fetch them.
routerAdd(
  "POST",
  "/api/turn-credentials",
  (e) => {
    const info = e.requestInfo();
    if (!info.auth) return e.json(401, { message: "Authentication required." });

    const iceServers = [
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.l.google.com:19302" },
    ];

    const turnUrl = $os.getenv("EXPRESSTURN_URL");
    const turnUser = $os.getenv("EXPRESSTURN_USERNAME");
    const turnPass = $os.getenv("EXPRESSTURN_PASSWORD");
    if (turnUrl && turnUser && turnPass) {
      iceServers.push({ urls: turnUrl, username: turnUser, credential: turnPass });
      iceServers.push({ urls: turnUrl + "?transport=tcp", username: turnUser, credential: turnPass });
    }

    return e.json(200, { iceServers: iceServers });
  },
  $apis.requireAuth()
);
