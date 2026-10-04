import { validateHtmlIntegrity } from './htmlIntegrity';
import { JsonEngine } from '../json/jsonEngine';
import { ProtectedContentEngine } from '../protected-content/protectedContentEngine';
import { structuralDiff, locationKey, type JsonLocation } from './structuralDiff';
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
      allowedPaths?: JsonLocation[];
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

    const safeFields = JsonEngine.analyze(originalJson).fields.filter(field => field.classification === 'TRANSLATABLE');
    const explicit = stats.allowedPaths ? new Set(stats.allowedPaths.map(locationKey)) : undefined;
    const allowed = safeFields.map(field => field.pathSegments || []).filter(path => !explicit || explicit.has(locationKey(path)));
    const structuralErrors = structuralDiff(originalJson,translatedJson,allowed);
    const read = (value: any, path: JsonLocation) => path.reduce((current,key) => current?.[key],value);
    for (const path of allowed) {
      const before = read(originalJson,path); const after = read(translatedJson,path);
      if (typeof before !== 'string' || typeof after !== 'string') continue;
      const signature = (text: string) => [...ProtectedContentEngine.protect(text).tokens.values()].map(token => [token.type,token.original]);
      try {if (JSON.stringify(signature(before)) !== JSON.stringify(signature(after))) modifiedMacros.push('Contenido tecnico alterado en ' + locationKey(path));}
      catch {placeholderErrors.push('Sintaxis tecnica ambigua en '+locationKey(path));}
    }
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

    // Lexical comparison shares the protection engine's exact tag boundaries.
    const htmlPaths = new Set(safeFields.map(field=>field.path));
    const originalHtml = new Map(origMeta.htmlTexts.filter(entry=>htmlPaths.has(entry.path)).map(entry=>[entry.path,entry.value]));
    const translatedHtml = new Map(transMeta.htmlTexts.filter(entry=>htmlPaths.has(entry.path)).map(entry=>[entry.path,entry.value]));
    for(const path of new Set([...originalHtml.keys(),...translatedHtml.keys()])) {
      for(const error of validateHtmlIntegrity(originalHtml.get(path)||'',translatedHtml.get(path)||''))htmlErrors.push(error+' en '+path);
    }

    const isValid =
      structuralErrors.length === 0 &&
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
      structuralErrors,
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
