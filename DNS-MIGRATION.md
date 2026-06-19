# DNS Migration Guide — moving `sixfriendstrekking.com` to Cloudflare

**Goal:** move DNS *management* to Cloudflare (free) so you can use `chat.sixfriendstrekking.com` for the messenger — **without changing or breaking your WordPress site or email.**

**What moves:** only the DNS "phone book."
**What does NOT move:** your website files, WordPress, hosting, and email all stay exactly where they are (PrabhuHost). Your domain stays *registered* at PrabhuHost too — this is only a nameserver change, not a domain transfer. **No cost.**
**Reversible:** if anything looks wrong, switch the nameservers back to PrabhuHost and you're exactly where you started.

---

## ⚠️ The single most important rule

When Cloudflare imports your records, set **every existing record to "DNS only" (grey cloud ☁️), NOT "Proxied" (orange cloud 🟠).**

Two reasons this matters here:
1. **Email will break if the apex is proxied.** Your `MX` record points mail at `sixfriendstrekking.com` itself. If that apex `A` record is orange-clouded, mail servers hit Cloudflare's proxy (which doesn't do email) and delivery fails.
2. **Your website's SSL certificate can break.** PrabhuHost auto-renews your HTTPS certificate using a method that fails when traffic is proxied. Grey-cloud avoids it.

The **only** record that will ever be orange/proxied is `chat` — and you won't create that by hand; the Cloudflare Tunnel creates it automatically later.

---

## Your current DNS records — verify Cloudflare imported ALL of these

Captured 2026-06-19. After Cloudflare scans your domain, check its list against this table and **manually add anything missing.**

| Type | Name | Value / Target | Set to | Why it matters |
|---|---|---|---|---|
| **A** | `@` (sixfriendstrekking.com) | `192.250.235.32` | **DNS only ☁️** | Your website **and** mail target. Must be grey or email breaks. |
| **CNAME** | `www` | `sixfriendstrekking.com` | **DNS only ☁️** | Website (`www.` version). |
| **CNAME** | `mail` | `sixfriendstrekking.com` | **DNS only ☁️** | Email server hostname. |
| **MX** | `@` | `sixfriendstrekking.com` (priority **0**) | n/a | Routes incoming email. **Easy to miss — confirm it's there.** |
| **TXT** | `@` | `v=spf1 ip4:192.250.235.32 include:spf.mysecurecloudhost.com +a +mx +ip4:23.106.66.242 ~all` | n/a | SPF — keeps your email from being marked spam. |
| **TXT** | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArBGHqS2vdWfYXbN9boq4qaIOTdlpdu2UNEk6Yu5G+VcjJnjwnvLjNWqIuF2QCmPgjlec4XPFzyadLnoBCRCOQQJdZ6BGGvkJAW9kvuWh+sx24Zur+cNHBSyVGN0VXt47lsywcE0zMLlCN6ZbF2wuQjYjxvNcUzNdGsXJhU2svgrljSTE4Vx0nKFuQclrt/mL1vq6jD6zVnHHCKaRuQpesSKXdknddH8dVxIK7SlB8Oilzq29NzWdoxcPjIdRiys9pnP1mzRRFi1p2xCRou2CTzsVNTX9DKX4iTmPySto8CAV9MrqYC5ZxULLhckoRqkJeZj/ZCsywNgvbcntfGao0QIDAQAB;` | n/a | DKIM — signs your outgoing email. Long value; paste exactly. |
| **A** | `cpanel` | `192.250.235.32` | **DNS only ☁️** | cPanel control-panel access. |
| **A** | `webmail` | `192.250.235.32` | **DNS only ☁️** | Webmail login page. |
| **A** | `autodiscover` | `192.250.235.32` | **DNS only ☁️** | Lets phone/Outlook mail apps auto-configure. |
| **A** | `ftp` | `192.250.235.32` | **DNS only ☁️** | FTP access (if you use it). |

> No `DMARC`, `CAA`, or `AAAA` (IPv6) records exist today — nothing to copy there.
> **Current nameservers (write these down for rollback):** `ns50.prabhuhost.com`, `ns51.prabhuhost.com`

---

## Before you start
- Do it at a **quiet time** (evening) so a brief hiccup affects no one.
- Have your **PrabhuHost client-area login** ready (their billing/client portal, e.g. `prabhuhost.com` → Client Login). You'll change nameservers there.
- Have a phone on **mobile data** (not home Wi-Fi) handy, to test the site from "outside."
- Budget ~20 minutes of work, then up to a few hours (occasionally up to 24h) of waiting for the change to spread.

---

## Step 1 — Create a free Cloudflare account
1. Go to `https://dash.cloudflare.com/sign-up`, register, verify your email. **No credit card needed** for the Free plan.
2. Click **Add a site** (or **Add a domain**) → type `sixfriendstrekking.com` → **Continue**.
3. Choose the **Free** plan → **Continue**.

