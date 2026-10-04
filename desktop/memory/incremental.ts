import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseJsonStrict } from '../../src/services/json/strictJson';
import { hashKey } from './store';
import type { ResolvedUnit } from './provenance';

interface StoredUnit {locator_id:string;source_hash:string;reuse_key:string;target:string;provider:string|null;model:string|null}
export interface IncrementalReport {
  schema_version:1;complete:boolean;baseline_committed:boolean;
  unchanged:number;changed:number;new:number;removed:number;
  units:{locator_id:string;status:'UNCHANGED'|'CHANGED'|'NEW'|'REMOVED';source_hash:string;reuse_invalidated?:boolean}[];
}
/** A baseline is private and only advances after complete validation, never on abort. */
export class IncrementalSession {
  private previous=new Map<string,StoredUnit>();
  constructor(readonly directory:string,readonly namespace:string){}
  private get file(){return path.join(this.directory,hashKey(this.namespace)+'.json');}
  async load(){
    await fs.mkdir(this.directory,{recursive:true});
    if(await fs.realpath(this.directory)!==this.directory)throw new Error('INCREMENTAL_PATH_INVALID');
    try{
      if((await fs.lstat(this.file)).isSymbolicLink())throw new Error('INCREMENTAL_PATH_INVALID');
      const value=parseJsonStrict(await fs.readFile(this.file,'utf8'));
      if(value?.schema_version!==1||!Array.isArray(value.units))throw new Error('INCREMENTAL_SCHEMA_INVALID');
      for(const unit of value.units){
        if(!unit||['locator_id','source_hash','reuse_key'].some(key=>typeof unit[key]!=='string'||!/^[a-f0-9]{64}$/.test(unit[key]))||typeof unit.target!=='string'||unit.target.length>1000000||![unit.provider,unit.model].every(item=>item===null||typeof item==='string')||this.previous.has(unit.locator_id))throw new Error('INCREMENTAL_SCHEMA_INVALID');
        this.previous.set(unit.locator_id,unit);
      }
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    return this;
  }
  lookup(locator:string,sourceHash:string,reuseKey:string){
    const record=this.previous.get(locator);
    return record?.source_hash===sourceHash&&record.reuse_key===reuseKey?{...record}:undefined;
  }
  describe(units:ResolvedUnit[],complete:boolean):IncrementalReport {
    const seen=new Set<string>();const changes:IncrementalReport['units']=[];
    for(const unit of units){
      if(seen.has(unit.locator_id))throw new Error('INCREMENTAL_LOCATION_DUPLICATE');
      seen.add(unit.locator_id);const old=this.previous.get(unit.locator_id);
      changes.push({locator_id:unit.locator_id,source_hash:unit.source_hash,status:!old?'NEW':old.source_hash===unit.source_hash?'UNCHANGED':'CHANGED',reuse_invalidated:Boolean(old&&old.reuse_key!==unit.reuse_key)});
    }
    if(complete)for(const old of this.previous.values())if(!seen.has(old.locator_id))changes.push({locator_id:old.locator_id,source_hash:old.source_hash,status:'REMOVED'});
    const count=(status:string)=>changes.filter(item=>item.status===status).length;
    return {schema_version:1,complete,baseline_committed:false,unchanged:count('UNCHANGED'),changed:count('CHANGED'),new:count('NEW'),removed:count('REMOVED'),units:changes};
  }
  async commit(units:ResolvedUnit[],signal:AbortSignal){
    if(units.some(unit=>unit.publication!=='VALIDATED'||unit.quality!=='PASS'||!unit.reuse_key))throw new Error('INCREMENTAL_UNVALIDATED');
    const stored:StoredUnit[]=units.map(unit=>({locator_id:unit.locator_id,source_hash:unit.source_hash,reuse_key:unit.reuse_key!,target:unit.translated_text,provider:unit.provider,model:unit.model}));
    const temporary=path.join(this.directory,randomUUID()+'.tmp');let committed=false;
    try{
      signal.throwIfAborted();
      const handle=await fs.open(temporary,'wx');try{await handle.writeFile(JSON.stringify({schema_version:1,units:stored}));await handle.sync();}finally{await handle.close();}
      signal.throwIfAborted();await fs.rename(temporary,this.file);committed=true;
      this.previous=new Map(stored.map(unit=>[unit.locator_id,unit]));
    }finally{if(!committed)await fs.rm(temporary,{force:true});}
  }
}
