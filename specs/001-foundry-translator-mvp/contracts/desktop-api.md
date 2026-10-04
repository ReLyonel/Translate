# Contratos desktop propuestos

No son APIs ya implementadas. IPC renderer/preload/host tipado; validar payload/emisor,
contextIsolation activado y renderer sin Node.

| Operación | Entrada | Salida |
|---|---|---|
| selectInput | kind=file/directory | selectionHandle, displayPath o cancelación |
| selectOutput | diálogo nativo | outputHandle, displayPath o cancelación |
| inspectInput | selectionHandle | found, compatible, idiomas, advertencias |
| startJob | handles, sourceLanguage auto/en/ru, targetLanguage es, providerId, glossaryVersion | jobId |
| cancelJob | jobId | accepted, state |
| getJob | jobId | snapshot/contadores/FileJob |
| subscribeJob | jobId | eventos con sequence creciente |
| exportReport | jobId + diálogo | savedPath o cancelación |
| openOutput | jobId | opened o error |
| listProviders | ninguna | id, executionMode, disponibilidad/modelo, sin secretos |

Handles creados por host y ligados a selección real; sin rutas arbitrarias/traversal.
Destino distinto, fuera del origen y nuevo. Abrir carpeta solo usa salida del job.
Eventos: job.started, file.started, file.finished, job.progress, job.finished,
job.cancelled, job.failed; jobId, sequence, timestamp y payload. Snapshot recupera
estado perdido. Progreso no acredita validación.
Errores seguros en español: INPUT_INVALID, OUTPUT_CONFLICT, PERMISSION_DENIED,
UNSUPPORTED_FORMAT, PROVIDER_UNAVAILABLE, PROVIDER_TIMEOUT, INVALID_RESPONSE,
VALIDATION_FAILED, DISK_FULL, CANCELLED.

## TranslationProvider

metadata() -> id, executionMode, idiomas/capacidades.
translate(units, sourceLanguage, targetLanguage es, glossary, AbortSignal)
-> resultados unitId/translatedProtectedText uno a uno.
Solo texto protegido, sin JSON completo ni credenciales. Rechazar IDs desconocidos,
duplicados, cantidad incorrecta y respuesta mal formada. Timeout/reintentos
acotados respetan abort. Proveedor no modifica archivos.

## Escritura e informe

atomicWriter recibe resultado passed y ruta autorizada; temporal en mismo volumen,
commit sin reemplazo existente y limpieza ante error/abort. Sin operación overwrite.
Informe: versiones app/reglas, proveedor local/externo, tiempos, contadores,
estado/severidad/motivo por archivo y salida; sin secretos ni texto completo.

## Implementación desktop actual

API tipada en desktop/contracts.ts: health/getSettings/saveSettings/translate,
selectInput/readInput/saveJson/openOutput y getProgress/onProgress. El snapshot
y eventos sequence corresponden a solicitudes de proveedor, no a FileJob validados.
Contratos de trabajos/lotes/exportReport quedan para T002/T014/T018.
No se registran endpoints HTTP.
## Revisión vigente 2026-10-02

El código tipado ejecutado sigue siendo `desktop/contracts.ts`; contiene también startBatch/cancelBatch/getBatchProgress/onBatchProgress. Esta ampliación conserva esos métodos y añade progresivamente FileJob/sequence/informes/revisión de TM. La cancelación de archivo individual por IPC queda pendiente; no se acredita a partir de AbortController del renderer.

Nuevos contratos previstos: provider metadata/capabilities con LOCAL|EXTERNAL e IDs por unidad; aprobación/rechazo/edición de memoria solo en host con validación; exportación de informes por diálogo nativo; perfil Foundry y publicación de packs en staging. Ningún contrato concede rutas arbitrarias, secretos renderer ni ejecución de scripts del módulo. Los protocolos futuros no se anuncian como funcionalidades disponibles.


## Contrato implementado de salida (2026-10-03)

Ver [output-strategies.md](output-strategies.md): startBatch acepta outputStrategy opcional; TRANSLATION_OVERLAY es el default y FULL_PORTABLE_COPY es explicito. BatchProgress contiene outputStrategy, publication y FileOutcome.written. El contrato propuesto anterior no reemplaza desktop/contracts.ts.
