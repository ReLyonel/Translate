# T077 — corpus histórico aprobado y preflight, 2026-10-03

**La reutilización histórica ya funciona; T077 sigue abierta por evidencia canónica SRD.** Se incorporó la declaración explícita del usuario de que tradujo/revisó el corpus Babele. Esta aprobación de traducción no constituye identidad Foundry/SRD. No se creó una nueva fase ni se ejecutaron T043/T036/T037 o traducción masiva.

## Comparación de FifthPendium

| Métrica | Baseline anterior | Nuevo preflight |
|---|---:|---:|
| Archivos descubiertos | 4.109 | 4.109 |
| Strings detectadas | 29.971 | 29.971 |
| Strings únicas | 29.348 | 29.348 |
| Reutilización histórica/TM exacta | 0 | 3.984 |
| Canonical/SRD/cache/glosario hits | 0 | 0 |
| Strings que requieren IA | 28.372 | 24.388 |
| Solicitudes iniciales estimadas | 33.942 | 29.958 |

Se eliminan 3.984 strings de la ruta de IA (14,04 %) y 3.984 solicitudes estimadas (11,74 %). El total resuelto sin IA es 4.960: 3.984 por memoria aprobada y 976 exclusivamente protegidas que ya existían. AI avoidance rate = 16,9006 % sobre las 29.348 strings únicas; no se atribuyen las 976 protegidas a ahorro nuevo. El denominador coincide con el baseline. Las estimaciones cuentan fragmentos iniciales, sin reintentos ni fallos runtime.

Persiste PREFLIGHT_INCOMPLETE_FILES por 2 archivos omitidos durante validación previa. MEMORY_UTILIZATION_WARNING y NO_APPROVED_MEMORY ya no aparecen en este módulo. El baseline no se declara de producción porque falta la aceptación canónica de T077.

## Contadores independientes

| Grupo | Métrica | Valor |
|---|---|---:|
| Babele | Entradas raíz leídas | 6.299 |
| Babele | Entradas embebidas inspeccionadas | 3.199 |
| Babele | Grupos únicos por contexto | 7.472 |
| Babele | Variantes aprobadas | 7.445 |
| Babele | Hits exactos seguros en pipeline | 3.984 |
| Babele | Entradas con CONTEXT_REQUIRED | 6.360 |
| Babele | Grupos conflictivos excluidos | 27 |
| TM | Entradas cargadas, sin PDF | 22.502 |
| TM | Entradas aprobadas | 7.445 |
| TM | Unidades con candidatos exactos/contextuales | 12.352 |
| TM | Hits exactos | 3.984 |
| TM | Unidades rechazadas por contexto | 1.518 |
| TM | Unidades con asociación de fuente sin verificar | 3.488 |
| SRD | Segmentos/líneas EN elegibles | 16.274 |
| SRD | Segmentos/líneas ES elegibles | 17.374 |
| SRD | Links EN/ES verificados | 0 |
| SRD | Links RU/SRD verificados | 0 |
| SRD | Hits | 0 |
| Caché | Hits actuales | 0 |
| Caché | LEGACY_CACHE_UNVERIFIED preservados | 5.000 |

Estas poblaciones no deben sumarse indiscriminadamente: variantes, grupos y unidades del módulo son cantidades diferentes. Las aprobaciones que no pasan contexto/asociación de fuente no reducen la estimación de IA.

## Confianza y preservación

La importación crea un recibo por corpus/fingerprint y 7.507 entradas internas, 7.445 aprobadas y 62 variantes retenidas para revisión. Todas mantienen EXACT_SOURCE_ONLY y canonical_identity UNKNOWN, sin canonical_uuid/canonical_evidence. Los IDs del diccionario histórico se utilizan para localizar campos candidatos, no para fabricar identidad canónica.

