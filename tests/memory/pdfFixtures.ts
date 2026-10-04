import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {MemoryStore} from '../../desktop/memory/store';
import {pdfHash,pdfPointer,type PdfEvidence} from '../../desktop/memory/pdfCorpus';

export async function pdfFixture(){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pdf-reuse-')),memory=path.join(root,'memory'),directory=path.join(memory,'pdf-reference');await fs.mkdir(directory,{recursive:true});
  const texts={en:['Longsword','Charge','Make an attack roll against the target.','Recover 1d6 Hit Points.'],es:['Espada larga','Carga','Realiza una tirada de ataque contra el objetivo.','Recupera 1d6 puntos de golpe.','Embestida']};
  const documents:any[]=[];
  for(const language of ['en','es'] as const){
    const bytes=Buffer.from('%PDF-1.7\nsynthetic '+language),sha256=pdfHash(bytes),id=sha256.slice(0,16),file=path.join(root,language+'.pdf'),folder=path.join(directory,'corpus',id);await fs.mkdir(folder,{recursive:true});await fs.writeFile(file,bytes);
    const title=language==='en'?'System Reference Document 5.2.1':'Documento de referencia del sistema 5.2.1';
    const pages=JSON.stringify({document:id,page:1,text:title})+'\n';
    const rows=texts[language].map((text,index)=>({id:id+'-p2-s'+(index+1),language,sourceDocument:id,page:2,text,textNormalized:text,textHash:pdfHash(text),type:index<2||index===4?'heading':'paragraph',alignmentEligible:true,metadata:{order:index+1}}));
    const segments=rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
    await fs.writeFile(path.join(folder,'pages.jsonl'),pages);await fs.writeFile(path.join(folder,'segments.jsonl'),segments);
    documents.push({id,sha256,path:file,fileName:language+'.pdf',pageCount:4,segmentCount:rows.length,language,status:'processed',source_verified:true,source_verification:'USER_VERIFIED',verification_scope:'DOCUMENT_ONLY_NOT_BILINGUAL_ALIGNMENT',approved_translation_pairs:0,pages_sha256:pdfHash(pages),segments_sha256:pdfHash(segments)});
  }
  await fs.writeFile(path.join(directory,'index.json'),JSON.stringify({schema_version:1,policy:'VERIFIED_REFERENCE_ALIGNMENT_REQUIRED',documents}));
  const store=await new MemoryStore(memory).load();
  const pair=async(sourceIndex=0,targetIndex=sourceIndex)=>{
    const a=store.pdfCorpus.segments.get(documents[0].id+'-p2-s'+(sourceIndex+1))!,b=store.pdfCorpus.segments.get(documents[1].id+'-p2-s'+(targetIndex+1))!;
    const pdf:PdfEvidence={edition:'srd-5.2.1',source:pdfPointer(a),target:pdfPointer(b),kind:a.kind,method:'STRUCTURAL_CANDIDATE',score:.8};
    return store.candidate(a.text,b.text,'en',{system:'dnd5e',module:'srd-5.2.1',document_type:'PDF_SRD',field_type:a.kind==='heading'?'name':'description',pdf},'pdf-srd-alignment','');
  };
  const moduleRoot=path.join(root,'module');await fs.mkdir(path.join(moduleRoot,'packs/items/_source'),{recursive:true});
  await fs.writeFile(path.join(moduleRoot,'module.json'),JSON.stringify({id:'test',version:'1',packs:[{name:'items',path:'packs/items',type:'Item',system:'dnd5e'}]}));
  await fs.writeFile(path.join(moduleRoot,'packs/items/_source/sword.json'),JSON.stringify({_id:'abcdefghijklmnop',type:'weapon',name:'Longsword',_stats:{systemId:'dnd5e'}}));
  return {root,memory,directory,documents,store,pair,moduleRoot};
}
