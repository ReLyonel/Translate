# Pipeline de traducción local

> Correccion vigente 2026-10-03: [alcance P0/P1/P2](MVP_SCOPE.md). Overlay es el default; copia completa requiere seleccion explicita. Los ejemplos historicos de copia completa representan ese modo opcional.

1. `corpus:list` inspecciona los PDFs en `PDF_SOURCE_DIR`; `corpus:scan` genera `data/sources/pdf-index.json` con hash, páginas e idioma estimado por contenido.
2. `corpus:extract` usa Python/PyMuPDF localmente y genera `pages.jsonl` y `segments.jsonl` por documento. No traduce ni transmite PDFs.
3. La futura alineación EN/ES combinará encabezados, secuencia, longitud, números y similitud. Diferencias de números o fórmulas rebajan la confianza y requieren revisión.
4. La memoria `en-es.jsonl` sólo reutiliza entradas `approved` con confianza >= 0.90: hash, normalización y frase segura; fuzzy queda para revisión.
5. El extractor Foundry selecciona únicamente rutas conocidas. Las desconocidas quedan `UNCERTAIN` y no se traducen por defecto.
6. Antes de la IA, el protector conserva macros, UUIDs, tiradas, expresiones y variables. En `@UUID[…]{Counterspell}` sólo se protege `@UUID[…]`.
7. Se buscan traducciones confirmadas, terminología y memoria antes de solicitar texto nuevo a Ollama. Ollama recibe lotes de cuatro textos protegidos, no el JSON.
8. Se restaura cada token exactamente una vez, se reconstruye desde el JSON original y `FoundryValidator` bloquea la descarga ante cambios técnicos.

## Configuración

La aplicación usa Ajustes para URL/modelo local de Ollama, persistidos en userData. Para las herramientas auxiliares de corpus, `.env.example` documenta `PDF_SOURCE_DIR`. Instale las dependencias PDF de forma local con `python3 -m pip install -r scripts/requirements-pdf.txt`.

## Transporte desktop

La traducción usa window.desktop.translate -> preload -> host, sin HTTP frontend.
No se redistribuye corpus personal; memoria del portable opcional en userData/translation-memory.json.


## Reglas ejecutadas 0.4.1

JsonEngine.parse rechaza claves duplicadas. analyze conserva pathSegments y se abstiene en rutas ambiguas/manifiestos. reconstruct solo usa propiedades propias y segmentos existentes. FoundryValidator aplica diff recursivo y allowlist de cadenas seguras, tipos/arrays/valores tecnicos y firma tecnica por ubicacion/orden. jobs y renderer bloquean salida invalida; el glosario solo sustituye prosa fuera de marcadores. Delimitadores de labels, HTML ejecutable, Macro/rolls/URLs/rutas quedan protegidos.

Los corpus historicos se mantienen para migracion/revision y no se inyectan automaticamente como terminos obligatorios en host. No hay aun TM aprobada contextual/cache/logs integrados. Packs binarios se copian, no se reconstruyen: no acreditar natividad V14.368. Ver AUDIT_V14_368.md y FOUNDRY_V14_368.md.
