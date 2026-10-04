# T077 — contrato de evidencia y auditoría de reutilización

La salida sigue siendo JSON/JavaScript nativo de Foundry. Babele es exclusivamente una procedencia histórica opcional: no se ejecutan conversores, no se instala una dependencia y no se genera su formato de salida.

## Identidad y decisión

`canonical_evidence.schema_version = 1` separa `match_type` de `decision`. Contiene `source`, `source_version`, `confidence`, `approved`, `approved_by`, `approved_at` y `evidence` con identidad de campo y hashes SHA-256 del texto original y traducido. La identidad incluye `system`, `package`, `pack`, `document_type`, `document_id`, `field_path`, `target_language` y `version`. Una confianza de 1 en la identidad no aprueba la traducción: una candidata continúa siendo `AMBIGUOUS`. `FUZZY` no autoriza `VERIFIED`.

La aprobación exige revisión explícita o una regla de evidencia ya verificada. Una prueba alterada respecto del texto o contexto persistido invalida la carga. Las entradas antiguas sin este campo mantienen compatibilidad; no se les asigna aprobación nueva. Los campos nuevos son opcionales y no alteran las claves existentes.

`reuse_scope = EXACT_SOURCE_ONLY` permite memoria histórica revisada por texto e idioma exactos y contexto compatible, pero la excluye de la reutilización canónica multilingüe. Editar y aprobar una entrada conserva este alcance. El análisis histórico es de solo lectura; una acción separada importa el corpus con su declaración explícita de confianza, según la continuación T077 descrita abajo.

## Puente SRD

Se reutilizan `PdfCorpus`, `PdfReuse` y `canonicalResolution`. El SRD español es referencia documental verificada, pero una pareja EN/ES exige evidencia de alineación. Una identidad Foundry/campo completa más una pareja SRD aprobada puede producir un vínculo persistente RU → SRD ES. Nombres parecidos, IDs presentes en un diccionario histórico, posición PDF o puntuaciones no prueban por sí solos correspondencia SRD. El Manual del Jugador no se incorpora automáticamente como SRD.

No existe un corpus previo de packs ES nativos. No se exige tal corpus ni se fabrica para superar los criterios. Los 8.372 candidatos PDF conservan su estado hasta disponer de evidencia adicional.

El importador existente admite ahora nombres RU literales que identifican un único documento, solo para el campo `name`; una clave textual no autoriza descripciones. Los IDs históricos permiten presentar campos candidatos, pero no demuestran el texto original histórico. Las nuevas importaciones usan `EXACT_SOURCE_ONLY` y permanecen sin aprobar. `babele_field_candidates` mide cobertura por ubicación; `babele_ru_es_exact_candidates` exige texto RU original observable en la clave del nombre. Los objetos embebidos/conversores no soportados se diagnostican y no se ejecutan.

## Caché

Los registros nuevos pueden incluir `identity.schema_version = 1`, con clave, hashes de texto/contexto, idiomas, proveedor, modelo, versión de prompt, glosario, reglas, revisión y fingerprint PDF. Se conserva el algoritmo de claves. El hash de texto de caché usa el algoritmo existente `hashKey`; los hashes de evidencia canónica usan SHA-256 directo del texto UTF-8.

Una entrada antigua sin descriptor se conserva como `LEGACY_CACHE_UNVERIFIED` y no se reutiliza automáticamente, incluso cuando coincide una clave. La auditoría previa informaba CACHE_LEGACY_METADATA_UNAVAILABLE; la instrucción posterior del usuario exige aislamiento estricto. No se inventa un motivo retrospectivo de modelo/prompt. Los descriptores nuevos permiten motivos concretos de incompatibilidad.

## Preflight e informes

`translationPreflight(..., { offline: true })` realiza discovery, clasificación, conteos y estimación sin llamar a Ollama, ni siquiera a sus endpoints de metadatos. `reuse_diagnostics` contiene estadísticas independientes de canonical, TM, caché, PDF y glosario. Los contadores independientes pueden superponerse; los contadores de resolución del pipeline siguen su prioridad y no deben sumarse con los diagnósticos como si fueran hits adicionales.