Los nombres RU literales, incluidos items embebidos, permiten demostrar la pareja textual. Una descripción cuyo texto RU original no figura en el histórico puede conservar aprobación de traducción histórica, pero su asociación al texto actual queda NATIVE_FIELD_PROJECTION y no se reutiliza automáticamente. Se informa TM_SOURCE_BINDING_UNVERIFIED. Términos cortos/polisémicos requieren sistema, módulo, pack, tipo/campo y contexto humano cuando existe. No se ejecutan conversores.

Los 3 conflictos originales permanecen excluidos, verificados comparando fuentes/alternativas con el respaldo anterior. La extracción de embebidos y agrupación textual por contexto descubre 24 grupos adicionales: 27 en total. Todos figuran TM_CONFLICT sin aprobación automática; el informe contiene source_ru, candidate_es, contexts, occurrences y provenance.

La reimportación real creó 0 entradas, no cambió bytes/revisión/estadísticas/timestamps y no incrementó times_used. Todas las entradas anteriores y los 5.000 registros de caché permanecen iguales al respaldo. Los 8.372 candidatos PDF permanecen AMBIGUOUS y sin aprobación. El módulo y los archivos históricos originales permanecen intactos.

SHA-256 de memoria antes: `7715c0f21a9041200578e0d926ee271616b8458361d1c36d8e12a6cbcb641c3c`; después de importación: `6edd82be68fb1da33d99f8124b2119e7e8d722a1b50ad5c248f854bad5a873a9`. El dry-run y sus muestras no modificaron esta base. Se conserva un respaldo privado en el directorio de memoria/backups.

## Evidencia de ejecución y SRD pendiente

Se probaron 20 hits reales históricos mediante TranslationRuntime con la red bloqueada, 0 llamadas a Ollama y sin publicar packs ni confirmar estadísticas de uso. Ejemplo real: Мультиатака → lookup exacto contextual → histórico manual aprobado → Ataque Múltiple; procedencia fifthpendium/fifthpendium.creatures.json, campo items[0].name, canonical_identity UNKNOWN. Esto es memoria histórica, no un mapping SRD VERIFIED.

El SRD ES conserva SRD_ES/AUTHORITATIVE_REFERENCE para correspondencias demostradas y tiene prioridad sobre memoria histórica cuando existe una pareja validada. Las fuentes disponibles son extracciones PDF: no aportan campos _id Foundry ni UUIDs explícitos o IDs de segmento comunes entre idiomas. Los identificadores se derivan de hash del PDF/página/orden y no son identidades canónicas de entradas. Estructura equivalente, títulos, números o posiciones no prueban alineación; cero parejas fueron fabricadas o promovidas. La muestra SRD informa UNAVAILABLE_NO_VERIFIED_CANONICAL_BINDING.

Queda demostrar la identidad RU → EN/SRD → ES a nivel de campo y 20 mappings canónicos reales, conservando validación estructural; repetir la evidencia correspondiente. No se consideran sustituidos por las 7.445 aprobaciones históricas ni por las 20 muestras de TM. No se exige revisar manualmente 8.372 candidatos para continuar.

## Entrega

451 pruebas/41 archivos, lint, build, smoke ASAR y portable sin Node/Bun en PATH PASS. Ejecutable 0.4.7 SHA-256: `E78202CC2B18E8C764BE9A8E2B8C3099A2372D26F270470870D0340CFFC1EEA8`.

Informes privados: [dry-run.json](../reports/canonical-memory/dry-run.json), [trusted-import.json](../reports/canonical-memory/trusted-import.json), [tm-conflicts.json](../reports/canonical-memory/tm-conflicts.json), [hit-examples.json](../reports/canonical-memory/hit-examples.json). Contrato: [canonical-reuse-audit.md](../specs/001-foundry-translator-mvp/contracts/canonical-reuse-audit.md).

Se detiene tras el nuevo preflight y sus verificaciones. T043 no ejecutada; T036/T037 continúan suspendidas; T065 permanece intacta.
