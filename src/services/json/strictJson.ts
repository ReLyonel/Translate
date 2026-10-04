/** JSON.parse validates grammar; a second lexical pass rejects duplicate decoded keys. */
export function parseJsonStrict(source: string): any {
  source = source.replace(/^\uFEFF/, '');
  const parsed = JSON.parse(source);
  const tokens = source.match(/"(?:[^"\\]|\\[\s\S])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g) || [];
  let index = 0;
  function value() {
    const token = tokens[index++];
    if (token === '{') {
      const keys = new Set<string>();
      if (tokens[index] === '}') { index++; return; }
      do {
        const key = JSON.parse(tokens[index++]) as string;
        if (keys.has(key)) throw new Error('JSON_DUPLICATE_KEY: no se puede traducir un JSON con claves duplicadas.');
        keys.add(key); index++; value();
      } while (tokens[index++] === ',');
    } else if (token === '[') {
      if (tokens[index] === ']') { index++; return; }
      do { value(); } while (tokens[index++] === ',');
    }
  }
  value();
  return parsed;
}
