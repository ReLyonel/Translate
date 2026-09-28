import { ProtectedToken, ProtectionResult } from '../../types';

export class ProtectedContentEngine {
  /**
   * Scans text, detects all Foundry macros, UUIDs, dice formulas, code,
   * and technical tokens, replacing them with unique [[PROTECTED_###]] tokens.
   */
  public static protect(text: string): ProtectionResult {
    if (!text || typeof text !== 'string') {
      return { protectedText: '', tokens: new Map() };
    }

    const tokens = new Map<string, ProtectedToken>();
    let counter = 1;

    const createToken = (original: string, type: ProtectedToken['type']): string => {
      // Pad to 3 digits e.g. [[PROTECTED_001]]
      const id = String(counter++).padStart(3, '0');
      const token = `[[PROTECTED_${id}]]`;
      tokens.set(token, { token, original, type });
      return token;
    };

    let processed = text;

    // 1. Foundry UUID and Document references:
    // e.g. @UUID[Compendium.dnd5e.spells.Item.abc123]{Cure Wounds}
    // or @UUID[Compendium.dnd5e.spells.Item.abc123]
    const uuidRegex = /@(UUID|Compendium|Item|Actor|JournalEntry|RollTable|Scene)\s*\[[^\]]+\](\{[^\}]*\})?/g;
    processed = processed.replace(uuidRegex, (match) => createToken(match, 'uuid'));

    // 2. Foundry Embed references:
    // e.g. @Embed[Compendium.dnd5e.rules.JournalEntryPage.abc]
    const embedRegex = /@Embed\s*\[[^\]]+\](\{[^\}]*\})?/g;
    processed = processed.replace(embedRegex, (match) => createToken(match, 'embed'));

    // 3. Foundry inline rolls and roll formulas:
    // e.g. [[/roll 1d20 + 5 # Initiative]] or [[1d8 + 3]] or @Roll[1d20+3]
    const foundryRollRegex = /\[\[(?:\/r(?:oll)?\s+)?([^\]]+)\]\]/g;
    processed = processed.replace(foundryRollRegex, (match) => createToken(match, 'roll'));

    const atRollRegex = /@Roll\s*\[[^\]]+\](\{[^\}]*\})?/g;
    processed = processed.replace(atRollRegex, (match) => createToken(match, 'roll'));

    // 4. Code blocks and inline code `code`
    const codeBlockRegex = /```[\s\S]*?```/g;
    processed = processed.replace(codeBlockRegex, (match) => createToken(match, 'code'));

    const inlineCodeRegex = /`[^`\n]+`/g;
    processed = processed.replace(inlineCodeRegex, (match) => createToken(match, 'code'));

    // 5. System template variables e.g. {{system.attributes.hp.value}} or ${expression}
    const templateRegex = /\{\{[^}]+\}\}|\$\{([^}]+)\}/g;
    processed = processed.replace(templateRegex, (match) => createToken(match, 'system'));

    // 6. Dice expressions outside of tags or words:
    // e.g. 1d8, 2d6 + 3, 4d10 - 2, 1d20, d100
    const diceRegex = /\b(?:\d+)?d(?:4|6|8|10|12|20|100)(?:\s*[+-]\s*\d+)?\b/gi;
    processed = processed.replace(diceRegex, (match) => createToken(match, 'dice'));

    // 7. Technical DC / Difficulty Class formulas:
    // e.g. "DC 15" or "DC 8 + proficiency bonus + Charisma modifier"
    const dcFormulaRegex = /\bDC\s+\d+\b/g;
    processed = processed.replace(dcFormulaRegex, (match) => createToken(match, 'system'));

    return {
      protectedText: processed,
      tokens,
    };
  }

  /**
   * Verifies that all generated tokens exist in the translated text exactly once,
   * then restores them back to their original strings.
   * If any token was corrupted, stripped, or duplicated by the AI model,
   * returns an explicit list of errors and flags isValid: false.
   */
  public static restore(
    translatedText: string,
    tokens: Map<string, ProtectedToken>
  ): { restoredText: string; isValid: boolean; errors: string[] } {
    if (tokens.size === 0) {
      return { restoredText: translatedText, isValid: true, errors: [] };
    }

    const errors: string[] = [];
    let restored = translatedText;

    // Check each token
    for (const [token, info] of tokens.entries()) {
      // Count occurrences of token in translated text
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = translatedText.match(new RegExp(escaped, 'g'));
      const count = matches ? matches.length : 0;

      if (count === 0) {
        errors.push(`Placeholder faltante: ${token} (original: "${info.original}"). El modelo lo eliminó o tradujo erróneamente.`);
      } else if (count > 1) {
        errors.push(`Placeholder duplicado: ${token} aparece ${count} veces.`);
      } else {
        // Exactly 1 occurrence: replace safely
        restored = restored.replace(token, () => info.original);
      }
    }

    // Also check if any rogue/malformed placeholders remain (e.g. [[PROTECTED_???]])
    const remainingPlaceholders = restored.match(/\[\[PROTECTED_\d+\]\]/g);
    if (remainingPlaceholders && remainingPlaceholders.length > 0) {
      for (const p of remainingPlaceholders) {
        if (!errors.some((e) => e.includes(p))) {
          errors.push(`Placeholder desconocido sin resolver: ${p}`);
        }
      }
    }

    return {
      restoredText: restored,
      isValid: errors.length === 0,
      errors,
    };
  }
}
