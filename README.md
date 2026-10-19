# UNONKA v0.1

One Telegram bot. Three services: **ASK** (anonymous questions), **CHAT**
(random anonymous text conversations), **MEET** (dating profiles and matches).

The v0.1 release uses Telegram Cloud Serverless and its built-in SQLite database.
All interaction is through native Telegram bot messages and inline buttons.
A Mini App may be added later as a second interface to the same domain logic.

## What's implemented
- ASK: personal deep link, anonymous send, recipient reply, inbox, block/report,
  opt-out, 20 sends/day and 5-second rate limiting.
- CHAT: 18+ self-attestation, search queue, atomically reserved pairs,
  text-only relay, next/stop, block/report, 10-minute queue lease.
- MEET: 18+ self-attestation, profile wizard and photo, reciprocal filters,
  like/skip, mutual match notifications, text conversations via the bot,
  profile edit/visibility and reports.
- CORE: explicit cross-mode routing, Russian menus, privacy notice and
  account deletion.
- Infrastructure: built-in SQLite, CI and main-branch tgcloud deployment.

## Start testing
1. In BotFather, enable **Serverless** for your bot.
2. Generate **CLI Access** token under Serverless (not normal Bot API token).
3. Set GitHub repository secret **TGCLOUD_TOKEN**.
4. Merge the implementation PR into main and inspect Actions → Deploy UNONKA.
5. Test with three distinct Telegram accounts; follow docs/QA.md.

Bot commands: /start, /menu, /ask, /chat, /meet, /next, /stop,
/cancel, /help, /privacy, /delete.

## Local checks
Requires Node.js 22 or newer:
- npm install
- npm run check
- npm test

The production CLI is a dev dependency only; runtime code imports solely from
Telegram Serverless sdk and local relative JavaScript modules.

## Architecture and Codex
- AGENTS.md — strict platform rules and future agent handoff.
- docs/ARCHITECTURE.md — modules, data, security and state separation.
- docs/GDD.md — product scope and flows.
- docs/QA.md — three-account manual acceptance checks.
- docs/DEPLOY.md — deployment runbook.

## Release status / important limits
This is a **closed-testing MVP**, not a fully moderated public platform.
No identity reveal; participants are anonymous **to each other**, not to the
bot operator. MEET and CHAT age gate is self-attestation only.
No complete public privacy policy, administrative review UI, real age
verification, media moderation or external backups yet.
Do not invite a broad public audience before those are addressed.
