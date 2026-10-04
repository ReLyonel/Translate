import {ProtectedContentEngine as P} from '../../src/services/protected-content/protectedContentEngine';
import {validateHtmlIntegrity} from '../../src/services/validation/htmlIntegrity';
import {validateQuality,validateLanguage} from '../translation/quality';
export function benchmarkQualityGate(source:string,wire:string,script=false){
 const protection=P.protect(source),restored=P.restore(wire,protection.tokens),reasons:string[]=[];
 const markers=(text:string)=>text.match(/\[\[PROTECTED_[^\]]+\]\]/g)||[];
 if(!restored.isValid||JSON.stringify(markers(wire))!==JSON.stringify(markers(protection.protectedText)))reasons.push('PLACEHOLDER_FAILURE');
 const target=restored.isValid?restored.restoredText:source;
 const tokens=[...protection.tokens.values()];
 const references=(text:string)=>text.match(/(?:@[A-Za-z][A-Za-z0-9]*|&(?:amp;)?Reference)\[[^\]]+\]/g)||[];
 if(restored.isValid&&JSON.stringify(references(source))!==JSON.stringify(references(target)))reasons.push('UUID_FAILURE');
 if(reasons.includes('PLACEHOLDER_FAILURE')){if(tokens.some(t=>/@\w+\[/.test(t.original)))reasons.push('UUID_FAILURE');if(tokens.some(t=>/\[\[|\b\d+d\d+/.test(t.original)))reasons.push('ROLL_FAILURE');}
 if(restored.isValid&&!script&&validateHtmlIntegrity(source,target).length)reasons.push('HTML_FAILURE');
 const structural=reasons.length>0;
 const quality=structural?{status:'FAILED',reasons:[]} as const:validateQuality(source,target);
 const language=structural?null:validateLanguage(target);
 const untranslated=!structural&&target.trim()===source.trim();
 return {target,structural_pass:!structural,reasons,quality,wrong_language:language?.reasons.some(r=>r==='TARGET_LANGUAGE_RUSSIAN'||r==='TARGET_LANGUAGE_ENGLISH')||false,untranslated,valid:!structural&&quality.status==='PASS'&&!untranslated};
}
