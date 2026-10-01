import path from 'node:path';
import fs from 'node:fs/promises';
import { TranslationMemoryLoader } from '../src/services/translation/translationMemory';

const projectRoot = process.cwd();
const sourceRoot = path.resolve(
  projectRoot,
  'data',
  'sources',
  'translation-memory',
  'fifthpendium-old-es',
);
const outputRoot = path.resolve(
  projectRoot,
  'data',
  'sources',
  'translation-memory',
  'generated',
);
const outputFile = path.join(outputRoot, 'fifthpendium-memory.json');

const loader = new TranslationMemoryLoader(sourceRoot);
const memory = await loader.load();

const conflictFreeTerms = Object.fromEntries(
  [...memory.terms.entries()]
    .filter(([source]) => !memory.conflicts.has(source))
    .map(([source, targets]) => [source, [...targets][0]]),
);

const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: 'fifthpendium-old-es',
  stats: {
    entries: memory.entries.length,
    uniqueSources: memory.terms.size,
    conflicts: memory.conflicts.size,
    conflictFreeTerms: Object.keys(conflictFreeTerms).length,
  },
  terms: conflictFreeTerms,
  conflicts: Object.fromEntries(
    [...memory.conflicts.entries()].map(([source, targets]) => [
      source,
      [...targets],
    ]),
  ),
  entries: memory.entries,
};

await fs.mkdir(outputRoot, { recursive: true });
await fs.writeFile(
  outputFile,
  JSON.stringify(payload, null, 2) + '\n',
  'utf8',
);

console.log(JSON.stringify({
  outputFile,
  ...payload.stats,
}, null, 2));
