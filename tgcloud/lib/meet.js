import { api, db } from 'sdk';
import { eq, and, or, ne, gt, asc } from 'sdk/db';
import { meetDrafts, profiles, meetVotes, meetPairs, blocks } from '../schema.js';
import { nowSeconds, validName, validAge, validCity, validBio, validMessage, pairKey, compatible, callbackId } from './pure.js';
import { getUser, setContext, say, show, keys, anyBlock, report, throttle } from './core.js';

const menu = { inline_keyboard: [
  [{ text: '🔎 Смотреть анкеты', callback_data: 'meet:search' }],
  [{ text: '💌 Мои симпатии', callback_data: 'meet:matches' },
   { text: '👤 Моя анкета', callback_data: 'meet:profile' }],
  [{ text: '🏠 Главное меню', callback_data: 'nav:home' }],
] };
const photoKeyboard = { inline_keyboard: [
  [{ text: 'Без фото (для тестов)', callback_data: 'meet:photo:skip' }],
  [{ text: 'Отменить', callback_data: 'nav:home' }],
] };
const genderKeyboard = { inline_keyboard: [
  [{ text: 'Женщина', callback_data: 'meet:gender:f' },
   { text: 'Мужчина', callback_data: 'meet:gender:m' }],
  [{ text: 'Другое', callback_data: 'meet:gender:x' }],
] };
const seekingKeyboard = { inline_keyboard: [
  [{ text: 'Женщин', callback_data: 'meet:seeking:f' },
   { text: 'Мужчин', callback_data: 'meet:seeking:m' }],
  [{ text: 'Других', callback_data: 'meet:seeking:x' },
   { text: 'Всех', callback_data: 'meet:seeking:any' }],
] };

const genderLabel = { m: 'мужчина', f: 'женщина', x: 'другое', any: 'любой' };

export async function getProfile(userId) {
  return db.select().from(profiles).where(eq(profiles.userId, userId)).get();
}

export async function openMeet(userId, chatId, message) {
  const user = await getUser(userId);
  if (!user?.ageConfirmed) return say(chatId, 'Для MEET необходимо подтвердить возраст 18+.', keys.back);
  await setContext(userId, 'meet');
  const profile = await getProfile(userId);
  if (!profile) return startWizard(userId, chatId);
  return show(chatId, '💕 UNONKA MEET\n\nЗнакомства по взаимной симпатии. ' +
    (profile.active ? 'Анкета опубликована.' : 'Анкета скрыта от поиска.') +
    '\n\nВыбирай действие:', menu, message);
}

export async function startWizard(userId, chatId) {
  await db.insert(meetDrafts).values({ userId }).onConflictDoUpdate({
    target: meetDrafts.userId,
    set: { name: null, age: null, city: null, gender: null, seeking: null, bio: null, photoId: null },
  }).run();
  await setContext(userId, 'meet', 'meet_name');
  return say(chatId, '💕 Создадим анкету.\n\n1/7 Как тебя зовут? (2–32 символа)\n\n/cancel — отмена.');
}

export async function meetInput(user, chatId, message) {
  const step = user.step;
  const text = message.text || '';
  if (step === 'meet_name') {
    const name = validName(text);
    if (!name) return say(chatId, 'Введи имя длиной 2–32 символа.');
    await db.update(meetDrafts).set({ name }).where(eq(meetDrafts.userId, user.tgId)).run();
    await setContext(user.tgId, 'meet', 'meet_age');
    return say(chatId, '2/7 Сколько тебе лет? (18–99)');
  }
  if (step === 'meet_age') {
    const age = validAge(text);
    if (!age) return say(chatId, 'Укажи возраст от 18 до 99 лет. Несовершеннолетние не могут пользоваться MEET.');
    await db.update(meetDrafts).set({ age }).where(eq(meetDrafts.userId, user.tgId)).run();
    await setContext(user.tgId, 'meet', 'meet_city');
    return say(chatId, '3/7 Твой город? (2–64 символа)');
  }
  if (step === 'meet_city') {
    const city = validCity(text);
    if (!city) return say(chatId, 'Название города: 2–64 символа.');
    await db.update(meetDrafts).set({ city }).where(eq(meetDrafts.userId, user.tgId)).run();
    await setContext(user.tgId, 'meet', 'meet_gender');
    return say(chatId, '4/7 Укажи пол:', genderKeyboard);
  }
  if (step === 'meet_gender' || step === 'meet_seeking') {
    return say(chatId, 'Пожалуйста, используй кнопки выбора.', step === 'meet_gender' ? genderKeyboard : seekingKeyboard);
  }
  if (step === 'meet_bio') {
    const bio = validBio(text);
    if (!bio) return say(chatId, 'Напиши о себе от 10 до 350 символов.');
    await db.update(meetDrafts).set({ bio }).where(eq(meetDrafts.userId, user.tgId)).run();
    await setContext(user.tgId, 'meet', 'meet_photo');
    return say(chatId, '7/7 Отправь одну фотографию для анкеты.\n\nВ тестовой версии фото можно пропустить.', photoKeyboard);
  }
  if (step === 'meet_photo') {
    if (!Array.isArray(message.photo) || !message.photo.length) {
      return say(chatId, 'Нужно отправить фото или нажать «Без фото».', photoKeyboard);
    }
    const last = message.photo[message.photo.length - 1];
    if (!last.file_id) return say(chatId, 'Telegram не передал идентификатор фотографии.');
    await db.update(meetDrafts).set({ photoId: last.file_id }).where(eq(meetDrafts.userId, user.tgId)).run();
    return saveProfile(user.tgId, chatId);
  }
}

