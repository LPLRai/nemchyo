/// <reference path="../pb_data/types.d.ts" />

// POST /api/create-invite  (authed admin) -> { code }
// Generates a one-time invite code an admin can turn into a link/QR.
routerAdd(
  "POST",
  "/api/create-invite",
  (e) => {
    const info = e.requestInfo();
    const auth = info.auth;
    if (!auth) return e.json(401, { message: "Authentication required." });

    const body = info.body || {};
    const code = $security.randomString(10);

    const col = $app.findCollectionByNameOrId("invites");
    const rec = new Record(col);
    rec.set("code", code);
    rec.set("display_name", body.displayName || "");
    rec.set("email", body.email || "");
    rec.set("role", body.role || "member");
    rec.set("consumed", false);
    // created_by only applies when a regular user (not a superuser) generated it
    try {
      if (auth.collection && auth.collection().name === "users") {
        rec.set("created_by", auth.id);
      }
    } catch (err) {
      /* superuser — skip created_by */
    }
    $app.save(rec);

    return e.json(200, { code: code });
  },
  $apis.requireAuth()
);

// POST /api/redeem-invite  (public) -> standard auth response { token, record }
// Consumes an invite, creates the user, and logs them in — no password typed.
routerAdd("POST", "/api/redeem-invite", (e) => {
  const info = e.requestInfo();
  const body = info.body || {};
  const code = (body.code || "").toString().trim();
  if (!code) return e.json(400, { message: "Missing invite code." });

  let invite;
  try {
    invite = $app.findFirstRecordByFilter(
      "invites",
      "code = {:code} && consumed = false",
      { code: code }
    );
  } catch (err) {
    return e.json(404, { message: "This invite is invalid or has already been used." });
  }

  // create the new user account
  const users = $app.findCollectionByNameOrId("users");
  const user = new Record(users);
  const email = invite.getString("email") || code.toLowerCase() + "@nemchyo.invite";
  user.set("email", email);
  user.set("emailVisibility", false);
  user.set("verified", true);
  user.set(
    "display_name",
    body.displayName || invite.getString("display_name") || "Family member"
  );
  user.set("presence_public", true);
  user.set("read_receipts_public", true);
  user.setPassword($security.randomString(40)); // random; the relative never needs it
  $app.save(user);

  // auto-join any "Whole Family" chats
  try {
    const fams = $app.findRecordsByFilter("chats", "type = 'family'");
    const memberCol = $app.findCollectionByNameOrId("chat_members");
    for (let i = 0; i < fams.length; i++) {
      const m = new Record(memberCol);
      m.set("chat", fams[i].id);
      m.set("user", user.id);
      m.set("role", "member");
      $app.save(m);
    }
  } catch (err) {
    /* no family chat yet — fine */
  }

  // mark the invite used
  invite.set("consumed", true);
  invite.set("consumed_by", user.id);
  $app.save(invite);

  // issue a long-lived auth token (token + record) just like a normal login
  return $apis.recordAuthResponse(e, user, "invite", null);
});
