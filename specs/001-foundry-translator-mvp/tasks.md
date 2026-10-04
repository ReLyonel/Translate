# Tasks: Traductor Foundry MVP

> Alcance vigente 2026-10-03: [P0 producto / P1 calidad / P2 optimizacion](../../docs/MVP_SCOPE.md). Overlay predeterminado; copia completa opcional. T077 no bloquea el MVP; T036/T037/T065/T077 siguen suspendidas. T043 ejecutada como benchmark, sin aprobar un ganador de produccion. Esta correccion prevalece sobre el alcance historico siguiente.

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/desktop-api.md.
**Status**: implementación incremental; auditoría vigente en docs/AUDIT_V14_368.md.
**Tests**: requeridos por spec para integridad, contratos y disco.

## Phase 1: Setup

- [ ] T001 Revisar compatibilidad Electron/React/Node, versiones/licencias y runtime producción; registrar decisión en specs/001-foundry-translator-mvp/research.md y package.json.

## Phase 2: Foundational

- [ ] T002 Definir tipos en src/services/jobs/jobTypes.ts: sourceLanguage=auto|en|ru; targetLanguage=es; estados, ubicaciones por segmentos; outcome/severity nulos antes de FINISHED según data-model.md.
- [ ] T003 Implementar selección autorizada, destinos nuevos fuera de origen y recorrido sin enlaces/junctions en src/services/jobs/fileDiscovery.ts.
- [ ] T004 Definir proveedor con executionMode=LOCAL|EXTERNAL, resultados unitId uno a uno, timeout y AbortSignal en src/services/translation/provider.ts; adaptar server.ts y translationService.ts manteniendo UI actual.

## Phase 3: US1 - Archivo (P1)

**Goal**: copia segura individual. **Independent Test**: quickstart escenario 1.

- [ ] T005 [US1] Implementar temporal/rename sin reemplazo y limpieza en src/services/jobs/atomicWriter.ts; nunca escribir original ni publicar sin passed.
- [ ] T006 [US1] Orquestar archivo, extracción/proveedor/validación/publicación en src/services/jobs/jobRunner.ts; verificar hash original y fallos disco/proveedor en tests/jobs/singleFile.test.ts.

## Phase 4: US2 - Integridad (P1)

**Goal**: contenido técnico intacto. **Independent Test**: quickstart escenario 3.

- [x] T007 [US2] Añadir regresiones por ubicación para referencias PRD, HTML, arrays/tipos y tokens adversariales en src/services/foundryPipeline.test.ts y tests/fixtures/foundry/.
- [x] T008 [US2] Reforzar clasificación conservadora/claves duplicadas en src/services/json/jsonEngine.ts y protección/restauración de cada token exactamente una vez en src/services/protected-content/protectedContentEngine.ts.
- [x] T009 [US2] Comparar estructura, orden arrays y valores/referencias por ubicación/multiplicidad en src/services/validation/foundryValidator.ts; bloquear commit fallido en src/services/jobs/jobRunner.ts.

## Phase 5: US3 - Idiomas/consistencia (P1)

**Goal**: EN/RU y memoria validada. **Independent Test**: escenarios 2 y 7.

- [x] T010 [US3] Implementar auto/en/ru con incertidumbre conservadora y selección manual en src/services/translation/languageDetector.ts y src/components/JsonTranslator.tsx.
- [x] T011 [US3] Cerrar prioridades vigentes de reutilización segura (canonical/SRD, TM aprobada, caché, glosario/contexto, proveedor), términos explícitos sobre glosario persistido y conflictos sin sustitución arbitraria en desktop/translation/runtime.ts y preflight.ts; prevalece la corrección T069–T073 sobre el orden histórico.
- [x] T012 [US3] Verificar persistencia existente en desktop/memory/store.ts: status=APPROVED|CANDIDATE|REJECTED; solo APPROVED con validationPassed y contexto/idioma/glosario/reglas compatibles se reutiliza; error/abort no aprueban.
- [x] T013 [US3] Verificar Unicode ruso, español, repetición sin llamadas, conflictos y contextos en tests/memory/languagesAndMemory.test.ts.

## Phase 6: US4 - Carpetas (P2)

**Goal**: copia completa módulo. **Independent Test**: escenarios 4 y 5.

- [ ] T014 [US4] Extender src/services/jobs/jobRunner.ts con cola acotada, jerarquía y copia byte a byte de recursos/JS/packs y originales fallidos con ERROR sin detener lote.
- [ ] T015 [US4] Añadir selección archivo/carpeta/destino y progreso preliminar en src/components/BatchTranslator.tsx e integrar en src/App.tsx.
- [x] T016 [US4] Verificar recursión, mayúsculas, junctions, permisos/disco lleno y continuidad ante JSON inválido en tests/jobs/directory.test.ts.

## Phase 7: US5 - Cancelación/informe (P2)

**Goal**: trabajo controlable. **Independent Test**: escenarios 6 y 4.

- [x] T017 [US5] Propagar abort al proveedor, prohibir commits tras confirmación y feedback UI <=1 segundo en desktop/jobs.ts, desktop/main.ts y src/components/BatchTranslator.tsx; confirmar después de finalizar publicación/limpieza.
- [ ] T018 [US5] Implementar contadores reconciliados e informe seguro exportable en src/services/jobs/jobReport.ts y src/components/JobReport.tsx; conectar cancelar en src/components/BatchTranslator.tsx.
- [x] T019 [US5] Verificar abort en extracción/traducción/validación/commit, cero temporales y conservación de completados en tests/jobs/cancellation.test.ts.

## Phase 8: US6 - Windows/privacidad (P2)

**Goal**: .exe nativo. **Independent Test**: escenario 8 Windows 10/11 sin Node.

- [x] T020 [US6] Crear desktop/main.ts y desktop/preload.ts; contextIsolation, renderer sin Node, servicios host empaquetados e IPC autorizado sin rutas arbitrarias.
- [ ] T021 [US6] Conectar diálogos nativos, snapshots/eventos ordenados y openOutput en desktop/main.ts y src/components/BatchTranslator.tsx.
- [x] T022 [US6] Mostrar local/externo y secretos solo host en src/components/SettingsView.tsx y desktop/main.ts; probar emisor/payload IPC y secretos ausentes en tests/contracts/desktopApi.test.ts.
- [ ] T023 [US6] Configurar .exe con runtime Node en desktop/build.config.ts, package.json y .github/workflows/ci.yml; registrar pruebas Windows 10/11 sin Node en specs/001-foundry-translator-mvp/quickstart.md.

## Phase 9: Polish & Cross-Cutting

- [ ] T024 Ejecutar lint/test/build y corpus 100 archivos/1.000 cadenas; registrar SC-001 a SC-008 y smoke Foundry con versiones en specs/001-foundry-translator-mvp/checklists/release.md.
- [ ] T025 Actualizar docs/ARCHITECTURE.md, docs/TRANSLATION_PIPELINE.md, specs/001-foundry-translator-mvp/traceability.md y quickstart.md con límites, comportamiento final y evidencia de convergencia.

## Dependencies & Execution

T001 -> T002 -> T003 -> T004 -> US1 -> US2 -> US3 -> US4 -> US5 -> US6 -> cierre.
US2 verifica motores existentes tras fundaciones; US1 no se entrega como seguro antes
de que US2 pase. US3 se prueba con fixtures sin carpetas. US4/US5 con host simulado.
T020 puede prepararse tras T004; integración final depende de jobs e informe.

Oportunidades separables: fixtures US2 junto a atomicWriter; tests idiomas junto a UI;
tests directorios junto a BatchTranslator; tests cancelación junto a JobReport;
config desktop junto a tests contratos. No marcar [P] en tareas que comparten motores.

## Implementation Strategy

Primer incremento útil: US1+US2+US3. MVP completo exige además US4+US5+US6.
Marcar [x] solo con evidencia. Esta adopción SDD entrega documentos; el backlog
se ejecuta después mediante implementación/convergencia.

