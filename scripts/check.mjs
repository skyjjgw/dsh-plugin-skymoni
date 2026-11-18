import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const file of await readdir(new URL('../lib/', import.meta.url))) {
  if (!file.endsWith('.js')) continue;
  const result = spawnSync(process.execPath, ['--check', new URL(`../lib/${file}`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
}
console.log('All plugin modules passed syntax checks.');
