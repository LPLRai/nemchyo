# Nemchyo — Server Deployment Runbook

Goal: get the backend live at **https://chat.sixfriendstrekking.com** on your Ubuntu laptop, reachable by the family through the Cloudflare tunnel (DNS already migrated ✅).

You run these on the **Ubuntu server**; paste outputs back to me if anything looks off. Replace `<you>` with your Linux username (find it with `whoami`).

> The schema is rebuilt fresh from `pb_migrations/` on the server — **no dev/test data is copied over.** You'll create a fresh admin + real family accounts.

---

## Step 0 — Architecture + base prep
```bash
uname -m   # x86_64 = amd64  ·  aarch64 = arm64  (tell me which)
sudo apt update && sudo apt -y upgrade
sudo apt -y install git unzip curl ufw fail2ban unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades   # auto security updates
```
Keep the lid-open server awake:
```bash
sudo sed -i 's/#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
```
Firewall — no inbound ports needed (the tunnel is outbound); allow SSH on LAN only:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.0.0/16 to any port 22 proto tcp
sudo ufw enable
sudo systemctl enable --now fail2ban
```

## Step 1 — Get the code (your GitHub repo)
```bash
cd ~
git clone https://github.com/LPLRai/nemchyo.git
```
- **Private repo:** when prompted, username = `LPLRai`, password = a **GitHub Personal Access Token** (GitHub → Settings → Developer settings → *Fine-grained tokens* → Generate → repo access: `nemchyo`, Contents: **Read** → copy the token). Public repo: it just clones, no prompt.

## Step 2 — Pocketbase (pin v0.39.4 to match the migrations)
```bash
mkdir -p ~/nemchyo-server && cd ~/nemchyo-server
# amd64 (x86_64):
curl -L -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.39.4/pocketbase_0.39.4_linux_amd64.zip
# arm64 (aarch64) — use this line INSTEAD if uname -m said aarch64:
# curl -L -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.39.4/pocketbase_0.39.4_linux_arm64.zip
unzip pb.zip && rm pb.zip
# bring in our schema + hooks
cp -r ~/nemchyo/backend/pb_migrations ./pb_migrations
cp -r ~/nemchyo/backend/pb_hooks ./pb_hooks
```

## Step 3 — Build schema + create the real admin
```bash
./pocketbase migrate up            # applies the 5 migrations -> full schema
./pocketbase superuser upsert admin@sixfriendstrekking.com 'PICK-A-STRONG-PASSWORD'
```
⚠️ Use a **strong, new** password (not the dev one). Write it down.

## Step 4 — Run Pocketbase as a service (binds to localhost only)
Create `/etc/systemd/system/pocketbase.service`:
```ini
[Unit]
Description=Pocketbase (Nemchyo)
After=network.target
[Service]
Type=simple
User=<you>
WorkingDirectory=/home/<you>/nemchyo-server
ExecStart=/home/<you>/nemchyo-server/pocketbase serve --http=127.0.0.1:8090
Restart=always
[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now pocketbase
curl -s http://127.0.0.1:8090/api/health   # expect {"code":200,...}
```

## Step 5 — Cloudflare tunnel → chat.sixfriendstrekking.com
```bash
# amd64:
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cf.deb
# arm64: ...cloudflared-linux-arm64.deb
sudo dpkg -i cf.deb && rm cf.deb
cloudflared tunnel login
```
↳ It prints a URL. **Open that URL in a browser** (on any device — the server may be headless), log into Cloudflare, and authorize **sixfriendstrekking.com**.
```bash
cloudflared tunnel create nemchyo
cloudflared tunnel route dns nemchyo chat.sixfriendstrekking.com
```
Create `~/.cloudflared/config.yml` (the create step printed your TUNNEL_ID):
```yaml
tunnel: nemchyo
credentials-file: /home/<you>/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: chat.sixfriendstrekking.com
    service: http://127.0.0.1:8090
  - service: http_status:404
```
```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

## Step 6 — Verify it's live
- On your phone (mobile data) open **https://chat.sixfriendstrekking.com/api/health** → `{"code":200}`.
- Open **https://chat.sixfriendstrekking.com/_/** → log in with the admin from Step 3.

## Step 7 — Make it usable
- In the admin UI (or we'll script it): create the **Whole Family** chat, add yourself, and generate invites for relatives.
- The Android app (next phase) will point here automatically; the web/PWA can be added to home screens once we serve it (optional Caddy step, later).

## Step 8 — Backups (do this once it's working)
```bash
mkdir -p ~/backups
cat > ~/backup.sh <<'EOF'
#!/usr/bin/env bash
set -e
STAMP=$(date +%F)
sudo systemctl stop pocketbase
cp -a ~/nemchyo-server/pb_data ~/backups/pb_data_$STAMP
sudo systemctl start pocketbase
find ~/backups -maxdepth 1 -name 'pb_data_*' -mtime +30 -exec rm -rf {} \;
EOF
chmod +x ~/backup.sh
( crontab -l 2>/dev/null; echo "30 3 * * * /home/<you>/backup.sh" ) | crontab -
```
Plug in an external drive / add Backblaze B2 later for offsite copies, and **test a restore**.

---

### Update routine (when we ship changes)
```bash
cd ~/nemchyo && git pull
cp -r ~/nemchyo/backend/pb_migrations/* ~/nemchyo-server/pb_migrations/
cp -r ~/nemchyo/backend/pb_hooks/*      ~/nemchyo-server/pb_hooks/

# Web / PWA (chat.sixfriendstrekking.com) — PocketBase serves pb_public.
# This step was missing, which is why the browser/iPhone web stayed on an old
# build. Re-copy the committed web export every time the web changes:
rm -rf ~/nemchyo-server/pb_public/*
cp -r  ~/nemchyo/nemchyo/dist/*  ~/nemchyo-server/pb_public/

sudo systemctl restart pocketbase     # migrations auto-apply on start
```
After this, on the iPhone do a hard refresh (or remove + re-add the PWA to the
home screen) once — Safari caches `index.html` aggressively. The JS bundles are
content-hashed, so subsequent updates pick up automatically.

---

### Monitoring (disk full + server/laptop down)
A small script pushes a phone alert when the disk fills or PocketBase stops, and
pings an external uptime check so you're told if the whole laptop goes offline.

1. Phone push: install the free **ntfy** app, and subscribe to a secret topic
   (e.g. `nemchyo-7f3k9q`). Put that topic in `backend/monitor.sh` (`NTFY_TOPIC`).
2. (Recommended) create a free check at **healthchecks.io**, copy its ping URL
   into `HEALTHCHECK_URL`, and set its period to ~15 min — it emails/pushes you
   if the laptop ever stops pinging (total outage, which the laptop can't report
   itself).
3. Wire it to cron:
```bash
chmod +x ~/nemchyo/backend/monitor.sh
( crontab -l 2>/dev/null; echo "*/5 * * * * /home/$USER/nemchyo/backend/monitor.sh" ) | crontab -
~/nemchyo/backend/monitor.sh    # run once to confirm (force a test push by setting DISK_THRESHOLD=0)
```

---

### Security note — media files
Photos/videos are served by PocketBase at long, unguessable URLs
(`/api/files/<15-char id>/<name>_<10-char random>.<ext>`), but this build does
**not** enforce per-user auth on those URLs (a request with no login still gets
the file — tested). So a URL that leaks *outside* the app is accessible to anyone
who has it. To shrink that exposure, add a **Cloudflare cache rule** so private
media is never stored on Cloudflare's edge:

> Cloudflare dashboard → your domain → **Caching → Cache Rules → Create rule**
> When `URI Path starts with /api/files/` → **Bypass cache**.

True per-user file gating (a token-checked serving layer) is a larger follow-up
tracked separately — the URLs being unguessable + not edge-cached is the
pragmatic posture for now.

---

### Web Push (iPhone / browser notifications)
The Android app gets push via Expo/FCM. Browsers — including the iPhone PWA —
use **Web Push**, sent by a small Node sidecar in `web-push-service/` (the
encryption can't run inside PocketBase's JS hooks).

1. Node (once): `sudo apt install -y nodejs npm`
2. VAPID keys (once):
   ```bash
   cd ~/nemchyo/web-push-service && npm install
   npm run gen-keys      # prints a Public Key and a Private Key — copy both
   ```
3. Give PocketBase the **public** key (clients fetch it to subscribe):
   ```bash
   sudo systemctl edit pocketbase
   #   under [Service] add:   Environment=NEMCHYO_VAPID_PUBLIC=<public key>
   sudo systemctl daemon-reload && sudo systemctl restart pocketbase
   ```
4. Run the sidecar as a service (holds BOTH keys; private stays only here):
   ```bash
   sudo tee /etc/systemd/system/nemchyo-webpush.service >/dev/null <<'UNIT'
   [Unit]
   Description=Nemchyo web-push sidecar
   After=network.target
   [Service]
   WorkingDirectory=/home/YOU/nemchyo/web-push-service
   ExecStart=/usr/bin/node server.js
   Environment=NEMCHYO_VAPID_PUBLIC=<public key>
   Environment=NEMCHYO_VAPID_PRIVATE=<private key>
   Environment=NEMCHYO_VAPID_SUBJECT=mailto:you@example.com
   Restart=always
   User=YOU
   [Install]
   WantedBy=multi-user.target
   UNIT
   sudo systemctl daemon-reload && sudo systemctl enable --now nemchyo-webpush
   curl -s localhost:8092/health     # -> {"ok":true}
   ```
   (Replace `YOU` and the keys. Keep PB's `NEMCHYO_VAPID_PUBLIC` and the
   sidecar's identical.)
5. On the **iPhone**: open the site in Safari → Share → **Add to Home Screen**,
   open it from the home screen, then **Profile → Enable notifications** and
   allow. iOS only permits web push from a home-screen PWA (iOS 16.4+).
