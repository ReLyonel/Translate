# Native acceptance evidence contract v1

This bundle verifies a manually repacked translated module. It does not generate compendiums, modify installed modules, remove Babele dependencies or certify translation quality. Existing native output follows `native-localization.md`. T055/T056 remain incomplete until an operator executes the probe in Foundry 14.368 without Babele and supplies the evidence.

## Bundle generation

```powershell
bunx tsx scripts/nativeAcceptance.ts ORIGINAL_MODULE TRANSLATED_COPY NEW_REPORT_DIRECTORY
```

The report directory must be new and outside both modules. Sources are read only; discovery rejects symlinks/junctions. Generated UTF-8 files:

- `acceptance-plan.json`: schemaVersion=1, targetCore=14.368, module ID/version, representative cases and SHA-256 artifact hashes.
- `runtime-probe.mjs`: read-only Foundry browser probe.
- `acceptance-report.json`: local preflight checks, optional runtime evidence and aggregate acceptance status.

Case schema:

```json
{
  "id": "case-1",
  "uuid": "Compendium.example.items.Item.abcdefghijklmnop",
  "documentType": "Item",
  "expectedName": "Espada",
  "fields": [{"segments": ["system", "description", "value"], "expected": "<p>Texto traducido</p>"}]
}
```

Up to three representative documents per Actor/Item/JournalEntry category are selected from declared pack sources. Field paths use literal string/number segments. Plans contain local expected text to compare effective compendium content; keep these private when the module content is private. `sourceHashes` covers selected source JSON/scripts, manifest, declared localization files and effective pack files, not every auxiliary resource. Presence of pack files does not prove their content was rebuilt. The runtime comparison supplies that evidence. The default case selection may lack links/rolls or a category; add representative cases to the plan and regenerate its report before claiming acceptance.

## Real runtime execution (deferred)

Use an isolated Foundry **14.368** world, correct system/version, Spanish selected, original module ID directory, manually repacked translated files, and Babele **not installed**, including inactive Babele. Review startup warnings/errors in browser and server logs first. Never use an active personal world for this test.

Make the generated probe and plan accessible under a temporary test module's assets in the isolated Data directory; do not alter the translated module manifest. In the browser developer console:

```javascript
const plan = await fetch('modules/acceptance-tools/acceptance-plan.json').then(r => r.json());
const {runNativeProbe} = await import('/modules/acceptance-tools/runtime-probe.mjs');
const evidence = await runNativeProbe(plan, {startupReviewed: true});
foundry.utils.saveDataToFile(JSON.stringify(evidence, null, 2), 'application/json', 'runtime.json');
```

Set `startupReviewed: true` only after actually reviewing startup logs. The probe captures counts of console warnings/errors **during its execution only**, without storing raw console arguments or credentials. Startup review is an explicit operator attestation; the probe cannot retroactively collect startup messages. Attach separate sanitized startup evidence when reviewing acceptance. The probe does not execute script macros, import world documents, mutate settings or modify compendium contents. It reads documents and uses Foundry's enriched-text renderer; inline rolls may evaluate in memory during rendering.

Validate downloaded evidence against unchanged sources:

```powershell
bunx tsx scripts/nativeAcceptance.ts ORIGINAL_MODULE TRANSLATED_COPY NEW_REVIEW_DIRECTORY runtime.json
```

## Runtime evidence

`schemaVersion`, `planSha256` (SHA-256 of compact JSON serialization of the exact plan), `executedAt` ISO UTC, `core.version/build`, `module.id/version`, `system.id/version`, `checks`, `cases`, `console`.

Required unique runtime checks: module_load, babele_absent, actors, items, journals, compendiums, descriptions, links, uuid_references, inline_rolls, spanish_language. Every plan case must occur once. Console fields: nonnegative integer warnings/errors and boolean startupReviewed. Binding mismatch, missing/duplicate cases, invalid statuses, wrong module/version or core other than version 14.368/build 368 fail validation. Later core builds require a separately versioned profile and verification.

Statuses:

- `PASS`: all required runtime checks/cases pass, required coverage exists, startup reviewed, no runtime warnings/errors or failed preflight checks.
- `FAILED`: corrupted evidence, failed local/runtime checks or runtime console errors.
- `WARNING`: runtime checks complete with warnings; no unconditional acceptance.
- `NOT_RUN`: absent runtime evidence, missing required coverage, unexecuted checks or unreviewed startup logs.

Optional Babele recommendations are diagnosed but not removed; a real Babele-absent pass can demonstrate they are not required. Mandatory and legacy Babele dependencies fail preflight. Reports are evidence artifacts, not cryptographic proof of execution: operator provenance and logs matter. Simulated tests never count as real runtime evidence.

## Current external limitation

The earlier inspection found 14.364. The controlled P0 acceptance of 2026-10-03 found **14.368** and opened an isolated ES world without Babele. FifthPendium could not activate: its original manifest allows dnd5e at most 5.9.9, while the installed system is 6.0.5. The real module-management UI confirms `enableable=false` and that incompatibility. No manifest compatibility override or personal-world launch was performed. Module/pack/script runtime certification remains pending; see [P0_ACCEPTANCE.md](../../../docs/P0_ACCEPTANCE.md).