## Evidencia desktop - 2026-10-01

- T020: Electron 44.5.1, main/preload empaquetados con esbuild; contextIsolation,
  sandbox y renderer sin Node. No existe servidor HTTP ni ruta de ejecución web.
- T021 parcial: diálogos nativos archivo/carpeta, handles aleatorios, lectura JSON,
  guardar copia y abrir salida; snapshots/eventos ordenados de solicitudes al proveedor.
  Integración con trabajos FileJob/lotes espera T002/T014/T018; UI lo indica explícitamente.
- T022: Ollama exclusivamente local, endpoint loopback validado sin credenciales;
  configuración en userData, payloads/emisor IPC validados y secretos descartados.
  Vitest cubre emisor, endpoint y payload; smoke Electron confirma bridge y ausencia Node.
- T023 parcial: .exe portátil x64 y CI Windows configurados. Prueba local Windows 11;
  Windows 10 y máquina limpia independiente siguen pendientes. Binario sin firma.

Cambio de alcance autorizado: escritorio es la única aplicación. React es el renderer
local de Electron; Vite únicamente genera assets, sin publicar una interfaz web.

Validación final: TypeScript y 29 pruebas aprobadas; portable final 100.434.691 bytes
probado sin Node en PATH. UI/diálogos expuestos, IPC inválido rechazado, renderer
sin Node y Ollama conectado. Windows 11 Pro 10.0.26200.

## Continuacion desktop - 2026-10-01

Version 0.1.1: renderer limitado a assets empaquetados, sin acceso a otros archivos
locales ni recursos remotos. TypeScript y 30 pruebas aprobadas.
`scripts/verify-desktop.ps1` verifica ejecutable empaquetado sin Node en PATH,
reporte nuevo, renderer sin Node, bridge nativo y rechazo de payload invalido.
CI Windows ejecuta esta comprobacion antes de publicar el artefacto de build.
T021 sigue pendiente de los trabajos/lotes; Windows 10 no se ha verificado.

## UI y corpus real - 2026-10-01

Version 0.2.0: interfaz compacta, origen auto/en/ru en desktop, tokens conservados
en host y marcadores inventados rechazados. TypeScript y 34 pruebas aprobadas.
Corpus FifthPendium bastion: 57 JSON, 1179 cadenas, 102 campos traducibles.
Prueba real de 58 unidades aprobada; originales intactos. Ver docs/UI_VALIDATION.md.
Estos controles no completan el motor de lotes ni el resto del MVP.

## Proveedores y lotes de carpeta — 2026-10-01

- [x] T026 Incorporar contrato intercambiable de proveedores locales, TranslateGemma 12B/27B mediante Ollama preferente y LibreTranslate seleccionable/fallback configurable; migrar configuración existente y conservar protección y glosario.
- [x] T027 Implementar traducción recursiva de carpetas JSON en escritorio con salida nueva, copia de recursos, validación por archivo, progreso, cancelación, errores y conservación de originales.

Implementación: `desktop/providers.ts`, `desktop/jobs.ts`, bridge nativo y controles de Ajustes/Archivos JSON. TypeScript y 42 pruebas automatizadas aprobadas. Documentación: `docs/PROVIDERS_AND_BATCH.md`. El resto de tareas existentes conserva su estado y alcance; este lote no implementa memoria aprobada persistente, reanudación entre sesiones ni todas las políticas del MVP.


Validación real final: 57/57 JSON de Bastion procesados, cero fallos, estado COMPLETED y SHA-256 de originales sin cambios. Proveedor real: TranslateGemma 27B / Ollama. 12B no descargado; LibreTranslate sin servicio activo, validado mediante pruebas simuladas. Ejecutable 0.3.0 generado y comprobado sin Node en PATH; Windows 11. Informe local: `reports/folder-validation/report.json`.
## Raíz completa del módulo — 2026-10-01

- [x] T028 Descubrir `_source` recursivamente bajo `pack`/`packs` y omitir el paso si no existen; traducir scripts bajo `scripts`, si existe, mediante AST y sin ejecutar código.
- [x] T029 Copiar toda la raíz conservando archivos auxiliares, rutas y directorios vacíos, sustituyendo solo el contenido aprobado de las copias traducidas; progreso de JSON/scripts y errores por archivo.

Contratos y límites: `docs/MODULE_ROOT_TRANSLATION.md`. Implementación: `desktop/moduleDiscovery.ts`, `desktop/scriptTranslation.ts`, `desktop/jobs.ts` y host Electron. Version 0.4.0; TypeScript y 50 pruebas aprobadas. Los textos de scripts de uso ambiguo se conservan, así como claves de localización y lógica ejecutable.



Verificación final 0.4.0: 50 pruebas aprobadas; copia integral con proveedor identidad de 14.444 archivos, incluidos 4.073 JSON y 36 scripts. Los 10.335 recursos auxiliares conservan su SHA-256 y todos los originales permanecen intactos. Un JSON (Armor of Vulnerability) ya contiene HTML desbalanceado: se conserva su copia original y se informa como fallo. Traducción real de nueve textos en translation.mjs con TranslateGemma 27B, sintaxis y original preservados. No se ejecutó inferencia sobre los 4.073 JSON del módulo completo. Portable 0.4.0 verificado sin Node en PATH. Informes: reports/module-validation/{copy-report,script-report,discovery}.json.


## Ampliacion 2026-10-02: objetivo nativo Foundry V14.368

Auditoria: [docs/AUDIT_V14_368.md](../../docs/AUDIT_V14_368.md). Se conservan T001-T029. Para evitar colisiones, N026-N060 del nuevo requerimiento se mapean a T030-T064 (offset +4). No completar una tarea por tener solo parte de sus criterios. T020/T022 siguen acreditadas en alcance local; el resto conserva sus pendientes concretos segun la auditoria.

## Phase 10: Integridad y compatibilidad antes de optimizar

