import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStartParameter, validAge, validName, validCity, validBio, validMessage,
  pairKey, compatible, callbackId, askLocator, normalizeText,
} from '../tgcloud/lib/pure.js';

describe('Anonymous links', () => {
  it('parses only bounded bot start parameters', () => {
    const code = '0123456789abcdef01234567';
    assert.deepEqual(parseStartParameter('/start ask_' + code), { kind: 'ask', code });
    assert.deepEqual(parseStartParameter('/start'), { kind: 'home' });
    assert.deepEqual(parseStartParameter('/start ask_123'), { kind: 'home' });
    assert.equal(parseStartParameter('hello'), null);
  });
  it('generates 96-bit hex routing identifiers', () => {
    const one = askLocator();
    const two = askLocator();
    assert.match(one, /^[a-f0-9]{24}$/);
    assert.notEqual(one, two);
  });
});

describe('Meet profile validation', () => {
  it('rejects underage, implausible and malformed ages', () => {
    for (const age of ['17', '100', '4', '18.5', 'not a number', '0']) assert.equal(validAge(age), null);
    assert.equal(validAge('18'), 18);
    assert.equal(validAge('99'), 99);
  });
  it('bounds untrusted profile fields', () => {
    assert.equal(validName(' a '), null);
    assert.equal(validName(' Аня '), 'Аня');
    assert.equal(validCity('M'), null);
    assert.equal(validCity('Москва'), 'Москва');
    assert.equal(validBio('short'), null);
    assert.equal(validBio('Я люблю книги и музыку'), 'Я люблю книги и музыку');
  });
  it('honors reciprocal preferences', () => {
    assert.equal(compatible({ gender: 'm', seeking: 'f' }, { gender: 'f', seeking: 'm' }), true);
    assert.equal(compatible({ gender: 'm', seeking: 'f' }, { gender: 'f', seeking: 'f' }), false);
    assert.equal(compatible({ gender: 'x', seeking: 'any' }, { gender: 'f', seeking: 'any' }), true);
  });
  it('canonicalizes pair key to prevent duplicate matches', () => {
    assert.equal(pairKey(8, 3), '3:8');
    assert.equal(pairKey(3, 8), '3:8');
  });
});

describe('Messaging boundaries', () => {
  it('rejects oversized text and strips NULL byte', () => {
    assert.equal(validMessage(''), null);
    assert.equal(validMessage('a'.repeat(2001)), null);
    assert.equal(validMessage(' Hello\u0000 '), 'Hello');
    assert.equal(normalizeText(null), '');
  });
  it('strictly parses callback IDs', () => {
    assert.equal(callbackId('meet:like:123', 'meet:like:'), 123);
    assert.equal(callbackId('meet:like:-1', 'meet:like:'), null);
    assert.equal(callbackId('meet:like:1foo', 'meet:like:'), null);
    assert.equal(callbackId('meet:skip:1', 'meet:like:'), null);
    assert.equal(callbackId('meet:like:99999999999999999', 'meet:like:'), null);
  });
});
