import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export interface LogPolicy {maxBytes:number;maxFiles:number;maxRuns:number;retentionDays:number}
export const defaultLogPolicy:LogPolicy={maxBytes:1048576,maxFiles:3,maxRuns:50,retentionDays:30};
export async function loadLogPolicy(root:string):Promise<LogPolicy>{
  const file=path.join(root,'log-policy.json');
  try {
    if((await fs.lstat(file)).isSymbolicLink())throw new Error('LOG_POLICY_PATH_INVALID');
    const value=JSON.parse(await fs.readFile(file,'utf8'));
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('LOG_POLICY_INVALID');
    const policy={...defaultLogPolicy};
    for(const key of Object.keys(policy) as (keyof LogPolicy)[])if(value[key]!==undefined)policy[key]=value[key];
    return policy;
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {...defaultLogPolicy};throw error;}
}
const allowed=new Set(['file','json_path','document_type','field','source_language','target_language','status','reason','provider','model','recovery_action','timestamp','scope']);
export function safeDiagnostic(input:Record<string,unknown>){const result:Record<string,unknown>={timestamp:new Date().toISOString()};for(const [key,value] of Object.entries(input)){if(!allowed.has(key))continue;if(key==='json_path'&&Array.isArray(value)){result[key]=value.filter(item=>typeof item==='string'||typeof item==='number');continue;}if(typeof value!=='string'||value.length>1000||/(?:bearer\s|api[_ -]?key|password|secret|token\s*=)/i.test(value))continue;result[key]=value;}return result;}
export class RunLogger {
  run='';private queue=Promise.resolve();
  constructor(readonly root:string,readonly policy:LogPolicy=defaultLogPolicy){if(Object.values(policy).some(value=>!Number.isSafeInteger(value))||policy.maxBytes<100||policy.maxFiles<1||policy.maxRuns<1||policy.retentionDays<1)throw new Error('LOG_POLICY_INVALID');}
  async init(){await fs.mkdir(path.join(this.root,'runs'),{recursive:true});if(await fs.realpath(this.root)!==this.root || await fs.realpath(path.join(this.root,'runs'))!==path.join(this.root,'runs'))throw new Error('LOG_PATH_INVALID');for(const channel of ['app','errors','translation']){const file=path.join(this.root,channel+'.log');try{const handle=await fs.open(file,'wx');await handle.close();}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('LOG_LINK_INVALID');}}this.run=new Date().toISOString().replace(/[:.]/g,'-')+'_'+randomUUID();await fs.mkdir(path.join(this.root,'runs',this.run));await this.prune();return this;}
  private async prune(){const root=path.join(this.root,'runs');const entries=await fs.readdir(root,{withFileTypes:true});const candidates=[];for(const entry of entries){if(!entry.isDirectory()||entry.isSymbolicLink()||!/^\d{4}-\d\d-\d\dT[\w-]+_[a-f0-9-]+$/.test(entry.name))continue;const file=path.join(root,entry.name);if(await fs.realpath(file)!==file)throw new Error('LOG_RETENTION_PATH_INVALID');candidates.push({file,mtime:(await fs.stat(file)).mtimeMs,name:entry.name});}candidates.sort((a,b)=>b.name.localeCompare(a.name));for(let index=0;index<candidates.length;index++)if(candidates[index].name!==this.run&&(index>=this.policy.maxRuns||candidates[index].mtime<Date.now()-this.policy.retentionDays*86400000))await fs.rm(candidates[index].file,{recursive:true,force:true});}
  event(channel:'app'|'errors'|'translation',input:Record<string,unknown>){const operation=async()=>{const file=path.join(this.root,channel+'.log');const line=JSON.stringify(safeDiagnostic(input))+'\n';const size=await fs.stat(file).then(stat=>stat.size).catch(error=>{if(error.code!=='ENOENT')throw error;return 0;});if(size+Buffer.byteLength(line)>this.policy.maxBytes){for(let index=this.policy.maxFiles;index>=1;index--){const target=file+'.'+index;if(index===this.policy.maxFiles)await fs.rm(target,{force:true});const previous=index===1?file:file+'.'+(index-1);try{if((await fs.lstat(previous)).isSymbolicLink())throw new Error('LOG_LINK_INVALID');await fs.rename(previous,target);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}}if(await fs.lstat(file).then(stat=>stat.isSymbolicLink()).catch(error=>{if(error.code!=='ENOENT')throw error;return false;}))throw new Error('LOG_LINK_INVALID');if(Buffer.byteLength(line)<=this.policy.maxBytes)await fs.appendFile(file,line);};const next=this.queue.then(operation);this.queue=next.catch(()=>{});return next;}
  async report(summary:Record<string,unknown>,errors:Record<string,unknown>[],warnings:Record<string,unknown>[],skipped:Record<string,unknown>[]){await this.queue;const directory=path.join(this.root,'runs',this.run);for(const [name,content] of Object.entries({summary,errors:errors.map(safeDiagnostic),warnings:warnings.map(safeDiagnostic),skipped:skipped.map(safeDiagnostic)}))await fs.writeFile(path.join(directory,name+'.json'),JSON.stringify(content,null,2)+'\n');return directory;}
}