- [x] T045 [N041] Perfil Foundry V14.368: Version minima objetivo 14.368, formatos/capacidades/limitaciones por sistema; posteriores requieren matriz verificada, no promesa universal. Implementacion/pruebas: desktop/compatibility/foundryV14.ts; docs/FOUNDRY_V14_368.md. Depende de ninguna (perfil documental de referencia).
- [x] T049 [N045] Placeholders universales: Reutilizar motor central, referencias/rolls/variables/Handlebars/HTML/URLs/rutas/identificadores/formulas; politica de orden y colisiones; versionar reglas. Implementacion/pruebas: src/services/protected-content/protectedContentEngine.ts; tests/golden/foundry_v14_368/. Depende de T045,T008.
- [x] T046 [N042] Correccion P0 T043 cerrada: referencias completas antes de entidades, prefijos/delimitadores HTML-encoded y normales, sin decode/encode; integrity-5, restauracion exacta y rechazo de sintaxis incompleta. 20 regresiones especificas sin Ollama,539 tests antes de inferencia y540 al cierre; repeticion120 muestras con0 mutaciones de referencias en4B/12B/27B. src/services/protected-content/protectedContentEngine.ts; tests/golden/encodedReferenceProtection.test.ts; docs/T043_PROTECTION_FIX.md. Depende de T045,T049. No promesa de compatibilidad runtime adicional ni migracion de formatos.
- [x] T047 [N043] Inline rolls/formulas: Sintaxis [[...]], comandos, brackets de tipos, lookup y extensiones; fixtures reales V14 y formulas intactas, ambiguas originales. Implementacion/pruebas: src/services/protected-content/protectedContentEngine.ts; tests/golden/foundry_v14_368/rolls/. Depende de T045,T049.
- [x] T054 [N050] Diff estructural: Segmentos sin ambiguedad, claves duplicadas rechazadas antes de parse; allowlist solo textos seguros; estructura/tipos/arrays/tecnicos y referencias por ubicacion. Implementacion/pruebas: src/services/validation/structuralDiff.ts; src/services/json/jsonEngine.ts; tests/golden/structuralDiff.test.ts. Depende de T045.
- [x] T048 [N044] HTML/enriched text: Texto visible traducible; tags/attrs/entities/URLs/IDs/Foundry intactos, scripts/style ejecutable preservado, casos anidados e interpolados. Implementacion/pruebas: src/services/protected-content/protectedContentEngine.ts; src/services/validation/foundryValidator.ts; desktop/scriptTranslation.ts; tests/golden/foundry_v14_368/html/. Depende de T049,T054.
- [x] T050 [N046] Integridad placeholders: Faltante/modificado/duplicado/inventado/reordenado; HTML/expresiones orden estricto y referencias movibles solo bajo politica explicita. Implementacion/pruebas: src/services/protected-content/protectedContentEngine.ts; tests/golden/placeholderIntegrity.test.ts. Depende de T049,T046,T047,T048.
- [x] T053 [N049] Golden corpus: Fixtures input/expected actor/item/spell/journal/table/scene/macro/settings/lang/pack/html/uuid/roll; distinguir sintetico vs runtime verificado, sin corpus privado. Implementacion/pruebas: tests/golden/foundry_v14_368/; tests/golden/golden.test.ts. Depende de T045,T054.
- [x] T064 [N060] Quality gate: Original parse/traduccion/tokens/referencias/estructura/formato/output parse PASS antes de COMPLETED; nunca basta respuesta IA; unidades/fallback diferenciados. Implementacion/pruebas: src/services/validation/qualityGate.ts; desktop/jobs.ts; src/components/JsonTranslator.tsx; tests/golden/qualityGate.test.ts. Depende de T054,T050,T009.
- [x] T057 [N053] Publicacion atomica: Gate antes de temporal y validacion del temporal antes de link/move; fsync/limpieza/colisiones/disco/abort; recursos byte a byte y originales intactos. Implementacion/pruebas: desktop/atomicWriter.ts; desktop/jobs.ts; desktop/main.ts; tests/jobs/atomicWriter.test.ts. Depende de T054,T064,T005.
- [x] T058 [N054] Recuperacion granular: STRING/FILE/JOB failure; original por cadena si seguro, revalidar archivo entero; fallback nunca TRANSLATED, severidad y contadores finales. Implementacion/pruebas: desktop/jobs.ts; desktop/contracts.ts; tests/jobs/recovery.test.ts. Depende de T002,T057,T064.

## Phase 11: Diagnostico, informes y metricas

- [x] T038 [N034] Directorio logs: logs en userData (no carpeta fuente), app/errors/translation y runs por fecha con identificador unico; no secretos ni texto completo. Implementacion/pruebas: desktop/logging/runLogger.ts; tests/logging/runLogger.test.ts. Depende de T002,T064.
- [x] T039 [N035] Diagnostico preciso: file/path/document/field/idiomas/status/reason/provider/model/recovery/timestamp; redaccion por allowlist y errores estables sin cuerpos del proveedor. Implementacion/pruebas: desktop/logging/runLogger.ts; desktop/translation/runtime.ts; tests/logging/runLogger.test.ts. Depende de T038,T054.
- [x] T041 [N037] Rotacion y retencion: Limites de bytes, archivos y ejecuciones; retencion configurable con limpieza solo bajo userData/logs y pruebas sin borrar otras rutas. Implementacion/pruebas: desktop/logging/runLogger.ts; tests/logging/runLogger.test.ts. Depende de T038,T039.
- [x] T042 [N038] Metricas: Registrar todas las metricas N038 y caracteres, duraciones monotonic y peticiones reales/reintentos; distinguir fuente recuperada/copias/validacion. Implementacion/pruebas: desktop/metrics/runMetrics.ts; desktop/jobs.ts; desktop/ollama.ts; tests/metrics/runMetrics.test.ts; tests/contracts/ollamaDesktop.test.ts. Depende de T002,T039,T064.
- [x] T040 [N036] Informes por ejecucion: summary/errors/warnings/skipped en exito/cancel/error; exportacion por dialogo, contadores reconciliados y eventos sequence; recuperar T018/T021. Implementacion/pruebas: desktop/logging/runReport.ts; desktop/preload.ts; src/components/BatchTranslator.tsx; tests/logging/runLogger.test.ts. Depende de T039,T042,T058.

## Phase 12: Memoria aprobada y consistencia

- [x] T030 [N026] TM avanzada: Separar identidad/contexto/procedencia/estadisticas; persistir candidatos/aprobados/rechazados EN/RU y no aprobar respuestas automaticamente. Implementacion/pruebas: desktop/memory/store.ts; tests/memory/runtime.test.ts. Depende de T002,T054,T064,T039.
- [x] T035 [N031] Glosario por sistema: Reutilizar almacenamiento actual, agregar system/module/version, detectar conflictos; tokens > usuario > exact TM > contexto > motor. Implementacion/pruebas: desktop/memory/store.ts; desktop/providers.ts; scripts/manageMemory.ts; tests/memory/runtime.test.ts. Depende de T049,T030.
- [x] T061 [N057] Conflictos contextuales: Charge y variantes por system/module/document/field/contexto; conservar alternativas y revision, no elegir un unico target global. Implementacion/pruebas: desktop/memory/conflicts.ts; desktop/memory/context.ts; desktop/memory/store.ts; tests/memory/review.test.ts; tests/memory/consistency.test.ts. Depende de T030,T035.
- [x] T059 [N055] Procedencia traduccion: GLOSSARY/TM_EXACT/TM_FUZZY_CONTEXT/CACHE/TRANSLATEGEMMA/MANUAL/ORIGINAL_FALLBACK por unidad y proveedor real incluidas alternativas. Implementacion/pruebas: desktop/memory/provenance.ts; desktop/translation/runtime.ts; desktop/logging/runReport.ts; tests/memory/provenance.test.ts. Depende de T030,T035,T042.
- [x] T060 [N056] Feedback de calidad: Aceptar/editar/rechazar/restaurar, revisar integridad y contexto; solo aprobados confiables; persistir transiciones sin promocion automatica. Implementacion/pruebas: desktop/memory/store.ts; desktop/memory/review.ts; desktop/main.ts; desktop/preload.ts; src/components/TranslationReview.tsx; tests/memory/review.test.ts. Depende de T030,T064,T059.
- [x] T033 [N029] Exact Match: Conectar TM exacta aprobada compatible antes de proveedor; glosario invalida contradicciones y pruebas con cero llamadas. Implementacion/pruebas: desktop/translation/runtime.ts; tests/memory/runtime.test.ts. Depende de T030,T035,T059.
- [x] T034 [N030] Fuzzy contextual: Similaridad acotada y contexto aprobado relevante; nunca devolver subfrase/fuzzy como traduccion automatica completa; reemplazar riesgo de TranslationSourceManager. Implementacion/pruebas: desktop/memory/store.ts; desktop/translation/runtime.ts; tests/memory/runtime.test.ts. Depende de T030,T033,T061.
- [x] T062 [N058] Reporte terminologico: Conteos de variantes de terminos por contexto al terminar; warning revisable sin correccion automatica ni contenido sensible completo. Implementacion/pruebas: desktop/logging/consistencyReport.ts; desktop/logging/runReport.ts; tests/memory/consistency.test.ts; tests/memory/incremental.test.ts. Depende de T040,T059,T061.

## Phase 13: Reutilizacion y calidad

