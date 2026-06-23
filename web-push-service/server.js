// Nemchyo web-push sidecar.
//
// PocketBase's JS hooks can't do the ECDSA/AES-GCM crypto the Web Push protocol
// needs, so this tiny localhost service does it. The PocketBase message hook
// POSTs recipients' browser subscriptions here, and this sends the encrypted
// push to Apple/Google/Mozilla's push endpoints via the `web-push` library.
//
// Env:
//   NEMCHYO_VAPID_PUBLIC   VAPID public key  (also exposed to clients by PB)
//   NEMCHYO_VAPID_PRIVATE  VAPID private key (secret — only here)
//   NEMCHYO_VAPID_SUBJECT  mailto:you@example.com  (contact for push services)
//   WEBPUSH_PORT           default 8092 (localhost only)
//
// Generate keys once with:  npm run gen-keys

const http = require('http');
const webpush = require('web-push');

const PORT = parseInt(process.env.WEBPUSH_PORT || '8092', 10);
const PUB = process.env.NEMCHYO_VAPID_PUBLIC;
const PRIV = process.env.NEMCHYO_VAPID_PRIVATE;
const SUBJECT = process.env.NEMCHYO_VAPID_SUBJECT || 'mailto:admin@sixfriendstrekking.com';

if (!PUB || !PRIV) {
  console.error('[web-push] Missing NEMCHYO_VAPID_PUBLIC / NEMCHYO_VAPID_PRIVATE');
  process.exit(1);
}
webpush.setVapidDetails(SUBJECT, PUB, PRIV);

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === 'POST' && req.url === '/push') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400);
        return res.end('bad json');
      }
      const subs = Array.isArray(payload.subscriptions) ? payload.subscriptions : [];
      const data = JSON.stringify({ title: payload.title || 'Nemchyo', body: payload.body || '', data: payload.data || {} });

      const results = await Promise.allSettled(
        subs.map((s) =>
          // wrap so a synchronous throw (e.g. malformed key) becomes a rejection
          Promise.resolve().then(() =>
            webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data)
          )
        )
      );

      // endpoints the push service says are gone (expired/unsubscribed)
      const gone = [];
      results.forEach((r, i) => {
        if (r.status === 'rejected' && (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)) {
          gone.push(subs[i].endpoint);
        }
      });
      const sent = results.filter((r) => r.status === 'fulfilled').length;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sent, gone }));
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => console.log(`[web-push] listening on 127.0.0.1:${PORT}`));
