/// <reference path="../pb_data/types.d.ts" />

// POST /api/device-link/create (authed) -> { code, expiresAt }
// A signed-in device generates a short code another device can redeem to sign
// in as the same account. Valid for 10 minutes, single use.
routerAdd(
  "POST",
  "/api/device-link/create",
  (e) => {
    const auth = e.requestInfo().auth;
    if (!auth) return e.json(401, { message: "Authentication required." });

    // Friendly alphabet (no 0/O/1/I/L) so it's easy to read and type.
    const code = $security.randomStringWithAlphabet(6, "ABCDEFGHJKMNPQRSTUVWXYZ23456789");
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const rec = new Record($app.findCollectionByNameOrId("device_links"));
    rec.set("code", code);
    rec.set("user", auth.id);
    rec.set("expires", expires);
    rec.set("used", false);
    $app.save(rec);

    return e.json(200, { code: code, expiresAt: expires });
  },
  $apis.requireAuth()
);

// POST /api/device-link/create-for (authed, family admin) -> { code, expiresAt }
// Account recovery: a family owner/admin mints a sign-in code FOR another member
// who has lost their only device (their account has a random password they never
// knew, so this is the only way back into the SAME account / history).
routerAdd(
  "POST",
  "/api/device-link/create-for",
  (e) => {
    const auth = e.requestInfo().auth;
    if (!auth) return e.json(401, { message: "Authentication required." });

    // Requester must be owner/admin of a "family" chat.
    let isAdmin = false;
    try {
      const fams = $app.findRecordsByFilter("chats", "type = 'family'");
      for (let i = 0; i < fams.length && !isAdmin; i++) {
        try {
          const m = $app.findFirstRecordByFilter("chat_members", "chat = {:c} && user = {:u}", { c: fams[i].id, u: auth.id });
          const r = m.getString("role");
          if (r === "owner" || r === "admin") isAdmin = true;
        } catch (err) {}
      }
    } catch (err) {}
    if (!isAdmin) return e.json(403, { message: "Only a family admin can do this." });

    const targetId = ((e.requestInfo().body || {}).user || "").toString();
    if (!targetId) return e.json(400, { message: "Missing user." });
    try {
      $app.findRecordById("users", targetId);
    } catch (err) {
      return e.json(404, { message: "That member no longer exists." });
    }

    const code = $security.randomStringWithAlphabet(6, "ABCDEFGHJKMNPQRSTUVWXYZ23456789");
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min for recovery

    const rec = new Record($app.findCollectionByNameOrId("device_links"));
    rec.set("code", code);
    rec.set("user", targetId);
    rec.set("expires", expires);
    rec.set("used", false);
    $app.save(rec);

    return e.json(200, { code: code, expiresAt: expires });
  },
  $apis.requireAuth()
);

// POST /api/device-link/redeem (public) -> standard auth response { token, record }
// Consumes a code and signs the caller in as that account — no password needed.
routerAdd("POST", "/api/device-link/redeem", (e) => {
  const body = e.requestInfo().body || {};
  const code = (body.code || "").toString().trim().toUpperCase();
  if (!code) return e.json(400, { message: "Enter your link code." });

  let link;
  try {
    link = $app.findFirstRecordByFilter("device_links", "code = {:c} && used = false", { c: code });
  } catch (err) {
    return e.json(400, { message: "That code is invalid or has already been used." });
  }

  const expMs = Date.parse(String(link.getString("expires")).replace(" ", "T"));
  if (isNaN(expMs) || expMs < Date.now()) {
    return e.json(400, { message: "That code has expired. Generate a new one." });
  }

  let user;
  try {
    user = $app.findRecordById("users", link.getString("user"));
  } catch (err) {
    return e.json(404, { message: "Account not found." });
  }

  link.set("used", true);
  $app.save(link);

  return $apis.recordAuthResponse(e, user, "device-link", null);
});