- [x] T032 [N028] Cache persistente: Clave idioma/texto/glosario/proveedor/modelo/prompt/reglas/perfil; invalidar cambios, validar hits y registrar hits/misses; no convertir cache en TM aprobada. Implementacion/pruebas: desktop/memory/store.ts; desktop/translation/runtime.ts; tests/memory/runtime.test.ts. Depende de T030,T035,T064.
- [x] T031 [N027] Deduplicacion: Identidad segura sin lowercase ni colapsar espacios significativos; reutilizar solo contexto compatible y registrar detected/unique/deduplicated. Implementacion/pruebas: desktop/translation/runtime.ts; tests/memory/runtime.test.ts. Depende de T030,T035,T054.
- [x] T063 [N059] Traduccion incremental: Manifiesto de unidades unchanged/changed/new/removed por segmentos/contexto; reutilizacion validada sin pedir nuevamente contenido intacto. Implementacion/pruebas: desktop/memory/incremental.ts; desktop/memory/moduleIdentity.ts; desktop/translation/runtime.ts; desktop/logging/runReport.ts; tests/memory/incremental.test.ts. Depende de T030,T031,T032,T033,T064.
- [x] T051 [N047] Detector sospechoso: Vacio/longitud/identico/instrucciones/markdown/JSON/duplicacion/prefijos; WARNING/FAILED por gravedad, nunca publicar criticos. Implementacion/pruebas: desktop/translation/quality.ts; tests/quality/language.test.ts; tests/logging/runLogger.test.ts. Depende de T064,T039.
- [x] T052 [N048] Validacion idioma: Validacion ES EN/RU con umbral por longitud; eximir nombres/acronimos/corto/tecnico y abstenerse si fuente incierta. Implementacion/pruebas: desktop/translation/quality.ts; tests/quality/language.test.ts. Depende de T010,T051,T039.

## Phase 14: Batching, benchmark y concurrencia seguros

- [x] T044 [N040] Regresiones transversales: Cada TM/cache/dedup/batch/concurrencia debe ejecutar corpus e invariantes, cancelacion/disco/offline; mantener pruebas funcionales previas. Implementacion/pruebas: tests/golden/foundry_v14_368/; .github/workflows/ci.yml. Depende de T053,T054,T057.
- [ ] T036 [N032] Batching con IDs: IDs internos de unidades; rechazar omitidos/duplicados/desconocidos/mezcla/cantidad, subdividir hasta individual y medir antes/despues. Implementacion/pruebas: desktop/ollama.ts; src/services/translation/jsonResponseParser.ts; tests/contracts/ollamaDesktop.test.ts. Depende de T054,T064,T042,T044.
- [x] T043 [N039] Repeticion tras correccion P0 T046 ejecutada: mismos120 textos/IDs/instrucciones/parametros/gate, input integrity-5 separado;65/101/110 aceptadas y55/19/10 fallos estructurales,0 mutaciones de referencias. Sin ganador definitivo;12B recomendado provisionalmente por eficiencia/calidad comparable revisada, con9 fallbacks mas que27B. Configuracion27B conservada provisional; sin routing. scripts/runFrozenTranslateGemmaBenchmark.ts; scripts/evaluateFrozenTranslateGemmaBenchmark.ts; tests/benchmark/; docs/T043_PROTECTION_FIX.md. Depende de T044,T053,T042,T046,T069,T070,T072,T073; T077 no bloquea este experimento conforme al alcance vigente.
- [ ] T037 [N033] Pipeline concurrente: Preparacion/validacion CPU acotadas mientras GPU trabaja, una solicitud GPU por defecto; limites configurables, backpressure y cancelacion segura. Implementacion/pruebas: desktop/jobs.ts; desktop/contracts.ts; tests/jobs/concurrency.test.ts. Depende de T036,T042,T044,T019.

## Phase 15: Aceptacion nativa sin Babele

- [ ] T055 [N051] Validacion nativa y packs: El usuario reempaqueta las fuentes traducidas con herramienta compatible; verificar manifiesto/rutas/IDs/UUID y cargar module/actors/items/journals/links/rolls en V14.368, capturando consola. La reconstruccion automatica queda pospuesta y no bloquea el traductor de fuentes. Implementacion/pruebas: tests/native/; docs/FOUNDRY_V14_368.md. Depende de T045,T054,T057,T064,T053,T067. T065 suspendida no bloquea esta aceptacion.
- [ ] T056 [N052] Independencia Babele: Sin Babele instalado ni formatos de salida Babele; diagnosticar dependencia del origen y probar resultado nativo real sin quitar integraciones a ciegas. Implementacion/pruebas: tests/native/noBabele.test.ts; docs/FOUNDRY_V14_368.md. Depende de T055.

### Paralelismo y validacion externa

Con contratos estables: T053 fixtures junto al protocolo T055/T056; T041 rotacion junto al esquema T030; T043 benchmark junto a T060 UI cuando existan IDs/gate. T036/T037 comparten proveedor/jobs y se ejecutan secuencialmente. T055/T056 requieren Foundry V14.368 y mundo aislado sin Babele; T043 requiere modelos realmente instalados; T023 exige Windows 10/11 limpio. No acreditar estas pruebas con mocks.


### Evidencia del primer incremento de integridad (2026-10-02)

T045: perfil explicito 14.368, NOT_RUN para runtime, limites de formatos y versiones posteriores. T054: diff por segmentos, tipos/arrays/allowlist, parse estricto y claves duplicadas rechazadas, integrado a JsonEngine/FoundryValidator/jobs/renderer; pruebas adversariales de valores tecnicos, referencias por ubicacion y rutas ambiguas. T053: golden sintetico con input/expected para 13 categorias, incluido en vitest/CI; no acredita carga en Foundry.

T046-T050 y T064 reciben mejoras iniciales pero conservan pendientes (fixtures runtime, cobertura universal completa, politica semantica de orden, gate y estados por unidad/archivo). No se implementaron TM/cache/concurrencia de la nueva fase. Se desactiva aplicacion automatica de corpus historicos sin aprobacion/contexto en host; archivos y herramientas de corpus se conservan para migracion como candidatos.

T009 cerrada en este incremento: comparacion por segmentos/ubicacion y multiplicidad tecnica, tipos y arrays, allowlist y bloqueo en jobs/renderer. La validacion runtime nativa sigue en T055/T056/T024; no se confunde con integridad estructural local.

## Ajuste de alcance: fuentes desempaquetadas y localizacion nativa (2026-10-02)

Se conservan T001-T064. El usuario desempaqueta y reempaqueta; la reconstruccion automatica es opcional futura, fuera del camino critico. T028/T029 ya cubren descubrimiento/copia/scripts: no duplicar su implementacion. Las tareas siguientes completan contratos, localizacion y pruebas. Traducir fuentes no demuestra que la base empaquetada contenga la traduccion.

- [ ] T065 Contrato de fuentes preparadas: documentar y mostrar en src/components/BatchTranslator.tsx el flujo desempaquetado por usuario -> traduccion -> reempaquetado por usuario; pack/packs/**/_source recursivo y scripts opcionales; advertir packs sin fuentes sin intentar editar LevelDB; conservar id del modulo y explicar instalacion final bajo su nombre original en un entorno separado. Pruebas: tests/desktop/moduleBatch.test.ts, ausencia de carpetas, modulo solo scripts, fuentes vacias y bases intactas. Depende de T028,T029,T045.
- [x] T066 Localizacion nativa: analizar archivos EN/RU declarados en languages, traducir solo valores humanos y producir archivos ES en la copia; conservar claves literales con puntos, claves anidadas y placeholders. Mantener localizaciones espanolas existentes sin sobrescritura; multiples diccionarios requieren correspondencia explicita, sin fusion arbitraria. Rutas relativas contenidas en la copia, sin enlaces; fuentes dudosas intactas con warning. Implementacion/pruebas: desktop/compatibility/nativeLocalization.ts; tests/native/localization.test.ts. Depende de T049,T054,T064,T057.
- [x] T067 module.json seguro: modificar exclusivamente languages para registrar cada diccionario ES nuevo validado y existente en la salida. Conservar entradas previas/flags, id, version, compatibility, coreTranslation, packs, scripts/esmodules, relationships, URLs y todo campo restante; no cambiar dependencias Babele. Parse estricto, diff con allowlist especifica para este cambio aditivo, validacion de rutas y publicacion atomica; manifiesto ausente/invalido/conflicto conserva original y registra warning. No enviar manifiesto completo al modelo ni registrar idioma sin archivo. Implementacion/pruebas: desktop/compatibility/moduleManifest.ts; tests/native/moduleManifest.test.ts. Depende de T066,T054,T057.
- [x] T068 Corpus real autorizado y regresion: seleccionar fixtures exclusivamente bajo C:/Users/leond/AppData/Local/FoundryVTT/Data/modules, leer sin ejecutar scripts ni tocar originales; controlar rutas reales/junctions y SHA-256 antes/despues. Cubrir modulo con ES existente, sin ES, multiples idiomas, JSON _source y scripts; invalidos, conflictos, rutas escapadas y fallos entre localizacion/manifiesto sin referencias colgantes. Conservar corpus privado fuera del repositorio; fixtures publicables sinteticos. Informe de prueba local separado de aceptacion Foundry T055/T056 tras reempaquetado manual. Implementacion/pruebas: scripts/validateNativeLocalization.ts; tests/native/; reports/native-localization/. Depende de T065,T066,T067,T044.

