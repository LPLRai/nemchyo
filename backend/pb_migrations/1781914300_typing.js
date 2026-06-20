/// <reference path="../pb_data/types.d.ts" />

// Typing indicators: a short-lived "typing until" timestamp a member sets while
// composing. Read receipts reuse the existing chat_members.last_read_at field,
// so no new field is needed for those.
migrate(
  (app) => {
    const m = app.findCollectionByNameOrId('chat_members');
    m.fields.add(new Field({ type: 'date', name: 'typing_until' }));
    app.save(m);
  },
  (app) => {
    const m = app.findCollectionByNameOrId('chat_members');
    try {
      m.fields.removeByName('typing_until');
    } catch (e) {}
    app.save(m);
  }
);
