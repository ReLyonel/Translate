import fs from 'node:fs/promises';
import path from 'node:path';

/** Root-folder mode deliberately skips unrelated JSON and absent pack/scripts trees. */
export function translationKind(relative: string): 'json' | 'script' | null {
  const parts = relative.split(/[\\/]/);
  if (['pack', 'packs'].includes(parts[0].toLowerCase()) && parts.slice(1, -1).includes('_source') && /\.json$/i.test(relative)) return 'json';
  if (parts[0].toLowerCase() === 'scripts' && /\.(?:js|mjs|cjs)$/i.test(relative)) return 'script';
  return null;
}
export async function discoverModule(root: string, signal?: AbortSignal) {
  const files: { absolute: string; relative: string; kind: 'json' | 'script' | null }[] = [];
  const directories: string[] = [];
  async function walk(directory: string) {
    signal?.throwIfAborted();
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      signal?.throwIfAborted();
      if (entry.isSymbolicLink()) throw new Error('La carpeta contiene enlaces; selecciona una carpeta sin enlaces.');
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isDirectory()) { directories.push(relative); await walk(absolute); }
      else if (entry.isFile()) {
        if (files.length >= 100000) throw new Error('Carpeta demasiado grande.');
        files.push({ absolute, relative, kind: translationKind(relative) });
      }
    }
  }
  await walk(root);
  return { files, directories };
}
