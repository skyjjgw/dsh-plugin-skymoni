import test from 'node:test';
import assert from 'node:assert/strict';
import { Account } from '../lib/account.js';
import { authorizationURL, formatCredits, parseJSON } from '../lib/protocol.js';
import { backend, store, TOKEN, KEY, flush } from './helpers.mjs';
function fixture(t, initial = null) {
  const api = backend(), disk = store(initial), account = new Account({ store: disk, fetch: api.fetch, scheduler: api.clock, now: api.clock.now });
  t.after(() => account.dispose()); return { ...api, disk, account };
}
test('browser authorization binds PKCE, polls, restores wallet/models, never publishes credentials', async t => {
  const { account, clock, disk, calls } = fixture(t); await account.begin();
  assert.equal(account.snapshot().authorizing, true);
  assert.match(account.snapshot().authorization.url, /^https:\/\/skymoni.com\/app\/authorize\?code=/);
  await clock.advance(1000); const state = account.snapshot();
  assert.equal(state.signedIn, true); assert.equal(state.wallet.balance, '625000'); assert.equal(state.balanceLabel, '1.2500 积分');
  assert.deepEqual(state.models.map(model => model.id), ['fixture-chat', 'fixture-responses']);
  assert.equal(disk.value().token, TOKEN); assert.equal(account.peekKey(account.authority().epoch), KEY);
  assert.equal(calls.find(call => call.path.endsWith('/authorize')).body.device_name, '小云 DSH 插件');
  for (const secret of [TOKEN, KEY, 'fixture-device-private']) assert.ok(!JSON.stringify(state).includes(secret));
});
test('pending and slow-down do not issue extra grants; cancel prevents later sign-in', async t => {
  const { account, clock, state, calls, disk } = fixture(t); state.pending = true; await account.begin();
  await clock.advance(2000); assert.equal(account.snapshot().authorizing, true);
  await account.cancel(); state.pending = false; await clock.advance(5000);
  assert.equal(account.snapshot().signedIn, false); assert.equal(disk.value(), null);
  assert.equal(calls.filter(call => call.path.endsWith('/authorize')).length, 1);
});
test('cold restoration uses only the plugin session; remote revocation withdraws authority before inference', async t => {
  const { account, state, disk } = fixture(t, { version: 1, token: TOKEN, expiresAt: 1800003600000 });
  await account.start(); const authority = account.authority(); assert.equal(account.snapshot().signedIn, true);
  state.revoked = true;
  await assert.rejects(account.inferenceKey(authority.epoch), { code: 'APP_SESSION_INVALID' });
  assert.equal(account.snapshot().signedIn, false); assert.equal(authority.signal.aborted, true); assert.equal(disk.value(), null);
});
test('logout aborts old authority, clears owned storage, revokes session without disabling shared key', async t => {
  const { account, clock, disk, calls } = fixture(t); await account.begin(); await clock.advance(1000);
  const old = account.authority(); await account.logout();
  assert.equal(old.signal.aborted, true); assert.equal(disk.value(), null); assert.deepEqual(account.snapshot().models, []); assert.equal(account.snapshot().error, null);
  assert.ok(calls.some(call => call.path.endsWith('/session') && call.method === 'DELETE'));
  assert.ok(!calls.some(call => /token\/|disable/.test(call.path)));
  await assert.rejects(account.inferenceKey(old.epoch), { code: 'STALE' });
});
test('storage failure revokes a newly issued orphan and refuses to expose a signed-in model route', async t => {
  const { account, disk, clock, calls } = fixture(t); disk.write = async () => { throw Error(TOKEN); };
  await account.begin(); await clock.advance(1000);
  assert.equal(account.snapshot().signedIn, false); assert.equal(account.snapshot().error.code, 'STORAGE');
  assert.ok(calls.some(call => call.path.endsWith('/session') && call.method === 'DELETE'));
  assert.ok(!JSON.stringify(account.snapshot()).includes(TOKEN));
});
test('authorization URLs are restricted to the exact first-party path and code', () => {
  for (const url of ['https://evil.invalid/app/authorize?code=QA001', 'https://skymoni.com@evil.invalid/app/authorize?code=QA001',
    'https://skymoni.com/app/authorize?code=QA001&next=x', 'https://skymoni.com/app/authorize?code=OTHER', 'http://skymoni.com/app/authorize?code=QA001']) assert.throws(() => authorizationURL(url, 'QA001'));
});
test('exact quota and four-decimal display do not round int64 through a JS number', () => {
  const value = parseJSON('{"balance":9007199254740993,"unit":500000}');
  assert.equal(value.balance, '9007199254740993'); assert.equal(formatCredits(value.balance, value.unit), '18014398509.4820 积分');
  assert.equal(formatCredits('25', '500000'), '0.0001 积分'); assert.equal(formatCredits('-25', '500000'), '-0.0001 积分');
});
test('expiry timer removes restored sessions and their model authority', async t => {
  const { account, clock, disk } = fixture(t, { version: 1, token: TOKEN, expiresAt: 1800000002000 });
  await account.start(); const old = account.authority(); await clock.advance(2000);
  assert.equal(account.snapshot().signedIn, false); assert.equal(old.signal.aborted, true); assert.equal(disk.value(), null);
});
test('a disabled shared key leaves account controls available, but exposes no model route or secret', async t => {
  const { account, state, clock } = fixture(t); state.failure = { path: '/api/app-account/provider', code: 'SKIVU_API_KEY_UNAVAILABLE', status: 409 };
  await account.begin(); await clock.advance(1000);
  assert.equal(account.snapshot().error.code, 'SKIVU_API_KEY_UNAVAILABLE'); assert.equal(account.snapshot().signedIn, true);
  assert.deepEqual(account.snapshot().models, []);
  assert.ok(!JSON.stringify(account.snapshot()).includes(TOKEN));
});
test('cancel during queued secure write cannot leave a saved session behind', async t => {
  const { account, disk, clock } = fixture(t); let release;
  const original = disk.write;
  disk.write = async record => { await new Promise(resolve => { release = resolve; }); await original(record); };
  await account.begin(); await clock.advance(1000); assert.ok(release);
  const cancelling = account.cancel(); release(); await cancelling; await flush();
  assert.equal(disk.value(), null); assert.equal(account.snapshot().signedIn, false);
});
test('dashboard displays account totals and a single check-in updates both wallet and status', async t => {
  const { account, clock, calls } = fixture(t);
  await account.begin(); await clock.advance(1000);
  const before = await account.dashboard();
  assert.equal(before.balanceLabel, '1.2500 积分');
  assert.equal(before.usedLabel, '0.5000 积分');
  assert.equal(before.checkin.checkedIn, false);
  const [first, second] = await Promise.all([account.checkin(), account.checkin()]);
  assert.equal(first.checkin.checkedIn, true);
  assert.equal(second.checkin.awardLabel, '0.1000 积分');
  assert.equal(first.balanceLabel, '1.3500 积分');
  assert.equal((await account.checkin()).balanceLabel, '1.3500 积分');
  assert.equal(calls.filter(({ method, path }) => method === 'POST' && path.endsWith('/checkin')).length, 1);
  assert.ok(!JSON.stringify(first).includes(TOKEN));
});
test('check-in uses site verification when required and reconciles a lost submission response', async t => {
  const { account, clock, state, calls } = fixture(t);
  await account.begin(); await clock.advance(1000);
  state.verification = true;
  assert.equal((await account.checkin()).checkin.requiresVerification, true);
  assert.ok(!calls.some(({ method, path }) => method === 'POST' && path.endsWith('/checkin')));
  state.verification = false;
  state.checkinNetworkError = true;
  assert.equal((await account.checkin()).checkin.checkedIn, true);
  assert.equal(account.snapshot().balanceLabel, '1.3500 积分');
  state.checkinEnabled = false;
  assert.deepEqual((await account.dashboard()).checkin, { enabled: false });
});
