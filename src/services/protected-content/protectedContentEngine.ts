import { ProtectedToken, ProtectionResult } from '../../types';

const hash = (value: string) => {
  let result = 5381;
  for (const char of value) result = ((result << 5) + result) ^ char.charCodeAt(0);
  return (result >>> 0).toString(16);
};

/** Protects only technical syntax; visible labels in `{...}` remain translatable. */
export class ProtectedContentEngine {
  public static protect(text: string): ProtectionResult {
    if (typeof text !== 'string') return { protectedText: '', tokens: new Map() };
    const tokens = new Map<string, ProtectedToken>();
    let counter = 1;
    const create = (original: string, type: ProtectedToken['type'], position: number) => {
      const token = `[[PROTECTED_${String(counter++).padStart(3, '0')}]]`;
      tokens.set(token, { id: token, token, original, type, position, hash: hash(original) });
      return token;
    };
    // Reference and roll command syntax is protected separately from its optional visible label.
    const patterns: [RegExp, ProtectedToken['type']][] = [
      [/@(?:UUID|Embed|Roll|Compendium|Item|Actor|JournalEntry|RollTable|Scene)\s*\[[^\]]+\]/g, 'reference'],
      [/\[\[(?:lookup\s+[^\]]+|\/damage\s+[^\]]+|\/item\s+[^\]]+|\/r(?:oll)?\s+[^\]]+|[^\]]*\d+d\d+[^\]]*)\]\]/gi, 'roll'],
      [/\{\{[^}]+\}\}|\$\{[^}]+\}/g, 'system'],
      [/```[\s\S]*?```|`[^`\n]+`/g, 'code'],
      [/\b(?:\d+)?d(?:4|6|8|10|12|20|100)(?:\s*[+-]\s*\d+)?\b/gi, 'dice'],
      [/\b(?:DC\s*\d+|@\w+(?:\.\w+)*)\b/g, 'system'],
    ];
    let output = text;
    for (const [pattern, type] of patterns) {
      output = output.replace(pattern, (original: string, offset: number) => create(original, type, offset));
    }
    return { protectedText: output, tokens };
  }

  public static restore(translatedText: string, tokens: Map<string, ProtectedToken>) {
    const errors: string[] = [];
    let restored = translatedText;
    for (const [token, info] of tokens) {
      const count = translatedText.split(token).length - 1;
      if (count !== 1) errors.push(`${count === 0 ? 'Placeholder faltante' : 'Placeholder duplicado'}: ${token}`);
      else if (hash(info.original) !== info.hash) errors.push(`Hash de token inválido: ${token}`);
      else restored = restored.replace(token, info.original);
    }
    const unexpected = restored.match(/\[\[PROTECTED_\d+\]\]/g) || [];
    errors.push(...unexpected.map((token) => `Placeholder desconocido: ${token}`));
    return { restoredText: restored, isValid: errors.length === 0, errors };
  }
}
