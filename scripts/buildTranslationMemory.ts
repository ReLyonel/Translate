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
const reportFile = path.join(outputRoot, 'fifthpendium-memory-report.json');

function uppercaseCount(value: string): number {
  return (value.match(/[A-ZÁÉÍÓÚÜÑ]/gu) ?? []).length;
}

function chooseCaseOnlyVariant(targets: Set<string>): string {
  return [...targets].sort((a, b) => {
    const upperDelta = uppercaseCount(a) - uppercaseCount(b);
    if (upperDelta !== 0) return upperDelta;

    const lengthDelta = a.length - b.length;
    if (lengthDelta !== 0) return lengthDelta;

    return a.localeCompare(b, 'es');
  })[0];
}

function isCaseOnlyConflict(targets: Set<string>): boolean {
  const normalized = new Set(
    [...targets].map((target) => target.toLocaleLowerCase('es')),
  );
  return normalized.size === 1;
}

const loader = new TranslationMemoryLoader(sourceRoot);
const memory = await loader.load();

const terms: Record<string, string> = {};
const caseOnlyResolved: Record<string, string> = {};
const semanticConflicts: Record<string, string[]> = {};

for (const [source, targets] of memory.terms.entries()) {
  if (targets.size === 1) {
    terms[source] = [...targets][0];
    continue;
  }

  if (isCaseOnlyConflict(targets)) {
    const selected = chooseCaseOnlyVariant(targets);
    terms[source] = selected;
    caseOnlyResolved[source] = selected;
    continue;
  }

  semanticConflicts[source] = [...targets].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
}

const payload = {
  version: 2,
  generatedAt: new Date().toISOString(),
  source: 'fifthpendium-old-es',
  stats: {
    entries: memory.entries.length,
    uniqueSources: memory.terms.size,
    rawConflicts: memory.conflicts.size,
    semanticConflicts: Object.keys(semanticConflicts).length,
    caseOnlyResolved: Object.keys(caseOnlyResolved).length,
    activeTerms: Object.keys(terms).length,
  },
  terms,
  caseOnlyResolved,
  conflicts: Object.fromEntries(
    [...memory.conflicts.entries()].map(([source, targets]) => [
      source,
      [...targets].sort((a, b) => a.localeCompare(b, 'es')),
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

await fs.writeFile(
  reportFile,
  JSON.stringify(
    {
      ...payload.stats,
      semanticConflicts,
      caseOnlyResolved,
    },
    null,
    2,
  ) + '\n',
  'utf8',
);

console.log(JSON.stringify({
  outputFile,
  reportFile,
  ...payload.stats,
}, null, 2));
