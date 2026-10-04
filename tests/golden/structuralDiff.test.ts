import { describe, expect, it } from 'vitest';
import { JsonEngine } from '../../src/services/json/jsonEngine';
import { FoundryValidator } from '../../src/services/validation/foundryValidator';
import { structuralDiff } from '../../src/services/validation/structuralDiff';
const stats = {translatedCount:1,confirmedTermsCount:0,reviewedTermsCount:0,uncertainTermsCount:0};
describe('strict JSON and explicit locations', () => {
  it('rejects duplicate decoded keys at every nesting level before translation', () => {
    for (const source of ['{"name":"one","name":"two"}', '{"x":[{"a":1,"\\u0061":2}]}', '{"__proto__":{},"__proto__":{}}']) expect(()=>JsonEngine.parse(source)).toThrow('JSON_DUPLICATE_KEY');
    expect(JsonEngine.parse('\uFEFF{"a":[1,true,null,{"name":"x"}],"nested":{"a":2}}')).toEqual({a:[1,true,null,{name:'x'}],nested:{a:2}});
  });
  it('distinguishes dotted/bracket keys and rejects ambiguous legacy locations', () => {
    const source = {'a.b':{name:'First'},a:{b:{name:'Second'}},'x[0]':{name:'Third'}};
    expect(JsonEngine.analyze(source).fields.find(field=>field.pathSegments?.[0]==='a.b')?.classification).toBe('UNCERTAIN');
    expect(()=>JsonEngine.reconstruct(source,[{path:'a.b.name',value:'Cambio'}])).toThrow('ambigua');
    const result = JsonEngine.reconstruct(source,[{path:'a.b.name',pathSegments:['a','b','name'],value:'Segundo'}]);
    expect(result['a.b'].name).toBe('First'); expect(result.a.b.name).toBe('Segundo');
  });
  it('does not traverse inherited objects during reinsertion', () => {
    expect(()=>JsonEngine.reconstruct({name:'Attack'},[{path:'constructor.prototype.name',pathSegments:['constructor','prototype','name'],value:'Unsafe'}])).toThrow();
    expect((Object.prototype as any).name).toBeUndefined();
  });
});
describe('structural gate', () => {
  it.each([
    [{name:'Attack',img:'icons/a.webp'},{name:'Ataque',img:'icons/b.webp'}],
    [{name:'Attack',enabled:true},{name:'Ataque',enabled:false}],
    [{name:'Attack',flags:{key:'same'}},{name:'Ataque',flags:{key:'other'}}],
    [{name:'Attack',range:[1,2]},{name:'Ataque',range:[2,1]}],
    [{name:'Attack',range:[]},{name:'Ataque',range:[1]}],
    [{name:'Attack',nested:{}},{name:'Ataque',nested:[]}],
    [{name:'Attack',nested:null},{name:'Ataque',nested:{}}],
    [{name:'Attack',value:3},{name:'Ataque',value:'3'}],
  ])('blocks any unauthorized technical/array/type change %#', (before,after) => {
    const report = FoundryValidator.validate(before,after,stats); expect(report.isValid).toBe(false); expect(report.structuralErrors?.length).toBeGreaterThan(0);
  });
  it('compares technical references by field rather than global totals', () => {
    const before = {description:'Use @Macro[a]',text:'Use @UUID[Item.b]'};
    expect(FoundryValidator.validate(before,{description:'Usa @UUID[Item.b]',text:'Usa @Macro[a]'},stats).isValid).toBe(false);
    expect(FoundryValidator.validate(before,{description:'Usa @Macro[a] @Macro[a]',text:'Usa @UUID[Item.b]'},stats).isValid).toBe(false);
  });
  it('uses explicit eligible allowlists and blocks attempts to authorize technical fields', () => {
    const before = {name:'Attack',description:'Sword',img:'icons/a.webp'};
    expect(FoundryValidator.validate(before,{...before,name:'Ataque'}, {...stats,allowedPaths:[]}).isValid).toBe(false);
    expect(FoundryValidator.validate(before,{...before,img:'other'}, {...stats,allowedPaths:[['img']]}).isValid).toBe(false);
    expect(FoundryValidator.validate(before,{...before,name:'Ataque'}, {...stats,allowedPaths:[['name']]}).isValid).toBe(true);
  });
  it('covers root scalars and scalar arrays', () => {
    expect(structuralDiff([1,2],[2,1],[])).toHaveLength(2);
    expect(structuralDiff(null,{},[])).toHaveLength(1);
    expect(structuralDiff('source','target',[])).toHaveLength(1);
  });
});
