# Modelo de datos propuesto

> Alcance vigente 2026-10-03: [P0 producto / P1 calidad / P2 optimizacion](../../docs/MVP_SCOPE.md). Overlay predeterminado; copia completa opcional. T077 no bloquea el MVP; T043/T036/T037/T065 siguen suspendidas. Esta correccion prevalece sobre el alcance historico siguiente.

Armonizar nombres con src/types/index.ts sin romper contratos actuales.

## TranslationJob

id, inputKind=file|directory, selectionHandle, outputRoot, providerId;
sourceLanguage=auto|en|ru; targetLanguage=es; glossaryVersion, rulesVersion;
state=CREATED|SCANNING|RUNNING|CANCELLING|COMPLETED|CANCELLED|FAILED;
createdAt, finishedAt, contadores, archivos.
Destino nuevo e independiente validado por ruta resuelta en host.
Transiciones CREATED -> SCANNING -> RUNNING -> COMPLETED; activos -> CANCELLING
-> CANCELLED; fallo fatal -> FAILED. Error de archivo no implica FAILED global.
Confirmación de cancelación impide nuevos commits.

## FileJob

id, jobId, relativePath, format, originalHash, outputPath;
state=QUEUED|EXTRACTING|TRANSLATING|VALIDATING|COMMITTING|FINISHED;
outcome=TRANSLATED|NO_TRANSLATABLE_CONTENT|SKIPPED|WARNING|ERROR;
severity=OK|WARNING|ERROR; warnings, errorCode, translatedUnitCount, outputPublished.
outcome y severity son nulos antes de FINISHED. ERROR nunca significa traducción
publicada, aunque exista copia original.
Contadores: found=descubiertos; compatible=JSON; processed=estado final;
translated=TRANSLATED; unchanged=NO_TRANSLATABLE_CONTENT; skipped=SKIPPED;
warnings/errors=severidad. Informe añade pendientes/cancelados para reconciliar.

## TranslationUnit / ProtectedToken

Unidad: id, fileId, ubicación por segmentos clave/índice, sourceText, idioma,
classification=SAFE|PROTECTED|UNCERTAIN, protectedText, contextHash, tokens.
Token: id único, kind, originalValue, occurrence, ubicación.
Restauración exige cada token exactamente una vez y ninguna referencia nueva.

## ValidationResult

fileId, syntaxValid, structureValid, protectedValuesValid, placeholderErrors,
issues {ubicación,código,mensaje}; passed equivale a todos los checks válidos.
Claves, tipos, longitud/orden de arrays y valores no elegibles se conservan.

## GlossaryTerm / MemoryEntry

Término: source, target, sourceLanguage, targetLanguage=es, contexto, userDefined.
Conflictos explícitos resueltos antes de iniciar; userDefined prevalece.
Memoria: id/hash, source, target, idiomas, contextHash, glossaryVersion, rulesVersion,
providerId, status=APPROVED|CANDIDATE|REJECTED, createdAt, validationPassed.
Solo APPROVED con validationPassed y contexto compatible se reutiliza.
Persistencia atómica; error/abort no aprueban entradas.

## ProviderConfig

id, executionMode=LOCAL|EXTERNAL, model, endpoint, timeout, credentialReference,
capacidades. Secretos solo host, nunca renderer, informe o salida.


## Configuración implementada 0.3.0

ProviderSettings: provider=ollama|libretranslate (por defecto ollama), endpoint local Ollama, model=translategemma:12b|translategemma:27b en UI, libreEndpoint local, fallback boolean (por defecto false). Se conserva compatibilidad con configuraciones previas endpoint/model.

BatchProgress incremental: id, state=RUNNING|COMPLETED|CANCELLED|ERROR, total JSON, completed JSON procesados (incluye copias originales por fallo), failed JSON sin traducir, current ruta relativa y errors sin respuestas del modelo. El host conserva el último snapshot durante la sesión. No equivale todavía al contrato persistente completo del MVP.
## Contratos de aprendizaje previstos — 2026-10-02

