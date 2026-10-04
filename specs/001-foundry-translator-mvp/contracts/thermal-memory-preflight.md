# Contrato T069–T073 — memoria, preflight y observación térmica

Versión de los reportes: `schema_version: 1`. Aplicación: 0.4.2. No se incorpora batching, concurrencia ni reconstrucción automática de packs.

## Autoridad y reutilización

Prioridad operativa, después de decisiones manuales de rechazo/restauración e invariantes de integridad:

`CANONICAL_APPROVED_TRANSLATION > TM_EXACT > CACHE > GLOSSARY > TM_FUZZY_CONTEXT > TRANSLATEGEMMA`.

La identidad canónica requiere sistema, módulo/pack, tipo nativo del pack, `_id` de 16 caracteres, UUID completo, versión del módulo y ruta del campo. No se infiere por nombre parecido; documentos embebidos sin prueba de identidad no reciben identidad canónica. Una traducción aprobada EN→ES puede resolver RU→ES únicamente bajo esa identidad y pasando nuevamente referencias, tokens, HTML y calidad. Alternativas aprobadas distintas bloquean la elección canónica.

`store.json` mantiene versión 1 y agrega opcionalmente `canonical_uuid` y `canonical_version` a las entradas. Se conservan candidatos, rechazos, aprobación explícita y revisión existente. La importación offline lee escalares relacionados mediante pack/ID y rutas explícitas de diccionarios JSON; no ejecuta converters ni scripts y no interpreta PDFs. Leer ese formato histórico no introduce dependencia ni salida Babele.

La importación siempre crea `CANDIDATE`, `approved: false`, motor `manual-spanish-import`. No certifica calidad lingüística ni equivalencia semántica entre versiones. El usuario revisa cada entrada mediante la vista existente antes de aceptarla. Campos inseguros permanecen candidatos para edición y la aceptación exige validación. Los informes no incluyen los textos completos:

```json
{
  "files": 45,
  "candidates": 5078,
  "structurally_compatible_candidates": 4295,
  "reviewable_unique_units": 4291,
  "conflicting_units": 3,
  "unmatched": 3246,
  "unsupported": 4338,
  "approved_automatically": 0,
  "policy": "REVIEW_REQUIRED"
}
```

Estos contadores tienen denominadores diferentes: candidates son pares campo/target; unique_units son identidades/campos; unmatched cuenta registros sin relación demostrada y unsupported cuenta construcciones no admitidas. No sumarlos como si fueran cadenas exclusivas. La escritura de importación es una transacción atómica; no modifica fuentes ni elimina entradas anteriores. El script CLI exige la aplicación cerrada y respalda previamente la base privada. La importación desde UI usa el bloqueo de revisión del host.

## Preflight e IPC

`preflightBatch(handle, language, terms)` descubre y protege contenido sin inferencia, consulta metadatos `/api/ps` y NVIDIA cuando existen, y devuelve estadísticas más un token efímero del host. `startBatch` requiere ese token. Está ligado a handle, fuentes/manifest, idioma, terminología, configuración y revisión de memoria; se revalida después del diálogo de destino y se consume al empezar. Un cambio obliga a analizar de nuevo. Importar/revisar invalida el análisis anterior.

Reporte de preflight: `files`, `strings_translatable`, `strings_unique`, `canonical_candidates`, `exact_tm_candidates`, `cache_candidates`, `glossary_only_hits`, `protected_only_strings`, `original_choices`, `fuzzy_tm_candidates`, `strings_requiring_ai`, `estimated_model_calls`, `memory`, `warnings`, `placement`, `gpu`, `prompt`, `revision`, `fingerprint`. Exact/canonical/cache/glossary/protected-only/original/AI particionan las unidades únicas; fuzzy es un subconjunto contextual de IA. `memory` contiene loaded, entradas totales/aprobadas, pares de idiomas, glosario y caché.

`MEMORY_UTILIZATION_WARNING` aparece cuando existe memoria pero no candidatos exactos/canónicos; `NO_APPROVED_MEMORY` explica la falta de aprobación; `PREFLIGHT_INCOMPLETE_FILES` indica abstención sobre fuentes inseguras. Se muestran antes de confirmar Traducir y se registran al final cuando corresponde.

`estimated_model_calls` estima fragmentos sin reintentos ni fallos de ejecución. `incremental_reuse_estimated: false` indica que no anticipa reutilización del baseline incremental: puede sobreestimar llamadas si ese baseline existe. Tampoco constituye una predicción de tiempo/temperatura. La caché incluye perfil, reglas, prompt, idiomas, texto, contexto, modelo/motor, glosario y revisión; la nueva versión del prompt no reutiliza silenciosamente la caché antigua. NOT_LOADED/UNKNOWN y VRAM null no cargan el modelo para obtener una estimación.

## Contrato TranslateGemma

