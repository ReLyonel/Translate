import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { JsonEngine } from '../src/services/json/jsonEngine';
import { ProtectedContentEngine } from '../src/services/protected-content/protectedContentEngine';
import { FoundryValidator } from '../src/services/validation/foundryValidator';
import { translate, health } from '../desktop/ollama';
import { validateSettings } from '../desktop/security';

const input = process.argv[2];
if (!input) throw new Error('Indica una carpeta de prueba.');
const root = await fs.realpath(input);
const destination = path.resolve('reports/foundry-validation');
await fs.mkdir(destination, { recursive: true });
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const stats = { translatedCount: 0, confirmedTermsCount: 0, reviewedTermsCount: 0, uncertainTermsCount: 0 };
const results: any[] = [];
const liveUnits: { file: string; field: string; original: string; protectedText: string; tokens: ReturnType<typeof ProtectedContentEngine.protect>['tokens'] }[] = [];
const originals = new Map<string, string>();
let descriptionAdded = false;
async function visit(directory: string) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { await visit(file); continue; }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
    const raw = await fs.readFile(file);
    originals.set(file, hash(raw));
    const original = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
    const inspection = JsonEngine.analyze(original, entry.name);
    const fields = inspection.fields.filter(field => field.classification === 'TRANSLATABLE');
    const restored = fields.map(field => {
      const protectedValue = ProtectedContentEngine.protect(field.originalValue);
      const roundtrip = ProtectedContentEngine.restore(protectedValue.protectedText, protectedValue.tokens);
      assert.equal(roundtrip.isValid, true, `${entry.name}: ${field.path} tokens`);
      assert.equal(roundtrip.restoredText, field.originalValue);
      for (const [token] of protectedValue.tokens) {
        assert.equal(ProtectedContentEngine.restore(protectedValue.protectedText.replace(token, ''), protectedValue.tokens).isValid, false);
        assert.equal(ProtectedContentEngine.restore(protectedValue.protectedText + token, protectedValue.tokens).isValid, false);
      }
      if (field.path === 'name' || (!descriptionAdded && field.path.endsWith('description.value') && /[\u0400-\u04ff]/.test(field.originalValue))) {
        liveUnits.push({ file: path.relative(root, file), field: field.path, original: field.originalValue, ...protectedValue });
        if (field.path !== 'name') descriptionAdded = true;
      }
      return { path: field.path, value: roundtrip.restoredText };
    });
    const reconstructed = JsonEngine.reconstruct(original, restored);
    assert.deepEqual(reconstructed, original, entry.name + ' reconstruction');
    const validation = FoundryValidator.validate(original, reconstructed, { ...stats, translatedCount: fields.length });
    // An unchanged source may itself contain invalid HTML: report it, do not label it safe.
    const technicalValid = !validation.modifiedIds.length && !validation.modifiedUuids.length && !validation.modifiedKeys.length && !validation.modifiedFormulas.length && !validation.modifiedMacros.length;
    assert.equal(technicalValid, true, entry.name + ' integrity');
    if (typeof original._id === 'string') {
      const corrupted = structuredClone(original); corrupted._id = 'changed-by-test';
      assert.equal(FoundryValidator.validate(original, corrupted, stats).isValid, false, 'ID corruption must fail');
    }
    results.push({ file: path.relative(root, file), strings: inspection.totalStrings, translatable: fields.length, protected: inspection.protectedCount, uncertain: inspection.uncertainCount, roundtrip: 'PASS', technicalIntegrity: 'PASS', sourceValidation: validation.isValid ? 'OK' : 'WARNING', sourceIssues: validation.htmlErrors, sha256: hash(raw) });
  }
}
await visit(root);
console.log(`Integridad: ${results.length} JSON comprobados; ${liveUnits.length} unidades seleccionadas para prueba real.`);
const liveResults: any[] = [];
if (process.argv.includes('--live')) {
  let settings = { endpoint: 'http://127.0.0.1:11500', model: 'translategemma:27b' };
  try { settings = validateSettings(JSON.parse(await fs.readFile(path.join(process.env.APPDATA || '', 'foundry-translator/provider.json'), 'utf8'))); } catch {}
  const status = await health(settings);
  assert(status.connected && status.modelInstalled, 'Ollama debe estar disponible');
  for (let i = 0; i < liveUnits.length; i += 4) {
    const chunk = liveUnits.slice(i, i + 4);
    const translated = await translate(settings, { texts: chunk.map(unit => unit.protectedText), sourceLanguage: 'auto' });
    for (let j = 0; j < chunk.length; j++) {
      const unit = chunk[j];
      const restored = ProtectedContentEngine.restore(translated[j], unit.tokens);
      assert(restored.isValid, unit.file + ' placeholders: ' + restored.errors.join('; '));
      assert(restored.restoredText.trim(), 'Empty translation');
      const original = JSON.parse((await fs.readFile(path.join(root, unit.file), 'utf8')).replace(/^\uFEFF/, ''));
      const copy = JsonEngine.reconstruct(original, [{ path: unit.field, value: restored.restoredText }]);
      const report = FoundryValidator.validate(original, copy, { ...stats, translatedCount: 1 });
      assert(report.isValid, unit.file + ' live validation: ' + JSON.stringify(report));
      liveResults.push({ file: unit.file, field: unit.field, source: unit.original, target: restored.restoredText, validation: 'PASS' });
    }
    console.log(`Ollama: ${Math.min(i + 4, liveUnits.length)}/${liveUnits.length} unidades validadas`);
  }
}
for (const [file, before] of originals) assert.equal(hash(await fs.readFile(file)), before, 'Original modified: ' + file);
const report = { createdAt: new Date().toISOString(), input: root, files: results.length, strings: results.reduce((sum, r) => sum + r.strings, 0), translatable: results.reduce((sum, r) => sum + r.translatable, 0), sourceWarnings: results.filter(r => r.sourceValidation === 'WARNING').length, originalsUnchanged: true, liveUnits: liveResults.length, results, liveResults, limits: 'Todos los JSON: integridad y pruebas adversariales. Traducción real: nombres y una descripción rusa representativa; no es traducción completa del pack ni prueba dentro de Foundry.' };
await fs.writeFile(path.join(destination, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ files: report.files, strings: report.strings, translatable: report.translatable, sourceWarnings: report.sourceWarnings, liveUnits: report.liveUnits, originalsUnchanged: true }));
