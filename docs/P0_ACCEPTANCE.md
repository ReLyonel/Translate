# Aceptación P0 controlada — 2026-10-03

**Resultado: aceptación completa pendiente.** La traducción/validación/overlay pasa las comprobaciones del corpus; Foundry bloquea la activación de FifthPendium por incompatibilidad previa con el sistema instalado. No se cambió ese requisito ni se acreditan T055/T056.

P0 features congeladas. Solo se corrigieron defectos descubiertos durante la aceptación; no hay funcionalidades P1/P2, nuevas tareas arquitectónicas, batching, concurrencia ni benchmark. T077 queda P1 y no se continúa. T043/T036/T037/T065 suspendidas.

## Los ocho avisos de identidad

| Archivo | Clasificación | Evidencia / actuación |
|---|---|---|
| `packs/dmg/_source/…dmgMagicItemList.json` | EXPECTED_WARNING | `pages[1].text.content` contiene sintaxis técnica ambigua en el original. Se conserva; no se relaja la protección. |
| `packs/items/_source/…dmgAbsorptionIou.json` | EXPECTED_WARNING | `system.description.value` contiene sintaxis técnica ambigua original. Se conserva. |
| `scripts/abilityConfig.mjs` | TEST_ARTIFACT | Los segmentos señalados son HTML con interpolaciones ya localizadas; no contienen prosa para IA. El contexto de `DialogV2.confirm` ahora se reconoce sin modificar las expresiones. |
| `scripts/changelog.mjs` | EXPECTED_WARNING | Diccionario de etiquetas/nombres de módulos: no se presupone contexto traducible universal. Sigue intacto. |
| `scripts/contentManager.mjs` | EXPECTED_WARNING | Diccionario de grupos/libros sin prueba suficiente de contexto. Sigue intacto. |
| `scripts/sweetypremades/SLighting/migration.js` | TEST_ARTIFACT | HTML con referencias `game.i18n` dentro de `Dialog.confirm`, no prosa nueva para IA. Se reconoce el contexto estático; no se ejecuta migración. |
| `scripts/sweetypremades/smartChanter.mjs` | P0_DEFECT | Se omitían títulos de `ApplicationV2.DEFAULT_OPTIONS.window` y `DialogV2.wait`. Corregido por nodos AST y clases/API explícitas. |
| `scripts/ui/firstlaunch.mjs` | P0_DEFECT | Se omitía HTML visible de `DialogV2.prompt`. Corregido; `${...}` permanece idéntico. |

Defecto adicional descubierto en la selección del corpus: CSS asignado a `style.textContent` en `styles.js`/`cleanName.mjs` podía clasificarse como texto humano. El AST ahora reconoce elementos `style`/`script` creados con `document.createElement` y excluye sus contenidos ejecutables. No se cambian validaciones para ocultar avisos.

Regresiones: [p0AcceptanceDefects.test.ts](../tests/native/p0AcceptanceDefects.test.ts). Suite total: **469 pruebas / 43 archivos PASS**, lint PASS.

## Corpus y traducción real

Nueve archivos originales completos, copiados sin editar desde el árbol autorizado `FoundryVTT/Data/modules/fifthpendium`: cinco JSON y cuatro scripts. Se preserva cada ruta relativa. JSON: actor con item embebido y roll, item EN `Beguile`, facility RU `Guildhall` con descripción larga/HTML/UUID/rolls, item RU corto `Azurite` y journal EN `Chapter 1`. Scripts: `translation.mjs`, `smartChanter.mjs`, `firstlaunch.mjs`, `abilityConfig.mjs`.

Se cubren nombres/descripciones, campos técnicos, arrays, items embebidos, assets/rutas, referencias y fórmulas; scripts con diálogos, notificaciones, ChatMessage e interpolaciones. La presencia de ChatMessage en el corpus no demuestra que ese flujo se haya ejecutado: la aceptación dinámica quedó bloqueada.

Ejecución serial, idiomas explícitos por grupo RU/EN, Ollama local en 11500, `translategemma:27b`, contexto 4096, memoria/caché aisladas. No se tocó la TM de producción ni se ejecutó inferencia sobre el módulo completo.

| Métrica | Resultado |
|---|---:|
| Archivos de entrada | 9 |
| Archivos modificados/escritos | 8 |
| Archivos sin cambios | 1 |
| Archivos con WARNING | 3 |
| Cadenas recuperadas al original | 2 |
| Peticiones Ollama | 44 |
| Reintentos | 2 |
| Duración total | 128,21 s |
| `changed_forbidden_fields` | **0** |
| `assets_written` | **0** |
| GPU máxima observada | 75 °C |
| Temperatura de memoria | No disponible en el driver |
| Pausas térmicas | 0 |

