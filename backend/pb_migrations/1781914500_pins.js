/// <reference path="../pb_data/types.d.ts" />

// Pinned messages: any member can pin a message to the chat, and everyone in
// the chat sees it in the pinned bar. A separate collection keeps pinning
// chat-scoped without loosening the messages updateRule (which is sender-only).
migrate(
  (app) => {
    const chats = app.findCollectionByNameOrId('chats');
    const messages = app.findCollectionByNameOrId('messages');
    const users = app.findCollectionByNameOrId('users');
    const member = 'chat.chat_members_via_chat.user ?= @request.auth.id';

    const pins = new Collection({
      type: 'base',
      name: 'pins',
      fields: [
        { type: 'relation', name: 'chat', required: true, maxSelect: 1, collectionId: chats.id, cascadeDelete: true },
        { type: 'relation', name: 'message', required: true, maxSelect: 1, collectionId: messages.id, cascadeDelete: true },
        { type: 'relation', name: 'pinned_by', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_pins_unique` ON `pins` (`chat`, `message`)'],
      listRule: '@request.auth.id != "" && ' + member,
      viewRule: '@request.auth.id != "" && ' + member,
      createRule: '@request.auth.id != "" && pinned_by = @request.auth.id && ' + member,
      updateRule: null,
      deleteRule: '@request.auth.id != "" && ' + member,
    });
    app.save(pins);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('pins'));
    } catch (e) {}
  }
);