Los siguientes contratos guían T030–T064; no son almacenamiento ya implementado.

MemoryEntry separa:

- **Identidad:** source_text exacto Unicode/espacios/case, translated_text, source_language=en|ru, target_language=es. Hash estable no aplica lowercase ni colapsa espacios como exact match.
- **Contexto semántico:** system, module, document_type, field_type, surrounding_context y compatibilidad de reglas/perfil/glosario. json_path por segmentos registra ubicación; no necesariamente forma parte de la identidad ni impide reutilizar ubicaciones compatibles.
- **Confianza:** status=CANDIDATE|APPROVED|REJECTED, approved, validationPassed, aprobación manual/autoridad identificable y reglas de revisión. Resultado de proveedor y aprobación son hechos distintos.
- **Procedencia:** translation_engine, model, prompt_version, source_document, file/location, provenance=GLOSSARY|TM_EXACT|TM_FUZZY_CONTEXT|CACHE|TRANSLATEGEMMA|MANUAL|ORIGINAL_FALLBACK. Fuzzy describe contexto, nunca autoría automática de la traducción final.
- **Estadísticas:** times_used, created_at, updated_at; usos confiables se actualizan después de validación/publicación, no por respuestas fallidas o canceladas.

CacheKey: source_language, target_language, source_text exacto, glossary_version, translation_engine/model efectivos, prompt_version, rules_version, profile y contexto compatible. CacheEntry guarda resultado validado/procedencia; no promueve entrada a APPROVED. Hits se revalidan. Fallback LibreTranslate debe registrar el proveedor real y nunca etiquetar su resultado como 27B.

TranslationUnit requiere id estable dentro de ejecución, segmentos clave/índice sin concatenación ambigua, fuente protegida, idioma/contexto/procedencia y estados de validación. FileJob diferencia errores STRING/FILE/JOB y outputKind=TRANSLATED|ORIGINAL_FALLBACK|UNCHANGED; COMPLETED solo con gate PASS. processed no es sinónimo de translated.

RunReport incluye resumen/errores/advertencias/omitidos, métricas N038, versión app/perfil/reglas y contadores reconciliados. Diagnostics usa allowlist file/json_path/document_type/field/languages/status/reason/provider/model/recovery_action/timestamp; sin fuente completa, credenciales ni respuesta cruda. Almacenamiento host userData/logs, rotación/retención acotadas.



## Incremento de reutilizacion y diagnostico (2026-10-02)

T030-T035, T038-T042 y T051-T052 implementadas en host desktop, sin cambiar los formatos nativos publicados. Contrato normativo: [translation-reuse-diagnostics.md](contracts/translation-reuse-diagnostics.md). Memoria/contexto/procedencia/estadisticas separados; CANDIDATE no aprobado por defecto, exact requiere aprobacion/contexto/reglas y fuzzy solo da contexto. Cache versionada y glosario persistente scoped, hits revalidados, dedup conserva referencias/case/espacios. Store unico con escritura serial/fsync/rename; no migracion automatica del corpus historico. CLI de revision/glosario disponible con aplicacion cerrada; UI de feedback T060 entregada en el incremento posterior descrito al final de este documento.

Runtime reutiliza proveedores y gates existentes; metadatos sourceText por unidad vinculados a placeholders permiten claves seguras. Validacion sospechosa/idioma precede cache/candidato; critica conserva original por unidad y archivo WARNING; advertencias no cuentan como COMPLETED validado. Logs con allowlist y reportes schema_version1 privados bajo userData, exportacion nativa, politicas de retencion y metricas HTTP/monotonic. Archivos fuente/recursos/localizaciones adicionales mantienen contadores distintos. Esquemas, ejemplos, limites y comandos en el contrato.

Se consolidan componentes estrechamente relacionados en MemoryStore/TranslationRuntime/RunLogger en vez de crear modulos vacios separados para cada tarea. TranslateGemma27B permanece principal; T065 no modificada. Runtime Foundry14.368 T055/T056 permanece NOT_RUN; las pruebas automatizadas no acreditan calidad real del modelo. Dependencias globales pendientes mantienen su estado.


