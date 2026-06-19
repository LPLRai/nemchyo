/// <reference path="../pb_data/types.d.ts" />

// Phase 1 MVP schema: extends the default `users` auth collection and adds
// `chats`, `chat_members`, `messages`. Membership-based access rules are applied
// at the end (once back-relations like `chat_members_via_chat` exist).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  // ---- 1) extend default `users` with profile fields -----------------------
  users.fields.add(new Field({ type: "text",   name: "display_name", max: 100 }));
  users.fields.add(new Field({ type: "editor", name: "about" }));
  users.fields.add(new Field({ type: "date",   name: "last_seen" }));
  users.fields.add(new Field({ type: "bool",   name: "presence_public" }));
  users.fields.add(new Field({ type: "bool",   name: "read_receipts_public" }));
  app.save(users);

  // ---- 2) chats (rules set in step 5 once back-relations exist) ------------
  const chats = new Collection({
    type: "base",
    name: "chats",
    fields: [
      { type: "text",     name: "name", max: 200 },
      { type: "editor",   name: "description" },
      { type: "select",   name: "type", required: true, maxSelect: 1,
        values: ["direct", "group", "family", "announcement"] },
      { type: "file",     name: "photo", maxSelect: 1, maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
      { type: "bool",     name: "admin_only_posting" },
      { type: "relation", name: "created_by", required: true, maxSelect: 1,
        collectionId: users.id, cascadeDelete: false },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    // temporary permissive rules; tightened in step 5
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: null,
  });
  app.save(chats);

  // ---- 3) chat_members -----------------------------------------------------
  const members = new Collection({
    type: "base",
    name: "chat_members",
    fields: [
      { type: "relation", name: "chat", required: true, maxSelect: 1,
        collectionId: chats.id, cascadeDelete: true },
      { type: "relation", name: "user", required: true, maxSelect: 1,
        collectionId: users.id, cascadeDelete: true },
      { type: "select",   name: "role", required: true, maxSelect: 1,
        values: ["member", "admin", "owner"] },
      { type: "date",     name: "last_read_at" },
      { type: "date",     name: "muted_until" },
      { type: "bool",     name: "pinned" },
      { type: "bool",     name: "archived" },
      { type: "text",     name: "draft" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_chat_members_unique` ON `chat_members` (`chat`, `user`)",
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  app.save(members);

  // ---- 4) messages ---------------------------------------------------------
  const messages = new Collection({
    type: "base",
    name: "messages",
    fields: [
      { type: "relation", name: "chat", required: true, maxSelect: 1,
        collectionId: chats.id, cascadeDelete: true },
      { type: "relation", name: "sender", required: true, maxSelect: 1,
        collectionId: users.id, cascadeDelete: false },
      { type: "select",   name: "type", required: true, maxSelect: 1,
        values: ["text", "image", "video", "voice", "audio", "file", "system"] },
      { type: "text",     name: "body" },
      { type: "date",     name: "edited_at" },
      { type: "bool",     name: "deleted_for_everyone" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX `idx_messages_chat_created` ON `messages` (`chat`, `created`)",
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  app.save(messages);

  // ---- 5) membership-based access rules ------------------------------------
  // You can only see/act on chats you are a member of; admin/owner gates writes.
  const c = app.findCollectionByNameOrId("chats");
  c.listRule   = '@request.auth.id != "" && chat_members_via_chat.user ?= @request.auth.id';
  c.viewRule   = '@request.auth.id != "" && chat_members_via_chat.user ?= @request.auth.id';
  c.createRule = '@request.auth.id != "" && created_by = @request.auth.id';
  c.updateRule = '@request.auth.id != "" && chat_members_via_chat.user ?= @request.auth.id && chat_members_via_chat.role ?~ "admin|owner"';
  c.deleteRule = '@request.auth.id != "" && chat_members_via_chat.user ?= @request.auth.id && chat_members_via_chat.role = "owner"';
  app.save(c);

  const m = app.findCollectionByNameOrId("chat_members");
  m.listRule   = '@request.auth.id != "" && chat.chat_members_via_chat.user ?= @request.auth.id';
  m.viewRule   = '@request.auth.id != "" && chat.chat_members_via_chat.user ?= @request.auth.id';
  m.createRule = '@request.auth.id != ""';
  m.updateRule = '@request.auth.id != "" && user = @request.auth.id';
  m.deleteRule = '@request.auth.id != "" && user = @request.auth.id';
  app.save(m);

  const msg = app.findCollectionByNameOrId("messages");
  msg.listRule   = '@request.auth.id != "" && chat.chat_members_via_chat.user ?= @request.auth.id';
  msg.viewRule   = '@request.auth.id != "" && chat.chat_members_via_chat.user ?= @request.auth.id';
  msg.createRule = '@request.auth.id != "" && sender = @request.auth.id && chat.chat_members_via_chat.user ?= @request.auth.id';
  msg.updateRule = '@request.auth.id != "" && sender = @request.auth.id';
  msg.deleteRule = '@request.auth.id != "" && sender = @request.auth.id';
  app.save(msg);
}, (app) => {
  // ---- revert --------------------------------------------------------------
  for (const n of ["messages", "chat_members", "chats"]) {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (e) {}
  }
  try {
    const users = app.findCollectionByNameOrId("users");
    for (const f of ["display_name", "about", "last_seen", "presence_public", "read_receipts_public"]) {
      try { users.fields.removeByName(f); } catch (e) {}
    }
    app.save(users);
  } catch (e) {}
});
