import { ProtectedContentEngine as Protection } from '../../src/services/protected-content/protectedContentEngine';
import { hashKey } from './store';

/** Bounded human context for review/provider, with only its fingerprint in diagnostics. */
export function surroundingContext(original:any,segments:(string|number)[],source:string):{document_type?:string;surrounding_context_hash?:string;surrounding_context?:string} {
  const parent=segments.slice(0,-1).reduce((value,key)=>value?.[key],original);
  let document=original,current=original;
  for(const segment of segments.slice(0,-1)){
    current=current?.[segment];
    if(current&&typeof current.name==='string'&&typeof current.type==='string')document=current;
  }
  const values=[parent?.name,document?.name,original?.name,parent?.description,document?.description,document?.system?.description?.value];
  const human=values.filter(value=>typeof value==='string'&&value!==source).map(value=>Protection.protect(value).protectedText.replace(/\[\[PROTECTED_[^\]]+\]\]/g,' ').trim().slice(0,300)).filter(Boolean);
  const prose=[...new Set(human)].join(' | ').slice(0,600);
  return {...(typeof document?.type==='string'?{document_type:document.type}:{}),...(prose?{surrounding_context_hash:hashKey(prose),surrounding_context:prose}:{})};
}
