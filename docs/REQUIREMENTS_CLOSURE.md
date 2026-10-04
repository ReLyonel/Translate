# Cierre T016 → T017 → T019 → T010 → T011 → T012 → T013

Fecha: 2026-10-03. Alcance: requisitos existentes del traductor; sin migraciones Foundry/dnd5e, sin inferencia real, sin nuevas fases. T036/T037/T043/T065/T077 permanecen suspendidas.

| Orden | Tarea | Evidencia |
|---|---|---|
| 1 | T016 | `tests/jobs/directory.test.ts`: rutas anidadas y extensión `.JSON`, arrays/IDs/paths conservados, JSON inválido aislado, junction real Windows rechazada antes de proveedor/salida, EACCES en discovery, EACCES/ENOSPC en publicación después de un archivo completo y destinos existentes/interiores rechazados. |
| 2 | T017 | AbortSignal llega al fetch del proveedor. Cancelar no reintenta ni activa fallback. La interfaz deshabilita el botón y muestra «Cancelando…» sin esperar al IPC; el host confirma después de finalizar escritura/limpieza/informe. |
| 3 | T019 | `tests/jobs/cancellation.test.ts`: abort en extracción, traducción, validación inicial/final, escritura temporal y copia; cero temporales al terminar, archivos completados conservados, snapshots independientes y secuenciales, informe cancelado reconciliado, baseline incremental y conocimiento aprobado sin promoción. Complementa las regresiones incrementales/térmicas existentes. |
| 4 | T010 | `languageDetector.ts` compartido por runtime/preflight/auditoría. EN/RU manual es autoritativo; auto analiza texto humano protegido, no atributos/referencias. No asume inglés por ausencia de cirílico. Mezclas, español, nombres inciertos y cirílico no identificable como RU conservan original + `SOURCE_LANGUAGE_UNCERTAIN`, sin proveedor ni persistencia. |
| 5 | T011 | Prioridad vigente preservada; glosario efectivo común en runtime/preflight, explícito sustituye persistido, conflictos no se adivinan. Corregido falso hit de caché contradictoria en preflight. |
| 6 | T012 | MemoryStore existente: estados CANDIDATE/APPROVED/REJECTED persisten tras recarga. Cache no implica aprobación. Aprobación explícita revalidada; ENOSPC/EACCES en aprobación conserva bytes/estado anterior y limpia temporal. Error/abort no aprueba ni incrementa usos confiables. |
| 7 | T013 | `tests/memory/languagesAndMemory.test.ts`: Unicode RU y ES, HTML/UUID/rolls originales, exact sin Ollama, dedup solo compatible, tipos de documento distintos, conflictos excluidos de exact/fuzzy, glosario local y caché compatible por modelo/prompt/idioma/contexto/glosario; legacy preservado sin hits. |

Se reutilizan `desktop/jobs.ts`, `atomicWriter.ts`, `TranslationRuntime` y `MemoryStore`. No se crean los componentes duplicados propuestos en rutas históricas `src/services/jobs/` y `jobMemory.ts`. Se ajustan las referencias de tareas a la implementación real.

## Defectos corregidos

1. Cancelación sin feedback inmediato del renderer mientras el host terminaba el trabajo.
2. Detección automática que convertía cualquier texto sin cirílico en inglés y consideraba caracteres protegidos como evidencia de idioma.
3. Diferencia entre preflight y runtime al evaluar caché contradictoria y términos explícitos frente a persistidos; conflictos visibles antes de inferencia.

La detección automática es una heurística conservadora, no un detector universal: nombres cortos no reconocidos requieren selección EN/RU manual. No identifica contenido técnico como texto para traducir ni modifica clasificación AST/JSON.

## Contrato conservado

