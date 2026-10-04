import { parseJsonStrict } from './strictJson';
import { DetectedField, JsonFieldClassification, JsonInspectionResult } from '../../types';

// Human-readable fields in native Foundry sources. Matching is based on the final key
// instead of a single hard-coded root path, so nested structures such as:
// entries.<id>.description, activities.<id>.name, advancement.<id>.title
// are handled without translating technical containers.
const TRANSLATABLE_KEYS = new Set([
  'name',
  'title',
  'label',
  'description',
  'chat',
  'chatflavor',
  'flavor',
  'tooltip',
  'caption',
  'content',
  'text',
]);

const PROTECTED_PATH_PREFIXES = [
  'flags.',
  '_stats.',
  'ownership.',
  'permission.',
  'mapping.',
  'folders.',
];

const TRANSLATABLE_PROTECTED_PATHS = new Set([
  // Book/Journal navigation metadata that is visibly rendered to users.
  'flags.dnd5e.title',
]);

const isKnownTranslatablePath = (path: string, keyName: string) => {
  const lowerPath = path.toLowerCase();
  const lowerKey = keyName.toLowerCase();

  // Explicit visible Book/Journal metadata can live under flags.
  if (TRANSLATABLE_PROTECTED_PATHS.has(lowerPath)) {
    return true;
  }

  if (PROTECTED_PATH_PREFIXES.some((prefix) => lowerPath.startsWith(prefix))) {
    return false;
  }

  // Foundry commonly stores prose inside *.description.value,
  // *.biography.value and *.text.text/content.
  if (/(^|\.)(description|biography|text)\.(value|content|text)$/.test(lowerPath)) {
    return true;
  }

  return TRANSLATABLE_KEYS.has(lowerKey);
};

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
  'converter',
  'mapping',
  'command', 'script', 'expression', 'key', 'scope', 'path', 'url', 'src',
  'changes', 'validation', 'schema', 'dependencies', 'relationships', 'compatibility',
].map(key=>key.toLowerCase()));

