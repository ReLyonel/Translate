# Trazabilidad del PRD

| Secciones PRD | Requisitos | Historias | Tareas |
|---|---|---|---|
| 1–6, 34–36 visión/integridad | FR-005 a 008; SC-001/002/003 | US1/US2 | T005–T009, T024 |
| 7–8, 17 JSON/validación | FR-005/006/007 | US1/US2 | T007–T009 |
| 9 JS; 31 fase 2 | fuera MVP; copia FR-009 | US4 | T014; roadmap |
| 10–11 referencias/técnicos | FR-006/007 | US2 | T007–T009 |
| 12–15 entrada/salida/UX | FR-001/002/003/008/013 | US1/US4/US6 | T002–T006, T014–T016, T020–T023 |
| 5, 14, 33 ruso | FR-004 | US3 | T010, T013 |
| 16, 24–25 estados/informe | FR-015/016/017 | US5 | T018, T019 |
| 18–20 glosario/memoria | FR-011/012 | US3 | T011–T013 |
| 21 proveedor | FR-010 | US3/US6 | T004, T022 |
| 22, 28 lotes/rendimiento | FR-003/009/013; SC-004 | US4 | T014–T016, T024 |
| 23 cancelación | FR-014; SC-005 | US5 | T017–T019 |
| 26–27 seguridad/privacidad | FR-008/017/018 | US1/US6 | T003–T005, T020–T022 |
| 29 MVP | FR-001 a FR-018 | US1–US6 | T001–T025 |
| 30 fuera MVP; 32 fase 3 | diferidos explícitos | roadmap | ninguna tarea MVP |

Prioridades ordenan ejecución sin degradar requisitos esenciales.
Estado documental: definido. Estado de producto: pendiente de evidencia.

## Avance desktop

T020/T022 verificadas. FR-001 entrega portable, prueba Windows 10 aún pendiente.
FR-002 selección nativa cubierta; lotes/contadores finales pendientes.
FR-018 local exclusivo y credenciales no aceptadas. T021/T023 parcialmente completadas.


## Trazabilidad vigente 2026-10-02

Auditoria: docs/AUDIT_V14_368.md. N026-N060 -> T030-T064 (offset +4); T001-T029 conservadas. Primera evidencia: T009/T054 diff y ubicaciones, T045 perfil y protocolo NOT_RUN, T053 golden sintetico; tests/golden/{golden,structuralDiff,placeholderIntegrity}.test.ts y pruebas de contratos. Todos incluidos en bun run test/CI. N051/N052 y T023 permanecen sin evidencia runtime requerida.

Version 0.4.1: 102 pruebas aprobadas, TypeScript/build/portable comprobados en Windows 11 sin Node en PATH. Este control no equivale a carga nativa Foundry14.368 ni a Windows10/maquina limpia. Memoria de corpus historico ya no se aplica automaticamente sin aprobacion/contexto; migracion prevista T030/T060.


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

Smoke del ejecutable empaquetado release/win-unpacked/Traductor Foundry.exe: PASS (exit0), ASAR/renderer cargados, bridge disponible, Node aislado, payload invalido rechazado, layouts sin overflow. Health local indica Ollama conectado y translategemma:27b instalado; no se tradujo corpus real ni se ejecuto Foundry. Portable electron-builder exit0; SHA-256 verificable en el artefacto entregado.


## Entrega de revision, procedencia e incremental (2026-10-02)

T059-T063 implementadas. Contrato normativo: [review-incremental.md](contracts/review-incremental.md). La vista Memoria y revision incorpora busqueda/paginacion, alternativas y ACCEPT/EDIT/REJECT/RESTORE/RESOLVE. Editar guarda candidata manual y exige aprobacion separada. Revision optimista y bloqueo durante trabajos protegen el estado; decisiones invalidan cache/inventario. La preferencia de original persiste hasta aceptacion explicita. Estadisticas se guardan en una transaccion por ejecucion validada.

Contextos acotados de texto humano y huella semantica separan system/module/document/field; los items embebidos usan su propio tipo. Conflictos exactos no eligen target global. Procedencia por unidad exporta hashes, productor real y estado de publicacion, sin narrativa privada. Reporte terminologico heuristico REVIEW_ONLY conserva variantes legitimas y separa modulo/sistema/idioma; no corrige automaticamente.

Inventario privado por module.json.id valido o raiz real conserva ubicaciones/hash/reuse_key/target/productor. Un modulo intacto evita llamadas IA sin omitir parse/proteccion/gates/copia completa. Configuracion, contexto y feedback pueden invalidar reutilizacion aun con fuente UNCHANGED. Solo una ejecucion completa PASS publica baseline; cancelacion, recuperacion o fallo previo al commit conservan la anterior. Entradas persistidas no se convierten en aprobadas por su uso.

340 pruebas/27 archivos PASS; pruebas con proveedores controlados, no benchmark linguistico ni runtime Foundry. TranslateGemma27B sigue predeterminado. T065 intacta, T055/T056 pospuestas. El esquema y limites de privacidad, contexto, almacenamiento y compatibilidad hacia atras quedan en el contrato.


