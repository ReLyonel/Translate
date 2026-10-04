import { expect, it } from 'vitest';
import { ProtectedContentEngine as Engine } from '../../src/services/protected-content/protectedContentEngine';
import { FoundryValidator } from '../../src/services/validation/foundryValidator';
import { translate, providers } from '../../desktop/providers';
import { vi } from 'vitest';
const stats = {translatedCount:1,confirmedTermsCount:0,reviewedTermsCount:0,uncertainTermsCount:0};
it('versioned rules avoid literal marker collisions and restore them exactly',()=>{
  const input='Keep [[PROTECTED_001]] and @UUID[Item.foo]';const protectedValue=Engine.protect(input);
  expect(Engine.rulesVersion).toBe('integrity-5');expect([...protectedValue.tokens.keys()]).not.toContain('[[PROTECTED_001]]');
  expect(Engine.restore(protectedValue.protectedText,protectedValue.tokens)).toMatchObject({isValid:true,restoredText:input});
});
it.each(['${fn({a:{b:1},s:"}"})}','[[/r @lookup[a[b[c]]] + 1d7]]','<a title="1 > 0" href="https://a.invalid">','C:\\modules\\example\\file.json','../assets/icons/file.webp','Compendium.example.items.Item.abcdefghijklmnop','@CustomRef[technical-id]','@UUID[Item.foo[bar[baz]]]','2d20kh1+5'])('preserves nested or technical syntax %s',syntax=>{
 const protectedValue=Engine.protect('Use '+syntax);expect(protectedValue.protectedText).not.toContain(syntax);
 expect(Engine.restore(protectedValue.protectedText.replace('Use','Usa'),protectedValue.tokens)).toMatchObject({isValid:true,restoredText:'Usa '+syntax});
});
it('rejects reordering directly at restoration, before reinsertion',()=>{
 const protectedValue=Engine.protect('Use @UUID[Item.a] then [[/r 1d20]]');const [first,second]=[...protectedValue.tokens.keys()];
 expect(Engine.restore(second+' '+first,protectedValue.tokens).isValid).toBe(false);
});
it.each(['@UUID[Item.new]','<script>evil()</script>','${evil()}','[[/r 1d20]]','https://new.invalid','[[unterminated'])('rejects invented syntax %s',invented=>{
 const protectedValue=Engine.protect('Hello');expect(Engine.restore('Hola '+invented,protectedValue.tokens).isValid).toBe(false);
});
it.each(['Use [[/r 1d20','Use ${fn({a:1})'])('abstains on incomplete technical syntax %s',source=>expect(()=>Engine.protect(source)).toThrow('AMBIGUOUS'));
it.each(['UUID','Compendium','Actor','Item','JournalEntry','RollTable','Scene','Macro'])('protects %s byte for byte', kind => {
  const input = `Use @${kind}[some.relative-or-absolute.ID] now`;
  const protectedValue = Engine.protect(input);
  expect(protectedValue.protectedText).not.toContain(`@${kind}`);
  const result=Engine.restore(protectedValue.protectedText.replace('Use','Usa'),protectedValue.tokens);
  expect(result.isValid).toBe(true); expect(result.restoredText).toContain(`@${kind}[some.relative-or-absolute.ID]`);
});
it.each(['[[1d20+5]]','[[/r 1d20]]','[[/roll @abilities.str.mod + 2]]','[[/damage 2d6[fire]]]','[[lookup @name]]','{{{value}}}','{{#if value}}','${actor.name}','https://example.com/a?x=1','modules/example/data/file.json'])('freezes %s', syntax => {
  const protectedValue = Engine.protect('Attack '+syntax);
  expect(protectedValue.protectedText).not.toContain(syntax);
  expect(Engine.restore(protectedValue.protectedText,protectedValue.tokens)).toMatchObject({isValid:true,restoredText:'Attack '+syntax});
});
it('rejects missing, modified, duplicated and invented placeholders', () => {
  const protectedValue=Engine.protect('Attack @UUID[Item.a]');
  const marker=[...protectedValue.tokens.keys()][0];
  for(const output of ['Ataque','Ataque '+marker.replace('001','999'),'Ataque '+marker+marker,'Ataque '+marker+' [[PROTECTED_999]]']) expect(Engine.restore(output,protectedValue.tokens).isValid).toBe(false);
});
it('blocks technical reordering under the explicit strict policy', () => {
  const before={description:'Attack @UUID[Item.a] then @UUID[Item.b]'};
  expect(FoundryValidator.validate(before,{description:'Ataca @UUID[Item.b] luego @UUID[Item.a]'},stats).isValid).toBe(false);
});
it('preserves label delimiters while allowing human labels to translate',()=>{
  const before={description:'Use @UUID[Item.a]{Sword}'};
  expect(FoundryValidator.validate(before,{description:'Usa @UUID[Item.a]{Espada}'},stats).isValid).toBe(true);
  expect(FoundryValidator.validate(before,{description:'Usa @UUID[Item.a]Espada'},stats).isValid).toBe(false);
});
it('protects code inside rich HTML rather than sending executable content', () => {
  const input='<p>Attack</p><script>const key="Attack";</script><style>.Attack{color:red}</style>';
  const result=Engine.protect(input);
  expect(result.protectedText).not.toContain('const key'); expect(result.protectedText).not.toContain('color:red');
  expect(Engine.restore(result.protectedText.replace('Attack','Ataque'),result.tokens).restoredText).toBe(input.replace('<p>Attack','<p>Ataque'));
});
it('never applies glossary terms inside protected markers', async () => {
  const spy=vi.spyOn(providers.libretranslate,'translate').mockImplementation(async (_settings,request)=>request.texts);
  try {
    expect(await translate({endpoint:'http://localhost:11434',model:'translategemma:27b',provider:'libretranslate'}, {texts:['Attack [[PROTECTED_001]]'],terminology:[{source:'PROTECTED',target:'Roto'},{source:'001',target:'otro'},{source:'Attack',target:'Ataque'}]})).toEqual(['Ataque [[PROTECTED_001]]']);
  } finally { spy.mockRestore(); }
});
