import { ProtectedToken, ProtectionResult } from '../../types';
import { HTML_TAG_SOURCE } from '../validation/htmlIntegrity';

// Recognize encoded syntax without decoding/re-encoding the source. A complete
// reference must take precedence over an entity at the same source position.
const bracketSource=String.raw`(?:\[|&(?:amp;)*(?:#0*91;|#x0*5b;|lbrack;|lsqb;))`;
const referencePrefixPattern=new RegExp(String.raw`(?:&(?:amp;)*(?:#0*38;|#x0*26;)?Reference|(?:@|&(?:amp;)*(?:#0*64;|#x0*40;|commat;))[A-Za-z][\w.]*)\s*`+bracketSource,'i');
const encodedBracket=/^&(?:amp;)*(?:#0*(91|93);|#x0*(5b|5d);|(lbrack|lsqb|rbrack|rsqb);)/i;
function referenceBracket(text:string,index:number){
  if(text[index]==='['||text[index]===']')return {value:text[index],length:1};
  if(text[index]!=='&')return undefined;
  const match=encodedBracket.exec(text.slice(index));if(!match)return undefined;
  const opening=match[1]==='91'||match[2]?.toLowerCase()==='5b'||/^(lbrack|lsqb)$/i.test(match[3]||'');
  return {value:opening?'[':']',length:match[0].length};
}

const hash = (value: string) => {
  let result = 5381;
  for (const char of value) result = ((result << 5) + result) ^ char.charCodeAt(0);
  return (result >>> 0).toString(16);
};

/** Protects only technical syntax; visible labels in `{...}` remain translatable. */
export class ProtectedContentEngine {
  public static readonly rulesVersion = 'integrity-5';
  public static protect(text: string): ProtectionResult {
    if (typeof text !== 'string') return { protectedText: '', tokens: new Map() };
    const tokens = new Map<string, ProtectedToken>();
    let counter = 1;
    const create = (original: string, type: ProtectedToken['type'], position: number) => {
      let token: string;
      do { token = `[[PROTECTED_${String(counter++).padStart(3, '0')}]]`; } while (text.includes(token));
      tokens.set(token, { id: token, token, original, type, position, hash: hash(original) });
      return token;
    };
    // Reference and roll command syntax is protected separately from its optional visible label.
    const patterns: [RegExp, ProtectedToken['type']][] = [
      [/<(?:script|style|code|pre)\b[^>]*>[\s\S]*?<\/(?:script|style|code|pre)\s*>/gi, 'code'],
      // Entire HTML tags are protected so the model can never add/remove attributes,
      // duplicate headings, or corrupt closing tags.
      [new RegExp(HTML_TAG_SOURCE,'gi'), 'html'],
      [/<!--|<!DOCTYPE|<\/?[A-Za-z]/gi, 'html'],
      [/\[\[PROTECTED_[^\]]+\]\]/g, 'code'],
      // Complete Foundry references first, including encoded prefixes/delimiters.
      [referencePrefixPattern, 'reference'],
      // Remaining HTML entities must remain byte-for-byte stable.
      [/&(?:[A-Za-z][A-Za-z0-9]+|#\d+|#x[0-9A-Fa-f]+);/g, 'html'],
      // Foundry inline references can appear outside @UUID-style macros.
      [/\[\[/g, 'roll'],
      [/\{\{\{?[\s\S]*?\}\}\}?|\$\{/g, 'system'],
      [/\{\{/g, 'system'],
      [/https?:\/\/[^\s<>\"{}]+/gi, 'system'],
      [/(?:ftp|file):\/\/[^\s<>"{}]+|\b[A-Za-z]:\\[^\s<>"{}]+/gi, 'system'],
      [/\b(?:Compendium|Actor|Item|JournalEntry|RollTable|Scene|Macro|CONFIG)\.[A-Za-z0-9_.-]+/g, 'reference'],
      [/(?:\.{1,2}\/|\/)(?:[\w%+.-]+\/)+[\w%+.-]+/g, 'system'],
      [/\b(?:modules|systems|icons|packs|assets|sounds|templates|lang)\/[\w./%+-]+/gi, 'system'],
      [/```[\s\S]*?```|`[^`\n]+`/g, 'code'],
      [/\b(?:\d+)?d\d+(?:[a-z]+\d*)*(?:(?:\s*[+*/-]\s*)(?:\d+|@[\w.]+))*\b/gi, 'dice'],
      [/[{}]/g, 'system'],
      [/\b(?:DC\s*\d+|@\w+(?:\.\w+)*)\b/g, 'system'],
    ];
    // Match original text once: subsequent patterns must never consume pieces of
    // inserted markers, especially references containing HTML/entities.
    const combined = new RegExp(patterns.map(([pattern]) => '(?:' + pattern.source + ')').join('|'), 'gi');
    let output='', cursor=0;
    let candidate:RegExpExecArray|null;
    while ((candidate=combined.exec(text))) {
      let original=candidate[0];const offset=candidate.index;
      if(original.startsWith('<') && !original.endsWith('>'))throw new Error('AMBIGUOUS_TECHNICAL_SYNTAX');
      if(original==='{{')throw new Error('AMBIGUOUS_TECHNICAL_SYNTAX');
      const referencePrefix=new RegExp('^(?:'+referencePrefixPattern.source+')$','i').test(original);
      if(original==='${' || original==='[[' || referencePrefix) {
        const opening=original==='${'?'{':'[', closing=original==='${'?'}':']';
        let depth=original==='[['?2:1, index=offset+original.length, quote='';
        for(;index<text.length && depth>0;index++) {
          const character=text[index];
          if(quote){if(character==='\\'){index++;continue;}if(character===quote)quote='';continue;}
          if(character==='"' || character==="'" || character==='`'){quote=character;continue;}
          if(referencePrefix){const bracket=referenceBracket(text,index);if(bracket){depth+=bracket.value==='['?1:-1;index+=bracket.length-1;}}
          else if(character===opening)depth++;else if(character===closing)depth--;
        }
        if(depth!==0)throw new Error('AMBIGUOUS_TECHNICAL_SYNTAX');
        original=text.slice(offset,index);combined.lastIndex=index;
      }
      const match = patterns.find(([pattern]) => new RegExp('^(?:' + pattern.source + ')$', 'i').test(original));
      const type=referencePrefix?'reference':original.startsWith('[[') && !original.startsWith('[[PROTECTED_')?'roll':match?.[1] || 'system';
      output+=text.slice(cursor,offset)+create(original,type,offset);cursor=combined.lastIndex;
    }
    output+=text.slice(cursor);
    return { protectedText: output, tokens };
  }

  public static restore(translatedText: string, tokens: Map<string, ProtectedToken>) {
    const errors: string[] = [];
    if (typeof translatedText !== 'string') return {restoredText:'',isValid:false,errors:['Respuesta no textual']};
    const observed = translatedText.match(/\[\[PROTECTED_[^\]]+\]\]/g) || [];
    if (JSON.stringify(observed) !== JSON.stringify([...tokens.keys()])) errors.push('Orden o identidad de placeholders alterados');
    errors.push(...observed.filter(token=>!tokens.has(token)).map(token=>'Placeholder desconocido: '+token));
    let restored = translatedText;
    for (const [token, info] of tokens) {
      const count = translatedText.split(token).length - 1;
      if (count !== 1) errors.push(`${count === 0 ? 'Placeholder faltante' : 'Placeholder duplicado'}: ${token}`);
      else if (hash(info.original) !== info.hash) errors.push(`Hash de token inválido: ${token}`);
      else restored = restored.replace(token, info.original);
    }
    if (!errors.length) {
      const signature = (values: Iterable<ProtectedToken>) => JSON.stringify([...values].map(value=>[value.type,value.original]));
      try { if (signature(tokens.values()) !== signature(this.protect(restored).tokens.values())) errors.push('Contenido técnico añadido o alterado'); }
      catch { errors.push('Sintaxis técnica ambigua'); }
    }
    return { restoredText: restored, isValid: errors.length === 0, errors };
  }
}
