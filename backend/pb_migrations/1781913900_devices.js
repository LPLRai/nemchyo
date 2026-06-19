/// <reference path="../pb_data/types.d.ts" />

// Device push tokens (one row per device) — powers push notifications.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const devices = new Collection({
    type: "base",
    name: "devices",
    fields: [
      { type: "relation", name: "user", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: "text", name: "token", required: true, max: 255 },
      { type: "select", name: "platform", maxSelect: 1, values: ["android", "ios", "web"] },
      { type: "autodate", name: "last_active", onCreate: true, onUpdate: true },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_devices_token` ON `devices` (`token`)"],
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
  });
  app.save(devices);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("devices")); } catch (e) {}
});