Orden: integridad T049/T054/T064/T057 -> T066 -> T067 -> T068 -> aceptacion real T055/T056. T065 puede avanzar en paralelo con integridad. Preparar fixtures sinteticos de T068 puede avanzar en paralelo con T066, pero la verificacion integrada depende de T067. T055/T056 siguen exigiendo Foundry real sin Babele; la reconstruccion automatica no es prerrequisito.

Evidencia de inspeccion, no implementacion: los manifiestos fifthpendium, colorsettings y ActiveAuras ya declaran ES. No asumir ausencia de traducciones ni agregar duplicados. ActiveAuras declara maximum=13: agregar ES no lo vuelve compatible con V14. No se modificaron archivos del arbol autorizado.


## Evidencia T066-T068 (2026-10-02)

Implementadas en desktop/compatibility/{nativeLocalization,moduleManifest,publishLocalization}.ts e integradas a jobs y progreso/UI. Contrato: contracts/native-localization.md. 127 pruebas aprobadas, incluidas 25 nuevas en tests/native/localization.test.ts; lint y build aprobados. Regresiones de claves literales/anidadas, EN/RU, referencias, respuestas invalidas, rutas, cancelacion, colisiones y fallo ENOSPC en reemplazo. scripts/validateNativeLocalization.ts inspecciona tres modulos reales exclusivamente bajo el arbol autorizado con proveedor identidad y originales intactos: reports/native-localization/summary.json. No acredita calidad linguistica ni runtime Foundry. Las dependencias generales T049/T057/T064/T044 conservan su alcance pendiente; este incremento cubre sus invariantes necesarios en localizacion sin marcar esas tareas completas. T065 no ejecutada; T055/T056 siguen pendientes.


## Incremento T055-T056: herramientas entregadas, runtime pospuesto (2026-10-02)

T055/T056 permanecen [ ] y parcialmente implementadas. Entregados desktop/compatibility/{nativeAcceptance,nativePreflight}.ts, scripts/{nativeAcceptance.ts,nativeRuntimeProbe.mjs}, tests/native/{nativePreflight,noBabele,runtimeProbe}.test.ts y contracts/native-acceptance.md. El verificador compara fuentes/scripts/manifiesto, diagnostica dependencias, genera UUIDs/casos y hashes de fuentes y bases efectivas; la sonda compara documentos reales con fuentes traducidas, enriquecimiento HTML/links/UUID/rolls, idioma y ausencia de Babele incluso inactivo. La evaluacion exige version/build 14.368/368, binding al plan, categorias completas y revision explicita de startup. 151 tests PASS (24 nuevos), lint/build PASS. Mocks no acreditan runtime.

Instalacion encontrada: C:/Program Files/Foundry Virtual Tabletop/resources/app/package.json, version14.364.0/build364. El usuario solicito dejar la prueba real para despues. No actualizar core, iniciar mundos personales ni marcar PASS nativo. Pendiente T055: copia traducida reempaquetada manualmente, mundo aislado14.368 y captura/revision de consola. Pendiente T056: ejecutar ese mundo sin Babele instalado y comprobar el resultado funcional real; revisar formatos/dependencias del origen. Contrato generado no sustituye esta evidencia. T065 y todas las dependencias generales conservan su estado.


## Entrega de integridad/publicacion/recuperacion (2026-10-02)

T049/T050: reglas integrity-3, colisiones con marcadores literales, orden tecnico estricto, referencias/rolls/templates anidados, HTML con atributos entrecomillados, rutas/identificadores/dados y abstencion ante sintaxis incompleta. T064: gate de siete checks, JSON/renderer/lotes, estados por archivo y recuperacion WARNING. T057: desktop/atomicWriter.ts, staging exclusivo, fsync, comparacion/validacion de bytes antes de link/rename, hash streaming de recursos; integrado a jobs, guardar JSON y publicacion de localizaciones. T058: recuperacion de unidades JSON/scripts, fallback por archivo revalidado, diagnosticos STRING/FILE/JOB y parada por disco/permisos. Contrato: contracts/integrity-publication.md.

192 tests PASS, incluidos tests/jobs/{atomicWriter,recovery}.test.ts y tests/golden/{qualityGate,placeholderIntegrity}.test.ts; lint y build PASS. Los tests previos de fallback por archivo se actualizan para exigir recuperacion granular y WARNING, y las referencias incompletas exigen abstencion. No se cambia modelo ni se ejecuta Foundry real. Las dependencias generales de arquitectura y fixtures runtime conservan sus pendientes fuera de este alcance; no prometer todas las sintaxis futuras ni durabilidad ante perdida de energia.


## Entrega T007/T008/T046-T048 (2026-10-02)

Clasificacion tecnica insensible a mayusculas y proteccion de descendientes de contenedores tecnicos; conservar nombres visibles reales y excepcion limitada flags.dnd5e.title. HTML lexical compartido con proteccion/validator, comillas/DOCTYPE/comments/void tags/bloques opacos y abstencion ante markup incompleto; no interpretar command JS como documento HTML. Referencias/rolls comparados por ubicacion/multiplicidad/orden, incluidas extensiones desconocidas intactas. Reglas integrity-4; contratos existentes compatibles. Contrato: contracts/foundry-content-integrity.md.

251 tests PASS (59 nuevos), lint y build PASS. Corpus autorizado FifthPendium: 4073 JSON, 2 warnings de origen, SHA-256 originales intactos. Informe y fixtures tecnicos privados: reports/foundry-coverage/{summary,private-fixtures}.json; script reproducible scripts/validateFoundryCoverage.ts. Texto de los fixtures privados sintetico alrededor de tokens reales. Fuentes declaran versiones mixtas12/13/14.364, no se renombra como runtime14.368 ni se redistribuye corpus privado. T055/T056 mantienen validacion real pendiente. No se cambio el alcance del flujo de preparacion manual.

## Entrega T030-T035 / T038-T042 / T051-T052 (2026-10-02)

Memoria persistente privada con candidatos y aprobacion explicita; contexto estricto, exact sin proveedor, fuzzy aprobado acotado sin sustitucion, glosario por sistema/modulo y cache versionada revalidada. Deduplicacion sin alterar case/espacios ni ocultar diferencias entre referencias. Administracion local en scripts/manageMemory.ts; feedback visual completo y migracion del corpus historico permanecen pendientes, no hay autoaprobacion. Proveedor27B y estructura de salidas conservados.

Logs/NDJSON privados y cuatro reportes por lote/solicitud directa, incluso cancelacion/error cuando el almacenamiento es escribible; exportacion por dialogo, redaccion, rotacion/retencion configurables y metricas monotonic con instrumentacion HTTP real. Calidad heuristica EN/RU->ES y respuestas sospechosas integrada con recuperacion granular, WARNING por archivo y exclusiones de memoria/cache. Contrato version1: contracts/translation-reuse-diagnostics.md. Se consolidan store/retrieval/cache/glossary en MemoryStore y diagnostics/rotation en RunLogger para evitar componentes duplicados. No son refactors masivos.

