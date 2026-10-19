import { ensureUser, home, say, privacy, deletionKeyboard, keys, requireAdult } from '../lib/core.js';
import { parseStartParameter, messageRoute } from '../lib/pure.js';
import { openAsk, openAskLink, acceptAskText } from '../lib/ask.js';
import { findChat, chatText, stopChat } from '../lib/chat.js';
import { openMeet, meetInput, meetChatText } from '../lib/meet.js';

export default async function (message) {
  if (!message?.from || message.chat?.type !== 'private') return;
  const user = await ensureUser(message.from);
  if (!user) return;
  const id = user.tgId;
  const chatId = message.chat.id;
  if (user.banned) return say(chatId, 'Доступ к UNONKA ограничен.');

  const text = (message.text || '').trim();
  const start = parseStartParameter(text);
  if (start) {
    await stopChat(id);
    if (start.kind === 'ask') return openAskLink(id, chatId, start.code);
    return home(id, chatId);
  }

  if (/^\/(menu|cancel)(?:@\w+)?$/.test(text)) {
    await stopChat(id);
    return home(id, chatId);
  }
  if (/^\/stop(?:@\w+)?$/.test(text)) {
    await stopChat(id);
    return home(id, chatId);
  }
  if (/^\/next(?:@\w+)?$/.test(text)) {
    if (!(await requireAdult(id, chatId, 'chat'))) return;
    await stopChat(id);
    return findChat(id, chatId);
  }
  if (/^\/help(?:@\w+)?$/.test(text)) {
    return say(chatId,
      'Команды:\n/start, /menu — главное меню\n/cancel — отменить ввод\n' +
      '/ask — мои анонимные вопросы\n/chat — случайный чат\n/meet — знакомства\n' +
      '/next — другой собеседник в CHAT\n/stop — остановить CHAT\n' +
      '/privacy — приватность\n/delete — удалить аккаунт', keys.back);
  }
  if (/^\/privacy(?:@\w+)?$/.test(text)) return privacy(chatId);
  if (/^\/delete(?:@\w+)?$/.test(text)) {
    return say(chatId, '⚠️ Удаление необратимо: анкета, симпатии, личные сообщения и связи будут удалены.\n\nПодтвердить удаление?',
      deletionKeyboard);
  }
  if (/^\/ask(?:@\w+)?$/.test(text)) {
    await stopChat(id);
    return openAsk(id, chatId);
  }
  if (/^\/chat(?:@\w+)?$/.test(text)) {
    if (!(await requireAdult(id, chatId, 'chat'))) return;
    return findChat(id, chatId);
  }
  if (/^\/meet(?:@\w+)?$/.test(text)) {
    if (!(await requireAdult(id, chatId, 'meet'))) return;
    await stopChat(id);
    return openMeet(id, chatId);
  }
  if (text.startsWith('/')) return say(chatId, 'Неизвестная команда. Используй /help или /menu.', keys.back);

  // Persistent state is the sole authority for routing. Never guess the recipient.
  const route = messageRoute(user);
  if (route === 'ask') return acceptAskText(user, chatId, message.text);
  if (route === 'meet_wizard') return meetInput(user, chatId, message);
  if (route === 'chat') return chatText(user, chatId, message.text);
  if (route === 'meet_chat') return meetChatText(user, chatId, message.text);

  return say(chatId, 'Выбери сервис из меню, чтобы начать.', keys.home);
}
