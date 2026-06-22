/// <reference path="../pb_data/types.d.ts" />

// Polls (blueprint phase 6): a poll rides in the chat timeline as a message of
// type "poll". `polls` holds the question, `poll_options` the choices, and
// `poll_votes` who voted for what. Access is gated by membership of the poll's
// chat (via the message relation), so polls inherit the chat's privacy.
migrate(
  (app) => {
    // 1) allow the "poll" message type
    const messages = app.findCollectionByNameOrId('messages');
    const typeField = messages.fields.getByName('type');
    const vals = typeField.values || [];
    if (vals.indexOf('poll') === -1) typeField.values = vals.concat(['poll']);
    app.save(messages);

    const users = app.findCollectionByNameOrId('users');

    const memberOfPollChat = 'message.chat.chat_members_via_chat.user ?= @request.auth.id';

    // 2) polls
    const polls = new Collection({
      type: 'base',
      name: 'polls',
      fields: [
        { type: 'relation', name: 'message', required: true, maxSelect: 1, collectionId: messages.id, cascadeDelete: true },
        { type: 'text', name: 'question', required: true, max: 300 },
        { type: 'bool', name: 'multiple' },
        { type: 'date', name: 'closes_at' },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      listRule: '@request.auth.id != "" && ' + memberOfPollChat,
      viewRule: '@request.auth.id != "" && ' + memberOfPollChat,
      createRule: '@request.auth.id != "" && message.sender = @request.auth.id',
      updateRule: '@request.auth.id != "" && message.sender = @request.auth.id',
      deleteRule: '@request.auth.id != "" && message.sender = @request.auth.id',
    });
    app.save(polls);

    const memberOfOptChat = 'poll.message.chat.chat_members_via_chat.user ?= @request.auth.id';

    // 3) poll_options
    const options = new Collection({
      type: 'base',
      name: 'poll_options',
      fields: [
        { type: 'relation', name: 'poll', required: true, maxSelect: 1, collectionId: polls.id, cascadeDelete: true },
        { type: 'text', name: 'text', required: true, max: 200 },
        { type: 'number', name: 'order' },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      listRule: '@request.auth.id != "" && ' + memberOfOptChat,
      viewRule: '@request.auth.id != "" && ' + memberOfOptChat,
      createRule: '@request.auth.id != "" && poll.message.sender = @request.auth.id',
      updateRule: null,
      deleteRule: '@request.auth.id != "" && poll.message.sender = @request.auth.id',
    });
    app.save(options);

    // 4) poll_votes (one vote per option per user; single-choice handled client-side)
    const votes = new Collection({
      type: 'base',
      name: 'poll_votes',
      fields: [
        { type: 'relation', name: 'poll', required: true, maxSelect: 1, collectionId: polls.id, cascadeDelete: true },
        { type: 'relation', name: 'option', required: true, maxSelect: 1, collectionId: options.id, cascadeDelete: true },
        { type: 'relation', name: 'user', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_poll_votes_unique` ON `poll_votes` (`option`, `user`)'],
      listRule: '@request.auth.id != "" && ' + memberOfOptChat,
      viewRule: '@request.auth.id != "" && ' + memberOfOptChat,
      createRule: '@request.auth.id != "" && user = @request.auth.id && ' + memberOfOptChat,
      updateRule: null,
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    });
    app.save(votes);
  },
  (app) => {
    for (const n of ['poll_votes', 'poll_options', 'polls']) {
      try {
        app.delete(app.findCollectionByNameOrId(n));
      } catch (e) {}
    }
    try {
      const messages = app.findCollectionByNameOrId('messages');
      const typeField = messages.fields.getByName('type');
      typeField.values = (typeField.values || []).filter((v) => v !== 'poll');
      app.save(messages);
    } catch (e) {}
  }
);