Se utiliza `/api/chat` sin sobre JSON y con un único mensaje user por unidad/fragmento, conforme al formato de la [biblioteca oficial Ollama](https://ollama.com/library/translategemma). Idiomas explícitos `Russian (ru)` o `English (en)` hacia `Spanish (es)`; las referencias técnicas originales se sustituyen antes por marcadores opacos. No se envía el archivo completo ni código ejecutable.

Ejemplo sintético del mensaje real sin contexto adicional:

```text
You are a professional Russian (ru) to Spanish (es) translator. Convey the meaning accurately using Spanish grammar and vocabulary. Return only the Spanish translation, without explanations or commentary. Preserve every [[PROTECTED_number]] placeholder exactly once in the original order.
Translate the following Russian text into Spanish:


Атака [[PROTECTED_0]]
```

`prompt_version: translategemma-native-2`; `num_ctx: 4096`, `num_predict: 2048`, temperatura 0. Fuente por fragmento ≤1200 caracteres y ≤1000 bytes UTF-8; prompt completo ≤1792 bytes; referencias contextuales y glosario ≤200 bytes cada uno. Los nombres históricos max_context_chars/max_glossary_chars describen límites implementados en bytes. Sin contexto relevante no se agrega. El presupuesto conservador no sustituye la tokenización real del modelo.

La segmentación conserva exactamente el texto fuente concatenado, corta por límites semánticos/espacios y no divide placeholders. Un bloque sin límite seguro genera abstención, nunca truncamiento silencioso. Se procesa individualmente, sin batching. Una respuesta vacía, explicativa, JSON/Markdown añadido, truncada o con marcadores faltantes/duplicados/alterados/inventados/reordenados se rechaza. Como política conservadora se exige orden de marcadores; puede abstenerse sobre una traducción lingüísticamente válida que los reordene. La publicación sigue las validaciones atómicas existentes. No se almacena como conocimiento aprobado una respuesta del modelo.

Se agregan cuando Ollama los entrega `prompt_tokens`, `generated_tokens`, `eval_duration`, `load_duration`. Duraciones de Ollama en **nanosegundos**, según [API chat](https://docs.ollama.com/api/chat); ausencias no se convierten en mediciones cero inventadas y `reported_fields` documenta disponibilidad. `/api/ps` informa residencia por size/size_vram, según [API ps](https://docs.ollama.com/api/ps); una foto actual no acredita el reparto histórico de una ejecución cancelada.

## NVIDIA y pausa

Solo lectura mediante `nvidia-smi -q -x`: nombre, utilización, temperatura GPU/memoria, VRAM usada/total, potencia y límites disponibles del driver. Los sensores no ofrecidos son null; ver [documentación NVIDIA](https://docs.nvidia.com/deploy/nvidia-smi/index.html). No se cambian clocks, voltajes, power limit ni ventiladores.

Estados: NORMAL, THERMAL_WARNING, THERMAL_PAUSE. Defaults de software configurados conservadoramente: GPU warning 80°C/pause 85°C; memoria warning 90°C/pause 96°C; histéresis 5°C, muestreo 5s. No son certificación de límites físicos del hardware. Un límite de pausa menor reportado por el driver prevalece. El ajuste de usuario habilita/deshabilita observación; no ofrece controles del hardware.

Durante pausa se aborta la petición propia en curso y se conserva el archivo sin publicar. Se esperan tres muestras frías sucesivas antes de reintentar esa unidad; cancelar interrumpe la espera y conserva la recuperación/atomicidad/checkpoints del trabajo existente. Pérdida de sensor durante una pausa conserva la pausa. Sin temperatura de memoria desde el inicio no se inventa valor ni se bloquea normalmente por ese sensor. **Con memoria N/A no se puede detectar el sobrecalentamiento de VRAM observado por otra herramienta.** Abort HTTP es cancelación del cliente: no se garantiza que el servidor detenga inmediatamente todos los kernels ni cargas de otros procesos.

`summary.json` agrega `memory`, `prompt` y `thermal` a los cuatro informes existentes; `thermal` incluye política, máximos disponibles y anillo limitado a 720 muestras. Datos ausentes null, sin secretos ni texto completo. Progreso conserva el estado RUNNING con estado térmico separado, de modo que Cancelar sigue disponible.

## Pruebas y aceptación pendiente

Fixtures controlados cubren referencias, identidad transversal EN/RU, conflictos, versión, importación candidata, preflight sin IA, source gate antes de GPU, presupuesto UTF-8, métricas, fallos de placeholders, pausa/reanudación/cancelación y sensor perdido. No sustituyen benchmark real ni aceptación Foundry14.368. T043 (4B/12B/27B mismo golden EN/RU) permanece pendiente; T036/T037 no implementados. T065 permanece suspendida. No realizar prueba térmica de estrés ni descargar modelos automáticamente para cerrar estos criterios.
