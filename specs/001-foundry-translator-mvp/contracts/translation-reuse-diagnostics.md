# Contrato: reutilización validada y diagnóstico — versión 1

Implementación T030–T035, T038–T042, T051–T052. Complementa los contratos de integridad/publicación y localización nativa; no cambia sus formatos de salida. TranslateGemma 27B sigue siendo el motor predeterminado. No introduce Babele, batching con IDs, concurrencia GPU ni reconstrucción de packs.

## Pipeline y fronteras

El host recibe unidades ya extraídas, nunca archivos completos para edición por IA. Cada unidad conserva texto original y contexto; el texto enviado al adaptador lleva placeholders. Los adaptadores separan los fragmentos humanos y mantienen los tokens en el host.

Orden de resolución: proteger → glosario explícito del usuario y glosario persistente compatible → TM exacta aprobada → caché versionada → ejemplos fuzzy aprobados → proveedor → restauración/validación → reinserción/gate/publicación existentes. Se valida cada hit antes de reutilizarlo. El glosario contradictorio invalida TM; un término explícito del usuario sustituye el término persistente del mismo nombre. Conflictos restantes detienen esa unidad, sin elegir una variante a ciegas.

`TranslateRequest.units` es opcional para mantener compatibilidad. Cada elemento contiene `sourceText` y, para llamadas internas del host, contexto. Debe corresponder por índice a `texts`; el IPC comprueba que la protección del original reproduce exactamente el texto protegido. No admite callbacks serializados ni rutas de disco desde el renderer. El host protege automáticamente texto directo sin marcadores. Si recibe marcadores sin original verificable, no usa TM ni caché para esa unidad.

La identidad usa texto original íntegro y lenguas, más `system`, `module`, `document_type`, `field_type` y glosario compatible. No se convierte a minúsculas ni se colapsan espacios. `json_path` localiza una ocurrencia y no forma parte de la identidad: permite reutilizar contenido equivalente en distintas ubicaciones compatibles. Referencias diferentes nunca son equivalentes por compartir los mismos nombres de placeholders.

El contexto actual deriva del módulo seleccionado, `_stats.systemId` cuando existe, `type` del documento y campo extraído. No se inventa un sistema desconocido. La compatibilidad es estricta, incluidos valores ausentes. No se comparte automáticamente una entrada sin contexto con un módulo distinto.

## Persistencia privada

Ruta: `app.getPath('userData')/translation-memory/store.json`. UTF-8, objeto JSON `version: 1`, propiedades `entries`, `cache`, `glossary`. Escritura serializada a temporal exclusivo, fsync y rename. Un esquema corrupto falla explícitamente; no se sustituye silenciosamente por una memoria vacía. Directorio/archivo enlazados se rechazan. Cerrar la aplicación antes de usar la herramienta CLI: no existe coordinación de escritores entre procesos.

Ejemplo de entrada, con valores ilustrativos:

```json
{
  "id": "sha256-de-identidad-y-variante",
  "source_text": "Sword",
  "translated_text": "Espada",
  "source_language": "en",
  "target_language": "es",
  "system": "dnd5e",
  "module": "example-module",
  "document_type": "weapon",
  "field_type": "name",
  "json_path": ["name"],
  "status": "CANDIDATE",
  "approved": false,
  "times_used": 0,
  "created_at": "2026-10-02T12:00:00.000Z",
  "updated_at": "2026-10-02T12:00:00.000Z",
  "translation_engine": "ollama",
  "model": "translategemma:27b",
  "rules_version": "integrity-4"
}
```

Los campos de contexto son opcionales. El identificador separa variantes de traducción; no implica aprobación. Fuente/target pertenecen a identidad/contenido, contexto a compatibilidad, engine/model a procedencia y fechas/uso a estadísticas. Respuestas de calidad PASS pueden guardarse como candidatos; WARNING/FAILED no ingresan en memoria/caché. Ningún resultado se aprueba automáticamente. `REJECTED` es un estado reservado para el futuro feedback T060; esta entrega no incluye su interfaz ni transición.

Solo `approved=true` y `status=APPROVED`, reglas vigentes y contexto compatible habilitan exact/fuzzy. Dos targets aprobados diferentes para el mismo original/contexto impiden exact y se excluyen del contexto fuzzy. Una aprobación manual revalida tokens, HTML y calidad. `times_used` cuenta ejecuciones de lote completamente limpias que reutilizan la entrada, una vez por entrada y ejecución; no cuenta intentos fallidos/cancelados ni exportaciones individuales pendientes de publicación.

La caché almacena `{value, created_at}` por SHA-256 de lenguas, texto original, contexto semántico, glosario completo/versionado, proveedor, modelo, `prompt-1`, reglas de protección y `foundry-v14.368`. Máximo 5000 entradas, expulsión por inserción. Cambiar cualquiera de estos datos cambia la clave. Su contenido sigue siendo no aprobado y se revalida al leerlo. Un fallback LibreTranslate no se guarda bajo una clave Ollama. Cambiar el prompt requiere incrementar su versión en el runtime.

