import { describe, expect, it } from 'vitest';
import {
  findRelevantMemoryTerms,
  mergeTerminology,
  resetTranslationMemoryCache,
} from './memoryContext';

describe('Translation memory context', () => {
  it('selects the longest relevant memory phrases first', () => {
    const terms = new Map([
      ['Spell', 'Conjuro'],
      ['Spell Slot', 'Espacio de conjuro'],
      ['Saving Throw', 'Tirada de salvacion'],
    ]);

    const matches = findRelevantMemoryTerms(
      ['Make a Saving Throw and spend a Spell Slot.'],
      terms,
      10,
    );

    expect(matches.map((entry) => entry.source)).toEqual([
      'Saving Throw',
      'Spell Slot',
    ]);
    expect(matches.some((entry) => entry.source === 'Spell')).toBe(false);
  });

  it('lets explicit terminology override historical memory', () => {
    const merged = mergeTerminology(
      [{ source: 'Aid', target: 'Ayuda' }],
      [{ source: 'Aid', target: 'Auxilio' }],
    );

    expect(merged).toEqual([
      { source: 'Aid', target: 'Ayuda' },
    ]);
  });

  it('exposes a deterministic cache reset for tests', () => {
    expect(() => resetTranslationMemoryCache()).not.toThrow();
  });
});