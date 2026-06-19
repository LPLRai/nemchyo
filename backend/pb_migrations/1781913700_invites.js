/// <reference path="../pb_data/types.d.ts" />

// Invite-based onboarding: an admin generates an invite (code), the relative
// redeems it via POST /api/redeem-invite (see pb_hooks/invites.pb.js) and is
// logged in with a long-lived token — never typing a password.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const invites = new Collection({
    type: "base",
    name: "invites",
    fields: [
      { type: "text", name: "code", required: true, min: 6, max: 64 },
      { type: "text", name: "display_name", max: 100 },
      { type: "text", name: "email", max: 255 },
      { type: "select", name: "role", maxSelect: 1, values: ["member", "admin", "owner"] },
      { type: "date", name: "expires" },
      { type: "bool", name: "consumed" },
      { type: "relation", name: "consumed_by", maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: "relation", name: "created_by", maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_invites_code` ON `invites` (`code`)"],
    // Only authed users (admins) manage invites directly; redemption is a public hook.
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  app.save(invites);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("invites")); } catch (e) {}
});