Las dependencias historicas T002/T010/T059/T061 describen ampliaciones globales aun pendientes: esta entrega reutiliza el contrato operativo desktop/contracts.ts y agrega los metadatos/callbacks necesarios; cubre conflictos exact/fuzzy conservadores y exencion de idioma incierto sin acreditar feedback, inventario incremental ni deteccion completa. No marca esas tareas terminadas. T065 permanece sin cambios, T055/T056 requieren la aceptacion real pospuesta.

Validacion final de este incremento: 297 tests PASS en 23 archivos (46 nuevos respecto a 251), lint y build PASS. Incluye fallo ENOSPC de memoria con JOB/IO_FAILURE, hits de cache manipulados, exclusiones fuzzy conflictivas y payload IPC vinculado al original. Prueba smoke de arranque Electron PASS; rechazo de payload invalido es esperado. Ejecutable portable actualizado en release/Traductor-Foundry-0.4.1-x64.exe. Las pruebas EN/RU usan fixtures/proveedores controlados; no equivalen a benchmark de calidad real ni aceptacion Foundry.

Smoke del ejecutable empaquetado release/win-unpacked/Traductor Foundry.exe: PASS (exit0), ASAR/renderer cargados, bridge disponible, Node aislado, payload invalido rechazado, layouts sin overflow. Health local indica Ollama conectado y translategemma:27b instalado; no se tradujo corpus real ni se ejecuto Foundry. Portable electron-builder exit0; SHA-256 verificable en el artefacto entregado.


## Entrega T059-T063 (2026-10-02)

Procedencia por ocurrencia con proveedor real y estados de calidad/publicacion; feedback IPC y vista Memoria y revision, sin aprobar automaticamente ediciones; conflictos por contexto humano acotado; reporte terminologico REVIEW_ONLY separado por modulo/sistema/idioma; inventario incremental privado por identidad nativa de modulo, con unchanged/changed/new/removed y revalidacion de targets. Contrato normativo: [review-incremental.md](contracts/review-incremental.md).

340 pruebas en 27 archivos PASS, incluidas 43 nuevas de procedencia/revision/conflictos/incremental. Verificadas cero llamadas IA para modulo intacto sin cache ordinaria, actualizacion desde otra carpeta por module.json.id, rechazo/restauracion manual, contextos de items embebidos, referencias manipuladas con igual numero de placeholders, proveedor fallback real, cancelacion y ENOSPC con baseline anterior conservada. Originales no modificados; pruebas de traduccion con proveedores controlados. No acredita calidad real del modelo ni Foundry14.368.

T065 permanece intacta por instruccion del usuario; T055/T056 siguen pospuestas. T036/T037 batching/concurrencia, T043 benchmark y restantes tareas generales conservan su estado. Los bloqueos historicos de T033/T034 respecto a procedencia/conflictos quedan cubiertos; no se cierran tareas ajenas. 41 tareas marcadas completas, 27 abiertas.


Validacion final de entrega: lint/build PASS, portable Windows generado y smoke del ejecutable ASAR PASS (exit0). Vista Memoria y revision cargada, IPC disponible, revision/paginacion/conflictos verificados en lectura y payload de traduccion invalido rechazado. Informe local sin textos privados: reports/review-incremental/validation.json. Artefacto: release/Traductor-Foundry-0.4.1-x64.exe, SHA-256 18145f6695042cea21f3829a153b81dc4b4b1d9010dbee27bf82fe75b19426f1. No modifica decisiones de memoria durante smoke ni acredita aceptacion real Foundry.


## Fase urgente: reducir inferencia y observar condiciones termicas (2026-10-02)

T036 y T037 NO se ejecutan en este incremento. T043 pasa a despues de T069-T073, sin exigir batching. No instalar/cambiar modelos ni implementar routing automatico sin evidencia de calidad. T065 permanece suspendida.

- [x] T069 GPU/thermal observability: lectura NVIDIA opcional sin cambios de hardware; utilizacion, temperaturas disponibles, VRAM, potencia/limites; NORMAL/THERMAL_WARNING/THERMAL_PAUSE, abort de inferencia propia, enfriamiento con hysteresis, progreso/cancelacion y checkpoint en memoria seguros. Sensores ausentes son null; memoria no observable nunca se estima. desktop/thermal.ts; desktop/logging/runReport.ts; desktop/main.ts; tests/thermal/thermal.test.ts; tests/memory/preflight.test.ts. Depende de T057,T058,T064.
- [x] T070 TM preflight/auditoria: base activa, SRD, carpeta manual spanish, glosario, cache y procedencia; contar entradas/aprobadas/pares; discovery sin inferencia; estimar resoluciones y llamadas sin reintentos; MEMORY_UTILIZATION_WARNING visible; conservar historicos, candidatos sin promocion, importacion atomica y paginacion sin clonar toda la base. desktop/memory/store.ts; desktop/memory/review.ts; desktop/memory/spanishImport.ts; desktop/translation/preflight.ts; scripts/auditThermalMemory.ts; tests/memory/preflight.test.ts. Depende de T030,T060,T063.
- [x] T071 Identidad canonica Foundry/SRD: system + modulo/pack + tipo nativo + _id/UUID + campo + version; solo targets aprobados, referencias/HTML revalidados y alternativas no conflictivas; reutilizacion EN/RU transversal sin nombres aproximados. Importar escalares verificables de spanish, sin ejecutar converters/PDF/scripts ni dependencia Babele; candidatas requieren autoridad humana. desktop/translation/inventory.ts; desktop/memory/spanishImport.ts; desktop/memory/store.ts; desktop/translation/runtime.ts; tests/memory/preflight.test.ts. Depende de T070,T045,T054,T064.
- [x] T072 Contrato TranslateGemma: una unidad por peticion, un mensaje user, RU/EN y ES explicitos; texto exclusivo, marcadores opacos validados; contexto/output y presupuesto UTF-8 conservadores; segmentacion semantica sin perdida ni particion de tokens; metrica tokens/duraciones cuando disponibles y disponibilidad explicita. desktop/ollama.ts; desktop/translation/prompt.ts; desktop/translation/reuse.ts; tests/contracts/translategemmaContract.test.ts. Depende de T047,T048,T051,T052,T064.
- [x] T073 Preflight visible: archivos/cadenas/unicas; canonical/exact/cache/glossary/fuzzy/protected-only; IA y llamadas estimadas; modelo/backend/VRAM conocida/sensores y advertencias; revision final antes de GPU, token ligado a fuente/configuracion/revision y descarte sin inferencia. desktop/main.ts; desktop/contracts.ts; desktop/preload.ts; src/components/BatchTranslator.tsx; tests/memory/preflight.test.ts. Depende de T069,T070,T071,T072.

Orden: T069 y T072 pueden prepararse independientemente; T070 -> T071 -> T073 integra todas. T043 despues de esta fase con el mismo golden EN/RU, registrando temperaturas disponibles, potencia, tokens/s, strings/s, calidad, errores y VRAM; modelos ausentes NOT_RUN. T036/T037 conservan suspension expresa hasta cerrar esta fase y sus pruebas. No acreditar benchmark ni seguridad fisica de VRAM a partir de mocks.


## Entrega local T069?T073 (2026-10-02)

360 pruebas/30 archivos PASS; lint/build y smoke del ejecutable empaquetado PASS (exit0, rechazo esperado de payload inválido). Artefacto 0.4.2: release/Traductor-Foundry-0.4.2-x64.exe; SHA-256 D1DD9C09A006358D768C397C532B8BDEE6A85A4422279C2627E0064E026C6C55. Contrato: [thermal-memory-preflight.md](contracts/thermal-memory-preflight.md); evidencia y DoD pendiente: [auditoría](../../docs/THERMAL_MEMORY_AUDIT.md).

