# UNONKA architecture v0.1

Telegram update handlers → shared service layer → one built-in SQLite DB.
There is no VPS, Redis or Mini App in v0.1.

## Data model
- unonka_users: Telegram identity, current mode, input step, context ID,
  age self-confirmation, ASK code and settings.
- unonka_ask_messages: anonymous sender/recipient mapping and message text.
- unonka_blocks: directed blocks by service.
- unonka_chat_queue: waiting or paired, with reciprocal peer_id.
- unonka_meet_drafts: partially filled dating profile.
- unonka_profiles: published profiles, visibility, photo file_id.
- unonka_meet_votes: one decision per directed profile pair.
- unonka_meet_pairs: confirmed mutual match using canonical pair key.
- unonka_reports: abuse reports for operator review.

## Routing invariants
- home/settings: input never forwarded to another user.
- ask + ask_compose: new question to validated context recipient.
- ask + ask_reply: response only to sender of ASK message owned by user.
- chat: send only after validating two reciprocal paired queue rows.
- meet + meet_*: profile wizard input; no messaging.
- meet_chat: send only to validated active mutual match.
- /menu, /cancel and navigation to another service terminate CHAT session.
- Clicking a reply action makes the destination explicit; incoming messages
  from another service do not silently change context.

## CHAT matching
A candidate is eligible only when their queue row is waiting and younger than
10 minutes; blocked pairs are ineligible. A single parameterized SQLite UPDATE
modifies both queue rows if and only if both are still waiting. Success means
exactly two rows affected. Do not replace with two independent updates.
No runtime background state is used.

## Auth, privacy, safety
The server observes Telegram IDs and message bodies. Sender identity is withheld
from other users, not from the bot operator; there is no E2E encryption.
18+ for CHAT/MEET is **self-attestation**, not true age verification.
Only raw text content is relayed in CHAT and MEET; private photos are limited
to user-supplied MEET profile pictures.
Actions on ASK messages must verify ownership; MEET chat checks an existing
mutual match. Block and report do not reveal the offender to the reporter.

tgcloud does not enforce foreign keys. Account deletion removes associated
relationships explicitly. Operator abuse reports are retained only until
the relevant account is deleted.

## Known limits and later extensions
- MEET discovery scans bounded pages (up to 1000 profiles), sorted by ID.
- No recommendation engine, geo search or ranking.
- No admin dashboard, formal moderation workflow, verified age check,
  external DB backup or production-grade privacy policy.
- Mini App should use tgcloud endpoints with verified initData and reuse this
  same service layer.
- Start with a closed three-account test before any broader release.
