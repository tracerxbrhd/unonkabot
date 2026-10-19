# UNONKA — instructions for Codex and coding agents

The first MVP is owned and implemented through the ChatGPT conversation.
Continue work from the repository; do not redesign the approved architecture.

## Product decisions
- ONE Telegram bot and ONE tgcloud SQLite database.
- Three logically isolated services: ASK, CHAT, MEET.
- No Mini App in v0.1; later Mini App is only another interface.
- Russian UI text and inline keyboards; slash commands are shortcuts.
- Anonymous means hidden from *other users*, not invisible to the backend.
- Never disclose Telegram ID, username, deep-link sender identity, or
  moderation target to another user without the person's explicit consent.
- CHAT is text-only; MEET is a dating profile bot with mutual likes.
- Never build paid deanonymization or synthetic anonymous interactions.

## Telegram Serverless runtime
- Runtime code belongs under tgcloud/schema.js, tgcloud/handlers and tgcloud/lib.
- The runtime is isolated V8, not Node.js: no npm/runtime dependencies,
  process, file system, background loops or self-hosted WebSockets.
- sdk and sdk/db are platform imports. Local imports need .js extensions.
- Every db terminal (get/all/run/count) is async and must be awaited.
- No foreign keys; enforce ownership and cleanup in service modules.
- Explicit chat_id for Bot API calls. CallbackQuery handler gets the payload,
  not the entire Update.
- Protect every callback data ID by rechecking the actor's authorization.
- CHAT pairing must update both queue rows in ONE atomic SQL statement.
- Never forward native Telegram Message objects in anonymous CHAT.
- Mode and step in unonka_users control outgoing message recipient.
- Keep all secrets in GitHub Actions settings, not source files.

## Delivery contract
- Tests: npm run check, npm test, plus docs/QA.md three-account walkthrough.
- Every feature change needs safety review for user identity and mode routing.
- Use a feature branch and PR; never directly commit business code to main.
- main automatically deploys with .github/workflows/deploy.yml.
- Schema changes use safe migrations only in CI; no migrate --yes.
- No automatic PR merging. Preserve existing state and user data.

## Platform documentation
https://blogfork.telegram.org/bots/serverless
