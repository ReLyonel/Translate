import {execFile} from 'node:child_process';
import path from 'node:path';
export type ThermalState='NORMAL'|'THERMAL_WARNING'|'THERMAL_PAUSE';
export interface GpuSample {available:boolean;timestamp:string;gpus:{name:string;utilization:number|null;temperature:number|null;memory_temperature:number|null;vram_used:number|null;vram_total:number|null;power_draw:number|null;limits:Record<string,number|null>}[]}
const number=(text?:string)=>text&&/^\s*\d+(?:\.\d+)?(?:\s|$)/.test(text)?Number.parseFloat(text):null;
export function parseNvidia(xml:string):GpuSample {
 const tag=(source:string,key:string)=>source.match(new RegExp('<'+key+'>([\\s\\S]*?)</'+key+'>'))?.[1];
 const gpus=[...xml.matchAll(/<gpu\s+id="[^"]*">([\s\S]*?)<\/gpu>/g)].map(match=>{
  const s=match[1],limits:Record<string,number|null>={};for(const key of ['gpu_temp_max_threshold','gpu_temp_slow_threshold','gpu_temp_max_gpu_threshold','gpu_temp_max_mem_threshold'])limits[key]=number(tag(s,key));
  const mem=tag(s,'fb_memory_usage')||'';return {name:tag(s,'product_name')||'NVIDIA',utilization:number(tag(s,'gpu_util')),temperature:number(tag(s,'gpu_temp')),memory_temperature:number(tag(s,'memory_temp')),vram_used:number(tag(mem,'used')),vram_total:number(tag(mem,'total')),power_draw:number(tag(s,'instant_power_draw')||tag(s,'power_draw')||tag(s,'average_power_draw')),limits};
 });return {available:gpus.length>0,timestamp:new Date().toISOString(),gpus};
}
export async function readNvidia():Promise<GpuSample>{
 const executable=process.platform==='win32'?path.join(process.env.SystemRoot||'C:\\Windows','System32','nvidia-smi.exe'):'/usr/bin/nvidia-smi';
 try{const xml=await new Promise<string>((resolve,reject)=>execFile(executable,['-q','-x'],{windowsHide:true,timeout:4000,maxBuffer:2000000},(error,stdout)=>error?reject(error):resolve(stdout)));return parseNvidia(xml);}catch{return {available:false,timestamp:new Date().toISOString(),gpus:[]};}
}
export interface ThermalPolicy {enabled:boolean;gpu_warning:number;gpu_pause:number;memory_warning:number;memory_pause:number;hysteresis:number;poll_ms:number}
export const defaultThermalPolicy:ThermalPolicy={enabled:true,gpu_warning:80,gpu_pause:85,memory_warning:90,memory_pause:96,hysteresis:5,poll_ms:5000};
export function thermalState(sample:GpuSample,policy=defaultThermalPolicy):ThermalState {
 if(sample.gpus.some(g=>g.temperature!==null&&g.temperature>=Math.min(policy.gpu_pause,g.limits.gpu_temp_slow_threshold??Infinity)||g.memory_temperature!==null&&g.memory_temperature>=Math.min(policy.memory_pause,g.limits.gpu_temp_max_mem_threshold??Infinity)))return 'THERMAL_PAUSE';
 return sample.gpus.some(g=>g.temperature!==null&&g.temperature>=policy.gpu_warning||g.memory_temperature!==null&&g.memory_temperature>=policy.memory_warning)?'THERMAL_WARNING':'NORMAL';
}
export class ThermalGuard {
 state:ThermalState='NORMAL';sample:GpuSample={available:false,timestamp:'',gpus:[]};
 private active?:AbortController;private timer?:ReturnType<typeof setTimeout>;private stopped=false;private cool=0;
 private memorySensorSeen=false;
 pauses=0;max_gpu:number|null=null;max_memory:number|null=null;
 readonly samples:GpuSample[]=[];
 constructor(readonly observe:()=>Promise<GpuSample>=readNvidia,readonly policy=defaultThermalPolicy,readonly notify:(guard:ThermalGuard)=>void=()=>{}){}
 async poll(){
  if(!this.policy.enabled)return;
  this.sample=await this.observe();let next=thermalState(this.sample,this.policy);
  this.samples.push(this.sample);if(this.samples.length>720)this.samples.shift();
  for(const g of this.sample.gpus){if(g.temperature!==null)this.max_gpu=Math.max(this.max_gpu??0,g.temperature);if(g.memory_temperature!==null){this.memorySensorSeen=true;this.max_memory=Math.max(this.max_memory??0,g.memory_temperature);}}
  if(this.state==='THERMAL_PAUSE'){
   const cool=this.sample.available&&this.sample.gpus.every(g=>g.temperature!==null&&g.temperature<this.policy.gpu_warning-this.policy.hysteresis&&(!this.memorySensorSeen&&g.memory_temperature===null||g.memory_temperature!==null&&g.memory_temperature<this.policy.memory_warning-this.policy.hysteresis));
   this.cool=cool?this.cool+1:0;if(this.cool<3)next='THERMAL_PAUSE';
  }
  if(next==='THERMAL_PAUSE'&&this.state!=='THERMAL_PAUSE'){this.pauses++;this.active?.abort(new Error('THERMAL_PAUSE'));}
  this.state=next;this.notify(this);
 }
 async start(){await this.poll();const loop=async()=>{if(this.stopped)return;await this.poll();if(!this.stopped){this.timer=setTimeout(loop,this.policy.poll_ms);this.timer.unref?.();}};this.timer=setTimeout(loop,this.policy.poll_ms);this.timer.unref?.();}
 stop(){this.stopped=true;clearTimeout(this.timer);}
 async wait(signal?:AbortSignal){while(this.state==='THERMAL_PAUSE'){signal?.throwIfAborted();await new Promise<void>((resolve,reject)=>{const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve();},abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal?.reason);},timer=setTimeout(done,100);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});}signal?.throwIfAborted();}
 async execute<T>(action:(signal:AbortSignal)=>Promise<T>,signal?:AbortSignal):Promise<T>{
  for(;;){await this.wait(signal);const controller=new AbortController();this.active=controller;const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
   try{const value=await action(combined);combined.throwIfAborted();return value;}catch(error){signal?.throwIfAborted();if(!controller.signal.aborted)throw error;}finally{this.active=undefined;}
  }
 }
 report(){return {enabled:this.policy.enabled,state:this.state,pauses:this.pauses,max_gpu_temperature:this.max_gpu,max_memory_temperature:this.max_memory,last_sample:this.sample,samples:this.samples,samples_retention:720,policy:this.policy};}
}
