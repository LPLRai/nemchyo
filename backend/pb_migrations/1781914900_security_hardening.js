/// <reference path="../pb_data/types.d.ts" />

// Security hardening (audit findings):
//  1. chat_members.createRule was `@request.auth.id != ""` — ANY logged-in user
//     could create a membership in ANY chat with ANY role, i.e. self-insert as
//     owner of the family chat and then take over any account via the recovery
//     endpoint, or join private DMs. Restrict creation to the chat's creator
//     (the only client path that creates memberships; the invite auto-join uses
//     $app.save which bypasses rules).
//  2. invites was world-readable/writable by any member (codes + emails leaked).
//     The client only ever touches invites through the create-/redeem-invite
//     hooks (which use $app, bypassing rules), so lock the collection entirely.
migrate(
  (app) => {
    const cm = app.findCollectionByNameOrId('chat_members');
    cm.createRule = '@request.auth.id != "" && chat.created_by = @request.auth.id';
    app.save(cm);

    const inv = app.findCollectionByNameOrId('invites');
    inv.listRule = null;
    inv.viewRule = null;
    inv.createRule = null;
    inv.updateRule = null;
    inv.deleteRule = null;
    app.save(inv);
  },
  (app) => {
    const cm = app.findCollectionByNameOrId('chat_members');
    cm.createRule = '@request.auth.id != ""';
    app.save(cm);

    const inv = app.findCollectionByNameOrId('invites');
    inv.listRule = '@request.auth.id != ""';
    inv.viewRule = '@request.auth.id != ""';
    inv.createRule = '@request.auth.id != ""';
    inv.updateRule = '@request.auth.id != ""';
    inv.deleteRule = '@request.auth.id != ""';
    app.save(inv);
  }
);
