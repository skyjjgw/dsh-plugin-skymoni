import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fail } from './protocol.js';

const KEEP_MS = 366 * 86400000;
const MAX_ROWS = 5000;
const count = value => Number.isSafeInteger(value) && value >= 0;

export function totalTokens(usage) {
  if (count(usage.totalTokens)) return usage.totalTokens;
  const { inputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0 } = usage;
  const numbers = [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens];
  if (!numbers.every(count)) return null;
  const total = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
  return count(total) ? total : null;
}

export function createUsageHistory({ read, update, now = Date.now }) {
  const tasks = new Map();
  const failed = new Set();
  const key = id => 'usage-' + createHash('sha256').update(id).digest('hex').slice(0, 32);
  const recent = (value, cutoff) => (value?.version === 1 && Array.isArray(value.rows) ? value.rows : [])
    .filter(row => count(row?.time) && row.time >= cutoff && typeof row.model === 'string' &&
      row.model.length <= 256 && (row.tokens === null || count(row.tokens)) && ['done', 'aborted', 'error'].includes(row.status));

  return {
    record(id, row) {
      const name = key(id);
      const task = (tasks.get(name) ?? Promise.resolve()).then(() => update(name, value => {
        const cutoff = now() - KEEP_MS;
        const rows = recent(value, cutoff).concat(row).sort((a, b) => b.time - a.time);
        const evictedAt = Math.max(value?.evictedAt ?? 0, rows[MAX_ROWS]?.time ?? 0);
        return { version: 1, evictedAt: evictedAt >= cutoff ? evictedAt : 0, rows: rows.slice(0, MAX_ROWS) };
      })).catch(() => { failed.add(name); }).finally(() => { if (tasks.get(name) === task) tasks.delete(name); });
      tasks.set(name, task);
      return task;
    },
    async list(id) {
      const name = key(id);
      await tasks.get(name);
      try {
        const data = await read(name);
        const cutoff = now() - KEEP_MS;
        return { rows: recent(data, cutoff), limited: (data?.evictedAt ?? 0) >= cutoff, incomplete: failed.has(name) };
      } catch { throw fail('STORAGE'); }
    },
  };
}

const labels = { done: '完成', aborted: '取消', error: '失败' };

export function usageRange(payload) {
  const { start, end } = payload;
  const valid = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(value);
  };
  if (Object.keys(payload).length !== 2 || !valid(start) || !valid(end) || start > end) return null;
  const until = new Date(end + 'T00:00:00');
  until.setDate(until.getDate() + 1);
  return { start, end, fromMs: +new Date(start + 'T00:00:00'), untilMs: +until };
}

export async function exportUsage(rows, range, directory = join(homedir(), 'Downloads')) {
  const csv = value => {
    const text = String(value ?? '');
    const safe = /^[=+\-@\t\r\n]|^\s+[=+\-@]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const selected = rows.filter(row => row.time >= range.fromMs && row.time < range.untilMs);
  if (!selected.length) throw fail('USAGE_EMPTY');
  const body = selected.map(row => [new Date(row.time).toISOString(), row.model, row.tokens, labels[row.status]].map(csv).join(','));
  const content = '\ufeff时间（UTC）,模型,已知Tokens,状态\r\n' + body.join('\r\n') + '\r\n';
  await mkdir(directory, { recursive: true });
  const basename = `Skymoni-用量-${range.start}-${range.end}`;
  for (let index = 1; index <= 100; index++) {
    const path = join(directory, basename + (index === 1 ? '' : ` (${index})`) + '.csv');
    try {
      await writeFile(path, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      return { path, count: selected.length };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw fail('USAGE_EXPORT_FAILED');
}
