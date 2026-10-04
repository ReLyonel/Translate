import { hashKey,type MemoryEntry,type MemoryContext } from './store';

export interface MemoryConflict {
  id:string;source_text:string;source_language:string;context:MemoryContext;
  approved_conflict:boolean;variants:{id:string;target:string;status:MemoryEntry['status'];approved:boolean}[];
}
export const semanticContext=(entry:MemoryContext):MemoryContext=>({canonical_uuid:entry.canonical_uuid,canonical_version:entry.canonical_version,system:entry.system,module:entry.module,document_type:entry.document_type,field_type:entry.field_type,surrounding_context_hash:entry.surrounding_context_hash});
export function memoryConflicts(entries:readonly MemoryEntry[]):MemoryConflict[] {
  const groups=new Map<string,MemoryEntry[]>();
  for(const entry of entries){
    const key=entry.pdf?.binding?hashKey(['PDF_BINDING',entry.pdf.binding.source_hash,entry.json_path,semanticContext(entry)]):hashKey([entry.source_text,entry.source_language,entry.target_language,entry.historical?entry.historical.context:semanticContext(entry)]);
    groups.set(key,[...(groups.get(key)||[]),entry]);
  }
  return [...groups].flatMap(([id,group])=>{
    const live=group.filter(entry=>entry.status!=='REJECTED');
    if(new Set(live.map(entry=>entry.translated_text)).size<2)return [];
    return [{id,source_text:group[0].source_text,source_language:group[0].source_language,context:semanticContext(group[0]),approved_conflict:new Set(live.filter(entry=>entry.approved).map(entry=>entry.translated_text)).size>1,variants:group.map(entry=>({id:entry.id,target:entry.translated_text,status:entry.status,approved:entry.approved}))}];
  });
}
