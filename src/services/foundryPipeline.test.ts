import { describe, expect, it } from 'vitest';
import { JsonEngine } from './json/jsonEngine';
import { ProtectedContentEngine } from './protected-content/protectedContentEngine';
import { FoundryValidator } from './validation/foundryValidator';

const stats = { translatedCount: 1, confirmedTermsCount: 0, reviewedTermsCount: 0, uncertainTermsCount: 0 };
describe('Foundry-safe pipeline', () => {
  it('reconstructs nested objects and arrays without changing technical fields', () => {
    const original = [{ _id: 'abc', name: 'Fire Bolt', system: { description: { value: 'Deal 1d10 fire damage.' }, activities: [{ description: { value: 'Make an attack.' } }] } }];
    const translated = JsonEngine.reconstruct(original, [{ path: '[0].name', value: 'Proyectil de fuego' }, { path: '[0].system.description.value', value: 'Inflige 1d10 de daño de fuego.' }]);
    expect(translated[0]._id).toBe('abc');
    expect(translated[0].system.activities[0].description.value).toBe('Make an attack.');
    expect(FoundryValidator.validate(original, translated, stats).isValid).toBe(true);
  });

  it('classifies supported activities/effects and leaves unknown prose uncertain', () => {
    const fields = JsonEngine.analyze({ system: { activities: [{ description: { chatFlavor: 'Hit!' } }], custom: 'Human prose' }, effects: [{ name: 'Blessed', description: 'Gain a bonus' }] }).fields;
    expect(fields.filter((field) => field.classification === 'TRANSLATABLE')).toHaveLength(3);
    expect(fields.find((field) => field.path === 'system.custom')?.classification).toBe('UNCERTAIN');
  });

  it('protects Foundry macros while retaining visible labels for translation', () => {
    const input = '@UUID[Compendium.x.Item.abc]{Counterspell} [[/item .ABC123]]{Counterspell} [[lookup @abilities.str.mod]] [[/damage 2d6[fire]]] @Embed[JournalEntry.foo]';
    const protectedValue = ProtectedContentEngine.protect(input);
    expect(protectedValue.protectedText).toContain('{Counterspell}');
    const translated = protectedValue.protectedText.replaceAll('Counterspell', 'Contrahechizo');
    const restored = ProtectedContentEngine.restore(translated, protectedValue.tokens);
    expect(restored.isValid).toBe(true);
    expect(restored.restoredText).toContain('@UUID[Compendium.x.Item.abc]{Contrahechizo}');
    expect(restored.restoredText).toContain('[[/item .ABC123]]{Contrahechizo}');
  });

  it('preserves UUIDs, rolls, formulas, dice, numbers and HTML attributes', () => {
    const original = { _id: 'same', uuid: 'Item.same', system: { formula: '2d6 + 3', description: { value: '<p class="rule"><a href="x" data-uuid="Item.same">Roll @UUID[Item.same]{Fire Bolt} [[/damage 2d6[fire]]]</a></p>' }, level: 3 } };
    const safe = JsonEngine.reconstruct(original, [{ path: 'system.description.value', value: '<p class="rule"><a href="x" data-uuid="Item.same">Tira @UUID[Item.same]{Proyectil de fuego} [[/damage 2d6[fire]]]</a></p>' }]);
    expect(FoundryValidator.validate(original, safe, stats).isValid).toBe(true);
    const unsafe = { ...safe, system: { ...safe.system, level: 4, formula: '1d6', description: { value: '<p>Cambio</p>' } } };
    const report = FoundryValidator.validate(original, unsafe, stats);
    expect(report.isValid).toBe(false);
    expect(report.numericChanges).not.toHaveLength(0);
    expect(report.modifiedFormulas).not.toHaveLength(0);
    expect(report.htmlErrors).not.toHaveLength(0);
  });

  it('rejects missing or duplicated protected tokens', () => {
    const protectedValue = ProtectedContentEngine.protect('Roll [[/roll 1d20 + 5]] now');
    expect(ProtectedContentEngine.restore('Tira ahora', protectedValue.tokens).isValid).toBe(false);
    expect(ProtectedContentEngine.restore(`${protectedValue.protectedText} ${protectedValue.protectedText}`, protectedValue.tokens).isValid).toBe(false);
  });
});
