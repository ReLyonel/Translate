# Implementation Plan: Traductor Foundry MVP

> Alcance vigente 2026-10-03: [P0 producto / P1 calidad / P2 optimizacion](../../docs/MVP_SCOPE.md). Overlay predeterminado; copia completa opcional. T077 no bloquea el MVP; T043/T036/T037/T065 siguen suspendidas. Esta correccion prevalece sobre el alcance historico siguiente.

**Branch**: rama actual conservada | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)
**Input**: specs/001-foundry-translator-mvp/spec.md
**Status**: arquitectura Electron ejecutada; ampliación nativa planificada y primer incremento de integridad implementado.

## Summary

Reutilizar React/TypeScript: extracción -> glosario/memoria -> protección -> proveedor
-> restauración -> validación -> publicación atómica. Añadir host desktop, trabajos
recursivos y cancelación.

## Technical Context

**Language/Version**: TypeScript según package.json/tsconfig existentes.
**Primary Dependencies**: React 19, Vite, Vitest, Electron, electron-builder y Ollama local.
**Storage**: salida independiente (overlay o copia completa), memoria JSON atomica versionada en datos del usuario y referencias PDF privadas.
**Testing**: Vitest motores/contratos; smoke manual Windows y Foundry.
**Target Platform**: Windows 10/11 .exe.
**Project Type**: desktop con renderer React y host Node aislado.
**Performance Goals**: corpus SC-004 y cancelación SC-005.
**Constraints**: originales intactos, ninguna traducción publicada sin validación.
**Scale/Scope**: miles de archivos/cadenas; solicitudes GPU seriales. Batching y concurrencia permanecen suspendidas.
**Desktop Decision**: Electron propuesto por reutilización Node/React; no instalado.
T001 valida compatibilidad, versiones y licencias antes de incorporarlo.

## Constitution Check

| Gate | Cumplimiento de diseño | Evidencia pendiente |
|---|---|---|
| Integridad | validar antes de commit, ambiguos intactos | T007–T009 |
| Originales | destino nuevo, temporales y rename | T002–T006 |
| Privacidad | proveedor host, metadatos local/externo | T004, T022 |
| Reutilización | motores existentes e IPC acotado | T001, T020 |
| Verificación | regresiones, progreso e informes | T006–T025 |

Revisión antes/después del diseño: sin excepciones constitucionales. Gates del producto
pendientes hasta ejecutar tareas; cumplimiento de diseño no acredita implementación.

## Project Structure

### Documentation (this feature)

spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md,
traceability.md, contracts/desktop-api.md y checklists/requirements.md.

### Source Code (repository root)

Existentes: src/components/, src/types/, src/services/{json,protected-content,
validation,translation,terminology}/, server.ts, scripts/ y .github/workflows/ci.yml.
Propuestos: desktop/{main,preload,build.config}.ts; src/services/jobs/{jobTypes,
fileDiscovery,atomicWriter,jobRunner,jobReport}.ts; servicios translation/{provider,
languageDetector,jobMemory}.ts; componentes BatchTranslator/JobReport; tests/jobs,
tests/contracts y tests/fixtures.

**Structure Decision**: FS y secretos en host; renderer sin Node ni ejecución de
módulos. IPC tipado con handles de selección, sin rutas arbitrarias. Servidor HTTP eliminado; IPC explícito exclusivamente desktop. Runtime Node incluido en .exe.

## Delivery & Validation

Fundaciones -> archivo/integridad/EN-RU -> lotes/cancelación -> host/.exe -> release.
Cada incremento verifica su historia y registra evidencia en tasks.md.

## Complexity Tracking

Sin excepciones; host desktop cubre diálogos y acceso nativo ausentes en navegador.


## Implementación incremental 0.3.0

`desktop/providers.ts`: interfaz y registro Ollama/LibreTranslate, fallback y glosario común. `desktop/jobs.ts`: lote recursivo independiente de Electron con escritura sin reemplazo, copia de recursos, validación y cancelación. `desktop/main.ts` administra diálogos, handles, snapshot de progreso y AbortController; el renderer consume el bridge. Esta implementación es incremental y no sustituye los contratos futuros de memoria aprobada/reanudación definidos para el MVP completo.


## Raíz de módulo 0.4.0

`desktop/moduleDiscovery.ts` determina JSON en `_source` bajo pack/packs y scripts JS/MJS/CJS. `desktop/scriptTranslation.ts` usa Acorn para analizar, editar literales visibles y validar sin ejecutar scripts. `desktop/jobs.ts` mantiene un modo genérico interno; Electron solicita modo module y copia todos los recursos y directorios. Se escapan delimitadores y se preservan interpolaciones. La protección técnica usa una única pasada sobre el original para evitar referencias que consuman marcadores insertados.


## Plan vigente 2026-10-02

