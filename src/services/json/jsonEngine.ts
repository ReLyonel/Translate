import { DetectedField, JsonFieldClassification, JsonInspectionResult } from '../../types';

// Fields that are explicitly translatable in Foundry VTT and Babele
const isKnownTranslatablePath = (path: string) => /^(name|title|label)$/.test(path) ||
  /^(system\.(description\.(value|chat)|activities(?:\[\d+\]|\.\d+)\.description\.(value|chatFlavor)|details\.biography\.value)|effects(?:\[\d+\]|\.\d+)\.(name|description)|pages(?:\[\d+\]|\.\d+)\.(name|text\.(content|text)))$/.test(path);

// Keys that are strictly technical and protected in Foundry VTT
const PROTECTED_KEYS = new Set([
  '_id',
  'id',
  'uuid',
  '_stats',
  'folder',
  'sort',
  'permission',
  'ownership',
  'flags',
  'img',
  'icon',
  'type',
  'pack',
  'formula',
  'actionType',
  'activation',
  'target',
  'range',
  'duration',
  'uses',
  'consume',
  'ability',
  'armor',
  'weapon',
  'proficient',
  'equipped',
  'attuned',
  'preparation',
  'level',
  'school',
  'components',
  'materials',
  'quantity',
  'weight',
  'price',
  'rarity',
  'identified',
  'source', // often just "SRD" or "PHB'24", but can be custom
  'coreVersion',
  'systemVersion',
  'createdTime',
  'modifiedTime',
  'lastModifiedBy',
  'schemaVersion',
]);

export class JsonEngine {
  /**
   * Deeply analyzes a JSON object or array, categorizing all strings.
   */
  public static analyze(json: any, fileName = 'document.json'): JsonInspectionResult {
    let totalObjects = 0;
    let totalStrings = 0;
    const fields: DetectedField[] = [];

    const isUrlOrPath = (val: string): boolean => {
      return (
        val.startsWith('http://') ||
        val.startsWith('https://') ||
        val.startsWith('data:') ||
        val.endsWith('.png') ||
        val.endsWith('.svg') ||
        val.endsWith('.jpg') ||
        val.endsWith('.webp') ||
        val.includes('/') ||
        val.includes('\\')
      );
    };

    const isInternalIdOrUuid = (val: string): boolean => {
      // Foundry 16-char alphanumeric ID e.g. "1g0ZfT8n3mQ9wX2y"
      if (/^[a-zA-Z0-9]{16}$/.test(val)) return true;
      // Standard UUID
      if (/^[0-9a-fA-F-]{36}$/.test(val)) return true;
      // Compendium pack UUID
      if (val.startsWith('Compendium.') || val.startsWith('Item.') || val.startsWith('Actor.')) return true;
      return false;
    };

    const walk = (current: any, currentPath: string, keyName: string) => {
      if (current === null || current === undefined) {
        return;
      }

      if (typeof current === 'object') {
        totalObjects++;
        if (Array.isArray(current)) {
          current.forEach((item, index) => {
            walk(item, `${currentPath}[${index}]`, keyName);
          });
        } else {
          for (const [key, value] of Object.entries(current)) {
            const nextPath = currentPath ? `${currentPath}.${key}` : key;
            walk(value, nextPath, key);
          }
        }
        return;
      }

      if (typeof current === 'string') {
        totalStrings++;
        const trimmed = current.trim();
        const lowerKey = keyName.toLowerCase();
        const lowerPath = currentPath.toLowerCase();

        // 1. Immediately Protected Check
        if (
          PROTECTED_KEYS.has(lowerKey) ||
          isUrlOrPath(trimmed) ||
          isInternalIdOrUuid(trimmed) ||
          lowerPath.includes('flags.') ||
          lowerPath.includes('_stats.') ||
          lowerPath.includes('ownership.') ||
          lowerPath.includes('permission.') ||
          lowerPath.endsWith('.img') ||
          lowerPath.endsWith('.type') ||
          lowerPath.endsWith('._id')
        ) {
          fields.push({
            id: `f-${fields.length + 1}`,
            path: currentPath,
            originalValue: current,
            classification: 'PROTECTED',
            reason: `Campo técnico del sistema (${keyName})`,
            userInclude: false,
          });
          return;
        }

        // 2. High-Confidence Translatable Check
        const isKnownPath = isKnownTranslatablePath(currentPath);
        const isDescription = lowerPath.includes('description.') || lowerPath.includes('biography.') || lowerPath.includes('.text.');
        const isNameOrTitle = /(?:^|\.)(name|title|label)$/.test(lowerPath);

        if (isKnownPath && trimmed.length > 0) {
          fields.push({
            id: `f-${fields.length + 1}`,
            path: currentPath,
            originalValue: current,
            classification: 'TRANSLATABLE',
            reason: isDescription ? 'Ruta documentada de contenido narrativo' : isNameOrTitle ? 'Ruta documentada de nombre/título' : 'Ruta documentada',
            userInclude: true,
          });
          return;
        }

        // 3. Uncertain check: has spaces or is sentence-like but in an unrecognized key
        if (trimmed.includes(' ') && trimmed.length > 5) {
          fields.push({
            id: `f-${fields.length + 1}`,
            path: currentPath,
            originalValue: current,
            classification: 'UNCERTAIN',
            reason: `Texto con espacios en clave no estándar "${keyName}"`,
            userInclude: false,
          });
          return;
        }

        // Otherwise protected by default
        fields.push({
          id: `f-${fields.length + 1}`,
          path: currentPath,
          originalValue: current,
          classification: 'PROTECTED',
          reason: 'Valor escalar técnico no humano',
          userInclude: false,
        });
      }
    };

    walk(json, '', '');

    const translatableCount = fields.filter((f) => f.classification === 'TRANSLATABLE').length;
    const protectedCount = fields.filter((f) => f.classification === 'PROTECTED').length;
    const uncertainCount = fields.filter((f) => f.classification === 'UNCERTAIN').length;

    // Approximate size in bytes
    const str = JSON.stringify(json);
    const fileSize = new Blob([str]).size;

    return {
      fileName,
      fileSize,
      totalObjects,
      totalStrings,
      translatableCount,
      protectedCount,
      uncertainCount,
      rawJson: json,
      fields,
    };
  }

  /**
   * Clones the original JSON and updates ONLY the specified paths with their translated values.
   * Guarantees 100% structural preservation: every key, order, array, and protected value remains exact.
   */
  public static reconstruct(originalJson: any, translatedFields: { path: string; value: string }[]): any {
    // Deep clone
    const cloned = JSON.parse(JSON.stringify(originalJson));

    for (const item of translatedFields) {
      this.setValueAtPath(cloned, item.path, item.value);
    }

    return cloned;
  }

  private static setValueAtPath(obj: any, path: string, value: string) {
    if (!path) return;

    // Parse path segments, e.g. "system.description.value" or "pages[0].text.content"
    const segments = path
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(Boolean);

    let current = obj;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (current[seg] === undefined || current[seg] === null) {
        return; // Path does not exist in target
      }
      current = current[seg];
    }

    const lastSeg = segments[segments.length - 1];
    if (current && typeof current === 'object' && lastSeg in current) {
      current[lastSeg] = value;
    }
  }
}
