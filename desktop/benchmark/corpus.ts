import {hashKey,type MemoryContext} from '../memory/store';
import type {InventoryUnit} from '../translation/inventory';
import {sourceLanguage} from '../../src/services/translation/languageDetector';
import {ProtectedContentEngine as P} from '../../src/services/protected-content/protectedContentEngine';
import {semanticChunks,translationPrompt} from '../translation/prompt';

export interface BenchmarkCase {id:string;language:'en'|'ru';source:string;context:MemoryContext;file:string;tags:string[];reference:{target:string;entry_id:string;approval:'APPROVED';provenance:string}|null;chunks:string[];prompts:string[]}
export function prepareCase(unit:InventoryUnit):BenchmarkCase|undefined {
 const language=sourceLanguage(unit.source);if(!language)return;
 const protectedSource=P.protect(unit.source),visible=protectedSource.protectedText.replace(/\[\[PROTECTED_\d+\]\]/g,' ').trim();if(!visible)return;
 let chunks:string[];try{chunks=semanticChunks(protectedSource.protectedText);}catch{return;}
 if(chunks.length>8)return;
 const tags:string[]=[];
 if(unit.context.json_path?.at(-1)==='name')tags.push('name');
 tags.push(unit.source.length<100?'short':unit.source.length>=1000?'long':'description');
 if(unit.source.includes('<'))tags.push('html');if(protectedSource.tokens.size)tags.push('placeholders');
 if(/@(?:UUID|Compendium)\[/.test(unit.source))tags.push('uuid');if(/\[\[|\b\d+d\d+/.test(unit.source))tags.push('roll');
 if(unit.context.json_path?.includes('items'))tags.push('embedded');if(unit.context.document_type==='Script')tags.push('javascript');
 return {id:hashKey([unit.file,unit.context.json_path,unit.source]),language,source:unit.source,context:unit.context,file:unit.file,tags,reference:null,chunks,prompts:chunks.map(chunk=>translationPrompt(chunk,language))};
}
/** Bounded deterministic round-robin stratification; same frozen cases for every model. */
export function selectCases(candidates:BenchmarkCase[],perLanguage=60){
 const result:BenchmarkCase[]=[];const categories=['name','short','description','long','html','uuid','roll','embedded','javascript','dialog','notification','template'];
 for(const language of ['en','ru'] as const){const pool=candidates.filter(c=>c.language===language).sort((a,b)=>a.file.localeCompare(b.file)||a.id.localeCompare(b.id)),seen=new Set<string>();let count=0;
  while(count<perLanguage){let added=false;for(const category of categories){if(count>=perLanguage)break;const candidate=pool.find(c=>!seen.has(c.id)&&c.tags.includes(category));if(candidate){seen.add(candidate.id);result.push(candidate);count++;added=true;}}if(!added)break;}
  for(const candidate of pool){if(count>=perLanguage)break;if(!seen.has(candidate.id)){seen.add(candidate.id);result.push(candidate);count++;}}
 }
 return result;
}
