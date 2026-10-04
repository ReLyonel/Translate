import { expect, it } from 'vitest';
import { JsonEngine } from '../../src/services/json/jsonEngine';
import { ProtectedContentEngine as Protection } from '../../src/services/protected-content/protectedContentEngine';
import { FoundryValidator } from '../../src/services/validation/foundryValidator';
import { validateHtmlIntegrity } from '../../src/services/validation/htmlIntegrity';
const stats={translatedCount:1,confirmedTermsCount:0,reviewedTermsCount:0,uncertainTermsCount:0};
it.each(['activation','target','range','duration','uses','consume','actionType','changes','schema','mapping','flags','_stats','ownership','relationships'])('does not translate visible-looking names inside technical container %s',container=>{
 const fields=JsonEngine.analyze({system:{[container]:[{name:'Human name',label:'Human label',description:'Human description'}]}}).fields;
 expect(fields.every(field=>field.classification==='PROTECTED')).toBe(true);
});
it.each(['actionType','coreVersion','systemVersion','createdTime','lastModifiedBy'])('matches technical keys case-insensitively: %s',key=>expect(JsonEngine.analyze({[key]:'Human sentence here'}).fields[0].classification).toBe('PROTECTED'));
it('preserves macros/code but keeps legitimate document names and prose eligible',()=>{
 const fields=JsonEngine.analyze({name:'Macro name',command:'ui.notifications.info("Execute this");',system:{activities:[{name:'Attack',description:{value:'Make an attack'}}]}}).fields;
 expect(fields.find(field=>field.path==='command')?.classification).toBe('PROTECTED');expect(fields.filter(field=>field.classification==='TRANSLATABLE')).toHaveLength(3);
});
it('does not interpret JavaScript inside command as an HTML document',()=>{
 const source={name:'Macro name',command:'const partial = "<p>";'};
 expect(FoundryValidator.validate(source,{...source,name:'Nombre de macro'},stats).isValid).toBe(true);
});
it.each(['JournalEntry.id','RollTable.id','Scene.id','Macro.id','JournalEntryPage.id','Playlist.id'])('does not translate standalone document identifier %s',value=>expect(JsonEngine.analyze({name:value}).fields[0].classification).toBe('PROTECTED'));
it.each(['UUID','Compendium','Actor','Item','JournalEntry','RollTable','Scene','Macro'])('preserves %s per field, quantity and order',type=>{
 const before={items:[{description:`Use @${type}[technical.id] twice @${type}[technical.id]`},{description:`Use @${type}[another.id]`}]};
 const after=structuredClone(before);after.items[0].description=before.items[0].description.replace('Use','Usa');
 expect(FoundryValidator.validate(before,after,stats).isValid).toBe(true);
 after.items[0].description=after.items[0].description.replace(`@${type}[technical.id]`,`@${type}[another.id]`);
 expect(FoundryValidator.validate(before,after,stats).isValid).toBe(false);
});
it.each(['[[/r 1d20kh1 + @abilities.str.mod]]','[[/roll (2d6 + 1) * 2]]','[[/damage 2d6[fire] + 1d4[cold]]]','[[lookup @abilities.str.mod]]','[[/item .abcdefghijklmnop]]','[[1d20cs>=19]]','[[/custom @lookup[a[b]] silent=true]]'])('freezes representative roll syntax without executing it: %s',roll=>{
 const value=Protection.protect('Attack '+roll);expect(Protection.restore(value.protectedText.replace('Attack','Ataca'),value.tokens)).toMatchObject({isValid:true,restoredText:'Ataca '+roll});
});
it.each([
 '<p data-expr="a < b > c"><strong>Attack</strong>&nbsp;<a href="modules/x/file.html" data-uuid="Item.a">Sword</a></p>',
 '<!-- <p>Comment</p> --><p>Attack</p>',
 '<p>Attack<area><base><br><col><embed><hr><img><input><link><meta><param><source><track><wbr></p>',
 '<script>if(a < b) { const x="<p>"; }</script><p>Attack</p>',
 '<style>.a::before{content:"<b>"}</style><p>Attack</p>',
 '<pre>const x = "<p>";</pre><p>Attack</p>',
 '<p><fvtt-element data-id="same">Attack</fvtt-element></p>'
])('preserves lexical HTML and opaque blocks %#',html=>{
 const protectedValue=Protection.protect(html);
 const restored=Protection.restore(protectedValue.protectedText.replace('Attack','Ataca'),protectedValue.tokens);
 expect(restored.isValid).toBe(true);expect(validateHtmlIntegrity(html,restored.restoredText)).toEqual([]);
 expect(FoundryValidator.validate({description:html},{description:restored.restoredText},stats).isValid).toBe(true);
});
it.each(['<p><strong>Attack</p></strong>','<p>Attack','<script>const a=1;','<style>.x{}</script>'])('rejects malformed original HTML conservatively: %s',html=>expect(FoundryValidator.validate({description:html},{description:html},stats).isValid).toBe(false));
it('detects attribute/comment/raw-code modifications while preserving prose changes',()=>{
 for(const [before,after] of [['<p id="same">Attack</p>','<p id="other">Ataca</p>'],['<!-- same --><p>Attack</p>','<!-- other --><p>Ataca</p>'],['<script>technical()</script><p>Attack</p>','<script>changed()</script><p>Ataca</p>']])expect(validateHtmlIntegrity(before,after)).not.toEqual([]);
});
it.each(['<!-- missing close','<p title="missing close','<!DOCTYPE html PUBLIC "missing'])('abstains on malformed HTML boundaries: %s',source=>expect(()=>Protection.protect(source)).toThrow('AMBIGUOUS'));
it('protects quoted doctype identifiers exactly',()=>{
 const text='<!DOCTYPE html PUBLIC "a>b"><p>Attack</p>';const value=Protection.protect(text);const restored=Protection.restore(value.protectedText.replace('Attack','Ataca'),value.tokens);
 expect(restored.isValid).toBe(true);expect(validateHtmlIntegrity(text,restored.restoredText)).toEqual([]);expect(restored.restoredText).toContain('PUBLIC "a>b"');
});
it('keeps duplicate Unicode keys, technical arrays and scalar types outside the allowlist',()=>{
 expect(()=>JsonEngine.parse('{"name":"x","\\u006eame":"y"}')).toThrow('JSON_DUPLICATE_KEY');
 const original={name:'Attack',range:[1,2],enabled:true};for(const after of [{name:'Ataca',range:[2,1],enabled:true},{name:'Ataca',range:[1,2],enabled:'true'}])expect(FoundryValidator.validate(original,after,stats).isValid).toBe(false);
});