La memoria y la caché contienen el texto traducible privado necesario para reutilizarlo; no se incluyen en informes ni se copian al módulo traducido. No hay migración automática del corpus histórico sin revisión/contexto/aprobación.

## Glosario y revisión disponibles

Formato de importación: array JSON de `{source, target, version, system?, module?}`. Términos globales y del contexto seleccionado se combinan; variantes incompatibles dentro del mismo ámbito se rechazan. La comparación de términos para conflictos no distingue mayúsculas. Los tokens técnicos prevalecen sobre cualquier término.

```json
[
  {"source":"Saving Throw","target":"Tirada de Salvación","system":"dnd5e","version":"1"},
  {"source":"Armor Class","target":"Clase de Armadura","system":"dnd5e","version":"1"}
]
```

Administración local explícita, con la aplicación cerrada:

```powershell
npx tsx scripts/manageMemory.ts "DIRECTORIO_USERDATA/translation-memory" list
npx tsx scripts/manageMemory.ts "DIRECTORIO_USERDATA/translation-memory" approve ID_REVISADO
npx tsx scripts/manageMemory.ts "DIRECTORIO_USERDATA/translation-memory" glossary "glosario.json"
```

La importación reemplaza el glosario persistente, no lo fusiona a ciegas. `list` muestra contenido privado solo en la consola solicitada. La interfaz actual conserva su glosario explícito. El feedback visual completo sigue en T060.

Fuzzy: intersección de conjuntos de palabras, al menos tres palabras comunes y similitud Jaccard ≥0,5. Máximo tres ejemplos aprobados; fuente/target de cada ejemplo se limitan a 300 caracteres y el contexto total a 2000. Se etiqueta como contexto y siempre se traduce el texto nuevo; nunca se devuelve el fuzzy como resultado automático.

## Calidad y recuperación

FAILED: resultado vacío, expansión mayor que `max(4×longitud original, original+300)`, explicación/prefijo del modelo, Markdown/JSON añadido, repetición evidente, tokens/HTML inválidos o idioma claramente inglés/ruso en texto suficientemente largo cuya fuente EN/RU esté confirmada. WARNING: texto largo idéntico o idioma objetivo incierto. Son heurísticas conservadoras, no una certificación lingüística ni un detector general de alucinaciones.

La validación de idioma exige al menos doce palabras y ochenta caracteres humanos; elimina tokens/markup. Exime textos cortos, nombres/acrónimos y textos dominados por palabras capitalizadas. Con fuente automática incierta no fuerza una validación agresiva de idioma. La detección de origen completa sigue en T010.

En lotes JSON/scripts, una unidad crítica conserva su original y genera recuperación STRING. Las demás unidades siguen procesándose; el archivo entero pasa de nuevo por el gate. Un warning de calidad marca el archivo WARNING y lo excluye del contador de archivos validados, aunque pase integridad. Ningún resultado crítico se publica como traducción. En traducción directa sin callback interno de recuperación, el error se devuelve al llamante sin resultado exportable.

## Logs y reportes

Ruta exclusiva: `userData/logs/`. Nunca bajo la carpeta fuente. Se crean siempre `app.log`, `errors.log`, `translation.log`: UTF-8, NDJSON, una entrada por línea. Los códigos de estado/motivo son identificadores estables; la interfaz los presenta con mensajes en español.

Cada lote y solicitud directa genera `runs/<fecha-UTC>_<UUID>/summary.json`, `errors.json`, `warnings.json`, `skipped.json`, incluidos cancelación y error posteriores a inicialización. Un fallo de disco que impida crear/escribir los propios logs se comunica como error; no puede garantizarse un reporte en un disco no escribible. Exportar crea una carpeta nueva mediante diálogo nativo; se impide exportar dentro del origen seleccionado.

Diagnósticos mediante allowlist: `file`, `json_path` (array de segmentos), `document_type`, `field`, `source_language`, `target_language`, `status`, `reason`, `provider`, `model`, `recovery_action`, `timestamp`, `scope`, cuando se conocen. Se descartan cuerpos del proveedor, textos fuente/target, credenciales, API keys, campos no permitidos y valores sospechosos de contener secretos. No se registra el mensaje bruto de una excepción. Los fallos de parse/IO pueden carecer de documento/campo. Un motivo específico de calidad aparece en warnings junto al diagnóstico de recuperación genérico del archivo.

Ejemplo:

```json
{
  "file":"packs/items/_source/a.json",
  "json_path":["system","description","value"],
  "document_type":"weapon",
  "field":"description.value",
  "source_language":"en",
  "target_language":"es",
  "status":"WARNING",
  "reason":"MODEL_EXPLANATION",
  "provider":"ollama",
  "model":"translategemma:27b",
  "recovery_action":"ORIGINAL_RESTORED",
  "timestamp":"2026-10-02T12:00:00.000Z"
}
```

