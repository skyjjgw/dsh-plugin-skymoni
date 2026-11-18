import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { LlmRuntime, LlmAdapter } from '@deepseek-ai/dsh-llm';
import { Account } from '../lib/account.js';
import { createProvider } from '../lib/provider.js';
import { PROVIDER } from '../lib/protocol.js';
import { backend, store, KEY, sse, collect } from './helpers.mjs';
const user = { role: 'user', content: [{ type: 'text', text: '本地合成验收' }] };
async function fixture(t) {
  const api = backend(), account = new Account({ store: store(), fetch: api.fetch, scheduler: api.clock, now: api.clock.now });
  const ctx = new Context(); const fiber = ctx.plugin(LlmRuntime); await fiber;
  const foreign = ctx.llm.registerAdapter(['existing-user-provider'], new class extends LlmAdapter { async *stream() {} }());
  const plugin = createProvider(ctx, account, { contextWindow: 65536, maxTokens: 8192, visionModels: [] });
  t.after(async () => { plugin.dispose(); foreign(); await account.dispose(); await fiber.dispose(); });
  await account.begin(); await api.clock.advance(1000);
  return { ...api, account, ctx, plugin };
}
test('real Cordis/LLM registry exposes account models while preserving another provider', async t => {
  const { ctx, account } = await fixture(t);
  assert.ok(ctx.llm.listProviders().some(provider => provider.id === PROVIDER));
  assert.deepEqual((await ctx.llm.listModels(PROVIDER)).map(model => model.id), ['fixture-chat', 'fixture-responses']);
  const info = await ctx.llm.resolveModelInfo(PROVIDER, 'fixture-chat'); assert.equal(info.defaultMaxTokens, 8192); assert.equal(info.cost, undefined);
  await account.logout(); assert.ok(!ctx.llm.listProviders().some(provider => provider.id === PROVIDER));
  assert.ok(ctx.llm.listProviders().some(provider => provider.id === 'existing-user-provider'));
});
test('native adapter sends streaming text and tools over ordinary /v1, with no session credential in model body', async t => {
  const { ctx } = await fixture(t); const original = globalThis.fetch; const sent = []; let tool = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://skymoni.com/v1/chat/completions');
    const headers = new Headers(options.headers); assert.equal(headers.get('authorization'), `Bearer ${KEY}`);
    sent.push(JSON.parse(options.body)); return sse(tool);
  };
  t.after(() => { globalThis.fetch = original; });
  const chunks = await collect(ctx.llm.stream({ provider: PROVIDER, model: 'fixture-chat', messages: [user] }));
  assert.ok(chunks.some(chunk => chunk.type === 'text-delta' && chunk.text.includes('验收成功')), JSON.stringify(chunks));
  assert.ok(chunks.some(chunk => chunk.type === 'finish' && chunk.reason.kind === 'stop'));
  tool = true;
  const tools = await collect(ctx.llm.stream({ provider: PROVIDER, model: 'fixture-chat', messages: [user], tools: [{ name: 'fixture_tool', description: '验收工具', parameters: { type: 'object', properties: { value: { type: 'integer' } } } }] }));
  assert.ok(tools.some(chunk => chunk.type === 'block-end' && chunk.block.type === 'tool-call'), JSON.stringify(tools));
  assert.equal(sent[0].stream, true); assert.equal(sent[1].tools[0].function.name, 'fixture_tool');
});
test('a prepared call cannot regain authority after logout and another login', async t => {
  const { ctx, account, clock } = await fixture(t);
  const prepared = await ctx.llm.prepareCall({ provider: PROVIDER, model: 'fixture-chat' });
  await account.logout(); await account.begin(); await clock.advance(1000);
  const chunks = await collect(prepared.stream({ ...prepared.config, messages: [user] }));
  assert.ok(chunks.some(chunk => chunk.type === 'finish' && ['aborted', 'error'].includes(chunk.reason.kind)), JSON.stringify(chunks));
});
test('revoked website session prevents model network I/O on the next native inference', async t => {
  const { ctx, state } = await fixture(t); state.revoked = true;
  const original = globalThis.fetch; let requests = 0; globalThis.fetch = async () => { requests++; throw Error('No model call permitted'); };
  t.after(() => { globalThis.fetch = original; });
  const chunks = await collect(ctx.llm.stream({ provider: PROVIDER, model: 'fixture-chat', messages: [user] }));
  assert.equal(requests, 0); assert.ok(chunks.some(chunk => chunk.type === 'finish' && ['error', 'aborted'].includes(chunk.reason.kind)));
});
test('native Responses adapter uses /v1/responses and returns the streamed text', async t => {
  const { ctx } = await fixture(t); const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://skymoni.com/v1/responses');
    assert.equal(new Headers(options.headers).get('authorization'), `Bearer ${KEY}`);
    const item = { id: 'message_1', type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Responses 验收成功', annotations: [] }], status: 'completed' };
    const events = [
      { type: 'response.created', response: { id: 'response_fixture', model: 'fixture-responses' } },
      { type: 'response.output_item.added', output_index: 0, item: { ...item, status: 'in_progress', content: [] } },
      { type: 'response.content_part.added', output_index: 0, content_index: 0, item_id: item.id, part: { type: 'output_text', text: '', annotations: [] } },
      { type: 'response.output_text.delta', output_index: 0, content_index: 0, item_id: item.id, delta: 'Responses 验收成功' },
      { type: 'response.output_item.done', output_index: 0, item },
      { type: 'response.completed', response: { id: 'response_fixture', model: 'fixture-responses', status: 'completed', output: [item], usage: { input_tokens: 5, output_tokens: 4, total_tokens: 9, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } } },
    ];
    return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
  };
  t.after(() => { globalThis.fetch = original; });
  const chunks = await collect(ctx.llm.stream({ provider: PROVIDER, model: 'fixture-responses', messages: [user] }));
  assert.ok(chunks.some(chunk => chunk.type === 'text-delta' && chunk.text.includes('验收成功')), JSON.stringify(chunks));
  assert.ok(chunks.some(chunk => chunk.type === 'finish' && chunk.reason.kind === 'stop'), JSON.stringify(chunks));
});
test('logging out aborts a native model stream already in progress', async t => {
  const { ctx, account } = await fixture(t); const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({ id: 'fixture', choices: [{ index: 0, delta: { role: 'assistant', content: '开始' }, finish_reason: null }] }) + '\n\n'));
    options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true });
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
  t.after(() => { globalThis.fetch = original; });
  const chunks = [];
  for await (const chunk of ctx.llm.stream({ provider: PROVIDER, model: 'fixture-chat', messages: [user] })) {
    chunks.push(chunk); if (chunk.type === 'text-delta') await account.logout();
  }
  assert.ok(chunks.some(chunk => chunk.type === 'finish' && chunk.reason.kind === 'aborted'), JSON.stringify(chunks));
});
