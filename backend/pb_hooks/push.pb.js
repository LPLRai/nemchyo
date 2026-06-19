/// <reference path="../pb_data/types.d.ts" />

// POST /api/register-device (authed): upsert this device's Expo push token.
routerAdd(
  "POST",
  "/api/register-device",
  (e) => {
    const info = e.requestInfo();
    const auth = info.auth;
    if (!auth) return e.json(401, { message: "Authentication required." });
    const body = info.body || {};
    const token = (body.token || "").toString().trim();
    if (!token) return e.json(400, { message: "Missing token." });
    const platform = (body.platform || "android").toString();

    let dev = null;
    try {
      dev = $app.findFirstRecordByFilter("devices", "token = {:t}", { t: token });
    } catch (err) {
      dev = null;
    }
    if (dev) {
      dev.set("user", auth.id);
      dev.set("platform", platform);
      $app.save(dev);
    } else {
      dev = new Record($app.findCollectionByNameOrId("devices"));
      dev.set("user", auth.id);
      dev.set("token", token);
      dev.set("platform", platform);
      $app.save(dev);
    }
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);

// POST /api/push-debug (authed): who WOULD receive a push for this chat
// (members minus you minus muted, that have a device). For verification.
routerAdd(
  "POST",
  "/api/push-debug",
  (e) => {
    const info = e.requestInfo();
    const auth = info.auth;
    if (!auth) return e.json(401, { message: "Authentication required." });
    const chatId = ((info.body || {}).chatId || "").toString();

    function muteActive(s) {
      if (!s) return false;
      const t = Date.parse(String(s).replace(" ", "T"));
      return !isNaN(t) && t > Date.now();
    }

    const recips = [];
    const members = $app.findRecordsByFilter("chat_members", "chat = {:c}", "", 500, 0, { c: chatId });
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const uid = m.get("user");
      if (uid === auth.id) continue;
      if (muteActive(m.getString("muted_until"))) continue;
      let devs = [];
      try {
        devs = $app.findRecordsByFilter("devices", "user = {:u}", "", 50, 0, { u: uid });
      } catch (err) {}
      for (let j = 0; j < devs.length; j++) recips.push({ user: uid, token: devs[j].getString("token") });
    }
    return e.json(200, { count: recips.length, recipients: recips });
  },
  $apis.requireAuth()
);

// On every new message: push to chat members (not the sender, not muted).
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

    const tokens = [];
    const members = $app.findRecordsByFilter("chat_members", "chat = {:c}", "", 500, 0, { c: chatId });
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const uid = m.get("user");
      if (uid === senderId) continue;
      if (muteActive(m.getString("muted_until"))) continue;
      let devs = [];
      try {
        devs = $app.findRecordsByFilter("devices", "user = {:u}", "", 50, 0, { u: uid });
      } catch (err) {}
      for (let j = 0; j < devs.length; j++) tokens.push(devs[j].getString("token"));
    }

    if (tokens.length > 0) {
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

      const payload = [];
      for (let k = 0; k < tokens.length; k++) {
        payload.push({
          to: tokens[k],
          title: title,
          body: body,
          sound: "default",
          channelId: "messages",
          priority: "high",
          collapseId: chatId,
          data: { chatId: chatId },
        });
      }

      try {
        $http.send({
          url: "https://exp.host/--/api/v2/push/send",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          timeout: 20,
        });
      } catch (err) {
        $app.logger().error("nemchyo push send failed: " + String(err));
      }
    }
  } catch (err) {
    $app.logger().error("nemchyo push hook error: " + String(err));
  }
  e.next();
}, "messages");
