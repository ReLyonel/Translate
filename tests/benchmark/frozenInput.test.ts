import {expect,it} from 'vitest';
import {correctedFrozenInputs} from '../../desktop/benchmark/frozenInput';
import {ProtectedContentEngine as P} from '../../src/services/protected-content/protectedContentEngine';
it('keeps samples and instruction bytes frozen while replacing only the protected input',()=>{
 const prefix='Frozen Russian (ru) to Spanish (es) instructions\n\n\n';
 const input=[{source:'Текст &amp;Reference[Prone] текст',chunks:['Текст [[PROTECTED_001]]Reference[Prone] текст'],prompts:[prefix+'Текст [[PROTECTED_001]]Reference[Prone] текст']}];
 const before=JSON.stringify(input),result=correctedFrozenInputs(input);
 expect(JSON.stringify(input)).toBe(before);expect(result[0].source).toBe(input[0].source);
 expect(result[0].prompts).toEqual([prefix+P.protect(input[0].source).protectedText]);expect(result[0].prompts[0]).not.toContain('Reference');
});
it('does not accept a changed instruction prefix for another chunk',()=>{
 expect(()=>correctedFrozenInputs([{source:'Text',chunks:['One','Two'],prompts:['A One','B Two']}])).toThrow('FROZEN_PROMPT_PREFIX_CHANGED');
});
it('does not silently rebuild a malformed frozen prompt',()=>expect(()=>correctedFrozenInputs([{source:'Text',chunks:['One'],prompts:['Something else']}])).toThrow('FROZEN_PROMPT_INVALID'));
