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


  it('protects HTML tags and entities while leaving visible prose translatable', () => {
    const input = '<p><strong>Global Play Lead:</strong> Dan Ayoub</p><h2>Core Software Development</h2><p><em>Arcana Unleashed</em> &amp; more</p>';
    const protectedValue = ProtectedContentEngine.protect(input);

    expect(protectedValue.protectedText).not.toContain('<strong>');
    expect(protectedValue.protectedText).not.toContain('</strong>');
    expect(protectedValue.protectedText).not.toContain('<h2>');
    expect(protectedValue.protectedText).not.toContain('class=');
    expect(protectedValue.protectedText).not.toContain('&amp;');

    const translated = protectedValue.protectedText
      .replaceAll('Global Play Lead:', 'Director Global de Juego:')
      .replaceAll('Core Software Development', 'Desarrollo del Software Principal')
      .replaceAll('Arcana Unleashed', 'Arcana Desatada')
      .replaceAll('more', 'más');

    const restored = ProtectedContentEngine.restore(translated, protectedValue.tokens);
    expect(restored.isValid).toBe(true);
    expect(restored.restoredText).toBe(
      '<p><strong>Director Global de Juego:</strong> Dan Ayoub</p><h2>Desarrollo del Software Principal</h2><p><em>Arcana Desatada</em> &amp; más</p>'
    );
  });

  it('rejects duplicated or missing HTML placeholders instead of exporting corrupt markup', () => {
    const input = '<h2>Credits</h2><p><strong>Lead:</strong> Name</p>';
    const protectedValue = ProtectedContentEngine.protect(input);
    const htmlTokens = [...protectedValue.tokens.entries()].filter(([, info]) => info.type === 'html');
    expect(htmlTokens.length).toBeGreaterThan(0);

    const firstHtmlToken = htmlTokens[0][0];
    const duplicated = protectedValue.protectedText + firstHtmlToken;
    expect(ProtectedContentEngine.restore(duplicated, protectedValue.tokens).isValid).toBe(false);

    const missing = protectedValue.protectedText.replace(firstHtmlToken, 'text');
    expect(ProtectedContentEngine.restore(missing, protectedValue.tokens).isValid).toBe(false);
  });

  it('classifies nested FifthPendium-style entries and preserves technical mappings', () => {
    const source = {
      label: 'Classes',
      mapping: {
        advancement: { path: 'system.advancement', converter: 'advancement' },
        effects: { path: 'effects', converter: 'effects' },
        activities: { path: 'system.activities', converter: 'activities' },
      },
      folders: {
        'Path of the Fanatic': 'Senda del Fanático',
      },
      entries: {
        abc123: {
          name: 'Path of Duplicity',
          description: '<p>As a Bonus Action, create an illusion at 30 feet.</p>',
          activities: {
            act123: { name: 'Invoke' },
          },
          effects: {
            fx123: { name: 'Duplicity', description: 'The illusion distracts the target.' },
          },
          advancement: {
            adv123: { title: 'Features' },
          },
        },
      },
    };

    const fields = JsonEngine.analyze(source).fields;
    const translatablePaths = fields
      .filter((field) => field.classification === 'TRANSLATABLE')
      .map((field) => field.path);

    expect(translatablePaths).toEqual(expect.arrayContaining([
      'label',
      'entries.abc123.name',
      'entries.abc123.description',
      'entries.abc123.activities.act123.name',
      'entries.abc123.effects.fx123.name',
      'entries.abc123.effects.fx123.description',
      'entries.abc123.advancement.adv123.title',
    ]));

    expect(fields.find((field) => field.path === 'mapping.advancement.path')?.classification).toBe('PROTECTED');
    expect(fields.find((field) => field.path === 'mapping.advancement.converter')?.classification).toBe('PROTECTED');
    expect(fields.find((field) => field.path === 'folders.Path of the Fanatic')?.classification).toBe('PROTECTED');

    const translated = JsonEngine.reconstruct(source, [
      { path: 'label', value: 'Clases' },
      { path: 'entries.abc123.name', value: 'Senda de la Duplicidad' },
      { path: 'entries.abc123.description', value: '<p>Como acción adicional, crea una ilusión a 30 pies.</p>' },
      { path: 'entries.abc123.activities.act123.name', value: 'Invocar' },
      { path: 'entries.abc123.effects.fx123.name', value: 'Duplicidad' },
      { path: 'entries.abc123.effects.fx123.description', value: 'La ilusión distrae al objetivo.' },
      { path: 'entries.abc123.advancement.adv123.title', value: 'Rasgos' },
    ]);

    expect(translated.mapping).toEqual(source.mapping);
    expect(translated.folders).toEqual(source.folders);
    expect(translated.entries.abc123.activities.act123.name).toBe('Invocar');
  });

  it('handles Foundry Book/JournalEntry structure and only translates visible metadata', () => {
    const source = {
      _id: 'aunCharacterOpZQ',
      folder: 'Uf3qYTTjlBDX7Lkg',
      name: 'Character Options',
      pages: [{
        _id: 'characterOPTIOFZ',
        type: 'text',
        name: 'Character Options',
        sort: 100200,
        text: {
          content: '<p>@Embed[Compendium.dnd-arcana-unleashed.book.JournalEntry.aunArtHandoutsG2.JournalEntryPage.LNQsrH9X4xuajIMD classes=overlay-caption cite=false]</p><p><span class="small-caps">This chapter is full of new character</span> options you can use to make characters suited to magical settings.</p>',
          format: 1,
        },
        title: { level: 1, show: false },
      }],
      flags: {
        dnd5e: {
          type: 'chapter',
          position: 2,
          title: 'Chapter 1: Character Options',
          showPages: false,
          navigation: { next: 'aunSubclassesywh', up: 'aunAMultiverseln' },
        },
        core: { viewMode: 2 },
      },
      _stats: {
        coreVersion: '14.367',
        systemId: 'dnd5e',
        systemVersion: '6.0.0',
        createdTime: 1784047165093,
      },
    };

    const fields = JsonEngine.analyze(source).fields;
    const paths = fields
      .filter((field) => field.classification === 'TRANSLATABLE')
      .map((field) => field.path);

    expect(paths).toEqual(expect.arrayContaining([
      'name',
      'pages[0].name',
      'pages[0].text.content',
      'flags.dnd5e.title',
    ]));

    expect(fields.find((field) => field.path === 'flags.dnd5e.type')?.classification).toBe('PROTECTED');
    expect(fields.find((field) => field.path === 'flags.dnd5e.navigation.next')?.classification).toBe('PROTECTED');
    expect(fields.find((field) => field.path === '_stats.coreVersion')?.classification).toBe('PROTECTED');

    const translated = JsonEngine.reconstruct(source, [
      { path: 'name', value: 'Opciones de personaje' },
      { path: 'pages[0].name', value: 'Opciones de personaje' },
      { path: 'pages[0].text.content', value: '<p>@Embed[Compendium.dnd-arcana-unleashed.book.JournalEntry.aunArtHandoutsG2.JournalEntryPage.LNQsrH9X4xuajIMD classes=overlay-caption cite=false]</p><p><span class="small-caps">Este capítulo está lleno de nuevas opciones de personaje</span> para crear personajes adecuados para entornos mágicos.</p>' },
      { path: 'flags.dnd5e.title', value: 'Capítulo 1: Opciones de personaje' },
    ]);

    expect(translated._id).toBe(source._id);
    expect(translated.folder).toBe(source.folder);
    expect(translated.flags.dnd5e.type).toBe(source.flags.dnd5e.type);
    expect(translated.flags.dnd5e.navigation).toEqual(source.flags.dnd5e.navigation);
    expect(translated._stats).toEqual(source._stats);
    expect(translated.pages[0].text.content).toContain('@Embed[Compendium.dnd-arcana-unleashed.book.JournalEntry.aunArtHandoutsG2.JournalEntryPage.LNQsrH9X4xuajIMD classes=overlay-caption cite=false]');
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
