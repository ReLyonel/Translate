import { ValidationReport } from '../../types';

export class FoundryValidator {
  public static validate(
    originalJson: any,
    translatedJson: any,
    stats: {
      translatedCount: number;
      confirmedTermsCount: number;
      reviewedTermsCount: number;
      uncertainTermsCount: number;
      placeholderErrors?: string[];
    }
  ): ValidationReport {
    const modifiedKeys: string[] = [];
    const modifiedIds: string[] = [];
    const modifiedUuids: string[] = [];
    const modifiedMacros: string[] = [];
    const modifiedFormulas: string[] = [];
    const htmlErrors: string[] = [];
    const numericChanges: string[] = [];
    const modifiedPaths: string[] = [];
    const placeholderErrors: string[] = [...(stats.placeholderErrors || [])];

    let originalKeysCount = 0;
    let translatedKeysCount = 0;

    // Helper to extract all keys, IDs, UUIDs, macros, and formulas from any JSON
    const extractMetadata = (obj: any, prefix = '') => {
      const keys: string[] = [];
      const ids: { path: string; val: string }[] = [];
      const uuids: { path: string; val: string }[] = [];
      const macros: string[] = [];
      const formulas: string[] = [];
      const htmlTexts: { path: string; value: string }[] = [];
      const scalars: { path: string; value: unknown }[] = [];

      const walk = (curr: any, path: string) => {
        if (!curr || typeof curr !== 'object') {
          return;
        }

        if (Array.isArray(curr)) {
          curr.forEach((item, idx) => walk(item, `${path}[${idx}]`));
          return;
        }

        for (const [k, v] of Object.entries(curr)) {
          const currentPath = path ? `${path}.${k}` : k;
          keys.push(currentPath);
          if (v === null || typeof v !== 'object') scalars.push({ path: currentPath, value: v });

          if (k === '_id' || k === 'id') {
            ids.push({ path: currentPath, val: String(v) });
          } else if (k === 'uuid' || currentPath.toLowerCase().includes('.uuid')) {
            uuids.push({ path: currentPath, val: String(v) });
          } else if (k === 'formula' || currentPath.endsWith('.formula')) {
            formulas.push(String(v));
          }

          if (typeof v === 'string') {
            // Check for macros
            const macroMatches = v.match(/@(UUID|Embed|Roll|Compendium|Item|Actor)\[[^\]]+\]/g);
            if (macroMatches) {
              macros.push(...macroMatches);
            }
            // Check for HTML
            if (/<[a-z][\s\S]*>/i.test(v)) {
              htmlTexts.push({ path: currentPath, value: v });
            }
          } else {
            walk(v, currentPath);
          }
        }
      };

      walk(obj, prefix);
      return { keys, ids, uuids, macros, formulas, htmlTexts, scalars };
    };

    const origMeta = extractMetadata(originalJson);
    const transMeta = extractMetadata(translatedJson);

    originalKeysCount = origMeta.keys.length;
    translatedKeysCount = transMeta.keys.length;

    // 1. Key Equality Check
    const origKeySet = new Set(origMeta.keys);
    const transKeySet = new Set(transMeta.keys);

    for (const k of origKeySet) {
      if (!transKeySet.has(k)) {
        modifiedKeys.push(`Clave eliminada: ${k}`);
      }
    }
    for (const k of transKeySet) {
      if (!origKeySet.has(k)) {
        modifiedKeys.push(`Clave agregada indebidamente: ${k}`);
      }
    }

    // 2. ID preservation check
    const transIdMap = new Map(transMeta.ids.map((i) => [i.path, i.val]));
    for (const origId of origMeta.ids) {
      const transId = transIdMap.get(origId.path);
      if (transId !== origId.val) {
        modifiedIds.push(`ID modificado en ${origId.path}: original "${origId.val}" vs actual "${transId}"`);
      }
    }

    // 3. UUID preservation check
    const transUuidMap = new Map(transMeta.uuids.map((u) => [u.path, u.val]));
    for (const origUuid of origMeta.uuids) {
      const transUuid = transUuidMap.get(origUuid.path);
      if (transUuid !== origUuid.val) {
        modifiedUuids.push(`UUID modificado en ${origUuid.path}: original "${origUuid.val}" vs actual "${transUuid}"`);
      }
    }

