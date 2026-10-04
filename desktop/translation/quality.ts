import { ProtectedContentEngine as Protection } from '../../src/services/protected-content/protectedContentEngine';
export interface QualityResult { status:'PASS'|'WARNING'|'FAILED'; reasons:string[] }
export function validateLanguage(text:string):QualityResult {
  const prose=Protection.protect(text).protectedText.replace(/\[\[PROTECTED_[^\]]+\]\]/g,' ');
  const words=prose.match(/\p{L}+/gu)||[];
  if(words.length<12 || prose.length<80)return {status:'PASS',reasons:[]};
  if(words.filter(word=>word===word.toUpperCase()||/^[\p{Lu}]/u.test(word)).length>words.length*.8)return {status:'PASS',reasons:[]};
  if((prose.match(/[\u0400-\u04ff]/g)||[]).length>Math.max(8,prose.length*.15))return {status:'FAILED',reasons:['TARGET_LANGUAGE_RUSSIAN']};
  const count=(set:Set<string>)=>words.filter(word=>set.has(word.toLowerCase())).length;
  const es=count(new Set(['el','la','los','las','de','del','que','para','una','un','con','por','en','y','al','es','puede','tirada','daño','realiza','ataque']));
  const en=count(new Set(['the','and','of','to','with','for','you','your','this','that','is','can','from','make','roll','damage','attack']));
  if(en>=4 && en>es*2)return {status:'FAILED',reasons:['TARGET_LANGUAGE_ENGLISH']};
  return es>=2?{status:'PASS',reasons:[]}:{status:'WARNING',reasons:['TARGET_LANGUAGE_UNCERTAIN']};
}
export function validateQuality(source:string,target:string,checkLanguage=true):QualityResult {
  const reasons:string[]=[];
  if(typeof target!=='string'||!target.trim())return {status:'FAILED',reasons:['EMPTY_TRANSLATION']};
  if(target.length>Math.max(source.length*4,source.length+300))reasons.push('EXCESSIVE_LENGTH');
  if(/^\s*(?:sure[,!]\s*)?(?:translation|(?:la )?traducci[oó]n|here (?:is|are)(?: the translation)?|the translation|as an ai|como modelo)\s*[:\n]/i.test(target))reasons.push('MODEL_EXPLANATION');
  if((/^\s*```|^\s*#{1,6}\s/m.test(target)&&!/^\s*```|^\s*#{1,6}\s/m.test(source)) || (/^\s*[\[{]/.test(target)&&!/^\s*[\[{]/.test(source)&&/"(?:translation|text|result)"\s*:/.test(target)))reasons.push('ADDED_OUTPUT_FORMAT');
  if(/^\s*[\[{]/.test(target)&&!/^\s*[\[{]/.test(source)){
    try{const value=JSON.parse(target);if(value&&typeof value==='object'&&!reasons.includes('ADDED_OUTPUT_FORMAT'))reasons.push('ADDED_OUTPUT_FORMAT');}catch{/* Brackets in human prose do not imply JSON. */}
  }
  if(reasons.length)return {status:'FAILED',reasons};
  const language:QualityResult=checkLanguage?validateLanguage(target):{status:'PASS',reasons:[]};
  if(source===target && source.replace(/\[\[PROTECTED_[^\]]+\]\]/g,'').trim().length>80 && /\p{L}/u.test(source))return {status:'WARNING',reasons:['UNCHANGED_LONG_TEXT',...language.reasons]};
  const sentences=target.match(/[^.!?]+[.!?]/g)||[];
  if(sentences.length>3 && new Set(sentences.map(sentence=>sentence.trim())).size<sentences.length/2)return {status:'FAILED',reasons:['DUPLICATED_TEXT']};
  return language;
}