export async function saveProfile(userId, chatId) {
  const draft = await db.select().from(meetDrafts).where(eq(meetDrafts.userId, userId)).get();
  if (!draft || !draft.name || !validAge(String(draft.age || '')) || !draft.city ||
      !['m', 'f', 'x'].includes(draft.gender) || !['m', 'f', 'x', 'any'].includes(draft.seeking) || !draft.bio) {
    return say(chatId, 'Не удалось сохранить анкету: некоторые поля не заполнены. Начни создание заново.', keys.back);
  }
  const row = {
    userId, name: draft.name, age: draft.age, city: draft.city,
    gender: draft.gender, seeking: draft.seeking, bio: draft.bio,
    photoId: draft.photoId || null, active: true, updatedAt: nowSeconds(),
  };
  await db.insert(profiles).values(row).onConflictDoUpdate({
    target: profiles.userId,
    set: { name: row.name, age: row.age, city: row.city,
      gender: row.gender, seeking: row.seeking, bio: row.bio,
      photoId: row.photoId, active: true, updatedAt: row.updatedAt },
  }).run();
  await db.delete(meetDrafts).where(eq(meetDrafts.userId, userId)).run();
  await setContext(userId, 'meet');
  return say(chatId, '✅ Анкета сохранена и опубликована!', menu);
}

export async function myProfile(userId, chatId) {
  const p = await getProfile(userId);
  if (!p) return startWizard(userId, chatId);
  const text = '👤 Твоя анкета\n\n' + p.name + ', ' + p.age + '\n📍 ' + p.city +
    '\nПол: ' + genderLabel[p.gender] + '\nИщу: ' + genderLabel[p.seeking] +
    '\n\n' + p.bio + '\n\n' + (p.active ? '✅ В поиске' : '⏸ Анкета скрыта');
  const actions = { inline_keyboard: [
    [{ text: '✏️ Перезаполнить', callback_data: 'meet:edit' }],
    [{ text: p.active ? '⏸ Скрыть анкету' : '▶️ Опубликовать', callback_data: 'meet:toggle' }],
    [{ text: '💕 Меню MEET', callback_data: 'nav:meet' }],
  ] };
  if (p.photoId) {
    try { return await api.sendPhoto({ chat_id: chatId, photo: p.photoId, caption: text, reply_markup: actions }); }
    catch (_) { /* Fall back to a text card if the photo became unavailable. */ }
  }
  return say(chatId, text, actions);
}

export async function nextCandidate(userId, chatId) {
  const me = await getProfile(userId);
  if (!me?.active) return say(chatId, 'Сначала создай и опубликуй свою анкету.', menu);
  const voted = await db.select().from(meetVotes).where(eq(meetVotes.voterId, userId)).all();
  const skipped = new Set(voted.map((v) => v.targetId));
  const blocked = await db.select().from(blocks).where(eq(blocks.actorId, userId)).all();
  const blockedIds = new Set(blocked.filter((b) => b.scope === 'meet').map((b) => b.targetId));

  let cursor = 0;
  // Pagination avoids starving new profiles when the earlier ones have been viewed.
  for (let page = 0; page < 20; page++) {
    const batch = await db.select().from(profiles).where(and(
      eq(profiles.active, true), ne(profiles.userId, userId), gt(profiles.userId, cursor),
    )).orderBy(asc(profiles.userId)).limit(50).all();
    if (!batch.length) break;
    for (const candidate of batch) {
      if (skipped.has(candidate.userId) || blockedIds.has(candidate.userId) || !compatible(me, candidate)) continue;
      if (await anyBlock(userId, candidate.userId, 'meet')) continue;
      await setContext(userId, 'meet', 'meet_browse', candidate.userId);
      const text = '💕 ' + candidate.name + ', ' + candidate.age + '\n📍 ' + candidate.city +
        '\n\n' + candidate.bio;
      const action = { inline_keyboard: [
        [{ text: '❤️ Нравится', callback_data: 'meet:like:' + candidate.userId },
         { text: '➡️ Пропустить', callback_data: 'meet:skip:' + candidate.userId }],
        [{ text: '🚩 Пожаловаться', callback_data: 'meet:report:' + candidate.userId }],
        [{ text: '💕 Меню MEET', callback_data: 'nav:meet' }],
      ] };
      if (candidate.photoId) {
        try { return await api.sendPhoto({ chat_id: chatId, photo: candidate.photoId, caption: text, reply_markup: action }); }
        catch (_) { /* Show text if media cannot be sent. */ }
      }
      return say(chatId, text + '\n\n(Анкета без фото)', action);
    }
    cursor = batch[batch.length - 1].userId;
  }
  await setContext(userId, 'meet');
  return say(chatId, '💤 На данный момент подходящие анкеты закончились. Загляни позже.', menu);
}

