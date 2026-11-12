import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePinRecord, verifyPin, validPin, parseLeaderConfig, leaderConfigText } from '../src/leader/pin.js';

test('PIN: huella y verificación', async () => {
  const rec = await makePinRecord('123456', 1000);
  assert.equal(rec.algo, 'PBKDF2-SHA256');
  assert.ok(!JSON.stringify(rec).includes('123456'));
  assert.equal(await verifyPin('123456', rec), true);
  assert.equal(await verifyPin('123457', rec), false);
  const other = await makePinRecord('123456', 1000);
  assert.notEqual(other.hash, rec.hash); // sal distinta
  assert.equal(parseLeaderConfig(leaderConfigText(rec)).pin.hash, rec.hash);
  assert.equal(parseLeaderConfig('no es json'), null);
});

test('PIN: formato', () => {
  assert.ok(validPin('123456'));
  assert.ok(validPin('12345678'));
  assert.ok(!validPin('1234'));
  assert.ok(!validPin('12345a'));
});