Auditar y reutilizar desktop/jobs/providers/main, JsonEngine, ProtectedContentEngine, FoundryValidator y Acorn. No refactor masivo ni traslado del backend. Primero cerrar diff/parse/tokens/gate; luego logs/diagnosticos y memoria aprobada. Cache/dedup y calidad despues; batching con IDs antes de concurrencia, GPU concurrency=1 por defecto. Benchmark reproducible antes/despues; mantener27B.

TM nueva host: identidad exacta preservando texto y lenguaje; contexto system/module/document/field/segments y versiones; provenance provider/model/prompt; estadisticas dates/timesUsed separadas. Migrar corpus historicos como candidatos, nunca aprobar solo por score ni reutilizar subfrases como exact. UI conserva glosario actual y agrega revision/ambitos progresivamente.

Logs host userData/logs y runs, allowlist sin secretos/texto completo, rotacion/retencion. Estados FileJob complementan API actual con campos aditivos; processed no equivale a translated. Publicacion sin overwrite requiere gate y validacion del temporal. El usuario desempaqueta y reempaqueta con herramienta compatible; automatizar packs queda pospuesto, nunca ejecutar binarios arbitrarios. Pruebas reales Foundry con version/build/system/mundo/Babele ausente evidenciados, no inferir PASS de validadores locales.

Dependencias y paralelismo: tasks.md fases10-15. Auditoria/certezas: docs/AUDIT_V14_368.md. Perfil: docs/FOUNDRY_V14_368.md.


## Ajuste autorizado: fuentes preparadas (2026-10-02)

El usuario desempaqueta y reempaqueta los packs. La reconstruccion automatica queda fuera del camino critico; T055 conserva aceptacion real del paquete recompilado. T065 completa este contrato; T066 genera localizaciones ES conservando claves; T067 permite solo registro aditivo seguro en languages de module.json; T068 agrega corpus real de lectura bajo la carpeta modules autorizada y regresiones. No cambiar compatibility/coreTranslation ni entradas ES existentes. No acreditar Foundry por traduccion de fuentes. Alcance y criterios: [SOURCE_TRANSLATION_SCOPE.md](../../docs/SOURCE_TRANSLATION_SCOPE.md). T001-T064 conservadas.


### Entrega T066-T068

Localizacion nativa implementada como etapa post-copia en jobs; archivos separados por entrada EN/RU y registro aditivo exclusivo de languages. ES existente se conserva; fallo revierte archivos nuevos y mantiene manifiesto. Contrato normativo: [native-localization.md](contracts/native-localization.md). 127 pruebas/lint/build PASS; corpus real identidad en tres modulos con originales intactos, calidad/runtime NOT_RUN. No completa las dependencias generales de publicacion/gate ni T055/T056.


### T055-T056 parcialmente implementadas

Verificador local, sonda browser de Foundry y evaluador de evidencia entregados con 24 pruebas nuevas (151 total). Contrato [native-acceptance.md](contracts/native-acceptance.md). Foundry instalado14.364 no acredita14.368; usuario pospone prueba real. T055/T056 permanecen abiertas. No se actualiza core ni se ejecutan mundos personales.


### Integridad/publicacion/recuperacion entregadas

T049/T050/T064/T057/T058 completadas en alcance local, reglas integrity-3; recuperar textos seguros sin marcar COMPLETED cuando hubo fallback. Writer comun en jobs/main/localizacion, fsync y gate antes/despues del temporal. 192 pruebas/lint/build PASS. Contrato [integrity-publication.md](contracts/integrity-publication.md). Runtime Foundry sigue sin acreditar.


### T007/T008/T046-T048: cierre local de contenido

Clasificacion por ancestros tecnicos/case, HTML lexical compartido y regresiones por ubicacion. Reglas integrity-4. 251 tests/lint/build PASS; corpus4073 JSON con2 warnings y originales intactos. Contrato [foundry-content-integrity.md](contracts/foundry-content-integrity.md). Evidencia privada bajo reports/foundry-coverage; runtime14.368 sigue NOT_RUN en T055/T056.


## Incremento de reutilizacion y diagnostico (2026-10-02)

T030-T035, T038-T042 y T051-T052 implementadas en host desktop, sin cambiar los formatos nativos publicados. Contrato normativo: [translation-reuse-diagnostics.md](contracts/translation-reuse-diagnostics.md). Memoria/contexto/procedencia/estadisticas separados; CANDIDATE no aprobado por defecto, exact requiere aprobacion/contexto/reglas y fuzzy solo da contexto. Cache versionada y glosario persistente scoped, hits revalidados, dedup conserva referencias/case/espacios. Store unico con escritura serial/fsync/rename; no migracion automatica del corpus historico. CLI de revision/glosario disponible con aplicacion cerrada; UI de feedback T060 entregada en el incremento posterior descrito al final de este documento.

