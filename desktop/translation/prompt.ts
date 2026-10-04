export const promptVersion='translategemma-native-2';
export const promptLimits={num_ctx:4096,max_source_chars:1200,max_source_bytes:1000,max_prompt_bytes:1792,max_context_chars:200,max_glossary_chars:200,max_output_tokens:2048};
const bounded=(text:string,bytes:number)=>{let result='';for(const character of text){if(Buffer.byteLength(result+character,'utf8')>bytes)break;result+=character;}return result;};
export function semanticChunks(text:string,max=promptLimits.max_source_chars):string[]{
 if(text.length<=max&&Buffer.byteLength(text,'utf8')<=promptLimits.max_source_bytes)return [text];const result:string[]=[];let remaining=text;
 while(remaining.length>max||Buffer.byteLength(remaining,'utf8')>promptLimits.max_source_bytes){const prefix=bounded(remaining.slice(0,max),promptLimits.max_source_bytes);let cut=Math.max(prefix.lastIndexOf('\n\n'),prefix.lastIndexOf('. '),prefix.lastIndexOf('! '),prefix.lastIndexOf('? '));if(cut<prefix.length/3)cut=prefix.lastIndexOf(' ');if(cut<1)throw new Error('TEXT_BUDGET_EXCEEDED');cut++;result.push(remaining.slice(0,cut));remaining=remaining.slice(cut);}if(remaining)result.push(remaining);return result;
}
export function translationPrompt(text:string,language:'en'|'ru',context='',terms:{source:string;target:string}[]=[]){
 const name=language==='ru'?'Russian':'English';const references=terms.filter(t=>text.toLowerCase().includes(t.source.toLowerCase())).slice(0,12).map(t=>JSON.stringify([t.source,t.target]));let glossary='';for(const line of references)if(Buffer.byteLength(glossary+'\n'+line,'utf8')<=promptLimits.max_glossary_chars)glossary+='\n'+line;
 // One user message, explicit ISO codes, exactly two blank lines before prose.
 const notes=[bounded(context,promptLimits.max_context_chars),glossary?'Terminology reference:\n'+glossary:''].filter(Boolean).join('\n');
 const build=(reference:string)=>'You are a professional '+name+' ('+language+') to Spanish (es) translator. Convey the meaning accurately using Spanish grammar and vocabulary. Return only the Spanish translation, without explanations or commentary. Preserve every [[PROTECTED_number]] placeholder exactly once in the original order.\n'+(reference?'Reference context (do not translate):\n'+reference+'\n':'')+'Translate the following '+name+' text into Spanish:\n\n\n'+text;
 const full=build(notes),prompt=Buffer.byteLength(full,'utf8')>promptLimits.max_prompt_bytes?build(''):full;
 if(Buffer.byteLength(prompt,'utf8')>promptLimits.max_prompt_bytes)throw new Error('PROMPT_BUDGET_EXCEEDED');return prompt;
}
