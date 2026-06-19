/// <reference path="../pb_data/types.d.ts" />

// Chat polish: reply-to (self relation on messages) + reactions collection.
migrate((app) => {
  const messages = app.findCollectionByNameOrId("messages");
  const users = app.findCollectionByNameOrId("users");

  // reply/quote: a message can reference another message in the same chat
  messages.fields.add(
    new Field({ type: "relation", name: "reply_to", maxSelect: 1, collectionId: messages.id, cascadeDelete: false })
  );
  app.save(messages);

  const reactions = new Collection({
    type: "base",
    name: "reactions",
    fields: [
      { type: "relation", name: "message", required: true, maxSelect: 1, collectionId: messages.id, cascadeDelete: true },
      { type: "relation", name: "user", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: "text", name: "emoji", required: true, max: 16 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_reactions_unique` ON `reactions` (`message`, `user`, `emoji`)"],
    // visible to members of the message's chat; you can only add/remove your own
    listRule: '@request.auth.id != "" && message.chat.chat_members_via_chat.user ?= @request.auth.id',
    viewRule: '@request.auth.id != "" && message.chat.chat_members_via_chat.user ?= @request.auth.id',
    createRule:
      '@request.auth.id != "" && user = @request.auth.id && message.chat.chat_members_via_chat.user ?= @request.auth.id',
    updateRule: null,
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
  });
  app.save(reactions);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("reactions")); } catch (e) {}
  try {
    const m = app.findCollectionByNameOrId("messages");
    m.fields.removeByName("reply_to");
    app.save(m);
  } catch (e) {}
});