## Step 2 — Let it scan, then verify every record
1. Cloudflare automatically scans and lists the records it found. Give it a moment.
2. **Compare its list to the table above.** For anything missing, click **Add record** and recreate it exactly (especially **MX**, **SPF TXT**, and the **DKIM TXT** — these are the ones scanners sometimes miss).
3. Double-check the DKIM value pasted in full (it's long and must match exactly).

## Step 3 — Force everything to "DNS only" (grey cloud)
For **each** record that shows a cloud icon (the A and CNAME records), click the **orange cloud** so it turns **grey ☁️ ("DNS only")**. MX and TXT records have no cloud — leave them as-is.
> Result: every record is grey. This is the safe state that keeps your site + email identical to now.

## Step 4 — Copy Cloudflare's two nameservers
Cloudflare now shows **two nameservers** to use, like:
```
xxxx.ns.cloudflare.com
yyyy.ns.cloudflare.com
```
Copy both exactly (yours will have different names).

## Step 5 — Change nameservers at PrabhuHost
1. Log in to your **PrabhuHost client area** → **Domains** → **My Domains** → select `sixfriendstrekking.com` → **Manage / Nameservers** (sometimes "Nameservers" in the left menu).
2. Choose **Use custom nameservers** and **replace** `ns50.prabhuhost.com` / `ns51.prabhuhost.com` with Cloudflare's two → **Save / Change Nameservers**.
3. **Can't find the option?** Open a PrabhuHost support ticket: *"Please change the nameservers for sixfriendstrekking.com to `xxxx.ns.cloudflare.com` and `yyyy.ns.cloudflare.com`."* This is a routine request.
4. Back in Cloudflare, click **Done, check nameservers**.

## Step 6 — Wait for activation
- Cloudflare emails you **"sixfriendstrekking.com is now active"** when the switch completes (usually minutes to a few hours; rarely up to 24–48h).
- Until then, your site/email keep working off the old nameservers. There is no downtime if records were copied correctly.

## Step 7 — Verify (do all four)
1. **Website:** open `https://www.sixfriendstrekking.com` on **mobile data** → it loads normally, padlock intact.
2. **Apex:** open `https://sixfriendstrekking.com` → loads normally.
3. **Email:** send a test email **to** a `@sixfriendstrekking.com` mailbox (if you use one) and/or submit your site's **contact form**, confirm it arrives. Send one **from** it too if possible.
4. **Records check:** at `https://dnschecker.org`, look up `MX` and `TXT` for `sixfriendstrekking.com` → they match the table above.

✅ If all four pass, the migration is done and safe.

---

## Rollback (if anything looks wrong)
In the PrabhuHost client area, set the nameservers back to `ns50.prabhuhost.com` / `ns51.prabhuhost.com` and save. Within a few hours everything returns to exactly how it was. Nothing was deleted on the host.

---

## What happens next (after "active")
You do **not** add the `chat` record by hand. When we set up the home server, this command on the laptop creates `chat.sixfriendstrekking.com` automatically (orange/proxied — the one exception to the grey-cloud rule):
```
cloudflared tunnel route dns family-chat chat.sixfriendstrekking.com
```
After that: `www` = your trekking site (unchanged) · `chat` = the messenger. Independent forever.

---

## Common pitfalls (avoid these)
- ❌ Leaving the apex/`www` **orange-clouded** → breaks email and/or site SSL. Keep them **grey**.
- ❌ Forgetting the **MX** record → incoming email to the domain stops. Re-add it (target `sixfriendstrekking.com`, priority `0`).
- ❌ Truncating the **DKIM** TXT value → outgoing mail looks unsigned/spammy. Paste it whole.
- ❌ Doing a domain **transfer** instead of a **nameserver change** — you do **not** need to transfer the domain. Only change nameservers.
- ❌ Panicking during propagation — old and new can both answer for a few hours; that's normal.