async function vote(userId, chatId, targetId, choice) {
  const actor = await getUser(userId);
  if (actor?.mode !== 'meet' || actor.step !== 'meet_browse' || actor.contextId !== targetId) {
    return say(chatId, 'Эта карточка уже не активна. Открой поиск заново.', menu);
  }
  if (!targetId || userId === targetId) return say(chatId, 'Эта анкета недоступна.', menu);
  const me = await getProfile(userId);
  const target = await getProfile(targetId);
  if (!me?.active || !target?.active || !compatible(me, target) ||
      await anyBlock(userId, targetId, 'meet')) {
    return say(chatId, 'Анкета недоступна.', menu);
  }
  // One irreversible decision per profile per v0.1; old inline keyboards are idempotent.
  const added = await db.run(
    'INSERT OR IGNORE INTO unonka_meet_votes (voter_id, target_id, choice, created_at) VALUES (:voter, :target, :choice, :now) RETURNING id',
    { ':voter': userId, ':target': targetId, ':choice': choice, ':now': nowSeconds() },
  );
  if (!added.rows?.length) return say(chatId, 'Эта анкета уже оценена.', menu);

  if (choice === 'like') {
    const reverse = await db.select().from(meetVotes).where(and(
      eq(meetVotes.voterId, targetId), eq(meetVotes.targetId, userId), eq(meetVotes.choice, 'like'),
    )).get();
    if (reverse) {
      const pair = pairKey(userId, targetId);
      const fresh = await db.run(
        'INSERT OR IGNORE INTO unonka_meet_pairs (pair_key, a_id, b_id, active, created_at) VALUES (:key, :a, :b, 1, :now) RETURNING pair_key',
        { ':key': pair, ':a': Math.min(userId, targetId), ':b': Math.max(userId, targetId), ':now': nowSeconds() },
      );
      if (fresh.rows?.length) {
        try { await say(userId, '💞 Взаимная симпатия с ' + target.name + '! Открой диалог в «Мои симпатии».',
          { inline_keyboard: [[{ text: '💬 Написать', callback_data: 'meet:open:' + targetId }]] }); }
        catch (_) { /* Notification best effort. */ }
        try { await say(targetId, '💞 Взаимная симпатия с ' + me.name + '! Открой диалог в «Мои симпатии».',
          { inline_keyboard: [[{ text: '💬 Написать', callback_data: 'meet:open:' + userId }]] }); }
        catch (_) { /* Notification best effort. */ }
      }
    }
  }
  return nextCandidate(userId, chatId);
}

export async function showMatches(userId, chatId) {
  await setContext(userId, 'meet');
  const pairs = await db.select().from(meetPairs).where(and(eq(meetPairs.active, true),
    or(eq(meetPairs.aId, userId), eq(meetPairs.bId, userId)))).limit(30).all();
  const rows = [];
  for (const p of pairs) {
    const peerId = p.aId === userId ? p.bId : p.aId;
    if (await anyBlock(userId, peerId, 'meet')) continue;
    const profile = await getProfile(peerId);
    if (profile) rows.push([{ text: '💬 ' + profile.name + ', ' + profile.age,
      callback_data: 'meet:open:' + peerId }]);
  }
  rows.push([{ text: '💕 Меню MEET', callback_data: 'nav:meet' }]);
  return say(chatId, rows.length === 1 ? '💌 Пока нет взаимных симпатий.' :
    '💌 Выбери собеседника:', { inline_keyboard: rows });
}

