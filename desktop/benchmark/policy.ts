import type {TranslationPreflight} from '../translation/preflight';import {thermalState,type GpuSample} from '../thermal';
export function benchmarkGate(preflight:Pick<TranslationPreflight,'warnings'|'canonical_candidates'|'pdf_canonical_candidates'>,gpu:GpuSample){
 // T043 compares model quality; incomplete T077 coverage is not a prerequisite.
 if(!gpu.available||gpu.gpus.some(g=>g.temperature===null))return 'BLOCKED_BY_GPU_OBSERVABILITY';
 if(thermalState(gpu)!=='NORMAL')return 'BLOCKED_BY_THERMAL_STATE';
 if(gpu.gpus.some(g=>(g.utilization??0)>10))return 'BLOCKED_BY_GPU_BUSY';
 return 'PASS';
}
