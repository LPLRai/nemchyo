# Backend — Pocketbase (local dev)

The messenger's backend: database + auth + realtime + file storage + access rules.
Single binary, no installer. This folder runs on your Windows PC for development;
the exact same setup (binary + `pb_migrations/`) later goes on the Ubuntu server.

## Run it
- **Easiest:** double-click `start-backend.cmd`.
- **Or** in a terminal here: `./pocketbase.exe serve --http=127.0.0.1:8090`
- Stop it: press `Ctrl+C` in that window.

## URLs
- **Admin UI (you):** http://127.0.0.1:8090/_/
- **API base (the app):** http://127.0.0.1:8090/api/

## Accounts (LOCAL DEV ONLY — change before deploying)
| Role | Login | Password |
|---|---|---|
| Superuser (admin) | `admin@sixfriends.local` | `Family-Admin-2026!` |
| Test user | `alice@test.local` | `Test-1234!` |
| Test user | `bob@test.local` | `Test-1234!` |
| Test user (non-member) | `carol@test.local` | `Test-1234!` |

Alice & Bob are members of a "Test Family" chat with one message; Carol is not a
member (used to confirm access rules block outsiders).

## Schema (defined in `pb_migrations/1781913600_init_messenger_schema.js`)
- **users** (auth) — + `display_name`, `about`, `last_seen`, `presence_public`, `read_receipts_public`
- **chats** — `type` (direct/group/family/announcement), `name`, `description`, `photo`, `admin_only_posting`, `created_by`
- **chat_members** — `chat`, `user`, `role` (member/admin/owner), `last_read_at`, `muted_until`, `pinned`, `archived`, `draft`
- **messages** — `chat`, `sender`, `type`, `body`, `edited_at`, `deleted_for_everyone`

**Access rule (enforced by the DB):** you can only read/write chats you're a member
of; only admins/owners can edit a chat; only the sender can edit/delete their message.

## Notes
- `pb_data/` is your local database + uploads. It is **not** meant to be committed or
  copied to the server — on the server the schema is recreated from `pb_migrations/`.
- To add/change schema later: edit a migration in `pb_migrations/`, then restart the
  server (migrations auto-apply on start) or run `pocketbase.exe migrate up`.
