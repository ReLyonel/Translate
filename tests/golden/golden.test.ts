import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, it } from 'vitest';
import { JsonEngine } from '../../src/services/json/jsonEngine';
import { ProtectedContentEngine } from '../../src/services/protected-content/protectedContentEngine';
import { FoundryValidator } from '../../src/services/validation/foundryValidator';
import { foundryV14Profile } from '../../desktop/compatibility/foundryV14';
const categories=['actors','items','spells','journals','tables','scenes','macros','settings','lang','packs','html','uuid','rolls'];
it.each(categories)('golden %s: only approved source locations differ', async category => {
  const root=path.resolve('tests/golden/foundry_v14_368',category);
  const input=JsonEngine.parse(await fs.readFile(path.join(root,'input.json'),'utf8'));
  const expected=JsonEngine.parse(await fs.readFile(path.join(root,'expected.json'),'utf8'));
  const fields=JsonEngine.analyze(input).fields.filter(field=>field.classification==='TRANSLATABLE');
  const changes=fields.map(field=>{
    const protectedValue=ProtectedContentEngine.protect(field.originalValue);
    const translated=protectedValue.protectedText.replaceAll('Attack','Ataque').replaceAll('Sword','Espada');
    const restored=ProtectedContentEngine.restore(translated,protectedValue.tokens);
    expect(restored.isValid).toBe(true);
    return {path:field.path,pathSegments:field.pathSegments,value:restored.restoredText};
  });
  const output=JsonEngine.reconstruct(input,changes);
  expect(output).toEqual(expected);
  expect(FoundryValidator.validate(input,output,{translatedCount:changes.length,confirmedTermsCount:0,reviewedTermsCount:0,uncertainTermsCount:0,allowedPaths:changes.map(change=>change.pathSegments!)}).isValid).toBe(true);
  expect(JsonEngine.parse(JSON.stringify(output))).toEqual(expected);
});
it('never describes source fixtures as native runtime certification',()=>{
  expect(foundryV14Profile).toMatchObject({targetVersion:'14.368',defaultModel:'translategemma:27b',babeleRequired:false,runtimeValidation:'NOT_RUN',nativePackPublishing:false,laterVersions:'REQUIRE_VALIDATION'});
});
