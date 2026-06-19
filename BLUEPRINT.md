# Self-Hosted Family Messenger — Architecture Blueprint

> **Locked decisions for this blueprint**
> - **Devices:** Mostly Android, a few iPhones.
> - **Security model:** Pragmatic family-grade (server owner can technically read messages). Not E2E.
> - **Backend:** Pocketbase (single Go binary) on one 8 GB Ubuntu laptop.
> - **Client:** React Native + Expo (one codebase, free Expo Push, OTA updates).
> - **Delivery (confirmed):** Android = native app (`.apk`, free); iPhone = web app / PWA (free). No Apple Developer account. Same Expo codebase produces both.
> - **Domain (confirmed):** `chat.sixfriendstrekking.com` — subdomain of the existing trekking site; DNS moves to Cloudflare free plan (site + email stay on PrabhuHost). See Appendix A.
> - **Reachability:** Cloudflare Tunnel (outbound-only, works behind CGNAT, no inbound ports).
> - **Audience for this doc:** You are newer to servers, so the runbook (§10) is copy-paste-exact with pitfalls flagged.
>
> Prices below were verified on 2026-06-19; re-check at build time (sources at the end).

---

## 0. Executive summary

You can run a genuinely WhatsApp-class messenger for **~$8/year (a domain) if your family runs the PWA on the few iPhones**, or **~$107/year if you ship a native iOS app** (domain + Apple Developer $99). Everything else — backend, push transport, tunnel, STUN, monitoring, backups-to-disk — is $0. The one honest cost surprise is **calls**, and it is *not* what your spec assumed: because your home connection is behind CGNAT with no inbound ports, **you cannot host a reachable TURN relay at home**. The clean fix is Cloudflare's managed TURN (free up to 1,000 GB/month, then $0.05/GB) — it keeps the zero-inbound-ports model and keeps call media off your home upload link. Details in §2.4 and §8.

The stack is deliberately small so it fits 8 GB with huge headroom:

| Component | Role | Approx. RAM |
|---|---|---|
| Pocketbase | DB (SQLite) + auth + realtime (SSE) + file storage + REST + access rules + FTS5 search | 50–150 MB |
| Caddy | Local reverse proxy, serves PWA + invite pages | 20–40 MB |
| cloudflared | Outbound tunnel to Cloudflare edge | 30–60 MB |
| Uptime Kuma (Docker) | Health/uptime alerts | 80–150 MB |
| (optional) coturn | Self-hosted TURN — only if you rent a VPS; see §8 | ~30 MB |
| **Total core** | | **~0.3–0.5 GB of 8 GB** |

That leaves the rest of RAM for SQLite page cache and media processing (ffmpeg on upload).

---

## 1. Architecture

```
                          ┌─────────────────────────────────────────────┐
                          │                  THE INTERNET                 │
                          └─────────────────────────────────────────────┘
   Family phones (Android native, iPhone native-or-PWA)
        │  HTTPS + SSE (realtime)              │  push wake-ups
        │  to https://chat.mydomain.tld        │
        ▼                                      ▼
 ┌──────────────────────┐            ┌──────────────────────┐
 │  Cloudflare edge      │            │  Expo Push service    │  (free)
 │  - TLS termination    │            │   ├─ FCM  → Android    │
 │  - DNS (your domain)  │            │   └─ APNs → iPhone     │  (native only)
 │  - Realtime TURN ●    │            └──────────┬───────────┘
 └──────────┬───────────┘                        │  server calls Expo API
            │  Cloudflare Tunnel                  │  when a msg must be delivered
            │  (OUTBOUND-only, no inbound ports)  │
            ▼                                     │
 ┌───────────────────────────────────────────────┴──────────────────────┐
 │  HOME LAPTOP — Ubuntu Server 24.04 LTS, LUKS full-disk encryption       │
 │                                                                         │
 │   cloudflared ──► Caddy (reverse proxy, serves PWA) ──► Pocketbase      │
 │                                              │  :8090                   │
 │                                              ├─ SQLite (messages, etc.) │
 │                                              ├─ pb_data/storage (media) │
 │                                              ├─ FTS5 full-text index    │
 │                                              ├─ realtime (SSE)          │
 │                                              └─ access rules (per-chat) │
 │                                                                         │
 │   ffmpeg/sharp on upload (compress img/video/voice) · rclone backups    │
 └─────────────────────────────────────────────────────────────────────────┘

  CALL MEDIA PATH (WebRTC):
  Phone A ──signaling (SSE+REST via tunnel)──► Pocketbase ──► Phone B
  Phone A ◄══════ media: STUN (free) tries direct P2P first ══════► Phone B
  Phone A ◄══════ if NAT blocks P2P: relay via Cloudflare TURN ● ══► Phone B
        (relay runs on Cloudflare, NOT your home link — see §2.4 / §8)
```

**Reading the diagram:** Day-to-day messaging is a normal HTTPS app — phones hold a long-lived **SSE** connection to `chat.mydomain.tld` for live updates, and POST messages over REST. When a message arrives for someone whose app is backgrounded/killed, your server calls **Expo Push**, which hands off to **FCM/APNs** to wake the phone. Calls negotiate over the same SSE/REST signaling, then send audio/video peer-to-peer, falling back to **Cloudflare TURN** when carrier NAT blocks a direct path.

---

## 2. Networking & reachability — "just works," no VPN

