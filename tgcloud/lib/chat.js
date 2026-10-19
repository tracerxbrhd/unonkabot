import { api, db } from 'sdk';
import { eq, and, ne, gte, asc } from 'sdk/db';
import { chatQueue } from '../schema.js';
import { nowSeconds, validMessage } from './pure.js';
import { anyBlock, getUser, setContext, say, show, keys, throttle, report, block } from './core.js';

const liveKeyboard = { inline_keyboard: [
  [{ text: '🔄 Следующий', callback_data: 'chat:next' },
   { text: '⛔ Завершить', callback_data: 'chat:stop' }],
  [{ text: '🚩 Жалоба и блокировка', callback_data: 'chat:report' }],
] };
const waitingKeyboard = { inline_keyboard: [
  [{ text: '🔄 Проверить снова', callback_data: 'chat:find' }],
  [{ text: '⛔ Прекратить поиск', callback_data: 'chat:stop' }],
] };

export async function getChatSession(userId) {
  return db.select().from(chatQueue).where(eq(chatQueue.userId, userId)).get();
}

export async function stopChat(userId, notify = true) {
  const session = await getChatSession(userId);
  if (!session) return null;
  if (session.status === 'paired' && session.peerId) {
    // A single statement removes both sides of a pair. A stale button can't erase another pair.
    await db.run('DELETE FROM unonka_chat_queue WHERE (user_id = :a AND peer_id = :b) OR (user_id = :b AND peer_id = :a)',
      { ':a': userId, ':b': session.peerId });
    if (notify) {
      try { await say(session.peerId, 'Собеседник завершил разговор.', waitingKeyboard); }
      catch (_) { /* They may have blocked the bot. */ }
    }
  } else {
    await db.delete(chatQueue).where(eq(chatQueue.userId, userId)).run();
  }
  return session;
}

export async function findChat(userId, chatId, callbackMessage) {
  const user = await getUser(userId);
  if (!user?.ageConfirmed) return say(chatId, 'Для анонимного чата нужно подтвердить возраст 18+.', keys.back);
  const previous = await getChatSession(userId);
  if (previous?.status === 'paired') {
    return show(chatId, '🎭 Ты уже общаешься с собеседником. Напиши текст или выбери действие:', liveKeyboard, callbackMessage);
  }
  const time = nowSeconds();
  await setContext(userId, 'chat');
  await db.insert(chatQueue).values({
    userId, status: 'waiting', peerId: 0, since: time,
  }).onConflictDoUpdate({
    target: chatQueue.userId,
    set: { status: 'waiting', peerId: 0, since: time },
  }).run();
  // Compare-and-swap both queue rows in one SQLite statement: no double match.
  const candidates = await db.select().from(chatQueue).where(and(
    eq(chatQueue.status, 'waiting'), ne(chatQueue.userId, userId),
    gte(chatQueue.since, time - 600),
  )).orderBy(asc(chatQueue.since)).limit(25).all();

  for (const candidate of candidates) {
    if (await anyBlock(userId, candidate.userId, 'chat')) continue;
    const changed = await db.run(
      'UPDATE unonka_chat_queue SET status = :paired, since = :now, peer_id = CASE WHEN user_id = :a THEN :b ELSE :a END ' +
      'WHERE user_id IN (:a, :b) AND status = :waiting AND ' +
      '(SELECT COUNT(*) FROM unonka_chat_queue WHERE user_id IN (:a, :b) AND status = :waiting) = 2',
      { ':paired': 'paired', ':waiting': 'waiting', ':now': time, ':a': userId, ':b': candidate.userId },
    );
    if (changed.rowsAffected === 2) {
      const text = '🎭 Собеседник найден! Можно отправлять текстовые сообщения.\n\n' +
        'Мы не раскрываем Telegram-профили. /next — следующий; /stop — закончить.';
      await say(chatId, text, liveKeyboard);
      try { await say(candidate.userId, text, liveKeyboard); }
      catch (_) { await stopChat(userId, false); await say(chatId, 'Собеседник оказался недоступен. Нажми «Следующий».', waitingKeyboard); }
      return;
    }
  }
  return show(chatId, '🔎 Сейчас свободных собеседников нет.\n\nТы в очереди. Когда другой пользователь начнёт поиск, бот соединит вас. Очередь действует 10 минут.', waitingKeyboard, callbackMessage);
}

export async function chatText(user, chatId, text) {
  const session = await getChatSession(user.tgId);
  if (!session) return say(chatId, 'Сейчас нет активного чата. Нажми «Поиск собеседника».', waitingKeyboard);
  if (session.status === 'waiting') return say(chatId, '🔎 Собеседник пока не найден.', waitingKeyboard);
  const reciprocal = await getChatSession(session.peerId);
  if (!reciprocal || reciprocal.status !== 'paired' || reciprocal.peerId !== user.tgId) {
    await stopChat(user.tgId, false);
    return say(chatId, 'Диалог уже завершён. Начни новый поиск.', waitingKeyboard);
  }
  const body = validMessage(text);
  if (!body) return say(chatId, 'Отправлять можно только текст до 2000 символов.');
  if (!(await throttle(user.tgId, 1))) return say(chatId, 'Слишком быстро. Подожди секунду.');
  if (await anyBlock(user.tgId, session.peerId, 'chat')) {
    await stopChat(user.tgId, false);
    return say(chatId, 'Разговор закрыт.', waitingKeyboard);
  }
  try {
    await api.sendMessage({ chat_id: session.peerId,
      text: '🎭 Анонимный собеседник:\n' + body, reply_markup: liveKeyboard });
  } catch (_) {
    await stopChat(user.tgId, false);
    return say(chatId, 'Не удалось доставить сообщение — диалог закрыт.', waitingKeyboard);
  }
}

export async function handleChatCallback(userId, chatId, data, message) {
  if (data === 'chat:find') return findChat(userId, chatId, message);
  if (data === 'chat:stop') {
    await stopChat(userId);
    await setContext(userId, 'home');
    return show(chatId, 'Диалог или поиск завершён.', keys.back, message);
  }
  if (data === 'chat:next') {
    await stopChat(userId);
    return findChat(userId, chatId);
  }
  if (data === 'chat:report' || data === 'chat:block') {
    const session = await getChatSession(userId);
    if (!session || session.status !== 'paired') return say(chatId, 'Активного собеседника нет.', keys.back);
    if (data === 'chat:report') await report(userId, session.peerId, 'chat');
    else await block(userId, session.peerId, 'chat');
    await stopChat(userId);
    await setContext(userId, 'home');
    return say(chatId, data === 'chat:report' ? '🚩 Жалоба принята и собеседник заблокирован.' : 'Собеседник заблокирован.', keys.back);
  }
}
