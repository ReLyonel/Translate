import {ProtectedContentEngine as P} from '../../src/services/protected-content/protectedContentEngine';
import {semanticChunks} from '../translation/prompt';

/** Derive corrected technical input without changing a frozen sample or prompt instruction. */
export function correctedFrozenInputs<T extends {source:string;chunks:string[];prompts:string[]}>(cases:T[]):T[]{
 return cases.map(c=>{
  if(!c.chunks.length||c.chunks.length!==c.prompts.length)throw new Error('FROZEN_PROMPT_INVALID');
  const prefixes=c.prompts.map((prompt,i)=>{
   if(!prompt.endsWith(c.chunks[i]))throw new Error('FROZEN_PROMPT_INVALID');
   return prompt.slice(0,prompt.length-c.chunks[i].length);
  });
  if(prefixes.some(prefix=>prefix!==prefixes[0]))throw new Error('FROZEN_PROMPT_PREFIX_CHANGED');
  const chunks=semanticChunks(P.protect(c.source).protectedText);
  return {...c,chunks,prompts:chunks.map(chunk=>prefixes[0]+chunk)};
 });
}