Importaci?n autorizada de spanish exclusivamente como candidatas: 5.077 nuevas, 14.995 totales, 0 aprobadas; 9.918 anteriores y 5.000 cach? preservadas, backup privado e informe con hashes. 4.291 campos ?nicos estructuralmente admisibles, 3 con alternativas conflictivas; no constituyen traducciones aprobadas. Preflight real readonly: 4109 archivos, 29971 cadenas elegibles, 29348 ?nicas, 976 solo protegidas, 28372 requieren IA bajo estado actual, 33942 peticiones estimadas sin retries/baseline. Son cifras de discovery completo, no las cadenas de una ejecuci?n parcialmente cancelada. Cache0 con nuevo perfil/prompt no elimina cach? vieja. Dos archivos ambiguos se abstienen antes de GPU. Reportes privados reports/thermal-memory/{preflight,spanish-import}.json.

Tareas cerradas en alcance de implementación local y pruebas controladas; NO se declara resuelto el DoD global urgente: benchmark12B/27B NOT_RUN, temperatura memoria NVIDIA N/A y aprobación/revisión de candidatas pendiente. No hubo inferencia de modelo ni estrés térmico real. T043 pendiente después de esta fase; T036/T037 sin implementar, T065 sin integración. 46 tareas completas y 27 abiertas.


## Referencias PDF verificadas (aclaración del usuario, 2026-10-02)

- [x] T074 Registrar e indexar PDFs verificados de spanish como memoria documental privada; reutilizar extractor existente, conservar hash/página/idioma, distinguir autoridad documental de alineación; mostrar contadores en preflight y reportes, conservar candidatas JSON sin aprobar. scripts/importVerifiedPdfMemory.py; desktop/memory/pdfReference.ts; tests/memory/pdfReference.test.ts. Depende de T070/T073. Contrato [verified-pdf-memory.md](contracts/verified-pdf-memory.md).
- [x] T075 Integrar reutilización de SRD PDF: validar pares/secciones EN→ES con procedencia PDF/página y conflictos; revisión de correspondencias, recuperación contextual acotada y enlace Foundry canónico solo con evidencia; registrar cobertura, hits y llamadas evitadas en preflight/runtime; pruebas golden EN/RU, diferencias SRD/manual/versión y extracción defectuosa. La fuente documental ya está verificada: no volver a solicitar su aprobación ni autoaprobar pares por posición/nombre. Depende de T074/T071/T072; sin batching/concurrencia ni T065.

3 PDFs registrados (2 ES, 1 EN), 1150 páginas y 38720 segmentos privados. SRD ES5.2.1: 398 páginas; SRD EN5.2.1:364; Manual del Jugador:388. No hubo inferencia, cambios a originales ni aprobación de JSON. Aclaración supera exclusión histórica de PDFs como fuentes; se mantiene prohibición de correspondencia automática no demostrada. La extracción/indexado no cuenta como hit exact/canónico ni incorpora aún esos fragmentos a prompts: T075 es el trabajo restante para reutilizar esa memoria documental.

Validación T074: 365 tests/31 archivos, lint/build y smoke ASAR PASS; rechazo de payload inválido esperado. Memoria store.json conserva SHA-256 E8F1AAFDD0B89E604EEDD978EDF8087D082029502E503A9865179FADBCB01A4D. Portable release/Traductor-Foundry-0.4.3-x64.exe, SHA-256 793BBAA96510F6740AA655E999160CBC1BA8F5B7D4D3079BC1876F4FC659C7E4. 47 tareas completas, 28 pendientes. T065/T036/T037 sin implementación.


T075 completada (2026-10-02): desktop/memory/pdfCorpus.ts, pdfAlignment.ts, pdfReuse.ts y UI/IPC de revision. Contrato contracts/pdf-srd-reuse.md. 385 tests/33 archivos PASS, lint y build PASS. 8.372 pares candidatos, 0 aprobaciones automaticas, 0 inferencia. Auditoria preserva 23.367 entradas y cache5.000; SHA store 7715c0f21a9041200578e0d926ee271616b8458361d1c36d8e12a6cbcb641c3c. Aprobacion y vinculacion humana pendientes; no afirmar ahorro GPU ni aceptacion Foundry real. 48 tareas completas, 27 pendientes. T036/T037/T065 suspendidas.


## Resolucion por evidencia antes del benchmark (2026-10-02)

- [x] T076 Clasificar parejas PDF en VERIFIED/HIGH_CONFIDENCE/AMBIGUOUS/REJECTED por evidencia; normalizar/agrupar variantes, preservar procedencia y rechazo; aprobar en transaccion solo duplicados de parejas ya aprobadas sin conflicto, rechazar planes obsoletos. UI de filtros/resolucion y contrato contracts/pdf-resolution.md. Depende de T075. Pruebas tests/memory/pdfResolution.test.ts y tests/contracts/localReuse.test.ts.
- [ ] T077 Completar identidad canonica real RU -> SRD EN/ES y 20 mappings VERIFIED. Continuacion del corpus historico aprobado implementada: recibo de confianza idempotente, TM textual sin UUID/canonical_identity UNKNOWN, contexto/polisemia/conflictos y cache LEGACY_CACHE_UNVERIFIED aislada. Corpus6299 entradas raiz/3199 embebidas;7507 entradas internas,7445 aprobadas y27 grupos conflictivos excluidos (incluyen los3 originales). Dry-run4109 archivos/29971 strings/29348 unicas:3984 TM hits,24388 IA y29958 solicitudes (-11.74%);canonical/SRD0.20 muestras reales TM con0 proveedor no sustituyen20 mappings canonicos. Restan evidencia determinista SRD y aceptacion real. Depende T075/T076. Contrato contracts/canonical-reuse-audit.md; resultados docs/T077_RESULTS.md. No fase nueva ni T043/T036/T037.

T075 reproducible: dos generaciones aisladas 8372 propuestas, 0 nuevas y mismos IDs; hash9745c089542057f086703c819bbb25135e6a9407f039644c8a0d21ddf04895a9. T076: 3574 grupos,625 variantes duplicadas; todas las8372 alineaciones historicas carecen de prueba bilingue y quedan AMBIGUOUS. T044 gate transversal en CI y pruebas canonical/PDF/TM/cache/glosario/modelo con invariantes; corregido glosario-only que aun invocaba proveedor. No optimizacion agresiva.

T043 parcial: herramientas/matriz calidad pura y pipeline real entregadas; pruebas de gate, corpus reproducible y aislamiento de memoria. 4B/12B NOT_INSTALLED; 27B NOT_RUN. No ejecutar hasta cobertura canonica real y memoria aprovechada. Depende adicionalmente de T076/T077. T036/T037/T065 siguen suspendidas.

Validacion final 0.4.5: 398 pruebas/37 archivos PASS, lint/build y smoke ASAR PASS. Memoria privada SHA7715c0f21a9041200578e0d926ee271616b8458361d1c36d8e12a6cbcb641c3c inalterada; cache5000 preservada, 0 inferencia. Total50 completas y27 pendientes incluyendoT077. Benchmark real y cobertura canonica no declarados completados.

Portable final release/Traductor-Foundry-0.4.5-x64.exe SHA3346266CC14B30BBC556B000093D90C89071F84C5E1E2392BC41E9B4F239F735; smoke final ASAR PASS. Clasificacion memoizada por revision/epoch/fingerprint para no reevaluar todas las pruebas al paginar; pruebas de invalidacion/stale PASS.

Validación T077 parcial 0.4.6 (2026-10-03): 434 tests/40 archivos PASS, lint/build PASS, smoke ASAR y portable sin Node/Bun en PATH PASS. Portable release/Traductor-Foundry-0.4.6-x64.exe SHA4D5DD970006AD850BB47102312C13F9B0E1B14EA94B72DA5347725DF163614A7. Dry-run completo sin Ollama: memoria/módulo/corpus histórico intactos; base SHA7715c0f21a9041200578e0d926ee271616b8458361d1c36d8e12a6cbcb641c3c. T077 continúa pendiente de cobertura verificada real y ahorro; 20 casos sintéticos no equivalen a 20 mappings de producción. Total50 completas/27 pendientes. T043 no ejecutada; T036/T037/T065 suspendidas.

