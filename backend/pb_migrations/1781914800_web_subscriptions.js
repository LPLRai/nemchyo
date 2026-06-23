/// <reference path="../pb_data/types.d.ts" />

// Browser Web Push subscriptions (one per browser/PWA install). Used to notify
// family members who use the web/PWA — e.g. iPhone, which can't get the Expo
// (FCM) push the Android app uses. Hook-only access, so all rules are locked.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const col = new Collection({
      type: 'base',
      name: 'web_subscriptions',
      fields: [
        { type: 'relation', name: 'user', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: 'text', name: 'endpoint', required: true, max: 600 },
        { type: 'text', name: 'p256dh', required: true, max: 300 },
        { type: 'text', name: 'auth', required: true, max: 300 },
        { type: 'text', name: 'ua', max: 400 },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_websub_endpoint` ON `web_subscriptions` (`endpoint`)'],
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
      app.delete(app.findCollectionByNameOrId('web_subscriptions'));
    } catch (e) {}
  }
);
