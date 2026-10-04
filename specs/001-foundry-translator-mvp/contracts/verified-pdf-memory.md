# Memoria de referencia PDF verificada

Registro privado: `%APPDATA%/foundry-translator/translation-memory/pdf-reference/index.json`.
Versión 1. Confirmación de autoridad: el usuario indicó expresamente que los PDFs de `spanish` son fuentes verificadas. Esa decisión se registra a nivel documental; no se aplica a los JSON importados como candidatas.

```json
{
  "schema_version": 1,
  "policy": "VERIFIED_REFERENCE_ALIGNMENT_REQUIRED",
  "documents": [
    {
      "id": "primeros-16-hex-del-sha256",
      "sha256": "sha256 completo del PDF",
      "language": "es",
      "pageCount": 398,
      "segmentCount": 12677,
      "status": "processed",
      "source_verified": true,
      "source_verification": "USER_VERIFIED",
      "verification_scope": "DOCUMENT_ONLY_NOT_BILINGUAL_ALIGNMENT",
      "approved_translation_pairs": 0
    }
  ]
}
```

El ejemplo abrevia hashes para explicar el formato; los valores reales se validan como 64 y 16 caracteres hexadecimales relacionados. Incluye además path/fileName/size, verified_at ISO UTC y documentType reference. Idioma se detecta desde contenido; no se atribuye español al SRD inglés ni se clasifica el Manual del Jugador como SRD.

El extractor reutiliza scripts/pdf_corpus.py. Guarda `corpus/<id>/pages.jsonl` y `segments.jsonl` en el directorio privado con texto, página, orden, hashes y procedencia. No los publica en repo/logs ni modifica los PDFs. Comprueba SHA-256 antes/después de extracción, escribe el registro final por reemplazo de archivo temporal y no cambia store.json ni aprobaciones. No ejecuta Ollama ni OCR automático. La extracción PDF puede separar columnas, guiones, encabezados y tablas: verificar fuente no certifica cada segmento extraído ni su correspondencia bilingüe.

Preflight y summary.json agregan `pdf_memory`: loaded, verified_documents, documents_by_language, pages, segments, approved_translation_pairs y policy. La UI distingue documentos de referencia verificados de entradas TM aprobadas. Un registro corrupto o que atribuya aprobación automática a pares se rechaza. PDFs ausentes devuelven loaded false y contadores cero; no impiden usar una instalación sin corpus.

**Esta entrega registra e indexa referencia verificada; todavía no recupera esos fragmentos automáticamente en los prompts ni los usa como exact/canonical TM.** Falta validar correspondencias EN→ES por sección/término y enlazar documentos Foundry cuando exista evidencia. La paginación/nombres/posición por sí solos no autorizan pares. Las fuentes verificadas pueden proporcionar el texto español confiable, pero una alineación incorrecta también corrompería una traducción.

T075 deberá implementar recuperación acotada y pares validados con procedencia PDF/página, aislamiento dnd5e/SRD5.2.1, conflictos y pruebas EN/RU. Nunca promocionar alineaciones heurísticas por el solo hecho de que ambos PDFs sean oficiales. No cambiar la decisión del usuario sobre los JSON ni mezclar ediciones/reglas diferentes del manual y SRD automáticamente.


La limitacion de recuperacion anterior describe T074. T075 implementa reutilizacion validada segun [pdf-srd-reuse.md](pdf-srd-reuse.md), manteniendo autoridad documental y aprobacion bilingue separadas.