`bun x tsx scripts/auditCanonicalMemory.ts [moduleRoot] [historicalRoot]` escribe informes locales privados en `reports/canonical-memory/`. Verifica hashes de memoria, módulo y corpus histórico antes/después; no modifica las fuentes ni la memoria. `dry-run.json` incluye FILES, STRINGS, REUSE, PDF, AI, KPI, comparison, resolution y diagnósticos.

`resolution` informa `srd_es_entries_loaded`, `srd_en_entries_loaded` (segmentos elegibles y líneas de encabezado sellados), `srd_en_es_links` (alineaciones aprobadas), `ru_to_srd_verified_links` (bindings aprobados), `srd_es_field_hits`, `babele_entries_loaded`, `babele_ru_es_exact_candidates`, `babele_approved_hits`, `babele_historical_unverified_hits`, caché/glosario, cadenas resueltas, cadenas para IA y solicitudes estimadas. Un hit histórico sin revisión es únicamente cobertura candidata y nunca reduce el presupuesto de IA.

`strings_resolved_without_ai` incluye contenido protegido y decisiones explícitas de conservar original; `strings_resolved_by_approved_reuse` permite distinguir el ahorro atribuible a traducciones reutilizadas. `AI_avoidance_rate` usa strings únicas como denominador. Las llamadas estimadas pueden superar el número de strings porque cuentan fragmentos; no equivalen a reintentos reales.

No se exportan credenciales ni textos completos en el diagnóstico de mappings. Los informes privados contienen identidades, rutas y hashes. Los motivos se separan por población de entradas y unidades; `stage_diagnostics` es superpuesto, no reconciliable mediante suma.

## Continuación T077 — corpus histórico aprobado por el usuario

La declaración explícita del usuario del 2026-10-03 sustituye el estado de procedencia anterior: el corpus JSON histórico es `HISTORICAL_BABELE`, `USER_TRANSLATED`, `USER_APPROVED_TRANSLATION_CORPUS`. No verifica la identidad de documentos ni las alineaciones PDF. Los párrafos anteriores que describen el adaptador únicamente de lectura corresponden a la auditoría previa; ahora existe una acción separada de importación confiable y el análisis sigue siendo de solo lectura.

`store.json.version=1` incorpora opcionalmente `trusted_corpora`: un recibo por corpus con ID, raíz privada, fingerprint SHA-256 sobre archivos JSON, hashes de archivos, autor/fecha de aprobación y versión del importador. Las entradas existentes conservan IDs y contenido; no se reetiquetan candidatos del modelo ni PDF. Una reimportación del mismo snapshot conserva bytes, revisión, aprobación, timestamps y times_used. Un cambio de fingerprint produce `TRUSTED_SOURCE_CHANGED` y conserva el snapshot aprobado anterior; no se hereda confianza a archivos modificados.

Las entradas importadas guardan `MemoryEntry.historical`: `provenance`, `translation_origin`, `translation_approval`, `source_corpus`, `source_file`, `source_file_hash`, `entry_key`, `import_version=historical-tm-2`, `canonical_identity=UNKNOWN`, `reuse_policy`, `context`, `source_binding` y `occurrences`. Idiomas y textos usan los campos existentes `source_language`, `target_language`, `source_text`, `translated_text` (representación de target_text). No tienen canonical_uuid/canonical_evidence y siempre son EXACT_SOURCE_ONLY.

La aprobación de traducción y la asociación del texto fuente son ejes diferentes. `LITERAL_RU_KEY` prueba el nombre RU presente en el JSON histórico, incluso en items embebidos; solo se extrae su nombre traducido, sin ejecutar conversores ni inferir descripciones. `NATIVE_FIELD_PROJECTION` permite conservar una traducción histórica aprobada asociada por clave/ubicación candidata, pero no demuestra qué texto RU tenía originalmente ese campo: queda excluida de auto-reuse mediante `TM_SOURCE_BINDING_UNVERIFIED`. Una revisión explícita de la pareja puede establecer `USER_REVIEWED_PAIR`. Esta distinción no altera ni inventa identidad canónica.

