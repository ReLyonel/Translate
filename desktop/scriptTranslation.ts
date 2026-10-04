import { parse } from 'acorn';
import type { TranslateRequest } from './contracts';
import { recoverUnits } from './translation/recoverUnits';

type Node = any;
function ast(source: string) {
  try { return parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }); }
  catch { return parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true }); }
}
const visibleKeys = new Set(['name', 'label', 'title', 'hint', 'description', 'content', 'text', 'tooltip', 'caption', 'message', 'choices', 'flavor']);
function member(node:Node):string[] {
  if(node?.type==='Identifier')return [node.name];
  if(node?.type==='MemberExpression'&&!node.computed)return [...member(node.object),node.property.name];
  return [];
}
const visualCalls=new Set(['ui.notifications.info','ui.notifications.warn','ui.notifications.error']);
const visualObjects=new Set(['Dialog','DialogV2','foundry.applications.api.DialogV2','ChatMessage.create','game.settings.register','game.settings.registerMenu','DocumentSheetConfig.registerSheet']);
for(const dialog of ['Dialog','DialogV2','foundry.applications.api.DialogV2'])for(const method of ['confirm','prompt','wait'])visualObjects.add(`${dialog}.${method}`);
function uiContext(ancestors:Node[]) {
  return ancestors.some(node=>
    ((node.type==='CallExpression'||node.type==='NewExpression')&&visualObjects.has(member(node.callee).join('.'))) ||
    (node.type==='VariableDeclarator'&&node.id?.type==='Identifier'&&['ui','dialog','dialogData','chatData'].includes(node.id.name)));
}
function human(text: string) {
  const value = text.trim();
  return /\p{L}/u.test(value) && !/^[\w-]+(?:\.[\w-]+)+$/.test(value) && !/^(?:https?:|modules\/|systems\/|icons\/|lang\/|\.\.?\/|#[\w-]+$)/i.test(value) && !/^[\w./-]+\.(?:mjs|js|json|hbs|png|svg|webp|css)$/i.test(value);
}
export function inspectScript(source: string, onUncertain:(start:number)=>void=()=>{}) {
  const tree = ast(source);
  const technicalElements=new Set<string>();
  function collect(node:Node){if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&node.id?.type==='Identifier'&&node.init?.type==='CallExpression'&&member(node.init.callee).join('.')==='document.createElement'&&['style','script'].includes(node.init.arguments[0]?.value))technicalElements.add(node.id.name);for(const child of Object.values(node))if(Array.isArray(child))child.forEach(collect);else if(child&&typeof child==='object')collect(child);}
  collect(tree);
  const spans: {start: number; end: number; text: string; template: boolean; prefix?:string; suffix?:string}[] = [];
  function walk(node: Node, ancestors: Node[]) {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
    const parent = ancestors.at(-1);
    const property = [...ancestors].reverse().find(item => item.type === 'Property');
    const key = property?.key?.name ?? property?.key?.value;
    const call = [...ancestors].reverse().find(item => item.type === 'CallExpression');
    const callee = member(call?.callee);
    const assignment = [...ancestors].reverse().find(item => item.type === 'AssignmentExpression');
    const assigned = member(assignment?.left);
    const inChoices = ancestors.some(item => item.type === 'Property' && (item.key?.name ?? item.key?.value) === 'choices');
    const valueNode = node.type === 'TemplateElement' ? parent : node;
    const cls=[...ancestors].reverse().find(item=>item.type==='ClassDeclaration'||item.type==='ClassExpression');
    const defaults=ancestors.some(item=>item.type==='PropertyDefinition'&&item.static&&(item.key?.name??item.key?.value)==='DEFAULT_OPTIONS');
    const windowTitle=key==='title'&&defaults&&member(cls?.superClass).join('.')==='foundry.applications.api.ApplicationV2'&&ancestors.some(item=>item.type==='Property'&&(item.key?.name??item.key?.value)==='window');
    const visible = ((uiContext(ancestors)||windowTitle)&&property?.value === valueNode && (visibleKeys.has(key) || inChoices)) ||
      (call?.arguments?.includes(valueNode) && visualCalls.has(callee.join('.'))) ||
      (assignment?.right === valueNode && !technicalElements.has(assigned[0]) && ['innerHTML','textContent','innerText'].includes(assigned.at(-1)||''));
    const technicalCall = (parent?.type === 'CallExpression' || (parent?.type === 'TemplateLiteral' && call?.arguments?.includes(parent))) && ['localize','format','register','registerMenu','get','set','on','once','fetch','querySelector','querySelectorAll','createElement','addEventListener'].includes(callee.at(-1)||'');
    const isKey = parent?.type === 'Property' && parent.key === node;
    if(!visible&&!technicalCall&&!isKey&&property?.value===valueNode&&visibleKeys.has(key)) {
      const text=node.type==='Literal'?node.value:node.type==='TemplateElement'?node.value.cooked:null;
      if(typeof text==='string'&&human(text))onUncertain(node.start);
    }
    if (visible && !technicalCall && !isKey && node.type === 'Literal' && typeof node.value === 'string' && human(node.value)) spans.push({start:node.start, end:node.end, text:node.value, template:false});
    if (visible && !technicalCall && node.type === 'TemplateElement' && node.value.cooked !== null) {
      let text = node.value.cooked;
      const previous = parent.quasis.slice(0,parent.quasis.indexOf(node)).map((quasi: Node) => quasi.value.cooked || '').join('');
      const prefix = previous.lastIndexOf('<') > previous.lastIndexOf('>') ? text.match(/^[^>]*>?/)?.[0] || '' : '';
      text = text.slice(prefix.length);
      const suffix = text.match(/<[^>]*$/)?.[0] || '';
      text = suffix ? text.slice(0,-suffix.length) : text;
      if (human(text)) spans.push({start:node.start, end:node.end, text, template:true, prefix, suffix});
    }
    for (const [key, child] of Object.entries(node)) {
      // Interpolated expressions are executable code, including any nested literals.
      if(node.type==='TemplateLiteral'&&key==='expressions')continue;
      if (key === 'key' && node.type === 'Property' && !node.computed) continue;
      if (Array.isArray(child)) child.forEach(value => walk(value, [...ancestors, node]));
      else if (child && typeof child === 'object') walk(child, [...ancestors, node]);
    }
  }
  walk(tree, []);
  return spans.sort((a,b) => a.start - b.start);
}
export async function translateScript(source: string, translate: (request: TranslateRequest) => Promise<string[]>, signal: AbortSignal, language: TranslateRequest['sourceLanguage'], onFailure:(index:number,reason:import('./contracts').RecoveryDiagnostic['reason'])=>void=()=>{}) {
  const spans = inspectScript(source);
  const changes: {start:number; end:number; value:string}[] = [];
  for (let start = 0; start < spans.length; start += 32) {
    signal.throwIfAborted();
    const group = spans.slice(start, start + 32);
    const result = await recoverUnits(group.map(span=>span.text),translate,signal,language,(index,reason)=>onFailure(start+index,reason),group.map((_,index)=>({document_type:'Script',field_type:'visible_literal',json_path:['script',start+index]})));
    group.forEach((span,index) => {
      if (result[index]===span.text) return;
      const quote=source[span.start];
      const literal=JSON.stringify(result[index]);
      const value = span.template ? ((span.prefix || '') + result[index] + (span.suffix || '')).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') : quote==="'"?"'"+literal.slice(1,-1).replace(/'/g,"\\'")+"'":literal;
      changes.push({start:span.start, end:span.end, value});
    });
  }
  let output = source;
  for (const change of changes.reverse()) output = output.slice(0,change.start) + change.value + output.slice(change.end);
  validateScriptTranslation(source,output);
  return output;
}
export function validateScriptTranslation(source:string,output:string) {
  // Compare exact bytes outside ranges and executable AST including imports/exports.
  const before = inspectScript(source); const after = inspectScript(output);
  const normalized = (code: string, ranges: typeof before) => ranges.slice().reverse().reduce((value, range) => value.slice(0,range.start) + 'TRANSLATABLE' + value.slice(range.end), code);
  const canonical=(code:string,ranges:typeof before)=>{
    const allowed=new Set(ranges.map(range=>`${range.start}:${range.end}`));
    const clean=(value:any):any=>{
      if(Array.isArray(value))return value.map(clean);
      if(!value||typeof value!=='object')return value;
      const replace=allowed.has(`${value.start}:${value.end}`);
      return Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','raw'].includes(key)).map(([key,item])=>[key,replace&&key==='value'?'TRANSLATABLE':clean(item)]));
    };
    return JSON.stringify(clean(ast(code)));
  };
  if(normalized(source,before)!==normalized(output,after)||canonical(source,before)!==canonical(output,after))throw new Error('SCRIPT_TRANSLATION_VALIDATION_FAILED');
}
