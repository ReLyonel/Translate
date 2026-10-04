import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseJsonStrict} from '../../src/services/json/strictJson';
import {ProtectedContentEngine as P} from '../../src/services/protected-content/protectedContentEngine';
export const pdfRulesVersion=P.rulesVersion+'/pdf-srd-1';

export const pdfHash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export const pdfText=(text:string)=>text.replace(/\u00ad/g,'').replace(/(?<=\p{L})-\s+(?=\p{L})/gu,'').replace(/\s+/gu,' ').trim();
export const pdfExactText=(text:string)=>text.replace(/\s+/gu,' ').trim();
export interface PdfPointer {document:string;segment:string;page:number;text_hash:string}
export interface PdfEvidence {
  edition:'srd-5.2.1';source:PdfPointer;target:PdfPointer;kind:'heading'|'paragraph';
  method:'STRUCTURAL_CANDIDATE'|'MANUAL_ALIGNMENT';score:number;edited?:boolean;
  binding?:{source_hash:string;source_excerpt:string;source_text?:string;usage?:'EXACT'|'CONTEXT_ONLY'};
}
export interface PdfSegment {id:string;language:'en'|'es';document:string;page:number;text:string;text_hash:string;kind:'heading'|'paragraph';order:number}
const hex=(value:unknown,size:number)=>typeof value==='string'&&new RegExp('^[a-f0-9]{'+size+'}$').test(value);
export function validPdfEvidence(value:unknown):value is PdfEvidence {
  const v=value as PdfEvidence;const pointer=(p:PdfPointer)=>p&&hex(p.document,16)&&typeof p.segment==='string'&&new RegExp('^'+p.document+'-p[1-9][0-9]*-[sl][1-9][0-9]*$').test(p.segment)&&Number.isSafeInteger(p.page)&&p.page>0&&hex(p.text_hash,64);
  return Boolean(v&&v.edition==='srd-5.2.1'&&pointer(v.source)&&pointer(v.target)&&['heading','paragraph'].includes(v.kind)&&['STRUCTURAL_CANDIDATE','MANUAL_ALIGNMENT'].includes(v.method)&&Number.isFinite(v.score)&&v.score>=0&&v.score<=1&&(v.edited===undefined||typeof v.edited==='boolean')&&(v.binding===undefined||v.binding&&hex(v.binding.source_hash,64)&&typeof v.binding.source_excerpt==='string'&&v.binding.source_excerpt.length<=600&&(v.binding.usage===undefined||['EXACT','CONTEXT_ONLY'].includes(v.binding.usage))&&(v.binding.source_text===undefined||typeof v.binding.source_text==='string'&&v.binding.source_text.length<=200000&&pdfHash(v.binding.source_text)===v.binding.source_hash&&v.binding.source_text.slice(0,600)===v.binding.source_excerpt)));
}
export function pdfPointer(segment:PdfSegment):PdfPointer{return {document:segment.document,segment:segment.id,page:segment.page,text_hash:segment.text_hash};}