`SAFE_EXACT` conserva el contexto de sistema, módulo, pack, tipo y campo. `CONTEXT_REQUIRED` añade la comprobación del contexto humano cuando está disponible y no admite un lookup sin los selectores requeridos. Cadenas cortas y términos polisémicos usan esta segunda política. `CONFLICT` crea entradas CANDIDATE/REVIEW_REQUIRED, diagnóstico TM_CONFLICT y ninguna aprobación automática. RESOLVE explícito puede resolver el grupo; reimportar no revierte rechazos ni restauraciones. Una decisión SAFE_EXACT del lookup significa que la pareja aprobada pasó también sus comprobaciones de contexto, aunque su política de entrada sea CONTEXT_REQUIRED.

Los contextos de pack provienen del manifest nativo, no de UUIDs inventados. Se conservan también para campos embebidos sin identidad canónica; las claves de deduplicación/caché distinguen packs en esas unidades. `TM_EXACT_APPROVED` y `HISTORICAL_BABELE` en la procedencia de ejecución incluyen referencia al recibo/corpus/archivo. El runtime lee únicamente la TM interna, sin consultar Babele, ejecutar sus conversores ni generar su formato.

Una pareja SRD validada tiene prioridad sobre memoria histórica. Protected tokens y validación del glosario explícito siguen los contratos existentes; se conserva la prioridad anterior para TM normal. `PdfReuse.spanishAuthority` declara SRD_ES/AUTHORITATIVE_REFERENCE únicamente para contenido SRD demostrado. `srdIdentityAudit` distingue IDs de extracción por hash/página/orden de identidades canónicas compartidas; semejanza estructural, números o títulos no verifica una pareja.

La caché sin descriptor se clasifica `LEGACY_CACHE_UNVERIFIED` y `getCache` nunca la devuelve, incluso si coincide una clave. No se borra al aprobar/revisar TM. Los registros actuales se verifican contra el descriptor esperado. Se conserva un registro legado en `legacy_cache` si una escritura nueva utiliza su misma clave. El límite de 5.000 se aplica a registros actuales; los 5.000 heredados quedan aislados y preservados. No hubo migración porque no se pudo reconstruir su perfil original determinísticamente.

Importación autorizada: `bun x tsx scripts/trustHistoricalCorpus.ts [moduleRoot] [corpusRoot] --user-approved-corpus`. Crea respaldo de memoria antes de la transacción, comprueba reimportación idempotente y originales intactos, y escribe `trusted-import.json`/`tm-conflicts.json`. En escritorio, la acción independiente exige declarar que el usuario tradujo/revisó el corpus y seleccionar su carpeta. Importar memoria candidata mantiene su comportamiento sin aprobación.

El nuevo dry-run conserva las secciones anteriores y añade BABELE, TM, SRD, CACHE y TOTAL, con contadores independientes y motivos. `babele_entries_loaded` cuenta entradas raíz del corpus, `babele_embedded_entries_loaded` las entradas anidadas inspeccionadas, `babele_unique_groups` grupos de parejas por contexto interno, `babele_approved_entries` variantes aprobadas y `babele_safe_exact_hits` unidades únicas realmente resueltas por la ruta histórica. No son la misma población. `babele_context_required` cuenta entradas sujetas a contexto; `tm_context_rejected` y `tm_source_binding_unverified` cuentan unidades rechazadas en lookup.

`hit-examples.json` demuestra hits históricos con el runtime real y la red bloqueada, sin publicar traducciones ni confirmar times_used. Una muestra histórica aprobada no es un mapping SRD VERIFIED. Si no hay bindings canónicos reales, la muestra SRD informa UNAVAILABLE y el criterio de 20 permanece pendiente. `production_baseline_accepted` sigue false hasta satisfacer la aceptación de T077; aumentar hits no la completa.

## Aceptación

Las 20 pruebas de bridge son sintéticas y verifican contratos, protección y ausencia de llamadas al proveedor; no demuestran 20 mappings reales. T077 permanece abierta hasta demostrar cobertura real aprobada y su ahorro. T043, T036 y T037 no se ejecutan en esta fase.
