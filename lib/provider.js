import { LlmAdapter, LlmError, resolveRetryPolicy, resolveImageAttachmentAccess } from '@deepseek-ai/dsh-llm';
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai';
import { InMemoryCredentialStore } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy';
import { ORIGIN, PROVIDER, publicError } from './protocol.js';

/** Ordinary upstream PiAiAdapter, scoped to this plugin's ephemeral route. */
export function createProvider(ctx, account, config) {
  let profiles = new Map(), registration, signature = '', disposed = false;
  let attachmentContext;
  ctx.inject?.(['attachments', 'fs'], child => {
    attachmentContext = child;
    child.effect(() => () => { if (attachmentContext === child) attachmentContext = undefined; }, 'skymoni-account:attachments');
  });
  const authorities = new WeakMap();
  const delegate = new PiAiAdapter({
    profiles: () => profiles,
    resolveApiKey: async (_route, profile) => {
      try { return account.peekKey(authorities.get(profile).epoch); }
      catch (error) { throw new LlmError(publicError(error).message, 'MISSING_CREDENTIAL'); }
    },
    auth: { credentials: new InMemoryCredentialStore(), authContext: { env: async () => undefined, fileExists: async () => false } },
    resolveAttachments: () => attachmentContext?.attachments,
    resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(attachments, path => attachmentContext?.fs.processPathFromHostPath(path), ref),
  });
  const metadata = model => ({ ...model, description: [model.description,
    `本地请求预算：上下文 ${config.contextWindow}、输出 ${config.maxTokens} tokens；可在插件配置调整。实际扣费以小云账单为准。`].filter(Boolean).join('\n') });
  async function* guarded(prepared, authority, options) {
    const signal = AbortSignal.any([authority.signal, ...(options.signal ? [options.signal] : [])]);
    try {
      await account.inferenceKey(authority.epoch, signal);
      if (signal.aborted) throw new LlmError('请求已取消。', 'ABORTED');
      for await (const chunk of prepared.stream({ ...options, signal })) yield chunk;
    } catch (error) {
      if (signal.aborted) throw new LlmError('请求已取消。', 'ABORTED');
      // Account errors are fixed messages. Preserve native LLM error facts.
      if (error instanceof LlmError) throw error;
      throw new LlmError(publicError(error).message, 'SKYMONI_ACCOUNT');
    }
  }
  class Adapter extends LlmAdapter {
    providerInfo() { return { id: PROVIDER, name: 'Skymoni' }; }
    providerRetryPolicy(route) { return delegate.providerRetryPolicy(route); }
    imageRequestTarget(...args) { return delegate.imageRequestTarget(...args); }
    async listModels(route) { return (await delegate.listModels(route)).map(metadata); }
    async resolveModel(...args) { return metadata(await delegate.resolveModel(...args)); }
    async prepareCall(route, model, signal) {
      const profile = profiles.get(route), authority = authorities.get(profile);
      if (!authority) throw new LlmError('请先登录小云账户。', 'MISSING_CREDENTIAL');
      const prepared = await delegate.prepareCall(route, model, signal);
      return { ...prepared, model: metadata(prepared.model), stream: options => guarded(prepared, authority, options) };
    }
    async *stream(options) { const prepared = await this.prepareCall(options.provider, options.model, options.signal); yield* prepared.stream(options); }
  }
  const adapter = new Adapter();
  function synchronize() {
    if (disposed) return;
    const state = account.snapshot(), authority = account.authority();
    const nextSignature = JSON.stringify([state.signedIn, authority.epoch, state.models]);
    if (signature === nextSignature) return;
    const previous = profiles;
    if (!state.signedIn || !state.models.length) profiles = new Map();
    else {
      const chat = openAICompletionsApi(), responses = openAIResponsesApi();
      const models = state.models.map(({ id, protocol }) => {
        const vision = config.visionModels.includes(id);
        return { id, name: id, provider: PROVIDER, api: protocol === 'responses' ? 'openai-responses' : 'openai-completions',
          baseUrl: `${ORIGIN}/v1`, input: vision ? ['text', 'image'] : ['text'], reasoning: false,
          contextWindow: config.contextWindow, maxTokens: config.maxTokens,
          // pi-ai requires numeric cost fields. DSH does not use them for billing.
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: protocol === 'responses' ? { supportsStore: false } : { maxTokensField: 'max_tokens', supportsStore: false, supportsStrictMode: false } };
      });
      const wire = model => model.api === 'openai-responses' ? responses : chat;
      const piProvider = { id: PROVIDER, name: 'Skymoni', baseUrl: `${ORIGIN}/v1`,
        auth: { apiKey: { name: 'Skymoni', resolve: async ({ credential }) => ({ auth: credential?.key ? { apiKey: credential.key } : {}, source: 'Skymoni' }) } },
        getModels: () => models, stream: (model, ...args) => wire(model).stream(model, ...args), streamSimple: (model, ...args) => wire(model).streamSimple(model, ...args) };
      const profile = { provider: PROVIDER, displayName: 'Skymoni', baseURL: `${ORIGIN}/v1`, piProvider,
        streamIdleTimeoutMs: 300000, timeoutMs: 600000, maxRequestImageBytes: 20 * 1024 * 1024,
        maxRequestImages: 20, imageOffloadCountQuantum: 5, requestImagePixelBudget: 2048 ** 2, requestImageMaxBytes: 1024 * 1024,
        retryPolicy: resolveRetryPolicy({ mode: 'normal', maxRetries: 0 }, '小云账户'),
        modelErrors: new Map(), configuredMaxTokens: new Map(models.map(model => [model.id, config.maxTokens])) };
      authorities.set(profile, authority); profiles = new Map([[PROVIDER, profile]]);
    }
    try {
      const routes = [...profiles.keys()];
      if (!registration && routes.length) registration = ctx.llm.registerAdapter(routes, adapter);
      else registration?.replace(routes);
      signature = nextSignature;
      ctx.emit?.('llm/models-updated', PROVIDER);
    } catch (error) { profiles = previous; throw error; }
  }
  account.on('change', synchronize); synchronize();
  return { adapter, dispose() { disposed = true; account.off('change', synchronize); registration?.(); profiles = new Map(); } };
}
