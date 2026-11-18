import { createHash } from 'node:crypto';
export const TOKEN = 'fixture-account-session-secret';
export const KEY = 'sk-' + 'k'.repeat(48);
export const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
export class Clock {
  time = 1800000000000; timers = new Map(); next = 0;
  now = () => this.time;
  setTimeout = (fn, delay) => { const id = ++this.next; this.timers.set(id, { fn, due: this.time + delay }); return id; };
  clearTimeout = id => { this.timers.delete(id); };
  async advance(ms) {
    const end = this.time + ms;
    while (true) {
      const next = [...this.timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      this.time = next[1].due; this.timers.delete(next[0]); next[1].fn(); await flush();
    }
    this.time = end; await flush();
  }
}
export function store(initial = null) {
  let value = initial; const writes = [];
  return { writes, read: async () => structuredClone(value), write: async record => { value = structuredClone(record); writes.push(record); }, clear: async () => { value = null; writes.push(null); }, value: () => structuredClone(value) };
}
export function backend(clock = new Clock()) {
  const calls = []; let challenge;
  const state = { pending: false, revoked: false, meName: '插件验收账户', failure: null,
    catalog: ['fixture-chat', 'fixture-responses', 'fixture-other-group'],
    relayCatalog: ['fixture-chat', 'fixture-responses', 'fixture-nonchat'] };
  const json = data => Response.json({ success: true, data });
  const fetch = async (url, options = {}) => {
    if (options.signal?.aborted) throw options.signal.reason;
    if (!String(url).startsWith('https://skymoni.com/')) throw Error('Unexpected fixture network');
    const path = new URL(url).pathname, body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path, method: options.method, headers: options.headers, body });
    if (state.failure?.path === path) return Response.json({ success: false, code: state.failure.code, message: TOKEN }, { status: state.failure.status ?? 503 });
    if (path === '/v1/models') {
      if (options.headers.Authorization !== `Bearer ${KEY}`) throw Error('Missing fixture relay auth');
      return Response.json({ object: 'list', data: state.relayCatalog.map(id => ({ id })) });
    }
    if (path.endsWith('/authorize')) {
      challenge = body.code_challenge;
      return json({ device_code: 'fixture-device-private', user_code: 'QA001', verification_uri_complete: 'https://skymoni.com/app/authorize?code=QA001', interval: 1, expires_in: 300 });
    }
    if (path.endsWith('/token')) {
      if (createHash('sha256').update(body.code_verifier).digest('base64url') !== challenge) throw Error('PKCE mismatch');
      if (state.pending) return Response.json({ success: false, code: 'AUTHORIZATION_PENDING' }, { status: 400 });
      return json({ access_token: TOKEN, token_type: 'AppAccount', expires_at: Math.floor(clock.now() / 1000) + 3600 });
    }
    if (options.headers.Authorization !== `AppAccount ${TOKEN}`) throw Error('Missing fixture auth');
    if (state.revoked) return Response.json({ success: false, code: 'APP_SESSION_INVALID' }, { status: 401 });
    if (path.endsWith('/me')) return json({ user: { id: 7, display_name: state.meName, group: 'default' }, wallet: { balance: 625000, used: 250000, request_count: 2 }, quota_per_unit: 500000, currency: 'USD', session: { id: 'fixture-sid', device_name: '小云 DSH 插件' }, subscriptions: [] });
    if (path.endsWith('/models')) return json({ models: state.catalog, model_protocols: Object.fromEntries(state.catalog.map(id => [id, id.endsWith('responses') ? 'responses' : 'chat'])) });
    if (path.endsWith('/provider')) return json({ provider_id: 'skymoni', base_url: 'https://skymoni.com/v1', api: 'openai-completions', api_key: KEY });
    if (path.endsWith('/session')) return json(null);
    throw Error('Unexpected fixture path ' + path);
  };
  return { fetch, calls, state, clock };
}
export function sse(tool = false) {
  const choices = tool ? [
    { delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'call_fixture', type: 'function', function: { name: 'fixture_tool', arguments: '{"value":7}' } }] }, finish_reason: null },
    { delta: {}, finish_reason: 'tool_calls' },
  ] : [{ delta: { role: 'assistant', content: '小云插件验收成功' }, finish_reason: null }, { delta: {}, finish_reason: 'stop' }];
  return new Response(choices.map(choice => 'data: ' + JSON.stringify({ id: 'fixture-response', object: 'chat.completion.chunk', model: 'fixture-chat', created: 1, choices: [{ index: 0, ...choice }] }) + '\n\n').join('') + 'data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
}
export async function collect(stream) { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return chunks; }
