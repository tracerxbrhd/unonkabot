import { table, integer, text, boolean, index, uniqueIndex } from 'sdk/db';

// Telegram user IDs fit into JavaScript's safe integer range.
// tgcloud intentionally has no foreign keys: service-layer checks are mandatory.
export const users = table('unonka_users', {
  tgId: integer('tg_id').primaryKey(),
  firstName: text('first_name').notNull(),
  username: text('username'),
  mode: text('mode').notNull().default('home'),
  step: text('step').notNull().default(''),
  contextId: integer('context_id').notNull().default(0),
  askCode: text('ask_code').notNull().unique(),
  askEnabled: boolean('ask_enabled').notNull().default(true),
  ageConfirmed: boolean('age_confirmed').notNull().default(false),
  banned: boolean('banned').notNull().default(false),
  lastSentAt: integer('last_sent_at').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const askMessages = table('unonka_ask_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  senderId: integer('sender_id').notNull(),
  recipientId: integer('recipient_id').notNull(),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  byRecipient: index('ask_recipient_idx').on(t.recipientId),
  bySender: index('ask_sender_idx').on(t.senderId),
}));

export const blocks = table('unonka_blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorId: integer('actor_id').notNull(),
  targetId: integer('target_id').notNull(),
  scope: text('scope').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  uniq: uniqueIndex('block_actor_target_scope_uq').on(t.actorId, t.targetId, t.scope),
}));

export const chatQueue = table('unonka_chat_queue', {
  userId: integer('user_id').primaryKey(),
  status: text('status').notNull(),
  peerId: integer('peer_id').notNull().default(0),
  since: integer('since').notNull(),
}, (t) => ({
  waiting: index('chat_queue_status_since_idx').on(t.status, t.since),
}));

export const meetDrafts = table('unonka_meet_drafts', {
  userId: integer('user_id').primaryKey(),
  name: text('name'),
  age: integer('age'),
  city: text('city'),
  gender: text('gender'),
  seeking: text('seeking'),
  bio: text('bio'),
  photoId: text('photo_id'),
});

export const profiles = table('unonka_profiles', {
  userId: integer('user_id').primaryKey(),
  name: text('name').notNull(),
  age: integer('age').notNull(),
  city: text('city').notNull(),
  gender: text('gender').notNull(),
  seeking: text('seeking').notNull(),
  bio: text('bio').notNull(),
  photoId: text('photo_id'),
  active: boolean('active').notNull().default(true),
  updatedAt: integer('updated_at').notNull(),
});

export const meetVotes = table('unonka_meet_votes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  voterId: integer('voter_id').notNull(),
  targetId: integer('target_id').notNull(),
  choice: text('choice').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  uniq: uniqueIndex('meet_voter_target_uq').on(t.voterId, t.targetId),
}));

export const meetPairs = table('unonka_meet_pairs', {
  pairKey: text('pair_key').primaryKey(),
  aId: integer('a_id').notNull(),
  bId: integer('b_id').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  aIdx: index('meet_pairs_a_idx').on(t.aId),
  bIdx: index('meet_pairs_b_idx').on(t.bId),
}));

export const reports = table('unonka_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reporterId: integer('reporter_id').notNull(),
  targetId: integer('target_id').notNull(),
  scope: text('scope').notNull(),
  reason: text('reason').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  targetIdx: index('reports_target_idx').on(t.targetId),
  dedupe: uniqueIndex('reports_actor_target_scope_uq').on(t.reporterId, t.targetId, t.scope),
}));
