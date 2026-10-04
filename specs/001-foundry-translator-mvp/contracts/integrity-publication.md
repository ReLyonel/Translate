# Integrity, quality gate and recovery contract v1

This increment implements T049/T050/T064/T057/T058. It does not implement pack preparation/reconstruction UI or certify runtime Foundry acceptance.

## Protection

Rules version: `integrity-3`. Markers remain `[[PROTECTED_NNN]]` for provider compatibility. Marker allocation skips markers already present in the original; literal source markers are themselves protected and restored exactly. Tokens are local to each string, never shared across contexts.

Protected classes include Foundry references and custom bracket references, standalone document/Compendium/CONFIG identifiers, balanced inline rolls and template expressions, Handlebars, HTML markup/attributes/entities, code blocks, URLs, declared resource paths, relative/absolute paths, Windows paths, dice formulas and data variables. Labels within reference braces remain human text. Nested square/curly expressions are scanned with balanced delimiters and quoted strings rather than assuming one nesting level. Unsupported/unbalanced technical expressions cause abstention and preservation, not speculative correction. This is a versioned supported-syntax contract, not a claim to understand every system's future custom syntax.

Missing, changed, duplicate, invented and reordered markers fail restoration. **Order is strict for every token**, including isolated references; no linguistic reordering exception is enabled. Restoration also compares protected content signatures to reject invented HTML, URLs, rolls, references and expressions. This strict policy deliberately prioritizes integrity over stylistic freedom. Moving references requires a future separately tested semantic policy.

## Quality gate

Seven checks: original_parse, translation, protected_tokens, references, structure, format, output_parse. JSON uses strict parse (including duplicate-key rejection), exact allowed path segments, the existing FoundryValidator and reparsing of serialized output. Empty translations fail. Script processing uses Acorn parse, protected-unit restoration, comparison outside authorized literal spans and final reparse; its format check refers to JavaScript syntax, not runtime execution or browser HTML layout.

Gate statuses: PASS, WARNING, FAILED. `FileOutcome.status=COMPLETED` requires all seven PASS. A provider response alone never completes a file. Recovered units set translation=WARNING; the whole reconstructed file must still pass technical/structural/format checks before publishing it as WARNING. Invalid original JSON can be copied exactly as ORIGINAL_FALLBACK with WARNING, but is not labeled validated. Gate results are attached to processed outcomes when available; rejected parsing/file-size paths can have no gate object.

## Recovery

STRING: missing/empty/invalid responses preserve the original unit. Other valid units may continue. Provider exception or count mismatch preserves every unit of that request; it does not assign mismatched results. No provider raw errors, response bodies or credentials are included in diagnostics.

FILE: if original parse, reconstruction or validation fails, preserve the original bytes and continue safely. Scripts retain the original raw span when recovering a unit; no unnecessary escaping rewrite is applied. Oversized files are copied without loading them entirely into memory.

JOB: source/path changes, permission failures, disk failures or failed publication stop the job with an ERROR snapshot and scope=JOB. A filesystem failure is never treated as a successful provider fallback. Cancellation prevents further scheduling/commits after it is observed; an already submitted atomic filesystem operation may finish before cancellation acknowledgement. Previously published complete files remain.

Diagnostics: scope STRING/FILE/JOB, relative file, optional pathSegments, stable reason and recovery ORIGINAL_RESTORED/ORIGINAL_COPIED/JOB_STOPPED. OutputKind: TRANSLATED, RECOVERED, ORIGINAL_FALLBACK, UNCHANGED, NOT_PUBLISHED, COMMIT_UNCERTAIN. A cleanup error after publication can leave a complete file; the job fails and reports COMMIT_UNCERTAIN rather than falsely claiming no output. String diagnostics from scripts use `['script', ordinal]`, not a JSON path. Diagnostic text contains no source/provider bodies.

## Atomic publication

Validate before creating a same-directory exclusive temporary, write and flush via fsync, read and compare staged bytes, validate again, check cancellation, publish via exclusive hard link. Existing destinations are never replaced. Native manifest replacement is the sole explicit exception: its current bytes must equal the expected original copied manifest, then a same-directory rename replaces it atomically after validation. Resource copies stream hash verification of source/temp/source and flush before publication. Ordinary handled failures clean up owned temporaries; cleanup failure is propagated as a job failure.

This guarantees publication of complete validated bytes under ordinary filesystem behavior; it does not promise directory-entry durability during hardware/power failure. A killed process can leave a temporary file, and disk cleanup failure can leave a complete published file or owned temporary. No silent overwrite, partial success or automatic crash recovery is claimed. Multi-file module output is not one filesystem transaction; native localization publishes dictionaries before its manifest and rolls back generated dictionaries on handled failure.

## Progress compatibility

Existing completed means processed selected source files, and failed now counts source files with warnings/fallback. `validated` counts files completed with no recovery. `recoveredStrings` counts recovered units; `outcomes` and `diagnostics` expose per-file and granular results. Source counters exclude copied assets and generated localization files. Batch COMPLETED means work ended, not that every file translated successfully; consumers must inspect warnings/outcomes. Exportable reconciled execution reports remain their own backlog tasks.

## Evidence

### Encoded Foundry references (T046 correction, integrity-5)

Protect the complete Foundry reference before individual HTML entities. Recognize raw and encoded Reference/@ prefixes and bracket delimiters without decoding/re-encoding the original string. Store the full original representation in one reference token; human labels outside the reference body remain separately translatable. Unterminated recognized syntax is invalid and must not reach the provider partially exposed.

After protection, terminology handling and semantic chunking may operate only on the protected text. Restore each original token exactly once with strict order, hash and technical-signature validation. A changed/missing/invented token is a failure requiring original recovery, never a successful warning-only translation. JSON strings and AST literal ranges retain their existing output format; no Foundry/dnd5e schema migration or new publication format is introduced. Rules version changes invalidate incompatible existing cache identities without editing the user's memory data.

192 automated tests pass, including golden regressions and new token, gate, disk-full/permission, collision, staged-validation, abort and granular-recovery cases. TypeScript and desktop build pass. Native Foundry acceptance remains deferred in T055/T056. Pack workflow changes remain outside this increment.