## Entrega de revision, procedencia e incremental (2026-10-02)

T059-T063 implementadas. Contrato normativo: [review-incremental.md](contracts/review-incremental.md). La vista Memoria y revision incorpora busqueda/paginacion, alternativas y ACCEPT/EDIT/REJECT/RESTORE/RESOLVE. Editar guarda candidata manual y exige aprobacion separada. Revision optimista y bloqueo durante trabajos protegen el estado; decisiones invalidan cache/inventario. La preferencia de original persiste hasta aceptacion explicita. Estadisticas se guardan en una transaccion por ejecucion validada.

Contextos acotados de texto humano y huella semantica separan system/module/document/field; los items embebidos usan su propio tipo. Conflictos exactos no eligen target global. Procedencia por unidad exporta hashes, productor real y estado de publicacion, sin narrativa privada. Reporte terminologico heuristico REVIEW_ONLY conserva variantes legitimas y separa modulo/sistema/idioma; no corrige automaticamente.

Inventario privado por module.json.id valido o raiz real conserva ubicaciones/hash/reuse_key/target/productor. Un modulo intacto evita llamadas IA sin omitir parse/proteccion/gates/copia completa. Configuracion, contexto y feedback pueden invalidar reutilizacion aun con fuente UNCHANGED. Solo una ejecucion completa PASS publica baseline; cancelacion, recuperacion o fallo previo al commit conservan la anterior. Entradas persistidas no se convierten en aprobadas por su uso.

340 pruebas/27 archivos PASS; pruebas con proveedores controlados, no benchmark linguistico ni runtime Foundry. TranslateGemma27B sigue predeterminado. T065 intacta, T055/T056 pospuestas. El esquema y limites de privacidad, contexto, almacenamiento y compatibilidad hacia atras quedan en el contrato.


## Incidente termico / reutilizacion: T069-T073 (2026-10-02)

Requisito urgente autorizado: no batching, no concurrencia adicional, reducir primero inferencia. Auditar ejecucion fifthpendium RU->ES y fuente manual C:/Users/leond/OneDrive/Escritorio/spanish. Base activa encontrada: 9918 candidatas RU->ES, cero aprobadas, 5000 cache y cero glosario persistente; no equivale al glosario del renderer. Historicos no cargados automaticamente en host por falta de idioma/aprobacion/contexto. Preservar datos y habilitar importacion por identidad verificable, sin promover resultados IA ni coincidencias por nombre.

Prioridad nueva del usuario, que sustituye la regla previa en caso de contradiccion: CANONICAL_APPROVED_TRANSLATION -> EXACT TM -> CACHE -> GLOSSARY -> FUZZY CONTEXT -> TRANSLATEGEMMA. Elegir original/rechazar y validacion tecnica siguen precediendo toda reutilizacion. Canonica exige modulo/pack/_id/UUID/campo/sistema/version y target aprobado no conflictivo; PDFs y converters complejos no acreditan identidad y quedan fuera del importador inicial. Salida sigue siendo nativa, sin Babele.

Contrato: [thermal-memory-preflight.md](contracts/thermal-memory-preflight.md). Telemetria opcional solo lectura, pausa propia con cancelacion y reanudacion conservadora; sensor ausente null, sin garantia sobre GPU usada por otros procesos o VRAM no observable. Prompt TranslateGemma especifico, una unidad/solicitud, marcadores opacos y validacion estricta; num_ctx4096 y presupuesto UTF-8 conservador incluyendo output. No se cambian motores por velocidad ni se instalan modelos.

Preflight es lectura previa a inferencia, sellado por hash de inventario/configuracion/revision y revisado antes de destino/ejecucion. Estimacion sin reintentos/fallos y con archivos no elegibles declarados; deteccion de fuente invalida antes del proveedor evita trabajo que terminaria recuperado. No modifica originales. Importar memoria crea candidatas por defecto; la aprobacion requiere autoridad explicita. No hay importacion al userData desde los scripts de auditoria.

