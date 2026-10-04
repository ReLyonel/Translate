import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { runBatch } from '../desktop/jobs';
import { translate, health } from '../desktop/providers';
const input = process.argv[2];
if (!input) throw new Error('Indica la carpeta de prueba.');
const settings = {endpoint:'http://127.0.0.1:11500', model:'translategemma:27b', provider:'ollama' as const, fallback:false};
if (!(await health(settings)).modelInstalled) throw new Error('Modelo no disponible.');
const parent = path.resolve('reports/folder-validation'); await fs.mkdir(parent, {recursive:true});
const output = path.join(parent, 'translated-' + Date.now());
async function hashes(root: string) {
  const result: Record<string,string> = {};
  async function walk(directory: string) { for (const entry of await fs.readdir(directory, {withFileTypes:true})) { const file = path.join(directory,entry.name); if (entry.isDirectory()) await walk(file); else if (entry.isFile()) result[path.relative(root,file)] = createHash('sha256').update(await fs.readFile(file)).digest('hex'); } }
  await walk(root); return result;
}
const before = await hashes(input);
let last = -1;
const result = await runBatch(input, output, request => translate(settings, request), new AbortController().signal, progress => { if (progress.completed !== last) { last = progress.completed; console.log(`${progress.completed}/${progress.total}; errores=${progress.failed}; ${progress.current}`); } });
const unchanged = JSON.stringify(before) === JSON.stringify(await hashes(input));
await fs.writeFile(path.join(parent,'report.json'),JSON.stringify({ ...result, originalHashesUnchanged:unchanged, output, provider:settings },null,2));
console.log(JSON.stringify({ ...result, originalHashesUnchanged:unchanged, output }));
if (!unchanged || result.failed) process.exitCode = 1;
