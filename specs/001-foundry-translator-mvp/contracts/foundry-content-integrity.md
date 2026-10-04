# Native Foundry content integrity contract v1

Implements T007/T008/T046/T047/T048 in the local source pipeline. Rules version `integrity-4`; this supersedes the rule version in `integrity-publication.md` without changing marker format or strict token order. Native runtime acceptance remains T055/T056.

## Classification

Technical keys are compared case-insensitively. Technical ancestors protect all descendant strings, even when a final key is name/label/description. This includes activation, target/range/duration, changes, schema, commands/scripts/expressions, relationships, ownership, metadata and other existing protected containers. The narrow existing `flags.dnd5e.title` exception remains. Document/Compendium identifiers and paths are protected; manifests go through their separate allowlisted publisher. Unknown prose stays UNCERTAIN, excluded by default. Duplicate decoded keys, including Unicode escapes and nested objects, are rejected before classification. Path segments remain authoritative; ambiguous dotted/bracket keys are not automatically translated.

## References and formulas

Protect UUID/Compendium/Actor/Item/JournalEntry/RollTable/Scene/Macro references, Embed, custom bracket references and technical standalone identifiers. Balanced bracket scanning preserves reference options, relative identifiers and nested brackets exactly. Reference labels can translate; braces remain technical. Per-field ordered signatures and structural diff prevent moving/replacing/duplicating references between fields or array elements.

Inline rolls remain opaque: standard roll commands, damage type brackets, lookup, item/system/custom commands, formulas, modifiers and nested syntax are preserved without execution. The application does not guess whether a custom command is supported at runtime; intact syntax is not runtime certification. Incomplete syntax abstains and uses original fallback.

## HTML and enriched text

One shared lexical tag definition is used by protection and validation. Tags, attribute text/order/quotes, classes, IDs, URLs, entities, comments and DOCTYPE are preserved byte for byte. Quoted `<`/`>` do not terminate an attribute. Full HTML void-element set is recognized. Script/style/code/pre bodies are opaque and immutable, never executed. Visible prose can translate while markup stays exact.

Balance validation uses a conservative explicit-tag subset. Crossed/missing closing tags or incomplete markup are rejected, including malformed original markup. Browser normalization, omitted HTML closing-tag repair, HTML rewriting and automatic correction are not supported. Validating JavaScript stored in command as if it were HTML is prohibited; technical code is preserved structurally instead. Native localization values use the same HTML validation. Script template fragments retain the existing AST/technical-token validation; their JavaScript format validation does not imply runtime DOM layout validation.

## Evidence and corpus handling

`tests/golden/foundryCoverage.test.ts` supplies 59 reproducible public synthetic cases; existing golden and pipeline suites remain active. Total suite: 251 PASS. `scripts/validateFoundryCoverage.ts` reads only the authorized modules tree, processes all FifthPendium `_source` JSON, checks exact token roundtrip and source SHA-256 before/after, and reports malformed/unsupported originals without modifying them. It writes private reports and technical-syntax fixtures with synthetic prose under `reports/foundry-coverage/`; those fixtures are not redistributed or presented as certified runtime fixtures.

Original documents identify mixed Foundry versions, including 12/13/14.364. No source metadata is rewritten to 14.368. Reproducible source-syntax validation plus official V14 API guidance is separate from executing a V14.368 world. Unsupported originals remain original; warnings are not silently counted as validated translations. No real AI linguistic quality or runtime acceptance is claimed by the identity corpus check.

Primary reference: [Foundry V14 TextEditor](https://foundryvtt.com/api/v14/classes/foundry.applications.ux.TextEditor.html), including enrichment of document links, UUID references, embeds and inline rolls.
