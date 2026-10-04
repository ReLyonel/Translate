import fs from 'node:fs/promises';
import path from 'node:path';
import { parseJsonStrict } from '../../src/services/json/strictJson';

/** Package identity lets a downloaded update reuse the baseline from another folder. */
export async function moduleIdentity(input:string){
  const root=await fs.realpath(input),file=path.join(root,'module.json');
  try{
    const stat=await fs.lstat(file);
    if(!stat.isFile()||stat.isSymbolicLink()||await fs.realpath(file)!==file)throw new Error('MODULE_IDENTITY_PATH_INVALID');
    if(stat.size<=5000000){
      let manifest:any;
      try{manifest=parseJsonStrict(await fs.readFile(file,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code)throw error;}
      if(manifest&&typeof manifest.id==='string'&&manifest.id.trim()&&manifest.id.length<=200)return {module:manifest.id,namespace:JSON.stringify(['module',manifest.id,'foundry-v14.368'])};
    }
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  return {module:path.basename(root),namespace:JSON.stringify(['folder',root,'foundry-v14.368'])};
}
