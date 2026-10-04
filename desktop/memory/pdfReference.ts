import fs from 'node:fs/promises';
import path from 'node:path';
import {parseJsonStrict} from '../../src/services/json/strictJson';

/** Document verification is not approval of a guessed bilingual alignment. */
export async function pdfReferenceStatistics(memoryDirectory:string){
  const empty={loaded:false,verified_documents:0,documents_by_language:{} as Record<string,number>,pages:0,segments:0,approved_translation_pairs:0,policy:'VERIFIED_REFERENCE_ALIGNMENT_REQUIRED'};
  try{
    const directory=path.join(memoryDirectory,'pdf-reference'),file=path.join(directory,'index.json');
    if(await fs.realpath(directory)!==directory)throw new Error('PDF_REFERENCE_PATH_INVALID');
    const stat=await fs.lstat(file);if(stat.isSymbolicLink()||stat.size>1000000)throw new Error('PDF_REFERENCE_PATH_INVALID');
    const value=parseJsonStrict(await fs.readFile(file,'utf8'));
    if(value.schema_version!==1||value.policy!==empty.policy||!Array.isArray(value.documents))throw new Error('PDF_REFERENCE_SCHEMA_INVALID');
    const result={...empty,loaded:true},ids=new Set<string>();
    for(const doc of value.documents){
      if(doc.source_verified!==true||doc.source_verification!=='USER_VERIFIED'||doc.verification_scope!=='DOCUMENT_ONLY_NOT_BILINGUAL_ALIGNMENT'||doc.approved_translation_pairs!==0||doc.status!=='processed'||typeof doc.sha256!=='string'||!/^[a-f0-9]{64}$/.test(doc.sha256)||doc.id!==doc.sha256.slice(0,16)||ids.has(doc.id)||!['en','es','unknown'].includes(doc.language)||!Number.isSafeInteger(doc.pageCount)||doc.pageCount<0||!Number.isSafeInteger(doc.segmentCount)||doc.segmentCount<0)throw new Error('PDF_REFERENCE_SCHEMA_INVALID');
      ids.add(doc.id);result.verified_documents++;result.pages+=doc.pageCount;result.segments+=doc.segmentCount;result.documents_by_language[doc.language]=(result.documents_by_language[doc.language]||0)+1;
    }
    return result;
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return empty;throw error;}
}
