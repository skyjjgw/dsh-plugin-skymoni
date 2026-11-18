import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { CredentialProvider } from '@deepseek-ai/dsh-credentials';
import * as Connection from '@deepseek-ai/dsh-client-connection';
import { LlmRuntime } from '@deepseek-ai/dsh-llm';
import * as Plugin from '../lib/index.js';

class MemoryCredentials extends CredentialProvider {
  records = new Map([['unrelated-provider/session', { kind: 'grant', payload: { fixture: 'untouched' } }]]);
  constructor(ctx) { super(ctx); }
  async readRecord(key) { return this.records.get(key); }
  async modifyRecord(key, fn) { const next = await fn(this.records.get(key)); if (next) this.records.set(key, next); return this.records.get(key); }
  async deleteRecord(key) { this.records.delete(key); }
}
test('official carrier admits exact account routes only for owner peers; plugin leaves existing RPC gateway and credentials intact', async t => {
  const ctx = new Context();
  const credentials = ctx.plugin(MemoryCredentials); await credentials;
  const llm = ctx.plugin(LlmRuntime); await llm;
  const connection = ctx.plugin(Connection); await connection;
  const nativeGateway = ctx.connection.rpc.intercept('/api', endpoint => endpoint === 'existing-gateway', async () => ({ ok: true, value: 'preserved' }));
  const plugin = ctx.plugin(Plugin, {}); await plugin;
  t.after(async () => { await plugin.dispose(); await nativeGateway(); await connection.dispose(); await llm.dispose(); await credentials.dispose(); });
  const route = 'skymoni-account/state';
  const request = () => new Request(`http://localhost/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'fixture_1', method: route, payload: {} }) });
  const handler = ctx.connection.createSharedFetchHandler('/api');
  const response = await handler.fetch(request(), ctx.connection.browserPeer);
  const envelope = await response.json(); assert.equal(envelope.rpcId, 'fixture_1'); assert.equal(envelope.result.value.signedIn, false);
  const rejected = await handler.fetch(request(), { principal: { kind: 'fixture-remote' } }); assert.equal(rejected.status, 403);
  const existing = await handler.fetch(new Request('http://localhost/api/existing-gateway', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'old_1', method: 'existing-gateway', payload: {} }) }), ctx.connection.browserPeer);
  assert.equal((await existing.json()).result.value, 'preserved');
  const malformed = await handler.fetch(new Request(`http://localhost/api/${route}`, { method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: 'bad', method: 'skymoni-account/login', payload: {} }) }), ctx.connection.browserPeer);
  assert.equal(malformed.status, 400);
  assert.deepEqual(await ctx.credentials.readRecord('unrelated-provider/session'), { kind: 'grant', payload: { fixture: 'untouched' } });
  await plugin.dispose(); assert.equal((await handler.fetch(request(), ctx.connection.browserPeer)).status, 404);
});