export async function openConversation(userId, chatId, peerId) {
  if (!peerId || userId === peerId || await anyBlock(userId, peerId, 'meet')) {
    return say(chatId, 'Диалог недоступен.', menu);
  }
  const pair = await db.select().from(meetPairs).where(and(
    eq(meetPairs.pairKey, pairKey(userId, peerId)), eq(meetPairs.active, true),
  )).get();
  const peer = await getProfile(peerId);
  if (!pair || !peer) return say(chatId, 'Диалог не найден.', menu);
  await setContext(userId, 'meet_chat', '', peerId);
  return say(chatId, '💬 Диалог с ' + peer.name + '.\n\nНапиши сообщение — оно будет передано через UNONKA без раскрытия Telegram ID.\n\nДля ответа на другой диалог сначала открой его в «Мои симпатии».',
    { inline_keyboard: [
      [{ text: '💌 Мои симпатии', callback_data: 'meet:matches' }],
      [{ text: '🏠 Главное меню', callback_data: 'nav:home' }],
    ] });
}

export async function meetChatText(user, chatId, text) {
  const peerId = user.contextId;
  if (!peerId || await anyBlock(user.tgId, peerId, 'meet')) return say(chatId, 'Диалог недоступен.', menu);
  const pair = await db.select().from(meetPairs).where(and(
    eq(meetPairs.pairKey, pairKey(user.tgId, peerId)), eq(meetPairs.active, true),
  )).get();
  if (!pair) return say(chatId, 'Диалог больше не существует.', menu);
  const body = validMessage(text);
  if (!body) return say(chatId, 'Можно отправить только текст до 2000 символов.');
  if (!(await throttle(user.tgId, 1))) return say(chatId, 'Отправляй сообщения чуть медленнее.');
  const sender = await getProfile(user.tgId);
  if (!sender) return say(chatId, 'Твоя анкета больше не найдена.', menu);
  try {
    await api.sendMessage({ chat_id: peerId, text: '💌 ' + sender.name + ' (MEET):\n' + body,
      reply_markup: { inline_keyboard: [[{ text: '↩️ Ответить', callback_data: 'meet:open:' + user.tgId }]] } });
  } catch (_) { return say(chatId, 'Собеседнику не удалось доставить сообщение.'); }
}

export async function handleMeetCallback(userId, chatId, data, message) {
  const user = await getUser(userId);
  if (!user?.ageConfirmed) return say(chatId, 'Требуется подтверждение возраста 18+.', keys.back);
  if (data === 'meet:profile') return myProfile(userId, chatId);
  if (data === 'meet:edit') return startWizard(userId, chatId);
  if (data === 'meet:matches') return showMatches(userId, chatId);
  if (data === 'meet:search') { await setContext(userId, 'meet'); return nextCandidate(userId, chatId); }
  if (data === 'meet:toggle') {
    const profile = await getProfile(userId);
    if (!profile) return startWizard(userId, chatId);
    await db.update(profiles).set({ active: !profile.active, updatedAt: nowSeconds() })
      .where(eq(profiles.userId, userId)).run();
    return myProfile(userId, chatId);
  }
  if (data === 'meet:photo:skip' && user.step === 'meet_photo') {
    return saveProfile(userId, chatId);
  }
  if (data.startsWith('meet:gender:') && user.step === 'meet_gender') {
    const gender = data.slice('meet:gender:'.length);
    if (!['m', 'f', 'x'].includes(gender)) return;
    await db.update(meetDrafts).set({ gender }).where(eq(meetDrafts.userId, userId)).run();
    await setContext(userId, 'meet', 'meet_seeking');
    return say(chatId, '5/7 С кем хочешь знакомиться?', seekingKeyboard);
  }
  if (data.startsWith('meet:seeking:') && user.step === 'meet_seeking') {
    const seeking = data.slice('meet:seeking:'.length);
    if (!['m', 'f', 'x', 'any'].includes(seeking)) return;
    await db.update(meetDrafts).set({ seeking }).where(eq(meetDrafts.userId, userId)).run();
    await setContext(userId, 'meet', 'meet_bio');
    return say(chatId, '6/7 Расскажи о себе (10–350 символов).');
  }

  const likedId = callbackId(data, 'meet:like:');
  if (likedId) return vote(userId, chatId, likedId, 'like');
  const skippedId = callbackId(data, 'meet:skip:');
  if (skippedId) return vote(userId, chatId, skippedId, 'skip');
  const reportId = callbackId(data, 'meet:report:');
  if (reportId && reportId !== userId && user.mode === 'meet' &&
      user.step === 'meet_browse' && user.contextId === reportId) {
    await report(userId, reportId, 'meet');
    await say(chatId, '🚩 Жалоба сохранена. Анкета заблокирована.');
    return nextCandidate(userId, chatId);
  }
  const openId = callbackId(data, 'meet:open:');
  if (openId) return openConversation(userId, chatId, openId);
  return say(chatId, 'Кнопка недоступна в текущем состоянии.', menu);
}