`summary.json`: `schema_version=1`, `job_id` para lotes, `status`, `total`, `processed`, `validated`, `warning_files`, `failed_files`, `warning_count`, `unprocessed`, `sequence`, `metrics`. `processed+unprocessed=total`; processed incluye archivos recuperados publicados. failed_files puede estar incluido en unprocessed. validated solo incluye outcomes COMPLETED. warning_count cuenta diagnósticos, no archivos. Recursos copiados y diccionarios adicionales se distinguen de los archivos fuente seleccionados y no inflan total/processed. Una cancelación previa al descubrimiento tiene total=0, no inventa un inventario.

Solicitudes directas usan `scope=STRINGS`, total/processed/unprocessed en unidades y no atribuyen archivos inexistentes. errors/warnings/skipped son arrays, vacíos cuando corresponde. skipped contiene un motivo agregado de las unidades/archivos pendientes; su cantidad se encuentra en summary.unprocessed. No representa un inventario de archivos aún no descubiertos. Los snapshots de lote tienen secuencia creciente; reportAvailable añade un evento final posterior a la secuencia capturada en summary.

Rotación: por defecto 1 MiB por log, tres backups además del activo, máximo cincuenta ejecuciones y treinta días. `logs/log-policy.json` permite `{maxBytes,maxFiles,maxRuns,retentionDays}`, enteros positivos (maxBytes ≥100); valores ausentes usan defaults, inválidos fallan explícitamente. Limpieza solo de directorios de ejecución gestionados con formato esperado y rutas reales contenidas; no sigue enlaces ni borra directorios ajenos. Retención se aplica al iniciar una ejecución. Los cuatro reportes de una ejecución se conservan juntos hasta su eliminación por retención.

## Métricas

Todos los nombres requeridos están presentes incluso con valor cero: files_scanned/files_processed, strings_detected/translatable/protected/unique/deduplicated, tm_exact_hits/tm_fuzzy_hits, cache_hits/cache_misses, ollama_requests/failures/retries, translation_time/validation_time/total_time, strings_per_second, characters_translated/reused; adicionalmente libretranslate_requests.

- files_scanned: todos los archivos descubiertos, incluidos recursos. files_processed: archivos fuente publicados, incluidos recuperados.
- strings_detected: cadenas inspeccionadas en JSON; literales humanos extraídos en scripts; unidades extraídas en localizaciones procesadas. translatable: candidatas enviadas a reutilización/traducción. No afirma inspeccionar cadenas arbitrarias de código.
- protected: unidades con al menos un token, no número de tokens. unique/deduplicated se calculan sobre identidades compatibles de unidades traducibles, no sobre cadenas técnicas excluidas. `unique+deduplicated=translatable` para unidades efectivamente sometidas al runtime; cancelación puede dejar candidatas extraídas aún sin procesar.
- exact/cache/fuzzy contabilizan hits por consulta efectiva; una duplicación interna reutilizada no agrega otra consulta. fuzzy_hits significa contexto usado, no traducción automática.
- Peticiones/fallos/reintentos Ollama y peticiones LibreTranslate se incrementan en el adaptador alrededor de llamadas HTTP reales; no se estiman por cadenas. La traducción por glosario puede requerir cero peticiones.
- Tiempos en segundos con `performance.now()`. translation_time mide adaptadores (incluidas sustituciones locales); validation_time mide validación de resultados frescos y el gate inicial de JSON. No pretende ser profiling exclusivo de todas las CPU/IO ni suma de tiempos de todos los checks temporales. total_time cubre el runtime del lote hasta iniciar escritura del reporte.
- strings_per_second: unidades nuevas procesadas por adaptador divididas por translation_time; no incluye unidades exact/cache/dedup como traducciones nuevas. characters_* cuenta longitud de campos fuente incluidos tokens; no tokens generados por el modelo.

## Evidencia y límites

Pruebas en `tests/memory/runtime.test.ts`, `tests/logging/runLogger.test.ts`, `tests/quality/language.test.ts`, `tests/metrics/runMetrics.test.ts`, `tests/contracts/ollamaDesktop.test.ts`, más corpus/gates nativos existentes. Incluyen aprobación/conflictos/contexto, caché por modelo/glosario, EN/RU, dedup sensible a referencias/espacios, recuperación granular, cancelación/error, redacción, rotación/retención y contadores HTTP reales.

No acredita calidad real de TranslateGemma ni aceptación Foundry 14.368. T055/T056 siguen pospuestas. No cambia T065. T036/T037/T043/T060/T061/T062/T063 conservan su alcance pendiente (batching, concurrencia, benchmark, feedback completo, revisión de conflictos, reporte terminológico e incremental explícito).