Runtime reutiliza proveedores y gates existentes; metadatos sourceText por unidad vinculados a placeholders permiten claves seguras. Validacion sospechosa/idioma precede cache/candidato; critica conserva original por unidad y archivo WARNING; advertencias no cuentan como COMPLETED validado. Logs con allowlist y reportes schema_version1 privados bajo userData, exportacion nativa, politicas de retencion y metricas HTTP/monotonic. Archivos fuente/recursos/localizaciones adicionales mantienen contadores distintos. Esquemas, ejemplos, limites y comandos en el contrato.

Se consolidan componentes estrechamente relacionados en MemoryStore/TranslationRuntime/RunLogger en vez de crear modulos vacios separados para cada tarea. TranslateGemma27B permanece principal; T065 no modificada. Runtime Foundry14.368 T055/T056 permanece NOT_RUN; las pruebas automatizadas no acreditan calidad real del modelo. Dependencias globales pendientes mantienen su estado.

Evidencia: 297 tests/23 archivos PASS, lint/build PASS; smoke de Electron PASS y portable Windows actualizado. Pruebas mock de EN/RU y corpus sintetico no acreditan calidad del modelo real ni runtime Foundry.


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


### Memoria PDF verificada

Reutilizar pdf_corpus.py para indexado privado, con registro de verificación documental y estadística separada de aprobación TM. T074 cubre fuente/indexado/preflight/reportes; T075 cubre alineación y recuperación segura, sin inferencia durante importaci?n ni asociaciones por nombre/página sin prueba. No migrar masivamente store.json ni aprobar JSON.


## T075 - Memoria PDF SRD

T075 mantiene el pipeline existente y agrega PdfCorpus/PdfReuse/PdfAlignment; porta la heuristica existente al host TS para ejecutar sin Python. Corpus sellado, indice por contexto, fingerprint de cache y marcador /pdf-srd-1 preservan seguridad y compatibilidad. Sin batching/concurrencia/refactor masivo. Contrato: [pdf-srd-reuse.md](contracts/pdf-srd-reuse.md).


## T076/T077 y T044/T043

Clasificacion por evidencia separada del estado de aprobacion, grupos normalizados y propagacion atomica VERIFIED. Varios scores altos o identidad aislada no certifican alineacion bilingue. Vinculos RU exigen identidad Foundry completa y pareja SRD previamente aprobada; el JSON importado permanece candidato. Corpus/gate de regresiones y benchmark con memoria aislada, mismo corpus/modelos e informe sin inferencia antes de GPU. Contratos: [pdf-resolution.md](contracts/pdf-resolution.md); benchmark: [BENCHMARK.md](../../docs/BENCHMARK.md). T077 y benchmark real siguen pendientes: cobertura actual cero.

### T077 — auditoría implementada, aceptación real pendiente

Reutilizar PdfCorpus/PdfReuse/canonicalResolution y el pipeline existente. Añadir canonicalEvidence, reuseAudit y el adaptador histórico de solo lectura historicalBabeleImport; extender caché con descriptores opcionales sin cambiar claves ni migrar la memoria privada. Inventory registra referencias explícitas/identificadores como evidencia candidata, nunca aprobación. Preflight offline omite todas las consultas HTTP a Ollama y muestra diagnósticos por motivo en escritorio. El CLI verifica invariantes por fingerprint y produce baseline comparable.

No buscar un corpus nativo ES inexistente. No autoaprobar históricos ni PDF por identidad o similitud aisladas. Las pruebas de 20 campos canónicos son sintéticas y se distinguen de los 20 mappings reales exigidos. La aceptación restante depende de evidencia bilingüe/identidad SRD real, no de cambios para elevar porcentajes. Contrato: [canonical-reuse-audit.md](contracts/canonical-reuse-audit.md).

Continuación T077 con declaración explícita de corpus aprobado: historicalTrust define recibos, políticas y contextos; historicalBabeleImport extrae nombres RU literales y referencias de procedencia sin conversores. MemoryStore importa/aprueba una transacción por corpus, separa source_binding de canonical_identity y conserva caché antigua. Resolver exacto admite históricos compatibles sin UUID; SRD validado precede al histórico. Se reutilizan revisión, quality gate, publicación y proveedores existentes. Se añaden IPC/UI para declarar corpus revisado, diagnóstico por fuente y pruebas de disco/idempotencia/conflictos/embebidos. El CLI importador respalda la base; el dry-run genera comparativa y muestras con red bloqueada. No batching/concurrencia/benchmark/inferencia masiva.


### Cierre T016/T017/T019/T010-T013 (2026-10-03)

Requisitos cerrados sobre host desktop existente, sin duplicar jobRunner/jobMemory propuestos. Regresiones directory/cancellation/languagesAndMemory/sourceLanguage; detector EN/RU conservador compartido y terminologia efectiva comun runtime/preflight. Priorizacion vigente de reutilizacion preservada. 510 tests,lint/build PASS; unico dry-run FifthPendium offline sin mutar fuentes/memoria. Resultados y limites en [REQUIREMENTS_CLOSURE.md](../../docs/REQUIREMENTS_CLOSURE.md). T036/T037/T043/T065/T077 suspendidas; migracion de esquemas fuera de alcance.
