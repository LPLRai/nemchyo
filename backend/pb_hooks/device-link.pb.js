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
