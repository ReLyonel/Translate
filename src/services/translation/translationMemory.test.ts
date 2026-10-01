import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TranslationMemoryLoader } from './translationMemory';

describe('Foundry translation memory', () => {
  it('extracts FifthPendium folder maps and bracketed entry names', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'translate-memory-'));

    await fs.writeFile(
      path.join(root, 'fifthpendium.spells.json'),
      JSON.stringify({
        label: 'Conjuros',
        mapping: {
          description: 'system.description.value',
          activities: { path: 'system.activities', converter: 'activities' },
        },
        folders: {
          'Оружие': 'Armas',
          '1 уровень [1st Level]': 'Nivel 1 [1st Level]',
        },
        entries: {
          abc123: {
            name: "Infusión Elemental de Songal [Songal's Elemental Suffusion]",
            description: '<p>Texto traducido.</p>',
            activities: {
              activity1: { name: 'Usar' },
            },
          },
        },
      }, null, 2),
      'utf8',
    );

    const memory = await new TranslationMemoryLoader(root).load();

    expect(memory.terms.get('Оружие')).toEqual(new Set(['Armas']));
    expect(memory.terms.get('1st Level')).toEqual(new Set(['Nivel 1']));
    expect(memory.terms.get("Songal's Elemental Suffusion"))
      .toEqual(new Set(['Infusión Elemental de Songal']));
    expect(memory.terms.has('Texto traducido.')).toBe(false);

    await fs.rm(root, { recursive: true, force: true });
  });

  it('records conflicts instead of silently picking one translation', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'translate-memory-'));

    await fs.writeFile(
      path.join(root, 'a.json'),
      JSON.stringify({
        folders: { Save: 'Guardar' },
      }),
      'utf8',
    );

    await fs.writeFile(
      path.join(root, 'b.json'),
      JSON.stringify({
        folders: { Save: 'Salvación' },
      }),
      'utf8',
    );

    const memory = await new TranslationMemoryLoader(root).load();

    expect(memory.conflicts.get('Save'))
      .toEqual(new Set(['Guardar', 'Salvación']));

    await fs.rm(root, { recursive: true, force: true });
  });

  it('reads UTF-8 Russian source keys', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'translate-memory-'));

    await fs.writeFile(
      path.join(root, 'russian.json'),
      JSON.stringify({
        folders: { 'Огненный шар': 'Bola de fuego' },
      }),
      'utf8',
    );

    const memory = await new TranslationMemoryLoader(root).load();

    expect(memory.terms.get('Огненный шар'))
      .toEqual(new Set(['Bola de fuego']));

    await fs.rm(root, { recursive: true, force: true });
  });
});