/** Immutable snapshot for one analysis/job. No model calls, guessed IDs or Python dependency. */
export class PdfCorpus {
  readonly segments=new Map<string,PdfSegment>();
  fingerprint='ABSENT';warning?:string;
  async load(memoryDirectory:string){
    const directory=path.join(memoryDirectory,'pdf-reference');
    let registryPresent=false;
    try{
      if(await fs.realpath(directory)!==directory)throw new Error('PDF_REFERENCE_PATH_INVALID');
      const read=async(file:string,max:number)=>{const stat=await fs.lstat(file);if(stat.isSymbolicLink()||stat.size>max||await fs.realpath(file)!==file)throw new Error('PDF_REFERENCE_PATH_INVALID');return fs.readFile(file);};
      const index=await read(path.join(directory,'index.json'),1000000),registry=parseJsonStrict(index.toString('utf8'));registryPresent=true;
      if(registry.schema_version!==1||registry.policy!=='VERIFIED_REFERENCE_ALIGNMENT_REQUIRED'||!Array.isArray(registry.documents))throw new Error('PDF_REFERENCE_SCHEMA_INVALID');
      const fingerprints=[pdfHash(index)];
      for(const doc of registry.documents){
        if(!hex(doc.id,16)||!hex(doc.sha256,64)||doc.id!==doc.sha256.slice(0,16)||doc.source_verified!==true||doc.source_verification!=='USER_VERIFIED'||doc.verification_scope!=='DOCUMENT_ONLY_NOT_BILINGUAL_ALIGNMENT'||doc.approved_translation_pairs!==0||doc.status!=='processed'||!Number.isSafeInteger(doc.pageCount)||doc.pageCount<1)throw new Error('PDF_REFERENCE_SCHEMA_INVALID');
        if(!['en','es'].includes(doc.language))continue;
        const folder=path.join(directory,'corpus',doc.id),pages=await read(path.join(folder,'pages.jsonl'),100000000);
        const pageOne=parseJsonStrict(pages.toString('utf8').split(/\r?\n/)[0]);
        if(pageOne.document!==doc.id||pageOne.page!==1)throw new Error('PDF_REFERENCE_EXTRACTION_INVALID');
        const title=pdfText(pageOne.text||'');
        // Explicit edition evidence from document contents. The Player Handbook is excluded.
        const expected=doc.language==='en'?'System Reference Document 5.2.1':'Documento de referencia del sistema 5.2.1';
        if(title!==expected&&!title.startsWith(expected+' '))continue;
        if(!hex(doc.pages_sha256,64)||!hex(doc.segments_sha256,64))throw new Error('PDF_EXTRACTION_UNSEALED');
        if(pdfHash(pages)!==doc.pages_sha256)throw new Error('PDF_REFERENCE_EXTRACTION_INVALID');
        if(typeof doc.path!=='string'||!path.isAbsolute(doc.path)||!doc.path.toLowerCase().endsWith('.pdf'))throw new Error('PDF_REFERENCE_PATH_INVALID');
        const pdf=await read(doc.path,300000000);if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-'))||pdfHash(pdf)!==doc.sha256)throw new Error('PDF_REFERENCE_STALE');
        const bytes=await read(path.join(folder,'segments.jsonl'),100000000);if(pdfHash(bytes)!==doc.segments_sha256)throw new Error('PDF_REFERENCE_EXTRACTION_INVALID');fingerprints.push(doc.sha256,pdfHash(pages),pdfHash(bytes));
        // Isolated human lines retain page/line provenance, including names inside tables.
        // They are searchable hypotheses, never automatically aligned or approved.
        for(const line of pages.toString('utf8').split(/\r?\n/).filter(Boolean)){
          const page=parseJsonStrict(line);if(page.document!==doc.id||!Number.isSafeInteger(page.page)||page.page<1||page.page>doc.pageCount||typeof page.text!=='string')throw new Error('PDF_REFERENCE_EXTRACTION_INVALID');
          page.text.split(/\r?\n/).forEach((raw:string,index:number)=>{const text=pdfExactText(raw);if(text.length<3||text.length>80||!/^\p{Lu}[\p{L}\p{M} '&’\-]+$/u.test(text)||text.endsWith('-')||text.split(' ').length>8)return;const id=doc.id+'-p'+page.page+'-l'+(index+1);this.segments.set(id,{id,language:doc.language,document:doc.id,page:page.page,text,text_hash:pdfHash(text),kind:'heading',order:index+1});});
        }
        for(const line of bytes.toString('utf8').split(/\r?\n/).filter(Boolean)){
          const row=parseJsonStrict(line),pointer={document:doc.id,segment:row.id,page:row.page,text_hash:row.textHash};
          if(typeof row.text!=='string'||row.text.length>200000||row.sourceDocument!==doc.id||row.language!==doc.language||!Number.isSafeInteger(row.page)||row.page<1||row.page>doc.pageCount||!new RegExp('^'+doc.id+'-p'+row.page+'-s[1-9][0-9]*$').test(row.id)||pdfHash(row.text.replace(/\s+/g,' ').trim())!==row.textHash)throw new Error('PDF_REFERENCE_EXTRACTION_INVALID');
          if(!['heading','paragraph'].includes(row.type)||row.alignmentEligible!==true)continue;
          if(this.segments.has(row.id))throw new Error('PDF_REFERENCE_EXTRACTION_INVALID');
          this.segments.set(row.id,{id:row.id,language:doc.language,document:doc.id,page:row.page,text:pdfText(row.text),text_hash:pointer.text_hash,kind:row.type,order:row.metadata?.order||0});
        }
      }
      this.fingerprint=pdfHash(JSON.stringify(['pdf-corpus-2',...fingerprints]));
    }catch(error){this.segments.clear();if(registryPresent||(error as NodeJS.ErrnoException).code!=='ENOENT'){this.warning=(error as NodeJS.ErrnoException).code==='ENOENT'?'PDF_REFERENCE_MISSING':error instanceof Error&&/^PDF_[A-Z_]+$/.test(error.message)?error.message:'PDF_REFERENCE_INVALID';this.fingerprint='INVALID:'+this.warning;}}
    return this;
  }
  evidence(value:PdfEvidence,source:string,target:string){
    if(!validPdfEvidence(value)||this.warning)return false;
    const a=this.segments.get(value.source.segment),b=this.segments.get(value.target.segment);
    return Boolean(a&&b&&a.language==='en'&&b.language==='es'&&a.document===value.source.document&&b.document===value.target.document&&a.page===value.source.page&&b.page===value.target.page&&a.text_hash===value.source.text_hash&&b.text_hash===value.target.text_hash&&a.kind===value.kind&&b.kind===value.kind&&pdfText(source)===a.text&&(value.edited||pdfText(target)===b.text));
  }
}
