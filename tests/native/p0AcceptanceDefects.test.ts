import {it,expect,vi} from 'vitest';
import {translateScript,inspectScript,validateScriptTranslation} from '../../desktop/scriptTranslation';
const signal=()=>new AbortController().signal;
it('classifies Foundry Dialog static methods without touching interpolation expressions',async()=>{
 for(const api of ['Dialog.confirm','foundry.applications.api.DialogV2.prompt','foundry.applications.api.DialogV2.wait']){
 const source=`${api}({window:{title:"Привет"},content:\`<p>Привет \${actor.name}</p>\`});`;
 const result=await translateScript(source,async request=>request.texts.map(text=>text.replaceAll('Привет','Hola')),signal(),'ru');expect(result).toContain('title:"Hola"');expect(result).toContain('${actor.name}');validateScriptTranslation(source,result);
 }
});
it('never sends executable CSS or script element text to a translation provider',async()=>{
 for(const tag of ['style','script']){const source=`const element=document.createElement('${tag}');element.textContent=\`body { visibility: hidden; }\`;`;const provider=vi.fn(async(request:{texts:string[]})=>request.texts.map(()=> 'Contenido traducido'));expect(inspectScript(source)).toEqual([]);expect(await translateScript(source,provider,signal(),'en')).toBe(source);expect(provider).not.toHaveBeenCalled();}
});
it('supports proven ApplicationV2 window titles but preserves arbitrary class defaults',async()=>{
 const source='class Example extends foundry.applications.api.ApplicationV2 { static DEFAULT_OPTIONS={id:"module-dialog",window:{title:"Привет"}}; }';expect(await translateScript(source,async request=>request.texts.map(()=> 'Hola'),signal(),'ru')).toContain('title:"Hola"');expect(inspectScript(source.replace('foundry.applications.api.ApplicationV2','TechnicalRegistry'))).toEqual([]);
});
