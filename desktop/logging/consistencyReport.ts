import { hashKey,type GlossaryTerm,type MemoryEntry } from '../memory/store';
import type { ResolvedUnit } from '../memory/provenance';

export interface ConsistencyIssue {source_hash:string;term?:string;system?:string;module?:string;source_language?:string;reason:'TRANSLATION_VARIANTS'|'KNOWN_TERM_VARIANTS';variants:{target_hash:string;term?:string;count:number;contexts:string[]}[]}
const preview=(text:string)=>text.length<=80&&!/[<>{}\[\]\r\n]|(?:api[_ -]?key|bearer\s|password|secret)/i.test(text)?text:undefined;
const escaped=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const expression=(text:string)=>new RegExp('(?<![\\p{L}\\p{N}_])'+escaped(text)+'(?![\\p{L}\\p{N}_])','giu');
export function consistencyReport(units:ResolvedUnit[],entries:MemoryEntry[],glossary:GlossaryTerm[]){
  const published=units.filter(unit=>unit.publication==='VALIDATED'&&unit.quality==='PASS');
  const groups=new Map<string,{source:string;system?:string;module?:string;source_language:string;targets:Map<string,{text:string;count:number;contexts:Set<string>}>}>();
  const add=(source:string,target:string,unit:ResolvedUnit)=>{
    const key=hashKey([source,unit.system,unit.module,unit.source_language]);
    const group=groups.get(key)||{source,system:unit.system,module:unit.module,source_language:unit.source_language,targets:new Map()};
    const variant=group.targets.get(target)||{text:target,count:0,contexts:new Set<string>()};
    variant.count++;variant.contexts.add(hashKey([unit.document_type,unit.field_type,unit.surrounding_context_hash]));group.targets.set(target,variant);groups.set(key,group);
  };
  for(const unit of published)add(unit.source_text,unit.translated_text,unit);
  const issue=(source:string,targets:Map<string,{text:string;count:number;contexts:Set<string>}>,reason:ConsistencyIssue['reason']):ConsistencyIssue=>({source_hash:hashKey(source),term:preview(source),reason,variants:[...targets.values()].map(target=>({target_hash:hashKey(target.text),term:preview(target.text),count:target.count,contexts:[...target.contexts]}))});
  const issues:ConsistencyIssue[]=[...groups.values()].filter(group=>group.targets.size>1).map(group=>({...issue(group.source,group.targets,'TRANSLATION_VARIANTS'),system:group.system,module:group.module,source_language:group.source_language}));
  const cohorts=new Map<string,ResolvedUnit[]>();
  for(const unit of published){const key=hashKey([unit.system,unit.module,unit.source_language]);const cohort=cohorts.get(key)||[];cohort.push(unit);cohorts.set(key,cohort);}
  // Only known, reviewed alternatives can be identified inside a larger description.
  const terms=[...entries.filter(entry=>entry.approved&&entry.source_text.length<=80&&entry.translated_text.length<=80&&entry.source_text.trim().split(/\s+/).length>=2).map(entry=>({source:entry.source_text,target:entry.translated_text,system:entry.system,module:entry.module})),...glossary];
  const alternatives=new Map<string,typeof terms>();
  for(const term of terms){const key=hashKey([term.source,term.system,term.module]);alternatives.set(key,[...(alternatives.get(key)||[]),term]);}
  let scanned=0;
  for(const scoped of alternatives.values()){
    const values=[...new Set(scoped.map(term=>term.target))].sort((a,b)=>b.length-a.length);
    if(values.length<2)continue;
    if(scanned++>=1000)break;
    const source=scoped[0].source;
    const matchExpression=new RegExp('(?<![\\p{L}\\p{N}_])(?:'+values.map(escaped).join('|')+')(?![\\p{L}\\p{N}_])','giu');
    for(const cohort of cohorts.values()){
    const targets=new Map<string,{text:string;count:number;contexts:Set<string>}>();
    for(const unit of cohort){
      if((scoped[0].system&&scoped[0].system!==unit.system)||(scoped[0].module&&scoped[0].module!==unit.module)||!expression(source).test(unit.source_text))continue;
      for(const match of unit.translated_text.matchAll(matchExpression)){
        const canonical=values.find(value=>value.toLowerCase()===match[0].toLowerCase())!;
        const target=targets.get(canonical)||{text:canonical,count:0,contexts:new Set<string>()};target.count++;target.contexts.add(hashKey([unit.document_type,unit.field_type,unit.surrounding_context_hash]));targets.set(canonical,target);
      }
    }
    const context=cohort[0];
    if(targets.size>1&&!issues.some(item=>item.source_hash===hashKey(source)&&item.system===context.system&&item.module===context.module&&item.source_language===context.source_language))issues.push({...issue(source,targets,'KNOWN_TERM_VARIANTS'),system:context.system,module:context.module,source_language:context.source_language});
    }
  }
  return {schema_version:1,warning_count:issues.length,issues,known_terms_truncated:scanned>1000,policy:'REVIEW_ONLY'};
}
