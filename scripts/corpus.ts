import { spawnSync } from 'node:child_process';
import path from 'node:path';

const command = process.argv[2];
if (!['list', 'scan', 'extract', 'inspect', 'report'].includes(command || '')) {
  throw new Error('Uso: npm run corpus:<list|scan|extract|inspect|report>');
}
const script = path.resolve('scripts', 'pdf_corpus.py');
const result = spawnSync(process.env.PYTHON || 'python3', [script, command!], { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
