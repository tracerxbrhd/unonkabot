# Three-account acceptance checklist (Telegram)

Use separate Telegram accounts A, B and C on your phone. Deploy first.
Age confirmation for CHAT and MEET is self-declared; no document check.

## Basic
- [ ] A, B, C: /start shows ASK, CHAT, MEET and settings.
- [ ] /menu, /cancel, /help and /privacy work.
- [ ] CHAT and MEET require 18+ self-confirmation.
- [ ] No Telegram username/user ID leaks in relayed anonymous text.

## ASK
- [ ] A shares the personal ASK link with B; B opens and sends text.
- [ ] A sees the question without B's identity; A replies; B receives it.
- [ ] C can independently send to A.
- [ ] A blocks B through question controls; B cannot send to A thereafter.
- [ ] A disables ASK; B/C cannot send using the link.
- [ ] >2000 characters and too-frequent messages are rejected.
- [ ] Reply context can be canceled without later text reaching B.

## CHAT
- [ ] A searches (waits), B searches (pairs with A).
- [ ] A sends plain text; B receives, C does not. B replies; A receives.
- [ ] C searches while A-B pair is active; remains waiting.
- [ ] A chooses Next and should pair with waiting C (or search).
- [ ] Old B session cannot relay into A's new chat with C.
- [ ] A reports a peer: the peer is blocked from a rematch.
- [ ] A sends photo: no photo is delivered to the peer.
- [ ] /menu ends a paired chat and alerts the peer.

## MEET
- [ ] A/B/C each complete profiles; underage 17 rejected.
- [ ] Reciprocal seeking preferences filter available cards.
- [ ] A likes B; B likes A; both see matching notification.
- [ ] A opens matched B, sends text. B taps Reply and answers A.
- [ ] C never gets A/B private messages.
- [ ] A hides profile; it is not available in new discovery.
- [ ] Changing services does not send text to an old match implicitly.

## Account deletion
- [ ] /delete asks for confirmation. Cancellation preserves data.
- [ ] Confirm removes A's ASK messages, profile, votes and matches.
- [ ] B/C continue to function after A is deleted.

Known limits: no moderation dashboard or real age verification.
Closed test only until privacy and abuse handling are production-ready.
