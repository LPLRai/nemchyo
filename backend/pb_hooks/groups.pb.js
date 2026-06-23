/// <reference path="../pb_data/types.d.ts" />

// POST /api/delete-chat (authed): permanently delete a group/announcement chat.
// Only the chat's owner or an admin may do this. Deleting the chat cascades to
// its members, messages, pins, etc. via the relation cascade rules.
routerAdd(
  "POST",
  "/api/delete-chat",
  (e) => {
    const info = e.requestInfo();
    const auth = info.auth;
    if (!auth) return e.json(401, { message: "Authentication required." });

    const chatId = ((info.body || {}).chat || "").toString();
    if (!chatId) return e.json(400, { message: "Missing chat." });

    let chat;
    try {
      chat = $app.findRecordById("chats", chatId);
    } catch (err) {
      return e.json(404, { message: "Chat not found." });
    }

    // the family chat is the core room — don't allow deleting it here
    if (chat.getString("type") === "family") {
      return e.json(400, { message: "The family chat can't be deleted." });
    }

    let mem;
    try {
      mem = $app.findFirstRecordByFilter("chat_members", "chat = {:c} && user = {:u}", { c: chatId, u: auth.id });
    } catch (err) {
      return e.json(403, { message: "You are not a member of this chat." });
    }
    const role = mem.getString("role");
    if (role !== "owner" && role !== "admin") {
      return e.json(403, { message: "Only the group owner or an admin can delete it." });
    }

    $app.delete(chat);
    return e.json(200, { ok: true });
  },
  $apis.requireAuth()
);
