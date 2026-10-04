# Contrato T075: memoria bilingüe SRD PDF

Implementación de escritorio 0.4.4. La verificación documental de T074 permanece vigente; una correspondencia bilingüe necesita aprobación independiente. Ningún PDF ni JSON original se modifica.

## Registro privado

Se amplía MemoryEntry sin cambiar las entradas anteriores. El atributo opcional `pdf` contiene:

```json
{
  "edition": "srd-5.2.1",
  "source": {"document": "<16 hex>", "segment": "<document>-p2-s1", "page": 2, "text_hash": "<64 hex>"},
  "target": {"document": "<16 hex>", "segment": "<document>-p2-s1", "page": 2, "text_hash": "<64 hex>"},
  "kind": "heading",
  "method": "MANUAL_ALIGNMENT",
  "score": 1,
  "edited": false
}
```

Los hashes abreviados son ilustrativos. `kind`: heading o paragraph. `method`: STRUCTURAL_CANDIDATE o MANUAL_ALIGNMENT. Score no representa aprobación ni garantiza equivalencia semántica. Todos los pares nuevos tienen status CANDIDATE, approved false; aceptar requiere validación de fuente, tokens y calidad. EDIT crea otra candidata. REJECT/RESTORE impiden reutilización; RESOLVE selecciona una variante contextual y rechaza alternativas.

El corpus comprueba SHA-256 del PDF original y sellos pages_sha256/segments_sha256 de la extracción, procedencia USER_VERIFIED, idioma, página, segmento y texto. Los bloques usan sufijo -sN; líneas breves aisladas derivadas del archivo de páginas sellado usan -lN y solo sirven para selección manual, sin ampliar la generación heurística. Un corpus obsoleto o defectuoso deshabilita reutilización y genera diagnóstico; la aplicación continúa sin inventar datos. Se admite exclusivamente SRD 5.2.1 EN/ES para reutilización dnd5e en nombres/descripciones. El Manual permanece referencia verificada; no se mezcla con SRD ni otras ediciones/sistemas.

## Identidad y reutilización

PDF_EXACT exige texto EN exacto, campo y sistema compatibles, par aprobado y ausencia de conflicto. Normalización nativa únicamente de espacios: no elimina guiones significativos. No resuelve nombres RU por similitud.

Para RU, el usuario elige un campo real de un documento Foundry con UUID, versión, sistema, módulo, tipo, ruta y hash del texto. `pdf.binding` agrega source_hash, source_excerpt, source_text y usage EXACT o CONTEXT_ONLY. El texto completo se guarda en memoria privada para permitir revisión. El vínculo empieza como candidata y necesita una segunda aprobación. Cambiar texto, versión, ruta o identidad invalida la correspondencia. Conflictos entre fuentes EN distintas para el mismo campo nativo bloquean reutilización.

EXACT requiere que sustituir el campo supere los controles de estructura protegida. Si la traducción plana del PDF no conserva HTML/referencias, CONTEXT_ONLY aporta referencia a IA y nunca reemplaza directamente el campo.

Prioridad: memoria canónica aprobada (incluido PDF), TM exacta/PDF exacto, caché, glosario, contexto aprobado, proveedor. Referencia contextual: máximo una, hasta 200 bytes UTF-8; pareja completa o una oración española completa. No truncar JSON, palabras, referencias ni decimales. Fuzzy es contexto, nunca sustitución automática. El modelo sigue siendo TranslateGemma 27B con el contrato lingüístico existente.

Las aprobaciones PDF llevan rules_version terminado en /pdf-srd-1 para evitar que clientes anteriores las reutilicen sin estos controles. El fingerprint de corpus/interpretación y revisión participa en caché/preflight; las claves ajenas al ámbito PDF mantienen compatibilidad. No se convierte caché ni propuestas previas en conocimiento aprobado.

## Preflight, informes y revisión

`pdf_memory` agrega alignment_entries, approved_alignments, candidate_alignments, conflicting_approved_alignments, conflicting_canonical_bindings, canonical_bindings y reference_fingerprint. Los documentos verificados se cuentan separados de los pares aprobados. Preflight muestra exact/canonical/context candidatos, revisión pendiente y estimación de llamadas evitadas, sin inferencia.

Runtime registra pdf_exact_hits, pdf_canonical_hits, pdf_context_hits y pdf_model_calls_avoided. Los últimos son solicitudes iniciales estimadas evitadas según fragmentación vigente, no retries ni ahorro medido de GPU. Caché/glosario/baseline no se atribuyen indebidamente a PDF. Provenance PDF_EXACT/PDF_CANONICAL/PDF_CONTEXT conserva documento, página y hash; los informes omiten texto completo del vínculo. Se preservan las validaciones y publicación atómica nativas.

En Memoria y revisión: filtrar SRD PDF; preparar propuestas o buscar fragmentos EN/ES; crear candidata; comparar y aceptar. Para RU: vincular a documento Foundry, revisar texto completo y aceptar la nueva candidata. Después ejecutar preflight. No es necesario Python para revisar/reutilizar el corpus ya preparado desde el ejecutable.

Herramientas: `npx tsx scripts/managePdfMemory.ts generate|audit`; bind requiere ID, raíz, archivo y ruta JSON. Las mutaciones exigen aplicación cerrada y backup previo; audit es readonly. `npx tsx scripts/auditPdfCoverage.ts` registra cobertura real sin inferencia ni cambios de memoria.

## Evidencia y límites

385 pruebas / 33 archivos PASS, incluyendo golden EN/RU, HTML, UUID, rolls, conflictos, cancelación, disco lleno, fuente alterada, aprobación independiente, alcance y contexto RU protegido. Auditoría privada: 8.372 pares candidatos añadidos, 23.367 entradas totales, 0 aprobadas, caché 5.000 y entradas anteriores preservadas. Fifthpendium: 0 reutilizaciones aprobadas y 0 vínculos canónicos. Por tanto todavía no se acredita reducción real de carga GPU: primero deben revisarse correspondencias útiles. No hubo inferencia real, benchmark ni validación dentro de Foundry 14.368 en esta entrega. Batching, concurrencia y T065 permanecen suspendidos.
