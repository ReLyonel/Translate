# Pipeline de traducción local

1. `corpus:list` inspecciona los PDFs en `PDF_SOURCE_DIR`; `corpus:scan` genera `data/sources/pdf-index.json` con hash, páginas e idioma estimado por contenido.
2. `corpus:extract` usa Python/PyMuPDF localmente y genera `pages.jsonl` y `segments.jsonl` por documento. No traduce ni transmite PDFs.
3. La futura alineación EN/ES combinará encabezados, secuencia, longitud, números y similitud. Diferencias de números o fórmulas rebajan la confianza y requieren revisión.
4. La memoria `en-es.jsonl` sólo reutiliza entradas `approved` con confianza >= 0.90: hash, normalización y frase segura; fuzzy queda para revisión.
5. El extractor Foundry selecciona únicamente rutas conocidas. Las desconocidas quedan `UNCERTAIN` y no se traducen por defecto.
6. Antes de la IA, el protector conserva macros, UUIDs, tiradas, expresiones y variables. En `@UUID[…]{Counterspell}` sólo se protege `@UUID[…]`.
7. Se buscan traducciones confirmadas, terminología y memoria antes de solicitar texto nuevo a Ollama. Ollama recibe lotes de cuatro textos protegidos, no el JSON.
8. Se restaura cada token exactamente una vez, se reconstruye desde el JSON original y `FoundryValidator` bloquea la descarga ante cambios técnicos.

## Configuración

Copie `.env.example` a `.env` y configure `LOCAL_LLM_PROVIDER=ollama`, URL, modelo, contexto, temperatura y `PDF_SOURCE_DIR`. Instale las dependencias PDF de forma local con `python3 -m pip install -r scripts/requirements-pdf.txt`.
