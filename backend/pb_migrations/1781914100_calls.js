/// <reference path="../pb_data/types.d.ts" />

// 1-to-1 voice/video calls: a `calls` record tracks the call lifecycle, and
// `call_signals` carries the WebRTC handshake (offer/answer/ICE) between the
// two peers over PocketBase realtime.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const chats = app.findCollectionByNameOrId("chats");

  const calls = new Collection({
    type: "base",
    name: "calls",
    fields: [
      { type: "relation", name: "chat", maxSelect: 1, collectionId: chats.id, cascadeDelete: true },
      { type: "relation", name: "caller", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: "relation", name: "callee", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: "select", name: "kind", required: true, maxSelect: 1, values: ["audio", "video"] },
      { type: "select", name: "status", required: true, maxSelect: 1, values: ["ringing", "ongoing", "ended", "missed", "declined"] },
      { type: "date", name: "started" },
      { type: "date", name: "ended" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    listRule: '@request.auth.id != "" && (caller = @request.auth.id || callee = @request.auth.id)',
    viewRule: '@request.auth.id != "" && (caller = @request.auth.id || callee = @request.auth.id)',
    createRule: '@request.auth.id != "" && caller = @request.auth.id',
    updateRule: '@request.auth.id != "" && (caller = @request.auth.id || callee = @request.auth.id)',
    deleteRule: null,
  });
  app.save(calls);

  const signals = new Collection({
    type: "base",
    name: "call_signals",
    fields: [
      { type: "relation", name: "call", required: true, maxSelect: 1, collectionId: calls.id, cascadeDelete: true },
      { type: "relation", name: "from", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: "relation", name: "to", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: "select", name: "type", required: true, maxSelect: 1, values: ["offer", "answer", "candidate", "hangup"] },
      { type: "json", name: "payload", maxSize: 100000 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE INDEX `idx_call_signals_to` ON `call_signals` (`to`, `created`)"],
    listRule: '@request.auth.id != "" && (from = @request.auth.id || to = @request.auth.id)',
    viewRule: '@request.auth.id != "" && (from = @request.auth.id || to = @request.auth.id)',
    createRule: '@request.auth.id != "" && from = @request.auth.id',
    updateRule: null,
    deleteRule: '@request.auth.id != "" && from = @request.auth.id',
  });
  app.save(signals);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("call_signals")); } catch (e) {}
  try { app.delete(app.findCollectionByNameOrId("calls")); } catch (e) {}
});
