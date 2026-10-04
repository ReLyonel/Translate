import {ProtectedContentEngine as Protection} from '../protected-content/protectedContentEngine';

/** Conservative EN/RU identification of human prose, never of protected references/attributes. */
export function sourceLanguage(text:string,selection:'auto'|'en'|'ru'='auto'):'en'|'ru'|undefined {
  if(selection!=='auto')return selection;
  const prose=Protection.protect(text).protectedText.replace(/\[\[PROTECTED_[^\]]+\]\]/g,' ');
  const cyrillic=(prose.match(/\p{Script=Cyrillic}/gu)||[]).length;
  const latin=(prose.match(/\p{Script=Latin}/gu)||[]).length;
  if(cyrillic>=2&&!/[іїєґў]/iu.test(prose)&&cyrillic>=latin*3)return 'ru';
  if(cyrillic)return undefined;
  const words=(prose.match(/\p{L}+/gu)||[]).map(word=>word.toLowerCase());
  const english=new Set(['the','and','with','you','your','this','that','can','from','make','must','when','each','into','has','have','which','does','its']);
  const spanish=new Set(['el','los','las','del','que','para','una','con','por','puede','tirada','daño']);
  const en=words.filter(word=>english.has(word)).length,es=words.filter(word=>spanish.has(word)).length;
  const terms=new Set(['sword','shield','attack','charge','save','resistance','level','damage','roll','hello','primary']);
  if(!es&&(en>=2||words.length<=3&&words.some(word=>terms.has(word))))return 'en';
  return undefined;
}
