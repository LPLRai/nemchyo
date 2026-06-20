/// <reference path="../pb_data/types.d.ts" />

// Profiles: let signed-in family members see each other's profile (display name
// + the built-in `avatar` file field). List/view were previously locked to
// "id = @request.auth.id", which is why other people showed up as "Member" and
// incoming calls couldn't show the caller's name. Editing stays restricted to
// your own record (updateRule is left untouched). Email stays private unless a
// user opts in (PocketBase hides it via emailVisibility, default false).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = '@request.auth.id != ""';
    users.viewRule = '@request.auth.id != ""';
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = 'id = @request.auth.id';
    users.viewRule = 'id = @request.auth.id';
    app.save(users);
  }
);
