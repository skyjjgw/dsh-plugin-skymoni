import { EventEmitter } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { ORIGIN, ERRORS, fail, publicError, object, integer, parseJSON, authorizationURL, profile, models, formatCredits } from './protocol.js';

const EMPTY = { signedIn: false, busy: false, authorizing: false, authorization: null, user: null,
  wallet: null, models: [], error: null, updatedAt: null, expiresAt: null };

/** Host-only account authority. Snapshot deliberately contains no credential. */
export class Account extends EventEmitter {
  #store; #fetch; #now; #scheduler; #record = null; #key = null; #pending = null;
  #epoch = 0; #authority = new AbortController(); #pollTimer; #expiryTimer; #disposed = false;
  #queue = Promise.resolve(); #started; #refreshTask; #state = structuredClone(EMPTY);
  constructor({ store, fetch = globalThis.fetch, now = Date.now, scheduler = globalThis, deviceName = '小云 DSH 插件' }) {
    super(); this.#store = store; this.#fetch = fetch; this.#now = now; this.#scheduler = scheduler; this.deviceName = deviceName;
  }
  snapshot() {
    const result = structuredClone(this.#state);
    result.balanceLabel = result.wallet ? formatCredits(result.wallet.balance, result.quotaPerUnit, result.currency) : '—';
    // Public fields cannot smuggle a credential if a future server echoes one.
    const secrets = [this.#record?.token, this.#key, this.#pending?.device, this.#pending?.verifier].filter(Boolean);
    return JSON.parse(JSON.stringify(result, (_key, value) => typeof value === 'string' && secrets.some(secret => value.includes(secret)) ? '[redacted]' : value));
  }
  authority() { return { epoch: this.#epoch, signal: this.#authority.signal }; }
  #publish() { if (!this.#disposed) this.emit('change', this.snapshot()); }
  #live(epoch = this.#epoch) { if (this.#disposed) throw fail('DISPOSED'); if (epoch !== this.#epoch) throw fail('STALE'); }
  #advance() {
    this.#authority.abort(); this.#authority = new AbortController(); this.#epoch++;
    this.#scheduler.clearTimeout(this.#pollTimer); this.#scheduler.clearTimeout(this.#expiryTimer);
    this.#pending = null; this.#key = null; this.#refreshTask = null;
    return this.#epoch;
  }
  #storage(operation) {
    const task = this.#queue.then(operation); this.#queue = task.catch(() => {}); return task;
  }
  async #request(path, { method = 'GET', body, token = this.#record?.token, signal, timeout = 20000 } = {}) {
    const relayDirectory = path === 'relay-models';
    const url = relayDirectory ? `${ORIGIN}/v1/models` : `${ORIGIN}/api/app-account/${path}`;
    const deadline = AbortSignal.timeout(timeout);
    const abort = AbortSignal.any([this.#authority.signal, deadline, ...(signal ? [signal] : [])]);
    try {
      const response = await this.#fetch(url, {
        method, signal: abort, redirect: 'error', credentials: 'omit',
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `${relayDirectory ? 'Bearer' : 'AppAccount'} ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (Number(response.headers.get('content-length')) > 1048576) { await response.body?.cancel(); throw fail('PROTOCOL'); }
      const reader = response.body?.getReader(); let size = 0; const chunks = [];
      if (!reader) throw fail('PROTOCOL');
      try {
        while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength;
          if (size > 1048576) { await reader.cancel(); throw fail('PROTOCOL'); } chunks.push(value); }
      } finally { reader.releaseLock(); }
      let envelope; try { envelope = parseJSON(Buffer.concat(chunks).toString('utf8')); } catch { throw fail('PROTOCOL'); }
      if (relayDirectory) {
        if ([401, 403].includes(response.status)) throw fail('SKIVU_API_KEY_UNAVAILABLE');
        if (!response.ok) throw fail('APP_SERVICE_UNAVAILABLE');
        if (!Array.isArray(envelope?.data) || envelope.data.length > 10000) throw fail('PROTOCOL');
        return new Set(envelope.data.flatMap(item => typeof item?.id === 'string' ? [item.id] : []));
      }
      if (response.status === 401) throw fail('APP_SESSION_INVALID');
      if (!response.ok || envelope?.success !== true) throw fail(Object.hasOwn(ERRORS, envelope?.code) ? envelope.code : 'APP_SERVICE_UNAVAILABLE');
      if (path === 'session' && method === 'DELETE' && envelope.data === null) return {};
      if (!object(envelope.data)) throw fail('PROTOCOL');
      return envelope.data;
    } catch (error) {
      if (abort.aborted) throw fail(deadline.aborted && abort.reason === deadline.reason ? 'NETWORK' : 'CANCELLED');
      if (Object.hasOwn(ERRORS, error?.code)) throw error;
      throw fail('NETWORK');
    }
  }
  start() {
    return this.#started ??= (async () => {
      const epoch = this.#epoch;
      try {
        const record = await this.#store.read(); this.#live(epoch);
        if (record) {
          if (record.version !== 1 || typeof record.token !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(record.token) ||
            !Number.isSafeInteger(record.expiresAt)) throw fail('STORAGE');
          this.#record = record; this.#state.signedIn = true; this.#state.expiresAt = record.expiresAt;
          if (record.expiresAt <= this.#now()) { await this.#invalidate(); return this.snapshot(); }
          await this.refresh(); this.#scheduleExpiry();
        }
      } catch (error) { if (!this.#disposed && epoch === this.#epoch) { this.#state.error = publicError(error); this.#publish(); } }
      return this.snapshot();
    })();
  }
  #scheduleExpiry() {
    this.#scheduler.clearTimeout(this.#expiryTimer);
    if (!this.#record || this.#disposed) return;
    const epoch = this.#epoch;
    this.#expiryTimer = this.#scheduler.setTimeout(() => {
      if (epoch !== this.#epoch || this.#disposed) return;
      if (this.#record.expiresAt <= this.#now()) void this.#invalidate(); else this.#scheduleExpiry();
    }, Math.max(1, Math.min(this.#record.expiresAt - this.#now(), 2147483647)));
    this.#expiryTimer?.unref?.();
  }
  async begin() {
    await this.start(); this.#live();
    if (this.#record || this.#state.authorizing || this.#state.busy) return this.snapshot();
    const epoch = this.#advance();
    Object.assign(this.#state, { busy: true, authorizing: true, error: null }); this.#publish();
    try {
      const verifier = randomBytes(32).toString('base64url');
      const data = await this.#request('authorize', { method: 'POST', token: null,
        body: { code_challenge: createHash('sha256').update(verifier).digest('base64url'), device_name: this.deviceName } });
      this.#live(epoch);
      if (typeof data.device_code !== 'string' || !/^[\x21-\x7e]{1,1024}$/.test(data.device_code)) throw fail('PROTOCOL');
      const url = authorizationURL(data.verification_uri_complete, data.user_code);
      this.#pending = { device: data.device_code, verifier, expiresAt: this.#now() + integer(data.expires_in, 1, 600) * 1000, interval: integer(data.interval ?? 5, 1, 60) };
      Object.assign(this.#state, { busy: false, authorization: { url, code: data.user_code, expiresAt: this.#pending.expiresAt } });
      this.#schedulePoll(epoch); this.#publish();
    } catch (error) {
      if (epoch === this.#epoch && !this.#disposed) { this.#pending = null; Object.assign(this.#state, { busy: false, authorizing: false, error: publicError(error) }); this.#publish(); }
    }
    return this.snapshot();
  }
  #schedulePoll(epoch) {
    if (!this.#pending || this.#disposed) return;
    this.#pollTimer = this.#scheduler.setTimeout(() => void this.#poll(epoch), Math.max(1, Math.min(this.#pending.interval * 1000, this.#pending.expiresAt - this.#now())));
    this.#pollTimer?.unref?.();
  }
  async #poll(epoch) {
    try {
      this.#live(epoch); const pending = this.#pending; if (!pending) return;
      if (pending.expiresAt <= this.#now()) throw fail('EXPIRED_TOKEN');
      const data = await this.#request('token', { method: 'POST', token: null, timeout: Math.min(20000, pending.expiresAt - this.#now()),
        body: { device_code: pending.device, code_verifier: pending.verifier } });
      if (data.token_type !== 'AppAccount' || typeof data.access_token !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(data.access_token)) throw fail('PROTOCOL');
      const record = { version: 1, token: data.access_token, expiresAt: integer(data.expires_at, 1, 8640000000000) * 1000 };
      if (epoch !== this.#epoch || this.#disposed) {
        try { await this.#request('session', { method: 'DELETE', token: record.token, timeout: 5000 }); } catch {}
        return;
      }
      if (record.expiresAt <= this.#now()) throw fail('EXPIRED_TOKEN');
      try { await this.#storage(async () => { this.#live(epoch); await this.#store.write(record); }); }
      catch (error) {
        // A cancelled login may finish issuance; revoke its orphaned session.
        try { await this.#request('session', { method: 'DELETE', token: record.token, timeout: 5000 }); } catch {}
        throw Object.hasOwn(ERRORS, error?.code) ? error : fail('STORAGE');
      }
      if (epoch !== this.#epoch || this.#disposed) {
        try { await this.#request('session', { method: 'DELETE', token: record.token, timeout: 5000 }); } catch {}
        return;
      }
      this.#record = record; this.#pending = null;
      Object.assign(this.#state, { signedIn: true, authorizing: false, authorization: null, expiresAt: record.expiresAt });
      this.#scheduleExpiry(); await this.refresh();
    } catch (error) {
      if (epoch !== this.#epoch || this.#disposed) return;
      if (['AUTHORIZATION_PENDING', 'SLOW_DOWN', 'NETWORK', 'APP_SERVICE_UNAVAILABLE', 'CANCELLED'].includes(error.code) && this.#pending) {
        if (error.code === 'SLOW_DOWN') this.#pending.interval = Math.min(60, this.#pending.interval + 5);
        if (!['AUTHORIZATION_PENDING', 'SLOW_DOWN'].includes(error.code)) this.#state.error = publicError(error);
        this.#schedulePoll(epoch);
      } else {
        this.#pending = null; Object.assign(this.#state, { busy: false, authorizing: false, authorization: null, error: publicError(error) });
      }
      this.#publish();
    }
  }
  async cancel() {
    this.#live(); if (!this.#state.authorizing) return this.snapshot();
    this.#advance(); this.#record = null; this.#state = structuredClone(EMPTY); this.#publish();
    try { await this.#storage(() => this.#store.clear()); } catch { this.#state.error = publicError(fail('STORAGE')); this.#publish(); }
    return this.snapshot();
  }
  async #invalidate() {
    this.#advance(); this.#record = null; this.#state = { ...structuredClone(EMPTY), error: publicError(fail('APP_SESSION_INVALID')) }; this.#publish();
    try { await this.#storage(() => this.#store.clear()); } catch { this.#state.error = publicError(fail('STORAGE')); this.#publish(); }
  }
  refresh() {
    if (this.#refreshTask) return this.#refreshTask;
    const task = this.#refresh().finally(() => { if (this.#refreshTask === task) this.#refreshTask = null; });
    return this.#refreshTask = task;
  }
  async #refresh() {
    this.#live(); if (!this.#record) return this.snapshot(); const epoch = this.#epoch;
    if (this.#record.expiresAt <= this.#now()) { await this.#invalidate(); return this.snapshot(); }
    this.#state.busy = true; this.#publish();
    try {
      const info = profile(await this.#request('me')); this.#live(epoch);
      Object.assign(this.#state, info, { signedIn: true });
      const catalog = models(await this.#request('models')); this.#live(epoch);
      const provider = await this.#request('provider', { method: 'POST' }); this.#live(epoch);
      if (provider.provider_id !== 'skymoni' || provider.base_url !== `${ORIGIN}/v1` || provider.api !== 'openai-completions' ||
        typeof provider.api_key !== 'string' || !/^sk-[A-Za-z0-9]{48}$/.test(provider.api_key)) throw fail('PROTOCOL');
      const allowed = await this.#request('relay-models', { token: provider.api_key }); this.#live(epoch);
      this.#key = provider.api_key;
      Object.assign(this.#state, info, { signedIn: true, models: catalog.filter(model => allowed.has(model.id)), busy: false, error: null, expiresAt: this.#record.expiresAt, updatedAt: this.#now() });
    } catch (error) {
      if (epoch !== this.#epoch || this.#disposed) return this.snapshot();
      if (error.code === 'APP_SESSION_INVALID') { await this.#invalidate(); return this.snapshot(); }
      this.#state.error = publicError(error); this.#state.busy = false;
      // Never leave a stale usable model route after a failed restoration.
      if (['SKIVU_API_KEY_UNAVAILABLE', 'SKIVU_API_KEY_LIMIT'].includes(error.code)) this.#key = null;
      if (!this.#key) this.#state.models = [];
    }
    this.#publish(); return this.snapshot();
  }
  peekKey(epoch) { this.#live(epoch); if (!this.#record || !this.#key || !this.#state.signedIn) throw fail('SIGNED_OUT'); return this.#key; }
  async inferenceKey(epoch, signal) {
    this.peekKey(epoch);
    if (this.#record.expiresAt <= this.#now()) { await this.#invalidate(); throw fail('APP_SESSION_INVALID'); }
    try { await this.#request('me', { signal }); this.#live(epoch); return this.peekKey(epoch); }
    catch (error) { if (error.code === 'APP_SESSION_INVALID' && epoch === this.#epoch) await this.#invalidate(); throw error; }
  }
  async logout() {
    this.#live(); const token = this.#record?.token; const epoch = this.#advance(); this.#record = null;
    this.#state = { ...structuredClone(EMPTY), busy: true }; this.#publish();
    let storageError = false, remoteError = false;
    try { await this.#storage(() => this.#store.clear()); } catch { storageError = true; }
    if (token) try { await this.#request('session', { method: 'DELETE', token, timeout: 5000 }); }
    catch (error) { remoteError = error.code !== 'APP_SESSION_INVALID'; }
    if (epoch === this.#epoch && !this.#disposed) {
      this.#state.busy = false; this.#state.error = storageError ? publicError(fail('STORAGE')) : remoteError ? publicError(fail('REMOTE_LOGOUT')) : null; this.#publish();
    }
    return this.snapshot();
  }
  async dispose() {
    if (this.#disposed) return;
    const pending = this.#state.authorizing; this.#advance(); this.#record = null; this.#disposed = true; this.removeAllListeners();
    if (pending) await this.#storage(() => this.#store.clear()).catch(() => {});
  }
}
