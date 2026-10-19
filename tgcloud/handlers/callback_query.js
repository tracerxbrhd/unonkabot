import { ensureUser, getUser, updateUser, home, settings, requireAdult, privacy,
  eraseAccount, say, keys } from '../lib/core.js';
import { openAsk, handleAskCallback } from '../lib/ask.js';
import { stopChat, findChat, handleChatCallback } from '../lib/chat.js';
import { openMeet, handleMeetCallback } from '../lib/meet.js';
import { api } from 'sdk';

export default async function (query) {
  if (!query?.from || !query.message || query.message.chat?.type !== 'private') return;
  try { await api.answerCallbackQuery({ callback_query_id: query.id }); } catch (_) { /* Expired. */ }
  const user = await ensureUser(query.from);
  if (!user) return;
  const id = user.tgId;
  const chatId = query.message.chat.id;
  const data = query.data || '';
  if (user.banned) return say(chatId, 'Доступ к UNONKA ограничен.');

  if (data === 'nav:home') {
    await stopChat(id);
    return home(id, chatId, query.message);
  }
  if (data === 'nav:settings') {
    await stopChat(id);
    return settings(id, chatId, query.message);
  }
  if (data === 'nav:ask') {
    await stopChat(id);
    return openAsk(id, chatId, query.message);
  }
  if (data === 'nav:chat') {
    if (!(await requireAdult(id, chatId, 'chat', query.message))) return;
    return findChat(id, chatId, query.message);
  }
  if (data === 'nav:meet') {
    if (!(await requireAdult(id, chatId, 'meet', query.message))) return;
    await stopChat(id);
    return openMeet(id, chatId, query.message);
  }
  if (data === 'adult:yes:chat' || data === 'adult:yes:meet') {
    await updateUser(id, { ageConfirmed: true });
    if (data.endsWith(':chat')) return findChat(id, chatId);
    await stopChat(id);
    return openMeet(id, chatId);
  }
  if (data === 'core:delete:yes') {
    await eraseAccount(id);
    return say(chatId, 'Данные аккаунта удалены. Чтобы начать заново, отправь /start.');
  }
  if (data.startsWith('ask:')) {
    await stopChat(id);
    return handleAskCallback(id, chatId, data, query.message);
  }
  if (data.startsWith('chat:')) {
    if (!(await requireAdult(id, chatId, 'chat', query.message))) return;
    return handleChatCallback(id, chatId, data, query.message);
  }
  if (data.startsWith('meet:')) {
    if (!(await requireAdult(id, chatId, 'meet', query.message))) return;
    await stopChat(id);
    return handleMeetCallback(id, chatId, data, query.message);
  }
  return say(chatId, 'Кнопка устарела. Открой главное меню.', keys.back);
}
