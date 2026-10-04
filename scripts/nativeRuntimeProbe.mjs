/** Run only in an isolated Foundry world after manually repacking the translated copy. */
export async function runNativeProbe(plan, options = {}) {
  const game = globalThis.game;
  if (!game?.ready) throw new Error('FOUNDRY_WORLD_NOT_READY');
  if (plan?.schemaVersion !== 1 || plan?.targetCore !== '14.368' || !Array.isArray(plan.cases)) throw new Error('NATIVE_PLAN_INVALID');
  const encoded = new TextEncoder().encode(JSON.stringify(plan));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  /** @type {import('../desktop/compatibility/nativeAcceptance').RuntimeEvidence} */
  const report = {
    schemaVersion: 1, planSha256: Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join(''),
    executedAt: new Date().toISOString(),
    core: { version: game.version, build: Number(game.release?.build) },
    module: { id: plan.module.id, version: String(game.modules.get(plan.module.id)?.version ?? '') },
    system: { id: game.system.id, version: String(game.system.version) },
    checks: [], cases: [],
    console: { warnings: 0, errors: 0, startupReviewed: options.startupReviewed === true }
  };
  const check = (id, status) => report.checks.push({ id, status });
  check('module_load', game.modules.get(plan.module.id)?.active ? 'PASS' : 'FAILED');
  // Installed but inactive is still a failure: the requirement is absence.
  check('babele_absent', Array.from(game.modules.values()).some(module => String(module.id).toLowerCase() === 'babele') || globalThis.Babele || game.babele ? 'FAILED' : 'PASS');
  check('spanish_language', /^es(?:-|$)/i.test(game.i18n.lang) ? 'PASS' : 'FAILED');
  const originalWarn = console.warn, originalError = console.error;
  console.warn = (...args) => { report.console.warnings++; originalWarn.apply(console, args); };
  console.error = (...args) => { report.console.errors++; originalError.apply(console, args); };
  let descriptions = 0, links = 0, uuids = 0, rolls = 0, failures = false;
  try {
    for (const item of plan.cases) {
      let status = 'PASS';
      try {
        const document = await globalThis.fromUuid(item.uuid);
        if (!document || document.documentName !== item.documentType || document.name !== item.expectedName || document.uuid !== item.uuid) throw new Error('DOCUMENT_MISMATCH');
        const object = document.toObject();
        for (const field of item.fields) {
          let value = object;
          for (const segment of field.segments) { if (value === null || typeof value !== 'object' || !Object.hasOwn(value, segment)) throw new Error('FIELD_MISSING'); value = value[segment]; }
          if (value !== field.expected) throw new Error('REPACKED_TEXT_MISMATCH');
          if (!/(?:description|content|text)/i.test(field.segments.join('.'))) continue;
          const enriched = await globalThis.foundry.applications.ux.TextEditor.enrichHTML(value, { relativeTo: document });
          const dom = new DOMParser().parseFromString(enriched, 'text/html');
          descriptions++;
          const references = [...value.matchAll(/@UUID\[([^\]]+)\]/g)];
          for (const reference of references) {
            if (!await globalThis.fromUuid(reference[1], { relative: document })) throw new Error('UUID_UNRESOLVED');
            uuids++;
          }
          if (references.length) {
            if (dom.querySelectorAll('a.content-link:not(.broken)').length < references.length) throw new Error('LINK_RENDER_FAILED');
            links += references.length;
          }
          const formulas = [...value.matchAll(/\[\[(?:[^\[\]]|\[[^\[\]]*\])*\]\]/g)];
          if (formulas.length) {
            if (dom.querySelectorAll('.inline-roll').length < formulas.length) throw new Error('INLINE_ROLL_RENDER_FAILED');
            rolls += formulas.length;
          }
        }
      } catch { status = 'FAILED'; failures = true; }
      report.cases.push({ id: item.id, status });
    }
  } finally { console.warn = originalWarn; console.error = originalError; }
  for (const [type, id] of [['Actor', 'actors'], ['Item', 'items'], ['JournalEntry', 'journals']]) {
    const cases = plan.cases.filter(item => item.documentType === type);
    check(id, !cases.length ? 'NOT_RUN' : cases.every(item => report.cases.find(result => result.id === item.id)?.status === 'PASS') ? 'PASS' : 'FAILED');
  }
  check('compendiums', !plan.cases.length ? 'NOT_RUN' : failures ? 'FAILED' : 'PASS');
  check('descriptions', descriptions ? 'PASS' : failures ? 'FAILED' : 'NOT_RUN');
  check('links', links ? 'PASS' : failures ? 'FAILED' : 'NOT_RUN');
  check('uuid_references', uuids ? 'PASS' : failures ? 'FAILED' : 'NOT_RUN');
  check('inline_rolls', rolls ? 'PASS' : failures ? 'FAILED' : 'NOT_RUN');
  return report;
}
