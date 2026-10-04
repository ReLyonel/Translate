export type JsonLocation = (string | number)[];
export interface StructuralIssue { path: JsonLocation; code: 'TYPE_CHANGED' | 'KEYS_CHANGED' | 'ARRAY_CHANGED' | 'UNAUTHORIZED_VALUE_CHANGED' }
export const locationKey = (path: JsonLocation) => JSON.stringify(path);

/** Only explicit string locations may differ. Everything else is compared recursively. */
export function structuralDiff(original: unknown, translated: unknown, allowed: JsonLocation[]): StructuralIssue[] {
  const eligible = new Set(allowed.map(locationKey));
  const issues: StructuralIssue[] = [];
  function visit(before: any, after: any, path: JsonLocation) {
    const kind = (value: any) => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (kind(before) !== kind(after)) { issues.push({path,code:'TYPE_CHANGED'}); return; }
    if (Array.isArray(before)) {
      if (before.length !== after.length) issues.push({path,code:'ARRAY_CHANGED'});
      before.forEach((value,index) => visit(value,after[index],[...path,index])); return;
    }
    if (before !== null && typeof before === 'object') {
      const keys = Object.keys(before); const next = Object.keys(after);
      if (JSON.stringify(keys) !== JSON.stringify(next)) issues.push({path,code:'KEYS_CHANGED'});
      for (const key of keys) { if (Object.hasOwn(after,key)) visit(before[key],after[key],[...path,key]); }
      return;
    }
    if (!Object.is(before,after) && !(typeof before === 'string' && eligible.has(locationKey(path)))) issues.push({path,code:'UNAUTHORIZED_VALUE_CHANGED'});
  }
  visit(original,translated,[]);
  return issues;
}