    // 4. Macro count and preservation check
    const origMacroCounts = new Map<string, number>();
    for (const m of origMeta.macros) {
      origMacroCounts.set(m, (origMacroCounts.get(m) || 0) + 1);
    }
    const transMacroCounts = new Map<string, number>();
    for (const m of transMeta.macros) {
      transMacroCounts.set(m, (transMacroCounts.get(m) || 0) + 1);
    }

    for (const [m, count] of origMacroCounts.entries()) {
      const transCount = transMacroCounts.get(m) || 0;
      if (transCount < count) {
        modifiedMacros.push(`Macro de Foundry faltante o alterada: "${m}" (esperado: ${count}, encontrado: ${transCount})`);
      }
    }

    const translatedScalarMap = new Map(transMeta.scalars.map((entry) => [entry.path, entry.value]));
    for (const original of origMeta.scalars) {
      const translated = translatedScalarMap.get(original.path);
      if (original.value !== translated) modifiedPaths.push(original.path);
      if (typeof original.value === 'number' && original.value !== translated) numericChanges.push(`Número técnico modificado en ${original.path}: ${original.value} → ${String(translated)}`);
    }
    for (const formula of origMeta.formulas) if (!transMeta.formulas.includes(formula)) modifiedFormulas.push(`Fórmula modificada o eliminada: ${formula}`);

    // 5. HTML Balance Check
    const checkHtmlBalance = (html: string) => {
      const tagRegex = /<\/?([a-z0-9]+)(?:\s+[^>]*)?>/gi;
      const stack: string[] = [];
      const voidTags = new Set(['br', 'hr', 'img', 'input', 'link', 'meta']);

      let match: RegExpExecArray | null;
      while ((match = tagRegex.exec(html)) !== null) {
        const fullTag = match[0];
        const tagName = match[1].toLowerCase();

        if (voidTags.has(tagName) || fullTag.endsWith('/>')) {
          continue;
        }

        if (fullTag.startsWith('</')) {
          const last = stack.pop();
          if (last !== tagName) {
            return `Etiqueta de cierre desbalanceada: esperada </${last || 'ninguna'}>, encontrada </${tagName}>`;
          }
        } else {
          stack.push(tagName);
        }
      }

      if (stack.length > 0) {
        return `Etiquetas sin cerrar: <${stack.join('>, <')}>`;
      }
      return null;
    };

    const originalHtml = new Map(origMeta.htmlTexts.map((entry) => [entry.path, entry.value.match(/<[^>]+>/g)?.join('') || '']));
    for (const html of transMeta.htmlTexts) {
      const err = checkHtmlBalance(html.value);
      if (err && !htmlErrors.includes(err)) {
        htmlErrors.push(err);
      }
      const signature = html.value.match(/<[^>]+>/g)?.join('') || '';
      if (originalHtml.get(html.path) !== signature) htmlErrors.push(`Estructura HTML o atributos modificados en ${html.path}`);
    }

    const isValid =
      modifiedKeys.length === 0 &&
      modifiedIds.length === 0 &&
      modifiedUuids.length === 0 &&
      modifiedMacros.length === 0 &&
      modifiedFormulas.length === 0 &&
      numericChanges.length === 0 &&
      placeholderErrors.length === 0 &&
      htmlErrors.length === 0;

    return {
      isValid,
      originalKeysCount,
      translatedKeysCount,
      modifiedKeys,
      modifiedIds,
      modifiedUuids,
      modifiedMacros,
      modifiedFormulas,
      numericChanges,
      modifiedPaths,
      placeholderErrors,
      htmlErrors,
      translatedTextsCount: stats.translatedCount,
      confirmedTermsCount: stats.confirmedTermsCount,
      reviewedTermsCount: stats.reviewedTermsCount,
      uncertainTermsCount: stats.uncertainTermsCount,
      timestamp: new Date().toLocaleTimeString(),
    };
  }
}
