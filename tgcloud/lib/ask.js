import { api, db } from 'sdk';
import { eq, desc, and, gte } from 'sdk/db';
import { askMessages, users } from '../schema.js';
import { nowSeconds, validMessage, callbackId } from './pure.js';
import { getUser, setContext, updateUser, say, show, keys, throttle, isBlocked, report, block } from './core.js';

const askKeyboard = { inline_keyboard: [
  [{ text: '🔗 Моя ссылка', callback_data: 'ask:link' },
   { text: '📥 Входящие', callback_data: 'ask:inbox' }],
  [{ text: '🏠 Главное меню', callback_data: 'nav:home' }],
] };

export async function openAsk(userId, chatId, callbackMessage) {
  const user = await getUser(userId);
  await setContext(userId, 'ask');
  const info = await api.getMe();
  const link = 'https://t.me/' + info.username + '?start=ask_' + user.askCode;
  const text = '📩 UNONKA ASK\n\nТвоя персональная ссылка:\n' + link +
    '\n\nОтправь её друзьям или размести в профиле. Автор вопроса не раскрывается получателю.\n' +
    (user.askEnabled ? '✅ Приём сообщений включён.' : '🔕 Приём сообщений отключён.');
  return show(chatId, text, askKeyboard, callbackMessage);
}

export async function openAskLink(userId, chatId, code) {
  const recipient = await db.select().from(users).where(eq(users.askCode, code)).get();
  if (!recipient || !recipient.askEnabled || recipient.banned) {
    return say(chatId, 'Эта ссылка недоступна либо приём сообщений отключён.', keys.back);
  }
  if (recipient.tgId === userId) return openAsk(userId, chatId);
  if (await isBlocked(recipient.tgId, userId, 'ask')) {
    return say(chatId, 'Получатель не принимает сообщения от этого отправителя.', keys.back);
  }
  await setContext(userId, 'ask', 'ask_compose', recipient.tgId);
  return say(chatId,
    '✉️ Напиши анонимное сообщение одним текстом (до 2000 символов).\n\nТвой Telegram-профиль получателю не показывается. /cancel — отменить.',
    { inline_keyboard: [[{ text: 'Отменить', callback_data: 'nav:home' }]] });
}

export async function acceptAskText(user, chatId, text) {
  const body = validMessage(text);
  if (!body) return say(chatId, 'Нужно текстовое сообщение от 1 до 2000 символов.');
  if (!(await throttle(user.tgId, 5))) return say(chatId, 'Немного медленнее — между сообщениями должно пройти 5 секунд.');

  if (user.step === 'ask_compose') {
    const recipient = await getUser(user.contextId);
    if (!recipient || recipient.banned || !recipient.askEnabled ||
        recipient.tgId === user.tgId || (await isBlocked(recipient.tgId, user.tgId, 'ask'))) {
      await setContext(user.tgId, 'home');
      return say(chatId, 'Получатель больше не доступен.', keys.back);
    }
    const recent = await db.$count(askMessages,
      and(eq(askMessages.senderId, user.tgId), gte(askMessages.createdAt, nowSeconds() - 86400)));
    if (recent >= 20) return say(chatId, 'Лимит: не более 20 анонимных сообщений за сутки.');

    const [saved] = await db.insert(askMessages).values({
      senderId: user.tgId, recipientId: recipient.tgId,
      body, createdAt: nowSeconds(),
    }).returning().run();
    try {
      await api.sendMessage({
        chat_id: recipient.tgId,
        text: '📨 Новое анонимное сообщение:\n\n' + body,
        reply_markup: { inline_keyboard: [
          [{ text: '↩️ Ответить', callback_data: 'ask:reply:' + saved.id }],
          [{ text: '🚫 Заблокировать', callback_data: 'ask:block:' + saved.id },
           { text: '🚩 Жалоба', callback_data: 'ask:report:' + saved.id }],
        ] },
      });
    } catch (_) {
      await db.delete(askMessages).where(eq(askMessages.id, saved.id)).run();
      return say(chatId, 'Доставить сообщение не удалось. Попробуй позже.');
    }
    await setContext(user.tgId, 'home');
    return say(chatId, '✅ Сообщение отправлено анонимно.', keys.back);
  }

  if (user.step === 'ask_reply') {
    const original = await db.select().from(askMessages)
      .where(and(eq(askMessages.id, user.contextId), eq(askMessages.recipientId, user.tgId))).get();
    if (!original) {
      await setContext(user.tgId, 'home');
      return say(chatId, 'Исходное сообщение больше не найдено.', keys.back);
    }
    if (await isBlocked(user.tgId, original.senderId, 'ask')) {
      await setContext(user.tgId, 'home');
      return say(chatId, 'Отправитель заблокирован.', keys.back);
    }
    try {
      await api.sendMessage({ chat_id: original.senderId,
        text: '💌 Ответ на твоё анонимное сообщение:\n\n' + body });
    } catch (_) { return say(chatId, 'Не удалось доставить ответ.'); }
    await setContext(user.tgId, 'home');
    return say(chatId, '✅ Ответ доставлен.', keys.back);
  }
}

export async function handleAskCallback(userId, chatId, data, message) {
  if (data === 'ask:link') return openAsk(userId, chatId, message);
  if (data === 'ask:inbox') {
    const entries = await db.select().from(askMessages)
      .where(eq(askMessages.recipientId, userId)).orderBy(desc(askMessages.id)).limit(10).all();
    if (!entries.length) return show(chatId, '📥 Пока нет анонимных сообщений.', askKeyboard, message);
    const rows = entries.map((entry) =>
      [{ text: '#' + entry.id + ' · ' + entry.body.replace(/\s+/g, ' ').slice(0, 24),
         callback_data: 'ask:view:' + entry.id }]);
    rows.push([{ text: '🏠 Главное меню', callback_data: 'nav:home' }]);
    return show(chatId, '📥 Последние 10 сообщений. Выбери, чтобы ответить:', { inline_keyboard: rows }, message);
  }
  if (data === 'ask:toggle') {
    const user = await getUser(userId);
    await updateUser(userId, { askEnabled: !user.askEnabled });
    return openAsk(userId, chatId, message);
  }
  const id = callbackId(data, 'ask:reply:') || callbackId(data, 'ask:view:') ||
    callbackId(data, 'ask:block:') || callbackId(data, 'ask:report:');
  if (!id) return say(chatId, 'Кнопка устарела.', keys.back);
  const original = await db.select().from(askMessages)
    .where(and(eq(askMessages.id, id), eq(askMessages.recipientId, userId))).get();
  if (!original) return say(chatId, 'Сообщение не найдено.', keys.back);
  if (data.startsWith('ask:block:')) {
    await block(userId, original.senderId, 'ask');
    return say(chatId, '🚫 Отправитель заблокирован, его личность не раскрыта.', keys.back);
  }
  if (data.startsWith('ask:report:')) {
    await report(userId, original.senderId, 'ask');
    return say(chatId, '🚩 Жалоба сохранена. Отправитель заблокирован.', keys.back);
  }
  await setContext(userId, 'ask', 'ask_reply', id);
  return say(chatId, '↩️ Ответь текстом на сообщение:\n\n' + original.body + '\n\n/cancel — отмена.', keys.back);
}
