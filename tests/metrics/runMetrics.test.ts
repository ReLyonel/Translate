import { expect,it,vi,afterEach } from 'vitest';
import { RunMetrics,metricNames } from '../../desktop/metrics/runMetrics';
afterEach(()=>vi.restoreAllMocks());
it('counts throughput from translated units rather than unique cached or reused units',()=>{
 const metrics=new RunMetrics();metrics.translatedUnits=2;metrics.values.strings_unique=100;metrics.values.translation_time=4;
 const result=metrics.finish();expect(result.strings_per_second).toBe(.5);expect(metricNames.every(name=>Number.isFinite(result[name])&&result[name]>=0)).toBe(true);
});
it('uses a monotonic clock even if wall clock time changes',()=>{
 const now=vi.spyOn(performance,'now').mockReturnValueOnce(1000).mockReturnValueOnce(3500);
 const metrics=new RunMetrics();vi.spyOn(Date,'now').mockReturnValue(-100000);
 expect(metrics.finish().total_time).toBe(2.5);expect(now).toHaveBeenCalledTimes(2);
});
