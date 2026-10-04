import { expect, it } from 'vitest';
import { jsonQualityGate } from '../../src/services/validation/qualityGate';
const source=JSON.stringify({_id:'abcdefghijklmnop',name:'Sword',description:'<p>Use @UUID[Item.id] [[/r 1d20]]</p>'});
const paths=[['name'],['description']];
it('COMPLETED requires every check PASS',()=>{
 const output=source.replace('Sword','Espada').replace('Use','Usa');const gate=jsonQualityGate(source,output,paths);expect(gate.status).toBe('PASS');expect(Object.values(gate.checks).every(status=>status==='PASS')).toBe(true);
});
it('recovered translations are WARNING despite passing structure checks',()=>{
 const gate=jsonQualityGate(source,source,paths,1);expect(gate.status).toBe('WARNING');expect(gate.checks.translation).toBe('WARNING');expect(gate.checks.structure).toBe('PASS');
});
it.each(['broken','{"name":"a","name":"b"}'])('rejects invalid original %s',input=>expect(jsonQualityGate(input,'{}',[]).status).toBe('FAILED'));
it('rejects invalid output, changed IDs, missing references and invalid HTML',()=>{
 for(const output of ['broken',source.replace('abcdefghijklmnop','changed'),source.replace('@UUID[Item.id]',''),source.replace('</p>','')])expect(jsonQualityGate(source,output,paths).status).toBe('FAILED');
});
it('rejects changes outside the exact allowlist',()=>expect(jsonQualityGate(source,source.replace('Sword','Espada'),[['description']]).status).toBe('FAILED'));
