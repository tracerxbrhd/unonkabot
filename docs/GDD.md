# UNONKA GDD v0.1

**ASK**: Users get a personalized public Telegram deep link. Another user opens
it, composes a text question (max 2000 chars), recipient sees it anonymously.
Recipient can reply, block or report. Incoming messages can be switched off.
Sender capped at 20 questions per rolling 24h and 5 seconds between sends.

**CHAT**: User self-confirms age 18+, enters a matching queue and meets another
waiting user. Conversations relay plain text through bot, never native forwards.
Next/Stop/Report allow leaving or blocking; queue entry expires after 10 min.
No guarantee anyone will be online at the same time.

**MEET**: A familiar dating bot (DaVinChik-like interaction): user confirms 18+,
creates name/age/city/gender/preference/bio/photo, browses suitable profiles,
likes or skips them. Mutual likes create a permanent match and allow a private
conversation through the bot. Profiles can be edited or hidden. Discovery uses
mutual gender preferences; city is for display only in v0.1.

**CORE**: One set of settings, account deletion, clear service navigation, basic
spam and abuse controls. Telegram bot is canonical UX. Future Mini App will
expose the same business functions with a visual front-end.
