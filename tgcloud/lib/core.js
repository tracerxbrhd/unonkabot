import { api, db } from 'sdk';
import { eq, and, or } from 'sdk/db';
import { users, blocks, reports, askMessages, chatQueue, meetDrafts, profiles, meetVotes, meetPairs } from '../schema.js';
import { askLocator, nowSeconds } from './pure.js';

export const keys = {
  home: { inline_keyboard: [
    [{ text: '📩 ASK · Анонимные сообщения', callback_data: 'nav:ask' }],
    [{ text: '🎭 CHAT · Случайный чат', callback_data: 'nav:chat' }],
    [{ text: '💕 MEET · Знакомства', callback_data: 'nav:meet' }],
    [{ text: '⚙️ Настройки и приватность', callback_data: 'nav:settings' }],
  ] },
  back: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'nav:home' }]] },
};

export async function ensureUser(from) {
  if (!from || !Number.isSafeInteger(from.id) || from.is_bot) return null;
  const name = (from.first_name || 'Друг').slice(0, 64);
  await db.insert(users).values({
    tgId: from.id, firstName: name, username: from.username || null,
    askCode: askLocator(), createdAt: nowSeconds(),
  }).onConflictDoUpdate({
    target: users.tgId,
    set: { firstName: name, username: from.username || null },
  }).run();
  return db.select().from(users).where(eq(users.tgId, from.id)).get();
}

export async function getUser(id) {
  return db.select().from(users).where(eq(users.tgId, id)).get();
}

export async function updateUser(id, values) {
  await db.update(users).set(values).where(eq(users.tgId, id)).run();
}

export async function setContext(id, mode, step = '', contextId = 0) {
  await updateUser(id, { mode, step, contextId });
}

export async function say(chatId, text, replyMarkup) {
  const payload = { chat_id: chatId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return api.sendMessage(payload);
}

export async function show(chatId, text, replyMarkup, callbackMessage) {
  if (callbackMessage && callbackMessage.chat && callbackMessage.message_id && !callbackMessage.photo) {
    try {
      return await api.editMessageText({
        chat_id: chatId, message_id: callbackMessage.message_id,
        text, reply_markup: replyMarkup,
      });
    } catch (_) { /* The old message may be too old or already unchanged. */ }
  }
  return say(chatId, text, replyMarkup);
}

export async function home(userId, chatId, callbackMessage) {
  await setContext(userId, 'home');
  return show(chatId, '🌘 UNONKA\n\nАнонимные вопросы, случайные диалоги и знакомства — всё в одном боте.\n\nВыбери, что хочешь делать:', keys.home, callbackMessage);
}

export async function settings(userId, chatId, callbackMessage) {
  const u = await getUser(userId);
  await setContext(userId, 'settings');
  return show(chatId,
    '⚙️ Настройки UNONKA\n\nАнонимные сообщения: ' + (u.askEnabled ? 'включены' : 'выключены') +
    '\nВозраст 18+: ' + (u.ageConfirmed ? 'подтверждён самостоятельно' : 'не подтверждён') +
    '\n\n/delete — удалить аккаунт и связанные с ним данные.\n/privacy — о приватности.',
    { inline_keyboard: [
      [{ text: u.askEnabled ? '🔕 Отключить ASK' : '🔔 Включить ASK', callback_data: 'ask:toggle' }],
      [{ text: '🏠 Главное меню', callback_data: 'nav:home' }],
    ] }, callbackMessage);
}

export async function requireAdult(userId, chatId, destination, callbackMessage) {
  const u = await getUser(userId);
  if (u.ageConfirmed) return true;
  await show(chatId,
    '🔞 CHAT и MEET предназначены только для совершеннолетних (18+).\n\nПодтверждая, ты заявляешь, что тебе исполнилось 18 лет. Это самоподтверждение, не проверка документа.',
    { inline_keyboard: [
      [{ text: 'Мне есть 18 лет', callback_data: 'adult:yes:' + destination }],
      [{ text: 'Назад', callback_data: 'nav:home' }],
    ] }, callbackMessage);
  return false;
}

export async function isBlocked(actorId, targetId, scope) {
  const result = await db.select().from(blocks)
    .where(and(eq(blocks.actorId, actorId), eq(blocks.targetId, targetId), eq(blocks.scope, scope))).get();
  return Boolean(result);
}

export async function anyBlock(a, b, scope) {
  return (await isBlocked(a, b, scope)) || (await isBlocked(b, a, scope));
}

export async function block(actorId, targetId, scope) {
  if (actorId === targetId) return;
  await db.run(
    'INSERT OR IGNORE INTO unonka_blocks (actor_id, target_id, scope, created_at) VALUES (:actor, :target, :scope, :created)',
    { ':actor': actorId, ':target': targetId, ':scope': scope, ':created': nowSeconds() },
  );
}

export async function report(actorId, targetId, scope, reason = 'user_report') {
  if (actorId === targetId) return;
  await db.run(
    'INSERT OR IGNORE INTO unonka_reports (reporter_id, target_id, scope, reason, created_at) VALUES (:actor, :target, :scope, :reason, :time)',
    { ':actor': actorId, ':target': targetId, ':scope': scope, ':reason': reason, ':time': nowSeconds() },
  );
  await block(actorId, targetId, scope);
}

export async function throttle(userId, seconds) {
  const t = nowSeconds();
  const result = await db.run(
    'UPDATE unonka_users SET last_sent_at = :now WHERE tg_id = :uid AND last_sent_at <= :limit',
    { ':now': t, ':uid': userId, ':limit': t - seconds },
  );
  return result.rowsAffected === 1;
}

export async function privacy(chatId) {
  return say(chatId, '🔐 Приватность UNONKA\n\n' +
    'Другие участники не получают твой Telegram ID и username автоматически. Но бот обрабатывает идентификаторы участников, текст переписки и анкеты для работы сервиса и жалоб.\n' +
    'Это не end-to-end шифрованный и не полностью анонимный перед владельцем бота сервис.\n' +
    'В CHAT пересылается только обычный текст. Не отправляй пароли, адреса и другие чувствительные данные.\n' +
    'Команда /delete удаляет твою учётную запись и связанные данные. Для безопасного публичного запуска требуется отдельная полная политика конфиденциальности.',
    keys.back);
}

export async function eraseAccount(userId) {
  // Delete both halves of any live anonymous session and all account associations.
  await db.run('DELETE FROM unonka_chat_queue WHERE user_id = :id OR peer_id = :id', { ':id': userId });
  await db.delete(askMessages).where(or(eq(askMessages.senderId, userId), eq(askMessages.recipientId, userId))).run();
  await db.delete(blocks).where(or(eq(blocks.actorId, userId), eq(blocks.targetId, userId))).run();
  await db.delete(meetVotes).where(or(eq(meetVotes.voterId, userId), eq(meetVotes.targetId, userId))).run();
  await db.delete(meetPairs).where(or(eq(meetPairs.aId, userId), eq(meetPairs.bId, userId))).run();
  await db.delete(meetDrafts).where(eq(meetDrafts.userId, userId)).run();
  await db.delete(profiles).where(eq(profiles.userId, userId)).run();
  // Retain anonymized abuse reports (target/reporter references are removed).
  await db.delete(reports).where(or(eq(reports.reporterId, userId), eq(reports.targetId, userId))).run();
  await db.delete(users).where(eq(users.tgId, userId)).run();
}

export const deletionKeyboard = { inline_keyboard: [
  [{ text: 'Да, удалить безвозвратно', callback_data: 'core:delete:yes' }],
  [{ text: 'Отмена', callback_data: 'nav:settings' }],
] };
