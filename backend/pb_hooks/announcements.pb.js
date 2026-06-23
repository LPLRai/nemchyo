/// <reference path="../pb_data/types.d.ts" />

// Announcement channels: when a chat has admin_only_posting = true, only its
// admins/owners may create messages. Everyone else can read but not post.
// (A collection rule can't tie a member's role to the message sender, so this
// is enforced here.)
onRecordCreateRequest((e) => {
  const rec = e.record;
  const chatId = rec.get("chat");
  if (chatId) {
    let chat = null;
    try {
      chat = $app.findRecordById("chats", chatId);
    } catch (err) {
      chat = null;
    }
    if (chat && chat.getBool("admin_only_posting")) {
      const auth = e.auth;
      let allowed = false;
      if (auth) {
        try {
          const mem = $app.findFirstRecordByFilter(
            "chat_members",
            "chat = {:c} && user = {:u}",
            { c: chatId, u: auth.id }
          );
          const role = mem.getString("role");
          allowed = role === "admin" || role === "owner";
        } catch (err) {
          allowed = false;
        }
      }
      if (!allowed) {
        throw new ForbiddenError("Only admins can post in this announcement channel.");
      }
    }
  }
  e.next();
}, "messages");
