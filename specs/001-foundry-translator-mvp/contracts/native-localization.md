# Native localization output contract v1

## Scope

Module-folder jobs only. Existing source files and auxiliary resources are copied first. Native localization is a separate post-copy stage, after source JSON and script processing. There is no Babele output or dependency, no pack reconstruction, and no modification of input files.

## Generated dictionaries

For each EN/RU entry in the original `module.json.languages`, in declaration order, generate:

```text
lang/fvtt-translator/es-001.json
lang/fvtt-translator/es-002.json
...
```

Each source entry gets its own dictionary, including when two entries share a path. No merging of dictionaries or inference of missing declarations. Paths already present in the copied tree cause safe rejection; generated files never overwrite existing files. Dictionaries are UTF-8 JSON, two-space indentation and terminal newline. Root and nested nodes must be objects; leaves must be strings. Arrays, numbers, booleans, null and duplicate keys are rejected. Literal keys containing dots remain literal; empty strings remain unchanged. Only leaf text is sent to the provider, after token protection, in groups of at most 32. Language comes from the manifest entry, not auto-detection.

Output must preserve keys, nesting, leaf types and all protected-token values/multiplicity/order. HTML markup, references, rolls and variables retain protected representation. Unknown semantic content remains subject to the conservative protection engine; this contract does not claim universal language or runtime validation. Failed/incomplete/empty responses prevent publication of the whole localization stage. Approval in Translation Memory is not implied.

## Manifest delta

Append one entry per generated dictionary:

```json
{"lang":"es","name":"Español","path":"lang/fvtt-translator/es-001.json"}
```

Only `languages` may change. Existing entries, their order and unknown fields/flags remain identical semantically. Every other manifest field remains identical, including `id`, `version`, `compatibility`, `coreTranslation`, `packs`, `scripts`, `esmodules` and `relationships`. The copy can have a temporary destination folder name; its final installed directory must match the original module ID. No claim of version compatibility is added.

If any `es` or `es-*` entry already exists, preserve all localization files and the manifest byte for byte and skip generation. Missing manifest/languages or absence of EN/RU declarations generates nothing. Invalid manifests, missing dictionaries, unsupported values, unsafe paths, collisions or provider failure retain the original manifest and emit a warning. Accepted paths are relative forward-slash paths without empty, dot, parent, drive, backslash or control-character segments; discovered sources must be regular files with unchanged real paths, and symlinks/junctions are rejected by discovery.

## Commit and failure behavior

Write each dictionary into an exclusive temporary file, flush, parse it, then publish by an exclusive hard link. Prepare and flush the modified manifest only after every dictionary exists and is validated. Replace the copied manifest with a same-directory atomic rename. On handled error or cancellation before manifest commit, remove newly generated dictionaries and temporary files; keep the original copied manifest. Existing colliding files are never removed. Empty generated directories can remain. A process/power crash may leave orphan dictionaries, but never registers missing dictionaries; crash recovery/directory durability remains part of pending T057. Disk cleanup failure is a job error, not a successful rollback.

## Desktop progress additions

`BatchProgress.warnings?: string[]` contains stage warnings. `generatedLocalizations?: string[]` lists only published, registered relative paths. The existing `total/completed/failed` counters continue counting selected source JSON/scripts, not generated dictionaries. Native localization warnings are visible independently of source-file failures. `COMPLETED` on the batch means execution ended; it does not certify Foundry runtime acceptance or linguistic quality.

## Verification

`tests/native/localization.test.ts` covers synthetic success/adversarial/integrated cases. `scripts/validateNativeLocalization.ts` reads only the authorized modules tree and emits a private integrity report under `reports/native-localization/`; an identity provider verifies preservation, not translation quality. Real Foundry 14.368, manual pack rebuild and Babele-absent acceptance remain T055/T056.
