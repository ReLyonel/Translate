/** Lexical HTML subset: no DOM normalization, execution or attribute rewriting. */
export const HTML_TAG_SOURCE = String.raw`<\/?[A-Za-z][A-Za-z0-9:-]*(?:[^"'<>]|"[^"]*"|'[^']*')*>|<!--[\s\S]*?-->|<!DOCTYPE(?:[^"'<>]|"[^"]*"|'[^']*')*>`;
const opaque=new Set(['script','style','code','pre']);
const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
export function inspectHtml(text:string) {
  const pattern=new RegExp(HTML_TAG_SOURCE,'gi');
  const tokens:string[]=[];const stack:string[]=[];const errors:string[]=[];
  let match:RegExpExecArray|null;
  while((match=pattern.exec(text))) {
    const raw=match[0];tokens.push(raw);
    if(raw.startsWith('<!--') || /^<!doctype/i.test(raw))continue;
    const name=raw.match(/^<\/?([A-Za-z][A-Za-z0-9:-]*)/)![1].toLowerCase();
    if(!raw.startsWith('</') && (voidTags.has(name)||/\/\s*>$/.test(raw)))continue;
    if(raw.startsWith('</')){if(stack.pop()!==name)errors.push('HTML_CLOSE_MISMATCH');continue;}
    if(opaque.has(name)) {
      const close=new RegExp('</'+name+'\\s*>','gi');close.lastIndex=pattern.lastIndex;
      const end=close.exec(text);
      if(!end){errors.push('HTML_OPAQUE_UNCLOSED');break;}
      tokens.push(text.slice(pattern.lastIndex,end.index),end[0]);pattern.lastIndex=close.lastIndex;
    }else stack.push(name);
  }
  if(stack.length)errors.push('HTML_TAG_UNCLOSED');
  return {tokens,errors};
}
export function validateHtmlIntegrity(before:string,after:string) {
  const original=inspectHtml(before),translated=inspectHtml(after);
  const errors=[...original.errors,...translated.errors];
  if(JSON.stringify(original.tokens)!==JSON.stringify(translated.tokens))errors.push('HTML_TECHNICAL_CHANGED');
  return [...new Set(errors)];
}