- Resolución vigente: original solicitado/protección → correspondencia canónica/SRD aprobada → TM exacta aprobada compatible → cache compatible → glosario → contexto fuzzy → proveedor para misses. La prioridad vigente de T069–T073 prevalece sobre la descripción histórica de T011; no se vuelve a imponer otro orden.
- Un término explícito prevalece sobre el persistido de igual fuente. La memoria histórica y la caché pasan la compatibilidad de glosario; las traducciones canónicas/TM aprobadas conservan la política de autoridad existente. Todos los resultados pasan protección y calidad antes de uso/publicación.
- La petición de cancelación no revierte un syscall de commit ya iniciado. Puede terminar una publicación atómica en curso antes de la confirmación; el host espera su resolución y limpieza. Tras confirmar no hay nuevas escrituras de traducción. No se promete detener una llamada nativa de disco en un plazo fijo.
- Permisos y disco lleno se prueban por inyección de errores reales de API EACCES/ENOSPC en directorios temporales; no se llenó el disco del usuario ni se cambiaron ACL de módulos reales. La junction sí se creó y rechazó en Windows.
- Overlay, originales, estructuras, proveedores y modelo 27B conservan sus contratos. Sin batching, concurrencia ni importaciones/aprobaciones nuevas de memoria.

## Validación

510 pruebas/47 archivos PASS (41 pruebas nuevas sobre las 469 anteriores). Lint y build PASS. Se actualizó la prueba de error de logging para seleccionar EN explícitamente: una fuente incierta en auto ahora se conserva y no invoca el proveedor.

Prueba aislada del componente React real en Electron, con cancelación simulada tardando 800 ms y GPU deshabilitada: feedback «Cancelando…» en **1,5 ms**, botón deshabilitado y sin anunciar confirmación antes de resolver el IPC. No usa Ollama ni mundos Foundry. Evidencia privada: `reports/requirements-closure/cancel-ui.json` y harness correspondiente.

El preflight final usa explícitamente RU para comparabilidad con el baseline, la base activa y configuración del usuario, sin términos UI adicionales. Toda petición HTTP está bloqueada. Verifica hashes de base y fuentes antes/después; no traduce ni importa, aprueba o escribe conocimiento. `dedup_hits` = ocurrencias elegibles menos claves únicas compatibles; no sumar otra vez ese contador a los hits TM. Las solicitudes estimadas excluyen reintentos/fallos y no acreditan throughput, seguridad térmica física ni aceptación Foundry.

## Resultado del único dry-run FifthPendium

4.109 archivos; 29.962 ocurrencias elegibles, 29.339 claves únicas y 623 ocurrencias deduplicadas. Tiempo del preflight y comprobación posterior: 132,82 s. Red bloqueada: 0 peticiones HTTP, 0 Ollama. Fuentes y memoria intactas. `PREFLIGHT_INCOMPLETE_FILES` conserva la advertencia de archivos que no pasan las comprobaciones conservadoras; no se relajan validadores.

| Métrica | Baseline solicitado | Resultado | Diferencia |
|---|---:|---:|---:|
| strings_unique | 29.348 | 29.339 | −9 |
| tm_hits | 3.984 | 3.984 | 0 |
| cache_hits | — | 0 | — |
| glossary_hits | — | 0 | — |
| dedup_hits | — | 623 | — |
| strings_requiring_model | — | 24.379 | — |
| estimated_model_requests | 29.958 | 29.949 | −9 |

Los hits TM mantienen la cobertura histórica aprobada; no se importó ni aprobó conocimiento nuevo. El inventario actual contiene nueve cadenas elegibles menos que el baseline histórico. No se atribuye esa diferencia a estas tareas ni a mayor cobertura TM/SRD: el origen se fijó en RU y no se aportaron términos adicionales, por lo que las correcciones de detección automática/glosario no justifican por sí mismas ese cambio. No se ejecutó un segundo dry-run para reconstruir el inventario histórico ni se promete un porcentaje de ahorro.

La caché heredada sin identidad compatible sigue excluida y el glosario persistente no aporta entradas. Los 623 duplicados ya se excluyen del conjunto de claves únicas: no son 623 hits TM adicionales. Las 976 strings solo protegidas no necesitan IA. La estimación inicial puede superar el número de strings por fragmentación semántica; excluye reintentos.

Evidencia privada reproducible: `reports/requirements-closure/{preflight.ts,preflight.json,summary.json,cancel-ui.json}`. El harness de UI es una prueba aislada del componente real con IPC simulado, no una prueba de inferencia o latencia de disco real. El build queda verificado; no se empaquetó un nuevo portable ni se alteró el ejecutable 0.4.9 previamente entregado.

Se detiene tras este resultado. No se ejecuta benchmark, traducción masiva, T077, batching, concurrencia ni migración de esquemas.
