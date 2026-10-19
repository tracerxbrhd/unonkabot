# Deployment runbook

## Once
1. Enable Serverless in BotFather for the UNONKA bot.
2. Generate BotFather → Serverless → CLI Access token, NOT the Bot API token.
3. Add repository secret TGCLOUD_TOKEN under Settings → Secrets and variables → Actions.
4. Merge a reviewed PR into main to trigger .github/workflows/deploy.yml.
5. Confirm green CI/deployment and perform docs/QA.md test with three accounts.

## CI
- PR runs npm install, JavaScript syntax checks and Node built-in unit tests.
- main push runs same validation, followed by tgcloud fetch, push, migrate --safe,
  webhook sync. It uses only the secret from GitHub Actions environment.
- A new database is created via safe additive migrations after first code push.
  Avoid user activity during that short first rollout.
- No --force or destructive migrations in automation. Review any warning/manual
  schema change and plan a separate data-safe migration.
- Never edit production modules in BotFather after GitHub takes ownership:
  the next action may conflict with the server revision.

## Developer
- npm install
- npm run check
- npm test
- npx tgcloud status (requires login or TGCLOUD_TOKEN)
- npx tgcloud run handlers/message with a private Telegram Message JSON payload

When running a handler against a live app, use disposable test users: the
handler can alter the shared database even without publishing new code.

## Before opening to public
Prepare legally adequate privacy policy, age safety plan, human moderation and
abuse workflow, retention/deletion policy, backup plan and monitoring.
