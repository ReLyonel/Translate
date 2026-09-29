# Arquitectura local

## Inspección inicial

La aplicación existente es una SPA React/Vite con un servidor Express en `server.ts`. La interfaz está dividida en traductor rápido, traductor JSON, glosario/PDF y ajustes. Ya existían `JsonEngine`, `TranslationService`, `ProtectedContentEngine`, `FoundryValidator`, `TerminologyEngine` y un extractor PDF en navegador. No había tests ni corpus persistente.

La integración original de Gemini era el único proveedor y se ha sustituido por un adaptador de Ollama en el servidor. Ningún secreto se expone al navegador y no se llama a una API cloud.

## Componentes y responsabilidades

* `server.ts`: límite local HTTP; comprueba Ollama y reenvía únicamente unidades de texto protegidas a `/api/chat`.
* `src/services/json/jsonEngine.ts`: descubre rutas Foundry documentadas y reconstruye desde el JSON original. Las rutas ambiguas son `UNCERTAIN` y no se incluyen automáticamente.
* `src/services/protected-content/protectedContentEngine.ts`: sustituye referencias, macros, fórmulas, dados y variables por tokens verificables; deja los labels `{visibles}` traducibles.
* `src/services/validation/foundryValidator.ts`: compara estructura, IDs, UUIDs, macros, fórmulas, números técnicos y firmas/atributos HTML antes de permitir descargar.
* `src/services/translation/translationService.ts`: orquesta términos, protección, proveedor, restauración y validación por lotes.
* `src/services/translation/translationSourceManager.ts`: índice de memoria local JSONL; sólo ofrece automáticamente entradas `approved` de alta confianza.
* `scripts/pdf_corpus.py`: CLI local que lee PDFs in situ con PyMuPDF y escribe índice/corpus bajo `data/sources`.

## Datos locales

Los PDFs se quedan en `PDF_SOURCE_DIR`. Los artefactos derivados se guardan en `data/sources/`; el índice y corpus regenerables no se versionan. La memoria EN→ES y terminología tienen formatos JSONL y pueden versionarse cuando sean datos autorizados.

## Límites actuales y evolución deliberada

La extracción no hace OCR por defecto y falla explícitamente si PyMuPDF no está instalado. La alineación bilingüe se deja para la siguiente unidad de desarrollo: debe producir candidatos revisables, nunca aprobar por número de página. La UI sigue usando el glosario local del navegador; las fuentes persistentes se integrarán mediante endpoints locales, sin duplicar documentos completos en React.