export class JsonEngine {
  public static parse(source: string): any { return parseJsonStrict(source); }
  /**
   * Deeply analyzes a JSON object or array, categorizing all strings.
   */
  public static analyze(json: any, fileName = 'document.json'): JsonInspectionResult {
    const isManifest = json && !Array.isArray(json) && typeof json.id === 'string' && ['packs', 'languages', 'compatibility'].some(key => Object.hasOwn(json,key));
    let totalObjects = 0;
    let totalStrings = 0;
    const fields: DetectedField[] = [];

    const isUrlOrPath = (val: string): boolean => {
      const normalized = val.trim();

      // Do not treat HTML closing tags such as </p> as filesystem paths.
      return (
        /^https?:\/\//i.test(normalized) ||
        /^data:/i.test(normalized) ||
        /^(?:\.\.?[\\/]|[A-Za-z]:[\\/]|\\\\)/.test(normalized) ||
        /\.(?:png|svg|jpe?g|webp)$/i.test(normalized)
      );
    };

    const isInternalIdOrUuid = (val: string): boolean => {
      // Foundry 16-char alphanumeric ID e.g. "1g0ZfT8n3mQ9wX2y"
      if (/^[a-zA-Z0-9]{16}$/.test(val)) return true;
      // Standard UUID
      if (/^[0-9a-fA-F-]{36}$/.test(val)) return true;
      // Compendium pack UUID
      if (/^(?:Compendium|Item|Actor|JournalEntry|RollTable|Scene|Macro|JournalEntryPage|Playlist|Token)\./.test(val)) return true;
      return false;
    };

    const walk = (current: any, currentPath: string, keyName: string, segments: (string | number)[]) => {
      if (current === null || current === undefined) {
        return;
      }

      if (typeof current === 'object') {
        totalObjects++;
        if (Array.isArray(current)) {
          current.forEach((item, index) => {
            walk(item, `${currentPath}[${index}]`, keyName, [...segments, index]);
          });
        } else {
          for (const [key, value] of Object.entries(current)) {
            const nextPath = currentPath ? `${currentPath}.${key}` : key;
            walk(value, nextPath, key, [...segments, key]);
          }
        }
        return;
      }

      if (typeof current === 'string') {
        totalStrings++;
        const trimmed = current.trim();
        const lowerKey = keyName.toLowerCase();
        const lowerPath = currentPath.toLowerCase();

        const protectedAncestor=segments.slice(0,-1).some(segment=>typeof segment==='string' && PROTECTED_KEYS.has(segment.toLowerCase()));
        if(protectedAncestor && !TRANSLATABLE_PROTECTED_PATHS.has(lowerPath)) {
          fields.push({id:`f-${fields.length+1}`,path:currentPath,pathSegments:[...segments],originalValue:current,classification:'PROTECTED',reason:'Contenedor tecnico: conservar original.',userInclude:false});return;
        }

        if (segments.some(segment => typeof segment === 'string' && /[.\[\]]/.test(segment))) {
          fields.push({id: `f-${fields.length+1}`, path: currentPath, pathSegments: [...segments], originalValue:current, classification:'UNCERTAIN', reason:'Ubicacion no estandar; conservar original.', userInclude:false}); return;
        }
        if (isManifest) { fields.push({id:`f-${fields.length+1}`, path:currentPath, pathSegments:[...segments], originalValue:current, classification:'PROTECTED', reason:'Manifiesto: conservar hasta publicacion nativa validada.', userInclude:false}); return; }
        // 1. Immediately Protected Check
        const explicitlyTranslatablePath = TRANSLATABLE_PROTECTED_PATHS.has(lowerPath);

        if (
          !explicitlyTranslatablePath &&
          (
            PROTECTED_KEYS.has(lowerKey) ||
            isUrlOrPath(trimmed) ||
            isInternalIdOrUuid(trimmed) ||
            lowerPath.includes('flags.') ||
            lowerPath.includes('_stats.') ||
            lowerPath.includes('ownership.') ||
            lowerPath.includes('permission.') ||
            lowerPath.startsWith('mapping.') ||
            lowerPath.startsWith('folders.') ||
            lowerPath.endsWith('.img') ||
            lowerPath.endsWith('.type') ||
            lowerPath.endsWith('._id')
          )
        ) {
          fields.push({
            id: `f-${fields.length + 1}`,
            path: currentPath,
            pathSegments: [...segments],
            originalValue: current,
            classification: 'PROTECTED',
            reason: `Campo técnico del sistema (${keyName})`,
            userInclude: false,
          });
          return;
        }

        // 2. High-Confidence Translatable Check
        const isKnownPath = isKnownTranslatablePath(currentPath, keyName);
        const isDescription = lowerPath.includes('description.') || lowerPath.includes('biography.') || lowerPath.includes('.text.');
        const isNameOrTitle = /(?:^|\.)(name|title|label)$/.test(lowerPath);

        if (isKnownPath && trimmed.length > 0) {
          fields.push({
            id: `f-${fields.length + 1}`,
            path: currentPath,
            pathSegments: [...segments],
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
            pathSegments: [...segments],
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
          pathSegments: [...segments],
          originalValue: current,
          classification: 'PROTECTED',
          reason: 'Valor escalar técnico no humano',
          userInclude: false,
        });
      }
    };

    walk(json, '', '', []);

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
  public static reconstruct(originalJson: any, translatedFields: { path: string; value: string; pathSegments?: (string | number)[] }[]): any {
    // Deep clone
    const cloned = JSON.parse(JSON.stringify(originalJson));

    const fields = this.analyze(originalJson).fields;
    for (const item of translatedFields) {
      const matches = fields.filter(field => field.path === item.path);
      const segments = item.pathSegments || (matches.length === 1 ? matches[0].pathSegments : undefined);
      if (!segments || !segments.length) throw new Error('Ubicacion JSON ambigua o inexistente.');
      this.setValueAtPath(cloned, segments, item.value);
    }

    return cloned;
  }

  private static setValueAtPath(obj: any, segments: (string | number)[], value: string) {
    let current = obj;
    for (const segment of segments.slice(0,-1)) {
      if (!current || typeof current !== 'object' || !Object.hasOwn(current,segment)) throw new Error('Ubicacion JSON inexistente.');
      current = current[segment];
    }
    const last = segments.at(-1)!;
    if (!current || typeof current !== 'object' || !Object.hasOwn(current,last) || typeof current[last] !== 'string') throw new Error('Campo JSON no traducible.');
    current[last] = value;
  }
}