Las descripciones de Guildhall y del item embebido del actor fallaron la validación de calidad: se conservan originales y se publican otros cambios válidos con WARNING. Firstlaunch también registra `UNCHANGED_LONG_TEXT` para un segmento. Las localizaciones españolas ya existentes permanecen intactas. No se afirma traducción completa de todas las descripciones ni calidad terminológica perfecta.

El guard térmico existente se configuró para esta prueba con GPU pause 80 °C/memoria pause 90 °C; habría cancelado de forma segura al alcanzar esos valores. No se modificaron clocks, voltajes, power limit ni ventilación. Al no producirse una condición térmica adversa real, la recuperación térmica se respalda en los tests existentes, no en una supuesta pausa observada.

## Diferencial e integración

Para los cinco JSON se aplica el gate completo con allowlist por ubicación. Solo cambian campos humanos permitidos; `_id`, `_key`, claves, tipos, estructura, arrays, flags técnicos, rutas de assets, imágenes, URLs, referencias y fórmulas conservan sus valores. Se verifican hashes de originales y que ningún archivo del overlay sea idéntico al origen.

Para los tres scripts modificados se reparsean original/resultado y se comparan bytes fuera de rangos y AST, imports/exports, identificadores e interpolaciones. AbilityConfig queda sin cambios y no se escribe. La compatibilidad AST pasa; el comportamiento ejecutado de esos scripts no queda acreditado.

El overlay se integró mediante copia/sustitución de sus archivos en una copia completa aislada, sin eliminar archivos ausentes. Los cinco packs afectados se recompilaron con el CLI oficial **desde sus `_source` completos ya integrados**, no desde el delta parcial. El CLI es herramienta de aceptación; no se añadió reconstrucción al producto.

Informe diferencial privado: [differential.json](../reports/p0-acceptance/differential.json). Corpus: [corpus.json](../reports/p0-acceptance/corpus.json). Auditoría: [warnings-audit.json](../reports/p0-acceptance/warnings-audit.json). Ejecución y telemetría: [execution.json](../reports/p0-acceptance/execution.json).

## Foundry real y criterio pendiente

Se inició exclusivamente un mundo de prueba aislado con Foundry **14.368**, dnd5e **6.0.5**, idioma ES y Babele **no instalado**. La interfaz real de gestión informa:

> Este módulo requiere una versión máxima del sistema de 5.9.9, pero su versión es 6.0.5.

La casilla del módulo está deshabilitada, `enableable=false`, `module_active=false`; los cinco casos de packs devuelven `PACK_UNAVAILABLE`. El rango `5.3.0–5.9.9` procede del manifiesto original y permanece idéntico. No es una modificación producida por traducción. Tampoco se modificó para sortear la restricción.

**T055/T056 permanecen pendientes**: activación, apertura efectiva de compendios/documentos traducidos, carga de imágenes, UUID/enriched links, rolls reales del contenido, items embebidos y ejecución funcional de diálogos/mensajes/scripts. El mundo y core abren; Babele está ausente; esto no certifica que el módulo traducido funcione sin Babele.

La aceptación completa requiere una combinación válida de módulo y sistema para Foundry 14.368. Antes de autorizar cambios de compatibilidad, habría que demostrar el soporte real del módulo; no corresponde hacerlo automáticamente durante este freeze.

Evidencia del cliente Foundry: [foundry-runtime.json](../reports/p0-acceptance/foundry-runtime.json). Preflight original completo: [acceptance-report.json](../reports/p0-acceptance/native-plan/acceptance-report.json); además conserva los dos fallos de integridad del origen, no causados por la traducción. Los errores de preparación del mundo en logs antiguos son artefactos del harness y no se atribuyen al traductor.

Las fuentes instaladas y la memoria de producción permanecen intactas. La TM conserva SHA-256 `6edd82be68fb1da33d99f8124b2119e7e8d722a1b50ad5c248f854bad5a873a9`. Se detiene el trabajo tras esta aceptación parcial y se espera decisión; no se amplía el alcance.

Entrega de las correcciones: [portable 0.4.9](../release/Traductor-Foundry-0.4.9-x64.exe), SHA-256 `2463E5A654D4A79C6C3BFD27E62CEF4DBBD50490637B994DA236F3931D464E64`. Build, smoke ASAR y portable sin Node/Bun PASS. El servidor y navegador de prueba quedaron cerrados; Ollama no se detuvo y el modelo de esta prueba se descargó de VRAM. Resumen estructurado: [acceptance.json](../reports/p0-acceptance/acceptance.json).
