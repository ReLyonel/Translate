import { parseJsonStrict } from '../../src/services/json/strictJson';
import { structuralDiff, type JsonLocation } from '../../src/services/validation/structuralDiff';
import { ProtectedContentEngine as Protection } from '../../src/services/protected-content/protectedContentEngine';
import type { TranslateRequest } from '../contracts';
import { validateHtmlIntegrity } from '../../src/services/validation/htmlIntegrity';

/** Localization keys are literal keys, not dotted document paths. */
export async function translateLocalization(source: string, language: 'en' | 'ru', translate: (request: TranslateRequest) => Promise<string[]>, signal: AbortSignal) {
  const original = parseJsonStrict(source);
  if (!original || Array.isArray(original) || typeof original !== 'object') throw new Error('LOCALIZATION_ROOT_INVALID');
  const result = structuredClone(original);
  const units: { segments: JsonLocation; value: string }[] = [];
  function walk(value: any, segments: JsonLocation = []) {
    if (typeof value === 'string') {
      if (/[\p{L}]/u.test(value)) units.push({segments,value});
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const key of Object.keys(value)) walk(value[key], [...segments,key]);
    } else throw new Error('LOCALIZATION_VALUE_INVALID');
  }
  walk(original);
  units.forEach(unit=>Protection.protect(unit.value));
  for (let offset=0; offset<units.length; offset+=32) {
    signal.throwIfAborted();
    const group=units.slice(offset,offset+32);
    const protectedValues=group.map(unit=>Protection.protect(unit.value));
    const translated=await translate({sourceLanguage:language,texts:protectedValues.map(value=>value.protectedText),context:{docType:'native-localization'},units:group.map(unit=>({sourceText:unit.value,context:{document_type:'native-localization',field_type:'localization',json_path:unit.segments}}))});
    signal.throwIfAborted();
    if (translated.length!==group.length) throw new Error('LOCALIZATION_RESPONSE_INVALID');
    group.forEach((unit,index)=>{
      if (typeof translated[index]!=='string' || !translated[index].trim()) throw new Error('LOCALIZATION_RESPONSE_INVALID');
      const restored=Protection.restore(translated[index],protectedValues[index].tokens);
      if (!restored.isValid) throw new Error('LOCALIZATION_TOKENS_INVALID');
      if(validateHtmlIntegrity(unit.value,restored.restoredText).length)throw new Error('LOCALIZATION_HTML_INVALID');
      const before=[...protectedValues[index].tokens.values()].map(token=>[token.type,token.original]);
      const after=[...Protection.protect(restored.restoredText).tokens.values()].map(token=>[token.type,token.original]);
      if (JSON.stringify(before)!==JSON.stringify(after)) throw new Error('LOCALIZATION_REFERENCES_INVALID');
      let parent=result;
      for (const key of unit.segments.slice(0,-1)) parent=parent[key];
      Object.defineProperty(parent,unit.segments.at(-1)!,{value:restored.restoredText,enumerable:true,writable:true,configurable:true});
    });
  }
  if (structuralDiff(original,result,units.map(unit=>unit.segments)).length) throw new Error('LOCALIZATION_STRUCTURE_INVALID');
  const serialized=JSON.stringify(result,null,2)+'\n';
  parseJsonStrict(serialized);
  return serialized;
}