T043 se adelanta tras esta fase; medir EN/RU con corpus identico, calidad y sensores disponibles, conservar27B predeterminado. T036/T037 no se implementan y T065 no cambia. La aceptacion real Foundry y la comparacion12B/27B conservan estado NOT_RUN.
# Memoria documental PDF verificada

Ampliación T074: registro privado independiente `pdf-reference/index.json`, schema_version1, fuentes verificadas por el usuario, hash, idioma, páginas y segmentos. No cambia aprobación de `MemoryEntry`. Las páginas/segmentos extraídos conservan procedencia en archivos JSONL privados. `pdf_memory` separa referencia documental de pares TM aprobados en preflight/reportes. Contrato: [verified-pdf-memory.md](contracts/verified-pdf-memory.md). T075 cubrirá correspondencias bilingües y recuperación contextual/canónica segura; no existe enlace Foundry automático a partir del PDF.



## T075 - Memoria PDF SRD

T075: MemoryEntry.pdf contiene edition, source/target pointers (document,segment,page,text_hash), kind, method, score, edited y binding opcional (source_hash,source_excerpt,source_text,usage EXACT|CONTEXT_ONLY). Binding requiere identidad/ version/ruta Foundry y segunda aprobacion; texto completo solo en memoria privada. Contrato: [pdf-srd-reuse.md](contracts/pdf-srd-reuse.md).


## T076/T077 y T044/T043

Clasificacion por evidencia separada del estado de aprobacion, grupos normalizados y propagacion atomica VERIFIED. Varios scores altos o identidad aislada no certifican alineacion bilingue. Vinculos RU exigen identidad Foundry completa y pareja SRD previamente aprobada; el JSON importado permanece candidato. Corpus/gate de regresiones y benchmark con memoria aislada, mismo corpus/modelos e informe sin inferencia antes de GPU. Contratos: [pdf-resolution.md](contracts/pdf-resolution.md); benchmark: [BENCHMARK.md](../../docs/BENCHMARK.md). T077 y benchmark real siguen pendientes: cobertura actual cero.

T077 añade `MemoryEntry.canonical_evidence` opcional, con match_type, decision, procedencia, aprobación e identidad/hash por campo, y `reuse_scope=EXACT_SOURCE_ONLY` para impedir que una entrada histórica textual se convierta en bridge multilingüe por sí sola. CacheRecord.identity es opcional para mantener compatibilidad con 5.000 registros antiguos. `reuse_diagnostics` separa poblaciones de entradas/unidades y motivos; los hits históricos sin revisión nunca cuentan como reutilización aprobada. Contrato: [canonical-reuse-audit.md](contracts/canonical-reuse-audit.md).

Continuación T077: `trusted_corpora` almacena la aprobación explícita y fingerprint del corpus; `MemoryEntry.historical` almacena procedencia, aprobación de traducción, fuente/archivo/clave, versión, contexto, políticas y asociación de fuente. canonical_identity permanece UNKNOWN, sin UUID ni evidencia canónica. source_binding diferencia LITERAL_RU_KEY, NATIVE_FIELD_PROJECTION y USER_REVIEWED_PAIR; la proyección sin verificar no autoriza auto-reuse. Conflictos siguen CANDIDATE/REVIEW_REQUIRED. MemoryContext.pack conserva contexto de manifest también en campos embebidos; legacy_cache preserva registros opacos cuando una clave es reemplazada por caché actual. UnitProvenance.historical_reference expone la cadena de procedencia sin copiar textos completos a logs.

## Publicacion implementada 2026-10-03

BatchProgress.outputStrategy = TRANSLATION_OVERLAY | FULL_PORTABLE_COPY. PublicationCounters conserva files_scanned, files_translated, files_unchanged, files_written, assets_skipped y bytes_avoided. FileOutcome.written separa validacion de escritura fisica: UNCHANGED validado no se escribe en overlay. Detalle y reconciliacion: [output-strategies.md](contracts/output-strategies.md).
