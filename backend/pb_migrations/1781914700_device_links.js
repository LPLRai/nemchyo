/// <reference path="../pb_data/types.d.ts" />

// Device linking: a signed-in device mints a short, short-lived code; a new
// device redeems it for its own auth token (WhatsApp-style linked devices).
// Since invited accounts have a random password the user never knows, this is
// how the same person signs in on a second phone or in a browser.
//
// Only the hooks touch this collection (via $app, which bypasses API rules), so
// every rule is locked.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const col = new Collection({
      type: 'base',
      name: 'device_links',
      fields: [
        { type: 'text', name: 'code', required: true, max: 20 },
        { type: 'relation', name: 'user', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: 'date', name: 'expires', required: true },
        { type: 'bool', name: 'used' },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX `idx_device_links_code` ON `device_links` (`code`)'],
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
    app.save(col);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('device_links'));
    } catch (e) {}
  }
);
