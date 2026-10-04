import {createHash} from 'node:crypto';
import type {MemoryContext,MemoryEntry} from './store';

export const historicalImportVersion='historical-tm-2';
export type HistoricalPolicy='SAFE_EXACT'|'CONTEXT_REQUIRED'|'CONFLICT';
export interface HistoricalContext {system:string;module:string;pack:string;document_type:string;field_type:string;field_path:(string|number)[];surrounding_context_hash?:string}
export interface HistoricalSource {
 provenance:'HISTORICAL_BABELE';translation_origin:'USER_TRANSLATED';translation_approval:'APPROVED_MANUAL'|'REVIEW_REQUIRED';
 source_corpus:string;source_file:string;source_file_hash:string;entry_key:string;import_version:string;
 canonical_identity:'UNKNOWN';reuse_policy:HistoricalPolicy;context:HistoricalContext;
 source_binding:'LITERAL_RU_KEY'|'NATIVE_FIELD_PROJECTION'|'USER_REVIEWED_PAIR';
 occurrences:{file:string;json_path:(string|number)[]}[];
}
export interface TrustedHistoricalCorpus {
 id:string;provenance:'HISTORICAL_BABELE';translation_origin:'USER_TRANSLATED';
 trust:'USER_APPROVED_TRANSLATION_CORPUS';translation_approval:'APPROVED_MANUAL';
 fingerprint:string;files:Record<string,string>;root:string;approved_by:string;approved_at:string;import_version:string;
}
const hex=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const historicalHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function validTrustedCorpus(v:TrustedHistoricalCorpus){return Boolean(v&&/^[a-z0-9-]+$/.test(v.id)&&v.provenance==='HISTORICAL_BABELE'&&v.translation_origin==='USER_TRANSLATED'&&v.trust==='USER_APPROVED_TRANSLATION_CORPUS'&&v.translation_approval==='APPROVED_MANUAL'&&hex(v.fingerprint)&&v.files&&typeof v.files==='object'&&!Array.isArray(v.files)&&Object.values(v.files).every(hex)&&historicalHash(v.files)===v.fingerprint&&typeof v.root==='string'&&typeof v.approved_by==='string'&&!!v.approved_by&&Number.isFinite(Date.parse(v.approved_at))&&v.import_version===historicalImportVersion);}
export function validHistoricalSource(v:HistoricalSource){const c=v?.context;return Boolean(v&&v.provenance==='HISTORICAL_BABELE'&&v.translation_origin==='USER_TRANSLATED'&&['APPROVED_MANUAL','REVIEW_REQUIRED'].includes(v.translation_approval)&&typeof v.source_corpus==='string'&&typeof v.source_file==='string'&&hex(v.source_file_hash)&&typeof v.entry_key==='string'&&v.import_version===historicalImportVersion&&v.canonical_identity==='UNKNOWN'&&['SAFE_EXACT','CONTEXT_REQUIRED','CONFLICT'].includes(v.reuse_policy)&&['LITERAL_RU_KEY','NATIVE_FIELD_PROJECTION','USER_REVIEWED_PAIR'].includes(v.source_binding)&&c&&['system','module','pack','document_type','field_type'].every(k=>typeof (c as any)[k]==='string'&&!!(c as any)[k])&&Array.isArray(c.field_path)&&c.field_path.length>0&&c.field_path.every(k=>typeof k==='string'||Number.isSafeInteger(k))&&Array.isArray(v.occurrences)&&v.occurrences.every(o=>typeof o.file==='string'&&Array.isArray(o.json_path)));}
export const historicalPack=(context:MemoryContext)=>/^Compendium\.[-\w]+\.([-\w]+)\./.exec(context.canonical_uuid||'')?.[1]||context.pack;
export function historicalContext(context:MemoryContext):HistoricalContext|undefined {const pack=historicalPack(context);if(!pack||!context.system||!context.module||!context.document_type||!context.field_type||!context.json_path?.length)return;return {system:context.system,module:context.module,pack,document_type:context.document_type,field_type:context.field_type,field_path:[...context.json_path],...(context.surrounding_context_hash?{surrounding_context_hash:context.surrounding_context_hash}:{})};}
export function historicalPolicy(source:string):Exclude<HistoricalPolicy,'CONFLICT'> {const words=source.match(/\p{L}+/gu)||[];return source.length<40||words.length<=4||/\b(?:charge|save|attack|resistance|level)\b|(?:заряд|атака|сопротивление|уровень|спасбросок)/iu.test(source)?'CONTEXT_REQUIRED':'SAFE_EXACT';}
export function historicalContextMatches(entry:MemoryEntry,context:MemoryContext){const h=entry.historical;if(!h)return false;const c=h.context;return context.system===c.system&&context.module===c.module&&historicalPack(context)===c.pack&&context.document_type===c.document_type&&context.field_type===c.field_type&&JSON.stringify(context.json_path)===JSON.stringify(c.field_path)&&(h.reuse_policy!=='CONTEXT_REQUIRED'||!c.surrounding_context_hash||context.surrounding_context_hash===c.surrounding_context_hash);}
export function historicalEntryId(source:string,target:string,context:HistoricalContext,corpus:string){return historicalHash([historicalImportVersion,corpus,source,target,context]);}