Validacion final de entrega: lint/build PASS, portable Windows generado y smoke del ejecutable ASAR PASS (exit0). Vista Memoria y revision cargada, IPC disponible, revision/paginacion/conflictos verificados en lectura y payload de traduccion invalido rechazado. Informe local sin textos privados: reports/review-incremental/validation.json. Artefacto: release/Traductor-Foundry-0.4.1-x64.exe, SHA-256 18145f6695042cea21f3829a153b81dc4b4b1d9010dbee27bf82fe75b19426f1. No modifica decisiones de memoria durante smoke ni acredita aceptacion real Foundry.


## Incidente termico / reutilizacion: T069-T073 (2026-10-02)

Requisito urgente autorizado: no batching, no concurrencia adicional, reducir primero inferencia. Auditar ejecucion fifthpendium RU->ES y fuente manual C:/Users/leond/OneDrive/Escritorio/spanish. Base activa encontrada: 9918 candidatas RU->ES, cero aprobadas, 5000 cache y cero glosario persistente; no equivale al glosario del renderer. Historicos no cargados automaticamente en host por falta de idioma/aprobacion/contexto. Preservar datos y habilitar importacion por identidad verificable, sin promover resultados IA ni coincidencias por nombre.

Prioridad nueva del usuario, que sustituye la regla previa en caso de contradiccion: CANONICAL_APPROVED_TRANSLATION -> EXACT TM -> CACHE -> GLOSSARY -> FUZZY CONTEXT -> TRANSLATEGEMMA. Elegir original/rechazar y validacion tecnica siguen precediendo toda reutilizacion. Canonica exige modulo/pack/_id/UUID/campo/sistema/version y target aprobado no conflictivo; PDFs y converters complejos no acreditan identidad y quedan fuera del importador inicial. Salida sigue siendo nativa, sin Babele.

Contrato: [thermal-memory-preflight.md](contracts/thermal-memory-preflight.md). Telemetria opcional solo lectura, pausa propia con cancelacion y reanudacion conservadora; sensor ausente null, sin garantia sobre GPU usada por otros procesos o VRAM no observable. Prompt TranslateGemma especifico, una unidad/solicitud, marcadores opacos y validacion estricta; num_ctx4096 y presupuesto UTF-8 conservador incluyendo output. No se cambian motores por velocidad ni se instalan modelos.

Preflight es lectura previa a inferencia, sellado por hash de inventario/configuracion/revision y revisado antes de destino/ejecucion. Estimacion sin reintentos/fallos y con archivos no elegibles declarados; deteccion de fuente invalida antes del proveedor evita trabajo que terminaria recuperado. No modifica originales. Importar memoria crea candidatas por defecto; la aprobacion requiere autoridad explicita. No hay importacion al userData desde los scripts de auditoria.

T043 se adelanta tras esta fase; medir EN/RU con corpus identico, calidad y sensores disponibles, conservar27B predeterminado. T036/T037 no se implementan y T065 no cambia. La aceptacion real Foundry y la comparacion12B/27B conservan estado NOT_RUN.


## T075

Requisito: SRD verificado, reutilizacion aprobada y proteccion nativa. Implementacion: desktop/memory/{pdfCorpus,pdfAlignment,pdfReuse,store}.ts, runtime/preflight, IPC y TranslationReview. Contrato: contracts/pdf-srd-reuse.md. Evidencia: tests/memory/pdfReuse.test.ts (18) y tests/golden/pdfMemory.test.ts (2); 385 pruebas/33 archivos totales PASS. Fuente alterada, conflictos, revision separada, RU/EN, HTML/UUID/rolls y fallback protegidos. Portable 0.4.4 build/smoke PASS. Sin inferencia real ni aceptacion Foundry14.368; aprobaciones reales siguen pendientes.


## T076/T077 y T044/T043

Clasificacion por evidencia separada del estado de aprobacion, grupos normalizados y propagacion atomica VERIFIED. Varios scores altos o identidad aislada no certifican alineacion bilingue. Vinculos RU exigen identidad Foundry completa y pareja SRD previamente aprobada; el JSON importado permanece candidato. Corpus/gate de regresiones y benchmark con memoria aislada, mismo corpus/modelos e informe sin inferencia antes de GPU. Contratos: [pdf-resolution.md](contracts/pdf-resolution.md); benchmark: [BENCHMARK.md](../../docs/BENCHMARK.md). T077 y benchmark real siguen pendientes: cobertura actual cero.


### Cierre T016/T017/T019/T010-T013 (2026-10-03)

Requisitos cerrados sobre host desktop existente, sin duplicar jobRunner/jobMemory propuestos. Regresiones directory/cancellation/languagesAndMemory/sourceLanguage; detector EN/RU conservador compartido y terminologia efectiva comun runtime/preflight. Priorizacion vigente de reutilizacion preservada. 510 tests,lint/build PASS; unico dry-run FifthPendium offline sin mutar fuentes/memoria. Resultados y limites en [REQUIREMENTS_CLOSURE.md](../../docs/REQUIREMENTS_CLOSURE.md). T036/T037/T043/T065/T077 suspendidas; migracion de esquemas fuera de alcance.
