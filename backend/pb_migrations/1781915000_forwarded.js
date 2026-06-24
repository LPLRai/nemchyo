/// <reference path="../pb_data/types.d.ts" />

// `forwarded` flag on messages so the UI can show a "Forwarded" label.
migrate(
  (app) => {
    const m = app.findCollectionByNameOrId('messages');
    m.fields.add(new Field({ type: 'bool', name: 'forwarded' }));
    app.save(m);
  },
  (app) => {
    const m = app.findCollectionByNameOrId('messages');
    try {
      m.fields.removeByName('forwarded');
    } catch (e) {}
    app.save(m);
  }
);
