import z from '@deepseek-ai/schemastery';
import { credentialKey } from '@deepseek-ai/dsh-credentials';
import { Account } from './account.js';
import { createProvider } from './provider.js';
import { RPC, publicError } from './protocol.js';

export const name = 'skymoni-account';
export const inject = ['connection', 'credentials', 'llm'];
export const Config = z.object({
  contextWindow: z.natural().min(4096).max(2000000).default(65536).description('本地上下文预算（tokens），应不超过所用模型的实际窗口。'),
  maxTokens: z.natural().min(256).max(262144).default(8192).description('本地每次输出预算（tokens），应不超过所用模型的输出上限。'),
  visionModels: z.array(z.string()).default([]).description('已确认支持图片的模型 ID。仅为列表中的模型启用 DSH 原生图片输入。'),
});

export async function apply(ctx, input) {
  const config = Config(input ?? {});
  if (config.maxTokens > config.contextWindow) throw new Error('输出预算不能大于上下文预算。');
  const key = credentialKey(name, 'session');
  const account = new Account({ store: {
    async read() { const record = await ctx.credentials.readRecord(key); return record?.kind === 'grant' ? record.payload : null; },
    async write(payload) { await ctx.credentials.modifyRecord(key, async () => ({ kind: 'grant', payload })); },
    async clear() { await ctx.credentials.deleteRecord(key); },
  } });
  const provider = createProvider(ctx, account, config);
  let disposed = false;
  const removers = [];
  ctx.effect(() => async () => { disposed = true; provider.dispose(); await Promise.all(removers.map(remove => remove())); await account.dispose(); }, 'skymoni-account:lifecycle');
  // Exact Fetch routes are admitted by Connection only for owner Peers and work
  // through the same /api carrier in Web and Desktop. Do not replace its gateway.
  const actions = { state: () => account.snapshot(), login: () => account.begin(), cancel: () => account.cancel(), refresh: () => account.refresh(), logout: () => account.logout() };
  for (const [action, perform] of Object.entries(actions)) removers.push(ctx.connection.fetch.register({
    path: `/api/${RPC}${action}`, methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      let frame;
      try {
        const source = await request.text(); if (source.length > 4096) throw Error();
        frame = JSON.parse(source);
        if (disposed || frame?.type !== 'client-request' || typeof frame.rpcId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(frame.rpcId) ||
          frame.method !== RPC + action || !frame.payload || typeof frame.payload !== 'object' || Array.isArray(frame.payload) || Object.keys(frame.payload).length) throw Error();
      } catch { return new Response('invalid request', { status: 400 }); }
      let result;
      try { await account.start(); result = { ok: true, value: await perform() }; }
      catch (error) { result = { ok: false, error: { ...publicError(error), details: {} } }; }
      return Response.json({ type: 'server-response', rpcId: frame.rpcId, result }, { headers: { 'Cache-Control': 'no-store' } });
    },
  }));
  await account.start();
}