### 2.1 Primary: Cloudflare Tunnel (`cloudflared`)
- You install `cloudflared` on the laptop. It makes an **outbound** connection to Cloudflare and registers your service. Cloudflare then serves `https://chat.mydomain.tld` from its edge and pipes requests down the tunnel to your laptop.
- **Why it satisfies your hard constraints:** no inbound ports opened, no static IP needed, survives a dynamic IP (the tunnel re-dials), and works behind **CGNAT** because the connection is outbound-only. TLS is handled at Cloudflare's edge automatically.
- **Requirement:** a domain managed on Cloudflare (~$8/yr for `.com`, at-cost). The free `*.trycloudflare.com` quick tunnels are **dev-only** — the URL changes on every restart, which would break "set up once."
- **From the relative's perspective:** the app talks to a website address exactly like WhatsApp talks to its servers. **Nothing is installed or toggled on their phone. Banking and every other app are completely unaffected** — this is server-side only.

### 2.2 Important tunnel caveat (build around it)
Cloudflare's Free/Pro plans **close idle WebSockets after 100 seconds**, and long-lived WebSockets through tunnels are flaky (random `1006` closures). **Mitigation, already baked into this design:**
- Use **Pocketbase realtime (SSE)** as the persistent live channel — SSE long-poll responses are stable through Cloudflare with no hard timeout.
- Implement a **client heartbeat** (ping every ~30 s) and **auto-reconnect with backoff**. This also covers phones that drop to a backgrounded state.
- Real-time correctness never depends *only* on the socket: push (§3) is the source of truth for "wake up, there's a message," and on reconnect the client syncs missed messages by `created` timestamp.

### 2.3 Documented alternative (if you ever get a static IP / port-forwarding)
Dynamic DNS (e.g., Cloudflare API updater or `ddclient`) + **Caddy** as the public reverse proxy with **automatic Let's Encrypt TLS**. You'd open 80/443 inbound and drop cloudflared. Keep this in your back pocket; the tunnel is strictly better for your stated network reality.

### 2.4 The calls/CGNAT correction (read this — it changes your spec)
Your spec assumed self-hosted **coturn** at home. **That cannot work under CGNAT.** A TURN relay must be reachable *inbound* by both phones; your home connection has no inbound path. So:
- **STUN** (free, `stun.cloudflare.com`) handles direct peer-to-peer when at least one side's NAT cooperates. Many home-Wi-Fi-to-home-Wi-Fi calls will connect directly.
- When both sides are on **mobile carrier NAT** (often symmetric), a **relay (TURN)** is required, and you need a *publicly reachable* one. Options:
  - **(Recommended) Cloudflare Realtime TURN** — managed, no inbound ports, **free to 1,000 GB/month then $0.05/GB**, and the relay runs on Cloudflare so **call media never touches your home upload bandwidth**. Best fit for your constraints.
  - **Self-hosted coturn on a tiny VPS** (~$4–6/mo) if you want full control / no third party in the media path. This is the only way to truly self-host TURN given CGNAT.
  - Coturn **at home** is *not viable* under CGNAT — don't.
- **Non-goal restated:** No mesh VPN (Tailscale/WireGuard) on family phones. You *may* use Tailscale only for **your own admin SSH** to the laptop.

---

## 3. Push notifications — normal behavior, self-hosted backend

### 3.1 The unavoidable truth
A self-hosted server **cannot** directly wake a sleeping iOS/Android app. Background wake-ups **must** go through **FCM (Android)** and **APNs (iOS)**. This is how every messenger works, it's free, invisible to the user, and **not a VPN**. Using FCM as a *transport* does **not** mean adopting Firebase as your backend — you keep Pocketbase; FCM only carries the "ping the phone" signal.

### 3.2 Flow
1. Phone registers an **Expo push token** with Pocketbase (`devices` collection) on login.
2. A new message is written to Pocketbase. A hook fires.
3. Server computes recipients (chat members minus the sender, minus those who muted), then calls the **Expo Push API** with their tokens + a per-chat collapse/group key.
4. Expo routes to FCM/APNs → phone shows a lock-screen notification with **sound**, even if the app is killed.
5. If the app is foregrounded, the **SSE** channel already delivered the message; the push is suppressed/aggregated.

### 3.3 Android vs iPhone (your device mix)
- **Android (native APK):** Expo Push → FCM. Full lock-screen + sound + high-priority. **Zero per-user setup, zero cost.** Requires a **free Firebase project** purely to obtain FCM credentials (no Firebase services used beyond that).
- **iPhone — two honest paths:**
  - **Native app (recommended for the few iPhones):** needs an **Apple Developer account ($99/yr verified)** to mint APNs credentials. Gives reliable lock-screen push **and** proper **CallKit/VoIP push** for incoming calls. This is the only way to fully satisfy your *hard* "notifications behave like a normal app" + "incoming-call notifications" constraints on iOS.
  - **PWA (free):** iOS 16.4+ Web Push works **only** after "Add to Home Screen," and is **less reliable** (no guaranteed background wake parity, **no CallKit** → no native full-screen incoming call). Fine as a zero-cost MVP for iPhone users; not equivalent for calls.
  - **Recommendation:** ship Android native + iOS PWA for the MVP to stay near-zero-cost, and **budget the $99/yr** to flip the iPhones to native once you reach the calls/polish phase (§12). The decision hinges on whether the iPhone users need reliable calls + rock-solid push; if yes, pay it.

