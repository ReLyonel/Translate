import {expect,it,vi,afterEach} from 'vitest';
import {ProtectedContentEngine as P} from '../../src/services/protected-content/protectedContentEngine';
import {semanticChunks} from '../../desktop/translation/prompt';
import {recoverUnits} from '../../desktop/translation/recoverUnits';
import {translate} from '../../desktop/ollama';
import {JsonEngine} from '../../src/services/json/jsonEngine';
import {jsonQualityGate} from '../../src/services/validation/qualityGate';

afterEach(()=>vi.restoreAllMocks());
const references=['&Reference[Prone apply=false]','&amp;Reference[Incapacitated apply=false]',
 '&AMP;Reference[Total Cover]','&#38;Reference[magic]','&#x26;Reference[Restrained apply=long]',
 '&amp;amp;Reference[Bloodied]','@UUID[Compendium.test.items.Item.a]','@Embed[Compendium.test.tables.RollTable.a inline rollable]',
 '&#64;UUID[Item.a]','&commat;Actor[abc]','&amp;Reference&#91;Prone&#93;',
 '&Reference&lbrack;key[nested]&rbrack;','&#x26;Reference&#x5b;key&#x5d;'];
it.each(references)('hides the entire technical reference and restores exact source bytes: %s',reference=>{
 const source='<p>Текст '+reference+'{Label} текст &amp;.</p>',value=P.protect(source);
 expect(value.protectedText).not.toContain('Reference');expect(value.protectedText).not.toContain('Item.a');
 expect([...value.tokens.values()].filter(t=>t.type==='reference').map(t=>t.original)).toEqual([reference]);
 expect(P.restore(value.protectedText.replaceAll('Текст','Texto').replaceAll('текст','texto').replace('Label','Etiqueta'),value.tokens)).toMatchObject({isValid:true,restoredText:source.replaceAll('Текст','Texto').replaceAll('текст','texto').replace('Label','Etiqueta')});
});
it('keeps multiple references, quoted/nested brackets and adjacent entities separate',()=>{
 const source='Текст &amp;Reference[key[a[b]] option="x]y"] &amp;Reference[Prone] &amp; final';
 const value=P.protect(source);expect([...value.tokens.values()].map(t=>t.original)).toEqual(['&amp;Reference[key[a[b]] option="x]y"]','&amp;Reference[Prone]','&amp;']);
 expect(P.restore(value.protectedText,value.tokens)).toMatchObject({isValid:true,restoredText:source});
});
it.each(['&amp;Reference[Prone','&Reference&#91;Prone','&#64;UUID[Item.a'])('rejects unterminated references instead of exposing technical prose: %s',source=>expect(()=>P.protect(source)).toThrow('AMBIGUOUS_TECHNICAL_SYNTAX'));
it('protects before semantic chunking, including long embedded field arrays',async()=>{
 const fields=['<p>Текст &amp;Reference[Prone] текст.</p>',('Текст &amp;Reference[Incapacitated apply=false] текст. ').repeat(70)];
 const onFailure=vi.fn();let calls=0;
 const output=await recoverUnits(fields,async request=>{calls++;return request.texts.map(text=>{
  const chunks=semanticChunks(text);expect(chunks.join('')).toBe(text);
  for(const chunk of chunks){expect(chunk).not.toContain('Reference');expect(chunk).not.toContain('apply=false');expect(chunk).not.toMatch(/\[\[PROTECTED_\d*$/);}
  return chunks.map(c=>c.replaceAll('Текст','Texto').replaceAll('текст','texto')).join('');
 });},new AbortController().signal,'ru',onFailure);
 expect(calls).toBe(1);expect(onFailure).not.toHaveBeenCalled();expect(output).toEqual(fields.map(s=>s.replaceAll('Текст','Texto').replaceAll('текст','texto')));
});
it('never sends reference bytes through the actual Ollama adapter (mocked HTTP only)',async()=>{
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async(_url,options)=>{
  const body=JSON.parse(String(options?.body)),prompt=body.messages[0].content;
  expect(prompt).not.toContain('Reference');expect(prompt).not.toContain('apply=false');
  return Response.json({message:{content:prompt.split('\n\n\n').at(-1).replaceAll('Текст','Texto')},done:true});
 });
 const source='<p>Текст &amp;Reference[Prone apply=false]{Label} @UUID[Item.a] [[/r 1d20]]</p>';
 expect(await recoverUnits([source],r=>translate({endpoint:'http://unused.invalid',model:'translategemma:27b'},r),new AbortController().signal,'ru',()=>{throw new Error('UNEXPECTED_FALLBACK');})).toEqual([source.replace('Текст','Texto')]);
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it('reconstructs embedded item fields and arrays without altering identity, assets or encoded references',async()=>{
 const original={_id:'actor123',type:'npc',img:'modules/example/a.webp',flags:{technical:'keep'},items:[
  {_id:'item123',type:'feat',system:{description:{value:'<p>Текст &amp;Reference[Prone apply=false] @UUID[Item.a] [[/r 1d20]]</p>'}}},
  {_id:'item456',type:'feat',system:{description:{value:('Текст &#38;Reference[magic] текст. ').repeat(60)}}}
 ]};
 const paths=original.items.map((_,i)=>['items',i,'system','description','value']);
 const texts=original.items.map(i=>i.system.description.value);
 const targets=await recoverUnits(texts,async r=>r.texts.map(t=>t.replaceAll('Текст','Texto').replaceAll('текст','texto')),new AbortController().signal,'ru',()=>{throw new Error('UNEXPECTED_FALLBACK');});
 const translated=JsonEngine.reconstruct(original,targets.map((value,i)=>({path:'unused',pathSegments:paths[i],value})));
 expect(jsonQualityGate(JSON.stringify(original),JSON.stringify(translated),paths).status).toBe('PASS');
 expect(translated.items.map((i:any)=>i._id)).toEqual(['item123','item456']);expect(translated.img).toBe(original.img);expect(translated.flags).toEqual(original.flags);
 const corrupt=structuredClone(translated);corrupt.items[0].system.description.value=corrupt.items[0].system.description.value.replace('Reference[Prone apply=false]','Reference[Changed]');
 expect(jsonQualityGate(JSON.stringify(original),JSON.stringify(corrupt),paths).status).toBe('FAILED');
});
