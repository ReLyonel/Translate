# Auditoría y plan de convergencia — 2026-10-02

Base inspeccionada: aplicación 0.4.0, host/preload/contratos Electron, trabajos/discovery, proveedores Ollama/LibreTranslate, parser/clasificador/reconstrucción JSON, protección, validador, AST de scripts, tres servicios históricos de memoria, glosario/PDF, componentes, scripts, pruebas, CI y artefactos SDD. Los resultados históricos no sustituyen la validación actual ni una prueba dentro de Foundry.

## Ya disponible y reutilizable

- Electron aislado, renderer sin Node y recursos locales; ejecutable y CI Windows. T020/T022 acreditadas en su alcance local actual.
- Ollama/TranslateGemma 27B predeterminado, selección 12B y LibreTranslate local/fallback. El registro de proveedores es reutilizable, pero solo admite dos proveedores locales y resultados posicionales.
- Lotes secuenciales, cancelación de solicitudes del lote, salida nueva, temporales con hard link sin reemplazo, recuperación por archivo y copia completa de recursos/directorios vacíos.
- JSON conservador y scripts JS/MJS/CJS mediante Acorn; nunca se ejecuta código del módulo ni se envía un archivo entero al modelo.
- Tokens técnicos conservados en host, deduplicación de fragmentos dentro de una solicitud Ollama y glosario persistido en localStorage. Existe extracción histórica de pares y detección de conflictos de corpus.
- 50 pruebas previas, prueba real de 57 JSON Bastion y nueve textos de translation.mjs. Copia identidad de 14.444 archivos: no equivale a traducción real ni a carga nativa.

## T001–T025 contrastadas con el código, antes de este incremento

| Tarea | Estado auditado | Evidencia y pendiente concreto |
|---|---|---|
| T001 | Parcial | research.md/package/build: stack ejecutado y licencias principales; falta cierre de compatibilidad/redistribución completo. |
| T002 | Pendiente | contracts.ts carece de FileJob, outcome/severity por archivo y ubicación por segmentos. |
| T003 | Parcial | moduleDiscovery/main/jobs: handles, rechazo de enlaces y destino nuevo; falta cubrir junctions, carreras y límites coherentes. |
| T004 | Parcial | providers.ts desacoplado y AbortSignal en lote; faltan IDs/capacidades y proveedores externos. server.ts eliminado correctamente. |
| T005 | Parcial | main/jobs: temporal/link sin overwrite; faltan validación final del temporal, durabilidad y fallos de disco inyectados. |
| T006 | Parcial | pipeline de carpeta y flujo individual renderer; falta contrato común, cancelación individual host y auditoría de hashes en producción. |
| T007 | Parcial | foundryPipeline/contracts cubren tokens y corrupción; falta corpus golden y pruebas por ubicación exhaustivas. |
| T008 | Parcial | JsonEngine/protección existentes; JSON.parse acepta duplicados y rutas de texto ambiguas. |
| T009 | Parcial, crítica | modifiedPaths no bloquea isValid; macros/fórmulas se comparan globalmente y pueden desplazarse entre campos; arrays de escalares no quedan cubiertos. |
| T010 | Parcial | UI auto/en/ru y cirílico; no hay abstención robusta español/mixto/idioma incierto por unidad. |
| T011 | Parcial | glosario gana y memoria aporta términos; faltan ámbitos por sistema, aprobación y contexto compatibles. |
| T012 | Pendiente | no existe almacén de resultados aprobados/candidatos/rechazados integrado al trabajo. |
| T013 | Parcial | Unicode/glosario/corpus probados; falta reutilización exacta contextual sin llamadas. |
| T014 | Parcial | copia completa y recuperación de archivo; faltan unidades/estados y recuperación por cadena. |
| T015 | Parcial | selección/progreso/cancelar existentes; faltan contadores reconciliados y resultados por archivo. |
| T016 | Parcial | recursión, destinos e inválidos probados; faltan permisos/disco lleno/rutas Windows. |
| T017 | Parcial | lote aborta y espera finalización; flujo individual no propaga señal por IPC; no se acredita latencia <=1 s. |
| T018 | Pendiente | resumen UI básico; no hay informe seguro exportable por ejecución. |
| T019 | Parcial | cancelación de traducción probada; faltan extracción, validación y commit con carreras. |
| T020 | Implementada | Electron aislado, main/preload empaquetados, IPC y prueba sin Node renderer. |
| T021 | Parcial | diálogos/snapshot/openOutput existen; eventos batch sin secuencia ni FileJob final. |
| T022 | Implementada, alcance local | loopback/payload/emisor/renderer probados; proveedores externos requerirán ampliación sin secretos renderer. |
| T023 | Parcial | portable y CI, Windows 11 sin Node; Windows 10 y máquina limpia independientes pendientes. |
| T024 | Parcial | lint/test/build y corpus; no SC completo ni smoke Foundry V14.368. |
| T025 | Parcial | documentación incremental; encabezados antiguos y referencias server.ts requieren conciliación. |