### 3.4 Notification UX (build into the client)
Per-chat grouping; sender name + message preview (hidden when privacy lock on); **@mention** alerts; **per-chat custom sound**; **per-chat mute** with WhatsApp-style durations — **15 minutes / 1 hour / 3 hours / 1 day / until I turn it back on** (stored in `muted_until`; the server's push sender skips members whose mute is still active); honor OS Do-Not-Disturb. **Incoming calls** use Android **full-screen intent / high-priority** and iOS **CallKit + VoIP push** (native only).

> **Build status (2026-06-19) — push & mute implemented:** `devices` collection + `POST /api/register-device`; a Pocketbase hook (`pb_hooks/push.pb.js`) fires `onRecordAfterCreateSuccess` for `messages`, computes recipients (chat members − sender − muted), and POSTs to the **Expo Push API** with title/body (preview: text · 📷 Photo · 📄 file), `sound`, high priority, and per-chat `collapseId`. Verified: recipients drop from 1→0 when a member mutes. Client registers its Expo token on login via `expo-notifications`. **Mute UI is live** in the conversation (bell → the durations above) with a chat-list 🔕 indicator. **Remaining for real on-device delivery:** a free Firebase/FCM project + a native Android build (EAS) carrying an Expo `projectId` — until then `registerForPush()` no-ops on web/dev (no token to send). iPhone push remains the PWA path.

---

## 4. Backend — Pocketbase (chosen default)

**Why Pocketbase here:** one Go binary, **tens of MB RAM**, bundles SQLite + auth (incl. OTP/OAuth) + **realtime (SSE)** + file storage + REST + **rules-based access control** (your per-chat Row-Level-Security equivalent) + **SQLite FTS5** for §5E search. Run as a `systemd` service behind Caddy. It is the smallest thing that does everything you need.

**Documented alternatives (decision criteria):**
- **Self-hosted Supabase (Docker): ~2–4 GB RAM.** Postgres + RLS + Postgres FTS. Choose **only if** you specifically need Postgres/RLS or expect to outgrow SQLite. Tight on 8 GB once media processing runs.
- **Matrix (Conduit/Dendrite) + custom client:** the *only* sane way to get **true E2E + multi-device sync** without writing crypto. You chose **pragmatic**, so this is out of scope here — but it's the documented upgrade path if you ever require "server cannot read."

**Rules regardless of choice (all satisfied by the default):** Caddy in front; database never exposed to the internet (Pocketbase binds `127.0.0.1`, only reachable via tunnel→Caddy); media in object storage (Pocketbase's built-in file storage on the encrypted disk; MinIO only if you later separate storage).

**One design note on realtime + signaling:** Pocketbase realtime is **SSE**, which is exactly right for the tunnel caveat in §2.2. WebRTC **signaling** is done by writing rows to a `call_signals` collection and subscribing via that same SSE channel — so **no second WebSocket service to run**. If call setup latency ever bothers you, you can add a tiny dedicated WS signaling service later, but start without it.

---

## 5. Data model / schema + access control

Pocketbase "collections" ≈ tables. Below: collection → key fields. Relations are `rel`. `auth` marks the auth collection.

### 5.1 Schema

**users** *(auth)* — `username`, `display_name`, `avatar`(file), `about`, `last_seen`(date), `presence_public`(bool), `read_receipts_public`(bool), `app_lock_enabled`(bool). *(No password shown to users — onboarding is invite-token based, §6.)*

**devices** — `user`→users, `expo_push_token`, `platform`(android|ios|web), `last_active`. *(One row per device; powers push + multi-device.)*

**chats** — `type`(direct|group|family|announcement), `name`, `photo`(file), `description`, `created_by`→users, `admin_only_posting`(bool). *(The one "Whole Family" chat is `type=family`; the announcements board is `type=announcement` + `admin_only_posting=true`.)*

**chat_members** — `chat`→chats, `user`→users, `role`(member|admin|owner), `joined`(date), `last_read_at`(date), `muted_until`(date), `pinned`(bool), `archived`(bool), `draft`(text), `notification_sound`. *(Membership is the spine of all access control. `last_read_at` drives unread counts + read receipts cheaply.)*

**messages** — `chat`→chats, `sender`→users, `type`(text|image|video|voice|audio|file|location|contact|poll|system|call), `body`(text, **FTS-indexed**), `reply_to`→messages, `forwarded_from`→users, `edited_at`(date), `deleted_for_everyone`(bool), `expires_at`(date, for disappearing/retention), `created`.

**attachments** — `message`→messages, `kind`(image|video|voice|audio|file), `file`(file), `thumbnail`(file), `mime`, `size`, `width`, `height`, `duration`, `waveform`(json), `original_name`. *(Distinguishes voice notes from music files via `kind`.)*

**reactions** — `message`→messages, `user`→users, `emoji`. *(Unique per (message,user,emoji).)*

**message_deletions** — `message`→messages, `user`→users. *(Powers "delete for me": hide a message from one user without removing it for others. "Delete for everyone" uses `messages.deleted_for_everyone`.)*

**pinned_messages** — `chat`→chats, `message`→messages, `pinned_by`→users. *(In-chat pins, §5E — distinct from the announcements board.)*

**starred_messages** — `user`→users, `message`→messages. *(Personal bookmarks.)*

**polls** — `message`→messages, `question`, `multiple`(bool), `closes_at`. **poll_options** — `poll`→polls, `text`, `order`. **poll_votes** — `option`→poll_options, `user`→users.

**link_previews** — `url`(unique), `title`, `description`, `image`(file), `fetched_at`. *(Server-side OpenGraph cache; SSRF-guarded, §6.)*

**calendar_events** — `title`, `description`, `starts_at`, `ends_at`, `all_day`(bool), `location`, `recurrence`, `created_by`→users. **event_rsvps** — `event`→calendar_events, `user`→users, `status`(yes|no|maybe).

**calls** — `chat`→chats, `initiator`→users, `kind`(audio|video), `status`(ringing|ongoing|missed|ended), `started_at`, `ended_at`, `participants`(json). **call_signals** — `call`→calls, `from`→users, `to`→users, `kind`(offer|answer|candidate|hangup), `payload`(json). *(Signaling over SSE; rows can auto-expire.)*

**invites** — `code`(unique), `created_by`→users, `for_user`(optional pre-provisioned), `chat`(optional, for group invites), `role`, `expires_at`, `consumed_by`→users, `consumed_at`. *(One-time deep-link / QR onboarding, §6.)*

### 5.2 Access-control rules (Pocketbase API rules — per-collection)
Expressed in Pocketbase rule style (`@request.auth.id` = caller; `?=` = "any related row matches"). Confirm exact back-relation names against your collection setup.

- **chats — List/View:** `@request.auth.id != "" && chat_members_via_chat.user ?= @request.auth.id` → *you only see chats you're a member of.*
- **messages — List/View:** `@request.auth.id != "" && chat.chat_members_via_chat.user ?= @request.auth.id` → *only members of the chat can read its messages.*
- **messages — Create:** `sender = @request.auth.id && chat.chat_members_via_chat.user ?= @request.auth.id && (chat.admin_only_posting = false || chat.chat_members_via_chat.role ?~ "admin|owner")` → *must be a member; in admin-only chats only admins post.*
- **messages — Update (edit):** `sender = @request.auth.id && created > @now - "900s"` (15-min edit window; tune). **Delete-for-everyone** sets the flag instead of hard-delete, within a window.
- **chat_members — Create (add member):** caller must be `admin|owner` of that chat. **Self-fields** (`muted_until`, `pinned`, `archived`, `draft`, `last_read_at`, `notification_sound`) updatable only on your **own** membership row.
- **reactions / starred / poll_votes / receipts:** `user = @request.auth.id` and the underlying message/chat must be visible to you (membership check via relation).
- **invites — Create:** admin only. **Consume:** handled by a server-side route that validates `code`, not yet `consumed`, not expired (so it can run before the user is fully authenticated).
- **Admin (you):** a superuser account bypasses rules for operations/backup. This is the explicit "trusted admin" in your security model.

**Net effect:** visibility is membership-derived everywhere. There is no "list all messages" path; every read/write is gated by chat membership and, where relevant, role.

---

## 6. Security model (the one-paragraph statement + hardening)

> **Stated security model — Option 1, pragmatic family-grade.** All traffic is encrypted **in transit** (TLS, terminated at Cloudflare and again to localhost) and all data is encrypted **at rest** via **LUKS full-disk encryption** on the laptop. Authentication is **password-free** (one-time invite tokens + long-lived device tokens in the OS secure store), with optional biometric/PIN app-lock. **Access rules** ensure each person can read only the chats they're a member of. **What this does NOT protect against:** because there is no end-to-end encryption, **you, the server owner, can technically read message contents and media** on the running server (the disk is only encrypted at rest, i.e., when powered off/stolen). The threat model it *does* cover: device theft of the server (LUKS), network eavesdropping (TLS), and other family members snooping into chats they're not in (access rules). It is **not** designed to protect messages from a compromised/curious server admin. This is adequate for essentially all families; if you ever need "server cannot read," the upgrade path is Matrix (out of scope here).

**Hardening checklist (in the runbook, §10):**
- **`ufw`** default-deny inbound — with the tunnel there are **no inbound ports** to open at all.
- **`unattended-upgrades`** for automatic security patches; **`fail2ban`** on SSH.
- SSH: **key-only**, no password, ideally reachable only via your **personal Tailscale** (admin-only, never the family path).
- Pocketbase binds **`127.0.0.1`** only; never exposed directly.
- **Auth-endpoint protection:** rate-limit invite consumption + token refresh (Caddy rate-limit / Pocketbase rules); single-use invites with expiry; token rotation.
- **Calls:** authenticated **short-lived TURN credentials** (HMAC, minted per call by the server — never ship static TURN secrets to clients); signaling only between authenticated members.
- **Link previews (SSRF guard):** server fetches OG data **only** for public hosts — block private/loopback/link-local ranges and metadata IPs (`127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fc00::/7`), cap redirects + response size + timeout, and **strip tracking query params** before storing.
- **Full-disk encryption note for a headless laptop:** LUKS asks for a passphrase **at boot**. Since the laptop is always-on and rarely reboots, that's fine — but plan for it (be physically present on reboot, or set up **Dropbear-SSH unlock** / **Clevis+TPM auto-unlock** if you want unattended reboots; the latter weakens the "stolen disk" guarantee slightly).

---

## 7. Feature → implementation map (the §5 checklist)

| Feature | How it's built |
|---|---|
| DMs / sub-groups / "Whole Family" | `chats.type`; membership in `chat_members`. |
| Pin / archive / mute / unread badges | Per-member fields (`pinned`, `archived`, `muted_until`, `last_read_at`). **Mute durations:** 15 min / 1 h / 3 h / 1 day / until turned back on (push sender honors it). |
| Text + light formatting + emoji + @mentions | Markdown-subset render; mentions stored as parsed entities → trigger mention push. |
| Reply/quote, forward, copy, react | `reply_to`, `forwarded_from`, client copy, `reactions`. |
| Edit / delete (me / everyone) | Update within window; `deleted_for_everyone` flag; `message_deletions` for delete-for-me. |
| Drafts / scheduled *(stretch)* | `chat_members.draft`; scheduled = row with future `created` + a server cron releasing it. |
| Delivery/read status + typing | Delivered = push/SSE ack; read = `last_read_at`; typing = ephemeral SSE event (not stored). |
| Photos/albums/camera, videos | `attachments` (kind=image/video); multi-select album = multiple attachments per message. |
| Voice notes + speed + waveform | kind=voice, Opus, `waveform` json; client playback 1×/1.5×/2×. |
| Music files (distinct) | kind=audio. |
| Arbitrary files + inline preview | kind=file; PDF/image inline; others → download. |
| GIFs / stickers | Ship a built-in sticker pack (self-contained); **Tenor GIF search optional, off by default** (external + privacy trade-off). |
| Server-side optimization | On upload: images→WebP/AVIF (sharp), video→H.264 720p capped bitrate (ffmpeg), voice→Opus; generate thumbnails; lazy full-media download. |
| Per-chat media gallery | Query `attachments` by chat, tabbed by kind + a `link_previews`-derived links tab. |
| Location / contact share *(stretch)* | message types `location`/`contact`; live location = periodic updates with TTL. |
| 1:1 voice/video calls | WebRTC; signaling via `call_signals` over SSE; STUN + Cloudflare TURN (§8). |
| Group calls *(stretch)* | **Recommend linking self-hosted/hosted Jitsi** rather than building an SFU on 8 GB (§8). |
| In-chat pin / starred | `pinned_messages` / `starred_messages`. |
| Global + in-chat search | **SQLite FTS5** over `messages.body` + sender + attachment names; scope by membership. |
| Link previews | `link_previews` cache, SSRF-guarded (§6). |
| Presence/last-seen + read receipts (+privacy toggles) | `users.last_seen`, `presence_public`, `read_receipts_public`. |
| Polls | `polls`/`poll_options`/`poll_votes`, live results via SSE. |
| Status/Stories *(stretch)* | Ephemeral collection with TTL `expires_at`. |
| Group mgmt + admin-only + invite link/QR | `chat_members.role`, `admin_only_posting`, `invites`. |
| Profile + light/dark + wallpapers | `users` fields + client theme store. |
| Announcements board | `chats.type=announcement` + `admin_only_posting`. |
| Family calendar + RSVP + reminders | `calendar_events` + `event_rsvps`; reminders = scheduled push. |
| Offline support | Local cache (SQLite/MMKV on device), outbound queue, sync-on-reconnect by timestamp. |
| Backup/export + retention | §11 backups; `expires_at` + cron for retention; disappearing messages *(stretch)*. |

---

## 8. Calls — the honest, high-complexity feature

**This is the single hardest part and the spec's biggest hidden assumption.** Re-stating the corrected design:

1. **Signaling:** caller writes an `offer` to `call_signals`; callee receives it over **SSE**; exchanges `answer` + ICE `candidate`s; either writes `hangup`. No extra server needed.
2. **Incoming-call alert:** Android **full-screen intent / high-priority FCM**; iOS **CallKit + VoIP push** (native only — PWA can't). This is a strong reason to put the iPhones on a native build (§3.3) before shipping calls.
3. **Media / NAT traversal:**
   - **STUN** (`stun.cloudflare.com`, free) for direct P2P.
   - **TURN relay required** when both peers are behind symmetric/carrier NAT. **Default = Cloudflare Realtime TURN** (free 1,000 GB/mo, then $0.05/GB; relay on Cloudflare, **off your home upload link**). Server mints **short-lived HMAC TURN credentials** per call.
   - **Self-host alternative:** coturn on a **tiny VPS** (~$4–6/mo) — only viable place to self-host TURN given CGNAT. Then *that VPS's* bandwidth carries relayed media (~1–2 Mbps per direction per video call), not your home link.
4. **Group calls *(stretch)*:** an SFU (mediasoup/Janus/LiveKit) is **CPU- and bandwidth-heavy** — a poor fit for an 8 GB laptop also running the backend. **Recommended pragmatic default: link/embed Jitsi** (host a lightweight Jitsi elsewhere, or use a hosted instance) for multi-party, rather than building an SFU. Keep 1:1 calls native; route "Family group call" to a Jitsi room link.

**Bandwidth reality:** with Cloudflare TURN, your **home upload is essentially unaffected by calls** (only tiny signaling). This is a meaningful improvement over the spec's coturn-at-home assumption — and the reason it's the recommended default.

---

## 9. Client app structure & key screens

**Stack:** React Native + **Expo** (dev build / EAS Build — *not* Expo Go, because calls + push + custom native need config plugins). Libraries: `expo-router` (nav), `expo-notifications` (push), `react-native-webrtc` + `@config-plugins/react-native-webrtc` (calls), `expo-av`/`expo-audio` (voice/media), `expo-image` (fast images), `expo-secure-store` (token), `expo-file-system` (cache/offline), `react-native-mmkv` or SQLite (local store), `@shopify/flash-list` (long chat lists), `expo-camera`.

**Screens:**
- **Onboarding:** consume invite deep-link/QR → save long-lived token to **Keychain/Keystore** → land directly on chat list. Optional biometric/PIN app-lock.
- **Chat list:** pinned section, unread badges, mute/archive, swipe actions, search bar.
- **Conversation:** message bubbles, grouped timestamps, reply/forward/react/edit/delete, attachment cards, typing + read ticks, @mention autocomplete, voice-record press-and-hold, in-chat pinned bar.
- **Media viewer + per-chat gallery:** full-screen pager; tabbed gallery (photos/video/files/links/audio).
- **File/document preview:** PDF + image inline; others download.
- **Call UI:** incoming (CallKit/full-screen), in-call controls (mute/cam/speaker/flip), connecting/relay state.
- **Search:** global + in-chat, filter by media type.
- **Starred / saved**, **Announcements**, **Calendar** (month + RSVP), **Polls**.
- **Settings/Profile:** display name, avatar, about, presence/read-receipt toggles, theme + wallpaper, **accessibility mode** (large text/high contrast), per-chat notification sound, app-lock.

**Distribution:** Android → **direct APK** (free) or Play ($25 one-time). iOS → **PWA** (free, MVP) then **TestFlight/App Store** ($99/yr) for native push + CallKit. **OTA updates via EAS Update** so you ship fixes without reinstalls.

**Design ↔ accessibility reconciliation (§6 of spec):** one coherent design system with **two density modes** — a "beautiful default" (refined bubbles, motion, wallpapers, light/dark) and an **"extra-simple/large" mode** (bigger type honoring OS dynamic-type, ≥48 dp targets, high contrast, fewer elements). Same components, different tokens — so neither audience is compromised. Full **VoiceOver/TalkBack** labels, shallow navigation, minimal text entry.

---

## 10. Ubuntu server runbook (copy-paste, beginner-safe)

> Pitfalls are flagged ⚠️. Run as your normal user with `sudo`; never as root over SSH.

### Step 1 — Power & install
1. In BIOS: disable "sleep on AC," and set "AC power loss → power on."
2. Install **Ubuntu Server 24.04 LTS**. In the installer, choose **"Encrypt the LUKS group"** (full-disk LUKS). ⚠️ Note the passphrase — it's required at every boot. (For unattended reboots later, see §6 Dropbear/Clevis note.)
3. After install, stop lid-suspend:
   ```bash
   sudo sed -i 's/#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
   sudo systemctl restart systemd-logind
   ```

### Step 2 — Base hardening
```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install ufw fail2ban unattended-upgrades rclone ffmpeg curl
sudo dpkg-reconfigure --priority=low unattended-upgrades   # enable auto security updates
sudo ufw default deny incoming
sudo ufw default allow outgoing
# No inbound ports needed (tunnel is outbound). If you must SSH locally, allow it on LAN only:
sudo ufw allow from 192.168.0.0/16 to any port 22 proto tcp
sudo ufw enable
sudo systemctl enable --now fail2ban
```
⚠️ Do SSH key setup **before** enabling `ufw` if you're remote. For admin access from outside, install Tailscale (`curl -fsSL https://tailscale.com/install.sh | sh`) — **admin-only**, not the family path.

### Step 3 — Pocketbase as a systemd service
```bash
sudo useradd -r -s /usr/sbin/nologin pocketbase
sudo mkdir -p /opt/pocketbase && cd /opt/pocketbase
# Download the latest linux amd64 build from github.com/pocketbase/pocketbase/releases (verify version)
sudo curl -L -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/vX.Y.Z/pocketbase_X.Y.Z_linux_amd64.zip
sudo apt -y install unzip && sudo unzip pb.zip && sudo rm pb.zip
sudo chown -R pocketbase:pocketbase /opt/pocketbase
```
Create `/etc/systemd/system/pocketbase.service`:
```ini
[Unit]
Description=Pocketbase
After=network.target
[Service]
Type=simple
User=pocketbase
WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve --http=127.0.0.1:8090
Restart=always
[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now pocketbase
```
⚠️ Binds to **127.0.0.1** — never `0.0.0.0`. It's only reachable via Caddy/tunnel. Then create your **superuser** and collections in the admin UI (reachable through the tunnel once Step 5 is done, or temporarily via an SSH tunnel: `ssh -L 8090:127.0.0.1:8090 you@laptop` then open `http://127.0.0.1:8090/_/`).

### Step 4 — Caddy (reverse proxy + serves the PWA)
```bash
sudo apt -y install debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt -y install caddy
```
`/etc/caddy/Caddyfile` (TLS handled by Cloudflare at the edge, so Caddy serves plain HTTP locally to cloudflared):
```
:8080 {
    handle_path /pwa/* { root * /var/www/pwa; file_server }
    reverse_proxy 127.0.0.1:8090
}
```
```bash
sudo systemctl restart caddy
```

### Step 5 — Cloudflare Tunnel
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel login                      # opens a URL to authorize your Cloudflare domain
cloudflared tunnel create family-chat
cloudflared tunnel route dns family-chat chat.mydomain.tld
```
`~/.cloudflared/config.yml`:
```yaml
tunnel: family-chat
credentials-file: /home/you/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: chat.mydomain.tld
    service: http://127.0.0.1:8080
  - service: http_status:404
```
```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```
✅ Test: open `https://chat.mydomain.tld/_/` from your phone's browser — you should reach Pocketbase admin. ⚠️ Add a **client SSE heartbeat** (§2.2) so the 100 s idle close never bites.

### Step 6 — Full-text search (FTS5)
SQLite ships FTS5 in Pocketbase's bundled build. Create a contentless FTS virtual table mirroring `messages.body` (+ sender, attachment names) and keep it in sync with triggers, or use Pocketbase's filter `~` (LIKE) for the MVP and graduate to FTS5 when volume grows. Scope every search query by the caller's chat membership (§5.2).

### Step 7 — Push (Expo)
1. Create a **free Firebase project** → add an **Android app** → download credentials → upload the FCM **service account key** to your Expo project (for Expo to send via FCM). *(Android only; you use zero other Firebase features.)*
2. *(Only if shipping native iOS)* Apple Developer account → APNs key → add to Expo.
3. Server: on new `messages`, a Pocketbase **hook** (JS in `pb_hooks/` or a small sidecar) collects recipient `expo_push_token`s and POSTs to `https://exp.host/--/api/v2/push/send` with title/body/sound/collapse key. Honor `muted_until` and privacy settings.

### Step 8 — Calls (TURN)
- Add **Cloudflare Realtime** (dashboard → Realtime → TURN) to get an API token; server mints short-lived TURN credentials per call. STUN = `stun.cloudflare.com` (free). No coturn install needed under CGNAT.
- *(Only if self-hosting on a VPS instead)* install coturn there with `use-auth-secret` + `static-auth-secret`, TLS, and `denied-peer-ip` ranges for the private nets.

### Step 9 — Monitoring (Uptime Kuma)
```bash
sudo apt -y install docker.io docker-compose-v2
sudo docker run -d --restart=always -p 127.0.0.1:3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1
```
Add monitors for `https://chat.mydomain.tld/api/health`, disk space, and the tunnel; route alerts to email/Telegram. Add a disk-space cron alert and `logrotate` for app logs.

### Step 10 — Backups + tested restore
```bash
# /opt/backup.sh
set -e
STAMP=$(date +%F)
DEST=/mnt/backupdrive/family-chat/$STAMP
mkdir -p "$DEST"
systemctl stop pocketbase
cp -a /opt/pocketbase/pb_data "$DEST/"          # SQLite + media in one tree
systemctl start pocketbase
rclone sync "$DEST" b2:family-chat-backups/$STAMP   # offsite (Backblaze B2)
find /mnt/backupdrive/family-chat -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;
```
```bash
sudo chmod +x /opt/backup.sh
echo "30 3 * * * root /opt/backup.sh" | sudo tee /etc/cron.d/family-chat-backup
```
⚠️ **Actually test a restore** quarterly: copy a `pb_data` snapshot to a scratch dir, run Pocketbase against it, confirm chats/media open. A backup you've never restored is a guess, not a backup.

---

## 11. Operations, reliability & cost

- **Single point of failure:** the laptop. Backups above hit **both** an external drive **and** Backblaze B2 (free egress when restored via a Cloudflare CDN partner path; B2 storage ~$6/TB/mo). Test restores.
- **Storage sizing (rough):** text ≈ free; compressed photo ≈ 150–300 KB; 1-min 720p video ≈ 8–15 MB; 1-min voice (Opus) ≈ 0.5–1 MB. For 20 active people sharing ~200 media/day at ~0.6 MB avg ≈ **~120 MB/day ≈ ~3.5 GB/month ≈ ~40 GB/year** (videos can multiply this). A 256–512 GB SSD lasts years with the compression policy + optional **retention** (auto-expire large media after N months, off by default, via `expires_at` cron).
- **Calls bandwidth:** with **Cloudflare TURN**, home upload is essentially untouched (signaling only). With VPS coturn, that VPS carries ~1–2 Mbps/direction per relayed video call.
- **Always-on:** lid-suspend disabled (Step 1), consider a small **UPS**, watch thermals (it'll run 24/7), `logrotate`, **disk-space monitor** in Uptime Kuma.
- **Updates:** `unattended-upgrades` for the OS; a one-line routine to bump the Pocketbase/cloudflared/Caddy binaries (download new release → swap → `systemctl restart`).
- **Growth path:** if the family outgrows one laptop — move media to **MinIO/B2**, split Pocketbase to a beefier box or migrate to **Supabase/Postgres**, and add a VPS for TURN/SFU. The client API stays the same.

### Cost summary (verified 2026-06-19 — re-verify at build)
| Item | Cost | Notes |
|---|---|---|
| Home laptop server | $0 | Already owned. |
| Electricity | ~few $/mo | 24/7 laptop. |
| **Domain (Cloudflare)** | **~$8/yr** | `.com` at-cost; required for stable tunnel URL. |
| Cloudflare Tunnel | $0 | Free. |
| STUN | $0 | `stun.cloudflare.com`. |
| Cloudflare TURN | $0 to 1,000 GB/mo, then $0.05/GB | Only used when calls can't go P2P. |
| Expo Push | $0 | 600 notifications/sec/project limit (ample). |
| FCM (Firebase project) | $0 | Push transport only. |
| **Apple Developer** | **$99/yr — only if native iOS** | Needed for reliable iPhone push + CallKit calls. PWA avoids it (weaker). |
| Google Play (optional) | $25 one-time | Or distribute Android APK directly for $0. |
| Backblaze B2 (optional offsite) | ~$6/TB/mo | Or external drive only = $0. |
| Tenor GIF API (optional) | $0 tier | Off by default (external + privacy). |
| **Realistic total** | **~$8/yr (all-PWA iOS) to ~$107/yr (native iOS)** | |

---

## 12. Phased build plan

1. **MVP text chat:** Pocketbase schema + auth/invites + DMs/groups + realtime (SSE) + chat list/conversation UI + persistent login. *(Deployable end-to-end via the tunnel.)*
2. **Media/files/audio + compression:** uploads, ffmpeg/sharp pipeline, thumbnails, voice notes, gallery.
3. **Push notifications:** Expo + FCM (Android first), mute/mention logic, lock-screen behavior.
4. **Search + pins + reactions + receipts:** FTS5, starred, read/typing, edit/delete.
5. **Voice/video calls (1:1):** WebRTC + signaling + Cloudflare TURN; **flip iPhones to native ($99) here** for CallKit.
6. **Announcements + calendar + polls.**
7. **Visual + accessibility polish:** themes/wallpapers, dynamic-type, high-contrast/large mode, screen-reader pass.
8. **Group calls *(stretch)*:** link Jitsi rather than build an SFU.

---

## 13. Unavoidable costs & external accounts

- **Domain registrar** = **Cloudflare** (domain + tunnel + DNS + TURN, one account).
- **Firebase project** — push transport only (FCM credentials for Expo). Free.
- **Expo/EAS account** — builds, OTA updates, push. Free tier sufficient.
- **Apple Developer ($99/yr)** — *only if* you ship native iOS (recommended for the few iPhones once calls land).
- **Backblaze B2** *(optional)* — offsite backups.
- **Tenor** *(optional, off by default)* — GIF search.

---

## 14. Sources (prices verified 2026-06-19)

- Apple Developer fee ($99/yr): https://richestsoft.com/blog/apple-developer-program-cost/ , https://www.groovyweb.co/blog/how-much-does-it-cost-app-store
- Backblaze B2 ($6/TB/mo, 3× free egress): https://www.backblaze.com/cloud-storage , https://www.backblaze.com/cloud-storage/transaction-pricing
- Cloudflare Registrar (.com at-cost ~$8): https://tldprice.org/registrar/cloudflare , https://www.cloudflare.com/application-services/solutions/low-cost-domain-names/
- Expo Push (free, 600/s): https://docs.expo.dev/push-notifications/overview/ , https://expo.dev/pricing
- Cloudflare Realtime TURN (free 1,000 GB, then $0.05/GB; free STUN): https://www.cloudflare.com/products/turn-sfu/ , https://developers.cloudflare.com/realtime/turn/faq/
- Cloudflare Tunnel WebSocket/SSE 100 s idle limit: https://developers.cloudflare.com/network/websockets/ , https://github.com/cloudflare/cloudflared/issues/1282

---

## Appendix A — 100% free configuration using `sixfriendstrekking.com`

**Goal:** zero new spend. Reuse the existing domain via a subdomain; no Apple Developer; APK + PWA distribution.

**Existing setup (probed 2026-06-19):** DNS at PrabhuHost (`ns50/ns51.prabhuhost.com`); WordPress on PrabhuHost (`192.250.235.32`); contact email is plain Gmail; an SPF TXT record exists (host can send mail).

### A.1 Reachability — `chat.sixfriendstrekking.com` (recommended, free)
Cloudflare Tunnel requires the **whole domain's DNS** to live on Cloudflare (free plan). The WordPress site and email stay where they are — only DNS *management* moves. Then a subdomain points to the home server while `www`/apex keep pointing to PrabhuHost.

Migration (one-time, do carefully):
1. Cloudflare free account → "Add site" `sixfriendstrekking.com`. It scans and imports existing DNS.
2. **Verify before switching** that these were imported: apex `A` → `192.250.235.32`, `www`, the **SPF TXT** above, any `MX`, and any cPanel/webmail/`mail`/`ftp` records you actually use. Missing MX/SPF = broken email.
3. Set the trekking-site records (`@`, `www`) to **DNS-only (grey cloud)** so Cloudflare doesn't proxy them — avoids cPanel AutoSSL surprises. (Proxying is optional/free CDN, but grey-cloud is the safe default.)
4. At PrabhuHost, change nameservers to the two Cloudflare ones. Wait for Cloudflare's activation email. **Site + email keep working** (records point to the same PrabhuHost IP).
5. Run the tunnel: `cloudflared tunnel route dns family-chat chat.sixfriendstrekking.com` → auto-creates the proxied subdomain to the home server.

Result: `www.sixfriendstrekking.com` = WordPress (unchanged) · `chat.sixfriendstrekking.com` = messenger. Independent after migration.

**Tradeoffs / risks:**
- One-time migration risk — if records aren't copied right, site/email can blip. Mitigate: lower TTL first, double-check records, migrate at a quiet hour.
- DNS is now managed at Cloudflare (easier panel, but a change for you).
- If PrabhuHost's panel won't expose nameserver changes, you may need their support to change them.
- **Cloudflare free ToS §2.8** restricts serving *disproportionate* video/large files through the CDN. A 5–20-person family's media is realistically fine, but heavy video sharing through the tunnel is a gray area — keep an eye on it; if ever flagged, serve media via a direct (non-proxied) path or B2.
- Coupling: the chat subdomain is discoverable (cert transparency logs), but it's auth-gated, so not a real exposure.

### A.2 Fallback if you do NOT want to move the domain's DNS
**Tailscale Funnel** — free public HTTPS at `your-machine.<tailnet>.ts.net`, outbound-only, works behind CGNAT, leaves `sixfriendstrekking.com` 100% untouched. Tradeoffs: ugly fixed hostname (not your brand), Funnel port/bandwidth limits, less "normal website" feel. Use only if you want zero risk to the trekking domain. (A CNAME from PrabhuHost to a Cloudflare tunnel does **not** work — the zone must be on Cloudflare.)

### A.3 The only real compromise of going 100% free: iPhone experience
No Apple Developer ($99) → iPhones use the **PWA** ("Add to Home Screen", iOS 16.4+):
- Web Push works but is **less reliable** for closed-app delivery.
- **No CallKit/VoIP push** → incoming calls can't *ring* when the app is fully closed on iPhone. In-app calls still work when open.
- Install friction (Safari → Share → Add to Home Screen) — make a 3-step picture guide for elderly relatives.
Android is unaffected and fully native via APK.

### A.4 Everything-free stack (no compromises beyond A.3)
| Need | Free choice | Note |
|---|---|---|
| Domain | `chat.sixfriendstrekking.com` | $0 (own it). |
| Tunnel + TLS + DNS | Cloudflare free | $0. |
| Backend / proxy | Pocketbase + Caddy | $0. |
| Push | Expo Push + free Firebase (FCM) | $0; Android full, iOS via PWA. |
| Android app | Direct **APK** sideload | $0; skip Play's $25. |
| iOS app | **PWA** | $0; see A.3. |
| 1:1 calls | STUN + Cloudflare TURN (free ≤1 TB/mo) | $0 at family scale. |
| Group calls | Link **hosted Jitsi** (meet.jit.si) | $0; external, not self-hosted. |
| Builds/updates | EAS free tier / `eas build --local`; OTA via EAS Update | $0; Android-only build needed if iOS=PWA. |
| Offsite backup | External USB ($0) + Backblaze B2 free 10 GB | $0. |
| Monitoring | Uptime Kuma + email/Telegram alerts | $0. |

**Net new cost to run everything: $0** (only your existing domain + electricity). The single tradeoff is the iPhone PWA experience in A.3.
