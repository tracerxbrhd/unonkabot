// Framework-independent functions; safe to import from Node tests and a future Mini App.
export const nowSeconds = () => Math.floor(Date.now() / 1000);

export function normalizeText(value, max = 2000) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, max + 1);
}

export function parseStartParameter(text) {
  const match = /^\/start(?:@\w+)?(?:\s+(\S+))?$/.exec((text || '').trim());
  if (!match) return null;
  const param = match[1] || '';
  if (!param) return { kind: 'home' };
  if (/^ask_[a-f0-9]{24}$/.test(param)) return { kind: 'ask', code: param.slice(4) };
  return { kind: 'home' };
}

export function askLocator() {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // A public routing identifier, not an authentication or authorization secret.
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
}

export function validName(value) {
  const name = normalizeText(value, 33).replace(/\s+/g, ' ');
  return name.length >= 2 && name.length <= 32 ? name : null;
}

export function validCity(value) {
  const city = normalizeText(value, 65).replace(/\s+/g, ' ');
  return city.length >= 2 && city.length <= 64 ? city : null;
}

export function validAge(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{2,3}$/.test(v)) return null;
  const age = Number(v);
  return age >= 18 && age <= 99 ? age : null;
}

export function validBio(value) {
  const bio = normalizeText(value, 351);
  return bio.length >= 10 && bio.length <= 350 ? bio : null;
}

export function validMessage(value) {
  const t = normalizeText(value, 2001);
  return t.length >= 1 && t.length <= 2000 ? t : null;
}

export function pairKey(a, b) {
  return [Math.min(a, b), Math.max(a, b)].join(':');
}

export function compatible(me, other) {
  return (me.seeking === 'any' || me.seeking === other.gender) &&
    (other.seeking === 'any' || other.seeking === me.gender);
}

// Exactly one recipient context may own a text message.
export function messageRoute(user) {
  if (user?.mode === 'ask' && ['ask_compose', 'ask_reply'].includes(user.step) && user.contextId) return 'ask';
  if (user?.mode === 'meet' && typeof user.step === 'string' && user.step.startsWith('meet_')) return 'meet_wizard';
  if (user?.mode === 'chat') return 'chat';
  if (user?.mode === 'meet_chat' && user.contextId) return 'meet_chat';
  return 'none';
}

export function callbackId(data, prefix) {
  if (typeof data !== 'string' || !data.startsWith(prefix)) return null;
  const id = data.slice(prefix.length);
  if (!/^[1-9]\d{0,15}$/.test(id)) return null;
  const n = Number(id);
  return Number.isSafeInteger(n) ? n : null;
}