Continuacion T077 0.4.7 (2026-10-03):451 tests/41 archivos PASS,lint/build PASS,smoke ASAR/portable sin Node/Bun PASS. Portable release/Traductor-Foundry-0.4.7-x64.exe SHAE78202CC2B18E8C764BE9A8E2B8C3099A2372D26F270470870D0340CFFC1EEA8. Memoria SHA6edd82be68fb1da33d99f8124b2119e7e8d722a1b50ad5c248f854bad5a873a9 tras importacion autorizada; dry-run/reimportacion inalteradas. Originales/cache5000/8372 PDF ambiguos preservados. T077 sigue abierta por canonical/SRD0 y20 mappings reales pendientes. Total50 completas/27 pendientes. T043 no ejecutada; T036/T037/T065 suspendidas.

## Correccion de salida entregada (2026-10-03)

Ampliacion de T028/T029/T057/T058/T066/T067 existentes, sin nuevos IDs: TRANSLATION_OVERLAY predeterminado, FULL_PORTABLE_COPY explicito, omission de archivos intactos, bytes originales para JSON sin cambios, manifest/localizaciones solo necesarios, contadores de publicacion y FileOutcome.written. Scripts: clasificacion AST conservadora, interpolaciones protegidas, reemplazo por rangos y comparacion AST/bytes; contexto incierto conserva original con WARNING.

Contrato [output-strategies.md](contracts/output-strategies.md). Suite:466 tests/42 archivos PASS, lint/build PASS. T077 conserva su criterio canonico pendiente en P1/P2 sin bloquear P0; T043/T036/T037/T065 suspendidas. T023/T055/T056 y cierre T024/T025 requieren sus entornos reales. No se acredita aceptacion Foundry ni calidad linguistica con proveedor identidad.

Verificacion 0.4.8: smoke ASAR y portable PASS sin Node/Bun en PATH. Prueba FifthPendium con proveedor identidad:4109 analizados/unchanged,0 escritos,10105 assets omitidos,523678079 bytes no duplicados;4193 hashes de originales intactos;8 archivos WARNING (2 JSON y6 scripts de contexto incierto). Sin Ollama ni inferencia. Resultados y ejecutable en [MVP_SCOPE.md](../../docs/MVP_SCOPE.md). No cerrar T023/T055/T056 con estas pruebas locales.

## Aceptacion P0 controlada (2026-10-03)

FREEZE P0 FEATURES. Solo defectos concretos de aceptacion: contextos Dialog estaticos, titulo Window ApplicationV2 y exclusion CSS/script element textContent por AST. Regresion en tests/native/p0AcceptanceDefects.test.ts;469 pruebas/43 archivos PASS. Sin IDs nuevos. T077 exclusivamente P1, no se continua. T043/T036/T037/T065 suspendidas.

Corpus9 archivos reales:8 modificados,44 peticiones Ollama,128.21s,3 warning_files,2 fallbacks;0 cambios prohibidos y0 assets escritos;originales/TM intactos. Copia aislada integrada y5 packs reempaquetados desde fuentes completas. Foundry14.368 abre mundo ES sin Babele, pero deshabilita FifthPendium: modulo admite dnd5e hasta5.9.9 y sistema instalado6.0.5. No modificar ese requisito para obtener PASS. T055/T056 reactivadas solo para esta prueba, siguen [ ] porque activacion/compendios/scripts reales no pueden acreditarse. Informe [P0_ACCEPTANCE.md](../../docs/P0_ACCEPTANCE.md). Esperar decision tras los resultados.

Portable0.4.9 publicado localmente con correcciones P0; build/smoke ASAR y portable sin Node/Bun PASS. SHA2562463E5A654D4A79C6C3BFD27E62CEF4DBBD50490637B994DA236F3931D464E64. Servidor/navegador aislados cerrados; detenido tras informe.


## Cierre autorizado de requisitos existentes (2026-10-03)

Orden ejecutado T016 -> T017 -> T019 -> T010 -> T011 -> T012 -> T013, sin IDs nuevos. Se reutilizan desktop/jobs.ts, atomicWriter.ts, TranslationRuntime y MemoryStore; las rutas propuestas historicas no requieren componentes duplicados. T011 se cierra con la precedencia vigente T069-T073, no con el orden historico sustituido.

510 tests/47 archivos PASS (41 adicionales), lint/build PASS. Junction real Windows; EACCES/ENOSPC inyectados, invalidos aislados, cancelacion por fase sin temporales ni perdida de completados, informe cancelado y baseline anterior conservados. Feedback del componente React real en Electron en 1,5 ms ante IPC de 800 ms. Corregida deteccion auto insegura y discordancia cache/glosario en preflight; incertidumbre conserva original sin proveedor. Aprobacion explicita/persistencia/rollback y EN/RU/contextos/conflictos/caches comprobados.

Unico dry-run real FifthPendium RU, red bloqueada:4109 archivos,29339 strings_unique,3984 tm_hits,0 cache_hits,0 glossary_hits,623 dedup_hits,24379 strings_requiring_model,29949 estimated_model_requests. Contra baseline29348/3984/29958: -9/0/-9; no atribuir menor inventario a mayor reutilizacion. Fuente y memoria intactas,0 Ollama/HTTP. No se hizo un segundo preflight ni traduccion real. Evidencia [REQUIREMENTS_CLOSURE.md](../../docs/REQUIREMENTS_CLOSURE.md), reports/requirements-closure/. 57 tareas completas,20 abiertas.

T036/T037/T043/T065/T077 suspendidas; no migraciones Foundry/dnd5e, no nuevos componentes arquitectonicos ni portable nuevo. Detenido tras el informe solicitado.


## T043 exclusivamente reactivada (2026-10-03)

Instruccion vigente: T043 activa; T036/T037/T065/T077 suspendidas. Se conserva cierre T016/T017/T019/T010-T013 y baseline29339 unicas,3984TM,0cache,0glosario,623dedup,24379IA,29949solicitudes. No mejorar metricas mediante nuevas funcionalidades ni migrar esquemas.

Preparacion real:120 segmentos FifthPendium,60EN/60RU,193chunks iniciales por modelo;24nombres,26largos,80HTML,22UUID,42rolls,12embedded,15JavaScript,9Dialog,4notifications,2template.2 referencias TM aprobadas,ningun PDF ambiguo como ground truth. Corpus privado reports/benchmark/real-corpus.json y matriz preparation.json; scripts/prepareTranslateGemmaBenchmark.ts.5 tests benchmark/lint PASS.

/api/tags confirma solo27B.4B/12B NOT_INSTALLED;27B NOT_RUN.0inferencia/0descargas,memoria intacta. Gate T043 no exige T077/canonical; termica permanece. Runner historico --run bloqueado hasta adaptacion al corpus real; comparacion/recursos/calidad pendientes, no cerrar T043. DEFAULT_MODEL27B conservado sin evidencia comparativa. Diferencia5570 peticiones iniciales es chunking; estimador excluye retries/fallbacks. Contrato/evidencia [BENCHMARK_T043.md](../../docs/BENCHMARK_T043.md). Detenerse antes de continuar por modelos ausentes.

Continuacion autorizada T043,2026-10-03: modelos ya instalados; mismo corpus/hash/prompts,120muestras por modelo,serial4B->12B->27B. Final55/78/82 aceptadas y65/42/38 fallos estructurales;172.44/350.97/688.51s;GPU maxima79/81/81C,sin THERMAL_ABORT. Defecto P0 concreto descubierto: Reference[...] codificada tras &amp; queda expuesta al modelo; gate benchmark estricto y reevaluacion comun lo rechazan, pipeline producto sin cambios. Calidad cualitativa documentada,ningun modelo aprovado para produccion;DEFAULT27B provisional. RAM servidor4B y temperaturaVRAM N/A.9tests benchmark/lint PASS. Memoria/fuentes/corpus intactos;0publicacion de modulo,0descargas. [Informe final](../../docs/BENCHMARK_T043_RESULTS.md) prevalece sobre estados historicos NOT_RUN. T043 cerrada como experimento;T036/T037/T065/T077 suspendidas. Detenido sin otras tareas.
