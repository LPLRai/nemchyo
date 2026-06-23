/// <reference path="../pb_data/types.d.ts" />

// Web Push (browser/PWA notifications, incl. iPhone). The actual encrypted send
// happens in the local web-push sidecar (see web-push-service/); here we expose
// the VAPID public key, store subscriptions, and on each message hand the
// recipients' subscriptions to the sidecar.

const WEBPUSH_SIDECAR = "http://127.0.0.1:8092/push";

// GET /api/web-push-key -> { key }  (public) — the client needs it to subscribe.
routerAdd("GET", "/api/web-push-key", (e) => {
  return e.json(200, { key: $os.getenv("NEMCHYO_VAPID_PUBLIC") || "" });
});

// POST /api/register-web-push (authed): upsert this browser's subscription.
routerAdd(
  "POST",
  "/api/register-web-push",
  (e) => {
    const auth = e.requestInfo().auth;
    if (!auth) return e.json(401, { message: "Authentication required." });
    const b = e.requestInfo().body || {};
    const endpoint = (b.endpoint || "").toString();
    const p256dh = (b.p256dh || "").toString();
    const authKey = (b.auth || "").toString();
    if (!endpoint || !p256dh || !authKey) return e.json(400, { message: "Missing subscription." });

    let rec = null;
    try {
      rec = $app.findFirstRecordByFilter("web_subscriptions", "endpoint = {:e}", { e: endpoint });
    } catch (err) {
      rec = null;
    }
    if (!rec) rec = new Record($app.findCollectionByNameOrId("web_subscriptions"));
    rec.set("user", auth.id);
    rec.set("endpoint", endpoint);
    rec.set("p256dh", p256dh);
    rec.set("auth", authKey);
    rec.set("ua", (b.ua || "").toString());
    $app.save(rec);
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);

// On every new message: send Web Push to members' browsers (not sender/muted).
onRecordAfterCreateSuccess((e) => {
  try {
    const msg = e.record;
    const chatId = msg.get("chat");
    const senderId = msg.get("sender");

    function muteActive(s) {
      if (!s) return false;
      const t = Date.parse(String(s).replace(" ", "T"));
      return !isNaN(t) && t > Date.now();
    }

    const subs = [];
    const members = $app.findRecordsByFilter("chat_members", "chat = {:c}", "", 500, 0, { c: chatId });
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const uid = m.get("user");
      if (uid === senderId) continue;
      if (muteActive(m.getString("muted_until"))) continue;
      let ws = [];
      try {
        ws = $app.findRecordsByFilter("web_subscriptions", "user = {:u}", "", 50, 0, { u: uid });
      } catch (err) {}
      for (let j = 0; j < ws.length; j++) {
        subs.push({ endpoint: ws[j].getString("endpoint"), p256dh: ws[j].getString("p256dh"), auth: ws[j].getString("auth") });
      }
    }
    if (subs.length === 0) {
      e.next();
      return;
    }

    let senderName = "Someone";
    try {
      senderName = $app.findRecordById("users", senderId).getString("display_name") || "Someone";
    } catch (err) {}
    let chatType = "group";
    let chatName = "Nemchyo";
    try {
      const c = $app.findRecordById("chats", chatId);
      chatType = c.getString("type");
      chatName = c.getString("name") || "Nemchyo";
    } catch (err) {}

    const mtype = msg.getString("type");
    let preview = msg.getString("body");
    if (mtype === "image") preview = "📷 Photo";
    else if (mtype === "file") preview = "📄 " + (msg.getString("file_name") || "File");
    if (!preview) preview = "New message";

    const isDirect = chatType === "direct";
    const title = isDirect ? senderName : chatName;
    const body = isDirect ? preview : senderName + ": " + preview;

    try {
      $http.send({
        url: WEBPUSH_SIDECAR,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptions: subs, title: title, body: body, data: { chatId: chatId } }),
        timeout: 15,
      });
    } catch (err) {
      $app.logger().error("nemchyo web-push sidecar send failed: " + String(err));
    }
  } catch (err) {
    $app.logger().error("nemchyo web-push hook error: " + String(err));
  }
  e.next();
}, "messages");