No se eliminan ni se dan por completadas las tareas por similitud de nombres o por checkbox. Los pendientes de estas tareas se reutilizan como dependencias; las nuevas no deben duplicar implementaciones existentes.

## Riesgos e incompatibilidades concretas

1. **Carga nativa de compendios:** copiar LevelDB/.db mientras se traducen fuentes `_source` deja los documentos efectivos sin traducir. Se necesita adaptador de exportación/reconstrucción con herramienta oficial, esquema compatible y staging validado. No editar binarios con regex. [Formato oficial de packs](https://foundryvtt.com/article/v11-leveldb-packs/).
2. **Babele en el origen:** FifthPendium recomienda Babele y sus scripts registran integraciones condicionales. El traductor no instala Babele, pero copiarlo no acredita independencia. Se debe probar el resultado sin ese módulo; dependencias obligatorias se diagnostican, nunca se eliminan a ciegas.
3. **Cobertura nativa incompleta:** manifiestos y lang se copian intactos; no hay es.json/registro español nativo. La etiqueta de un pack o una clave i18n puede seguir en otro idioma aunque el JSON fuente esté traducido.
4. **Integridad:** parser pierde claves duplicadas; rutas `a.b`/índices pueden ser ambiguas; validador acepta valores técnicos modificados y swaps globales. Prioridad inmediata antes de memoria/optimización.
5. **Memoria:** TranslationSourceManager está separado del host, solo EN y usa lowercase/espacios como identidad; incluso devuelve un par completo para una subfrase. memoryContext usa términos históricos sin aprobación/contexto. No es TM exacta confiable; los corpus deben importarse como candidatos hasta revisión.
6. **Glosario:** sustitución sobre el texto completo puede alcanzar marcadores técnicos. Falta ámbito por sistema y conflictos. Los términos no deben cambiar tokens protegidos.
7. **Correspondencia:** array de traducciones valida cantidad, no identidad ni mezcla. Mantener batch pequeño hasta contrato con IDs, fallback y benchmark.
8. **Estados y recuperación:** completed cuenta archivos procesados incluidas copias fallidas; no significa traducción aprobada. Se necesitan outcome/severity y gate. Un error de cadena hoy restaura todo el archivo.
9. **Observabilidad y cancelación:** errores genéricos, sin logs persistentes/rotación, métricas ni informe exportable; cancelación individual incompleta. No optimizar concurrencia ahora.

## Perfil y certeza de versión

Se verificó la existencia de [Foundry 14.368](https://foundryvtt.com/releases/14.368) y la [API TextEditor v14](https://foundryvtt.com/api/v14/classes/foundry.applications.ux.TextEditor.html). Esto no acredita schemas de sistemas ni compatibilidad de versiones posteriores. El manifiesto FifthPendium 5.5.4.6 declara core mínimo 13/verificado 14 y dnd5e 5.3–5.9.9; hay que contrastarlo con la instalación del mundo de prueba. No se localizó el runtime en las rutas de instalación habituales comprobadas; no se ejecutó Foundry.

## Identificadores y orden del nuevo trabajo

T026–T029 históricos se conservan. Los requisitos nuevos se nombran **N026–N060**, y sus tareas son **T030–T064** respectivamente (ID nuevo = ID solicitado + 4). El orden del archivo sigue dependencias/prioridad, no orden numérico.

1. Perfil N041; placeholders/referencias/rolls/HTML N042–N046; diff N050; corpus N049; gate/publicación/recuperación N060/N053/N054. Reutilizar T002–T009/T019.
2. Diagnóstico/logs/informes/retención/métricas N034–N038. Reutilizar T018/T021.
3. TM aprobada y feedback N026/N029/N030/N056, glosario/conflictos/procedencia N031/N055/N057/N058. Reutilizar T010–T013.
4. Caché contextual/deduplicación/incremental N028/N027/N059; detector sospechoso/idioma N047/N048.
5. Batches con IDs N032, benchmark N039, concurrencia acotada N033 y regresiones transversales N040. No cambiar 27B por velocidad.
6. Packs nativos/carga real/sin Babele N051/N052, Windows 10/11 limpio T023, cierre T024/T025. Preparar fixtures y protocolos desde fase 1; aceptar solo con evidencia real.

Paralelismo admisible después de fijar contratos: fixtures de referencia y protocolo Foundry; rotación de logs y esquema TM; benchmark y UI de revisión cuando estén listos proveedor/unidades/gate. No editar en paralelo motores compartidos, publicar antes del gate ni aumentar solicitudes GPU concurrentes. Esta auditoría no crea agentes.

Requieren runtime real: N041 verificación de esquemas, N051/N052 carga de documentos/compendios sin Babele, N043/N044 sintaxis enriquecida frente a fixtures reales, N039 calidad/VRAM de modelos instalados; T023 requiere sistemas Windows independientes. No simular PASS para esos criterios.

## Primera implementación autorizada

Se empieza por parse estricto, ubicaciones por segmentos, diff estructural con allowlist, preservación técnica por ubicación, cobertura de Macro/rolls/URLs y protección del glosario frente a tokens. Se reutiliza JsonEngine/FoundryValidator/ProtectedContentEngine y sus consumidores; no se reemplazan React, Electron ni los proveedores. El resto se mantiene explícito en el backlog. La constitución se armoniza con el alcance JS ya autorizado y la nueva prioridad nativa, sin cambiar la obligación de conservar originales.

## Resultado del incremento 0.4.1

Implementados parse estricto y rechazo de duplicados, reinserción por segmentos propios sin recorrer prototipos, abstención ante rutas ambiguas/manifiestos, diff con allowlist de cadenas elegibles y validación técnica por ubicación/orden. Ampliadas referencias Macro, rolls genéricos, URLs/rutas, delimitadores de etiquetas visibles, HTML ejecutable y glosario fuera de marcadores. El renderer deja de anunciar éxito cuando la validación falla.

Se conserva el corpus histórico, pero se desactiva su aplicación automática como terminología obligatoria en el host: carece de aprobación/contexto compatibles. No se elimina el cargador ni se migra inventando aprobación. La TM avanzada sigue pendiente.

102 pruebas aprobadas, 13 categorías golden sintéticas, TypeScript/build/smoke aprobados. T009 se cierra por validación estructural local; T045/T053/T054 se cierran en alcance perfil documental/golden sintético/diff. Esto deja T001–T025 en tres acreditadas, diecinueve parciales y tres pendientes. Las 35 tareas nuevas tienen IDs únicos y se comprobó que sus dependencias no forman ciclos. Pendiente: formatos nativos efectivos, Foundry 14.368 real sin Babele, Windows 10/máquina limpia, logs/TM/cache/calidad adicional y optimizaciones.


## Actualizacion T030-T035, T038-T042 y T051-T052 (2026-10-02)

Completadas en el alcance local documentado: TM privada/aprobacion explicita/contexto, exact/fuzzy, glosario versionado, cache/dedup seguros; logs con rotacion/retencion, informes de exito/cancel/error/exportacion y metricas HTTP reales; detector de respuestas sospechosas/idioma con recuperacion y gate WARNING. 297 tests, lint/build/smoke PASS. Ver contracts/translation-reuse-diagnostics.md bajo specs/001-foundry-translator-mvp para esquema y limites. Se agregan metadatos al contrato operativo sin completar el cierre formal global T002/T010/T059/T061.

Sin cambios en T065, default TranslateGemma27B ni dependencias Babele. T055/T056 runtime14.368 mantienen NOT_RUN por decision del usuario. T060 feedback visual, T036/T037 optimizaciones y T043 benchmark real siguen pendientes. No se publican fuentes completas en logs ni se importan corpus antiguos como conocimiento aprobado.


## Actualizacion T059-T063 (2026-10-02)

Cerradas procedencia por ocurrencia, revision visual/IPC, conflictos contextuales, informe terminologico e inventario incremental. Se reutilizan store/runtime/jobs/gates existentes. Contrato: [review-incremental.md](../specs/001-foundry-translator-mvp/contracts/review-incremental.md). 340 tests/27 archivos PASS, con 43 nuevas regresiones. Estado de tasks: 41 completas y 27 abiertas; T065 intacta. T060 visual entregada; referencias anteriores a su estado pendiente son historicas.

El inventario no reconstruye packs ni evita validar/copiar archivos; reduce llamadas IA. Fuzzy es solo contexto, ediciones siguen candidatas hasta aceptar y los informes no corrigen variantes automaticamente. Los contextos humanos son acotados y privados; logs/procedencia exportan hashes. Productor efectivo LibreTranslate se distingue del modelo Ollama preferente.

Pendiente evidencia real Foundry14.368 sin Babele, Windows10/maquina limpia, calidad/benchmark de modelos y tareas generales abiertas. Las pruebas usan proveedores controlados y no certifican calidad linguistica real. No se tocan originales ni se aprueba/importa corpus historico.


## Fase urgente T069?T073 (2026-10-02)

Ver [auditoría de memoria e inferencia](THERMAL_MEMORY_AUDIT.md) y [contrato](../specs/001-foundry-translator-mvp/contracts/thermal-memory-preflight.md). 360 pruebas locales PASS; importaci?n de spanish exclusivamente como candidatas por decisión del usuario, con backup y preservaci?n de memoria/cach? anterior. Zero aprobadas explica exact/fuzzy0. Canonical requiere identidad/version/campo y aprobación. Telemetr?a NVIDIA no inventa temperatura de memoria ausente. Benchmark y seguridad f?sica de ejecuci?n larga no acreditados; batching/concurrencia no implementados, T065 suspendida.
