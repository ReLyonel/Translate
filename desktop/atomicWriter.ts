import fs from 'node:fs/promises';
import { createReadStream, constants } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

async function digest(file:string) {const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
/** Temp files live beside their target. Exclusive publication never overwrites existing files. */
export async function atomicWrite(target:string, data:Buffer|string, signal:AbortSignal, validate:(bytes:Buffer)=>void|Promise<void>, replaceExpected?:Buffer, onCommitted:()=>void=()=>{}) {
  const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);
  signal.throwIfAborted();await validate(bytes);
  const parent=path.dirname(target);
  if(await fs.realpath(parent)!==parent)throw new Error('OUTPUT_PATH_CHANGED');
  let temporary=target+'.'+randomUUID()+'.tmp';
  try {
    const handle=await fs.open(temporary,'wx');
    try {await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
    signal.throwIfAborted();
    const staged=await fs.readFile(temporary);
    if(!staged.equals(bytes))throw new Error('TEMP_CONTENT_CHANGED');
    await validate(staged);signal.throwIfAborted();
    if(replaceExpected) {
      if((await fs.lstat(target)).isSymbolicLink() || !(await fs.readFile(target)).equals(replaceExpected))throw new Error('REPLACE_TARGET_CHANGED');
      signal.throwIfAborted();await fs.rename(temporary,target);temporary='';
    }else await fs.link(temporary,target);
    onCommitted();
  }finally{if(temporary)await fs.rm(temporary,{force:true});}
}
export async function atomicCopy(source:string,target:string,signal:AbortSignal) {
  signal.throwIfAborted();
  if((await fs.lstat(source)).isSymbolicLink() || await fs.realpath(source)!==source)throw new Error('SOURCE_CHANGED');
  if(await fs.realpath(path.dirname(target))!==path.dirname(target))throw new Error('OUTPUT_PATH_CHANGED');
  const temporary=target+'.'+randomUUID()+'.tmp';
  try {
    const before=await digest(source);
    await fs.copyFile(source,temporary,constants.COPYFILE_EXCL);
    const handle=await fs.open(temporary,'r+');try{await handle.sync();}finally{await handle.close();}
    if(await digest(temporary)!==before || await digest(source)!==before)throw new Error('COPY_CONTENT_CHANGED');
    signal.throwIfAborted();await fs.link(temporary,target);
  }finally{await fs.rm(temporary,{force:true});}
}
