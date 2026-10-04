# Contrato de procedencia, revisión e incremental — versión 1

Entrega T059–T063. Complementa `translation-reuse-diagnostics.md`, `integrity-publication.md` y `native-localization.md`. El contenido publicado conserva los formatos JSON/scripts/localizaciones existentes. No introduce Babele, fine-tuning, reconstrucción ni cambios en T065 o en el modelo predeterminado TranslateGemma 27B.

## Procedencia por unidad — T059

Cada ocurrencia tiene `unit_id`, `locator_id`, `file`, `json_path`, idiomas, hashes de fuente/target, contexto, `origins`, proveedor/modelo productor, calidad y publicación. Un mismo texto reutilizado en otra ubicación conserva otra identidad de ocurrencia. Los hashes utilizan SHA-256 de la representación JSON determinista del valor, no son hashes de los bytes del archivo completo.

`origins` registra las etapas que contribuyeron al resultado: `GLOSSARY`, `TM_EXACT`, `TM_FUZZY_CONTEXT`, `CACHE`, `TRANSLATEGEMMA`, `MANUAL`, `ORIGINAL_FALLBACK`; `PROVIDER` cubre LibreTranslate y adaptadores que no sean TranslateGemma. Fuzzy nunca es un resultado automático: aparece acompañado del productor. Un glosario aplicado parcialmente puede coexistir con el motor; una sustitución completa del glosario no atribuye llamadas IA. La TM manual puede indicar `[TM_EXACT, MANUAL]`.

`provider/model` identifica al productor del texto reutilizado, no una petición HTTP en esta ejecución. Es null para decisiones manuales/glosario puro/original. Un fallo puede añadir `attempted_provider/attempted_model`. Las métricas HTTP existentes determinan si hubo llamadas. `deduplicated` señala reutilización local dentro de una solicitud; `incremental` señala reutilización desde el inventario anterior. `memory_id` vincula una entrada privada cuando se conoce.

`quality=PASS|WARNING|FAILED`; `publication=PENDING|VALIDATED|RECOVERED|NOT_PUBLISHED`. VALIDATED indica reinserción/publicación y validación del archivo, no aprobación humana ni certificación lingüística; debe leerse junto a quality. Copias originales de fallback registran recuperación. Una respuesta del motor no acredita publicación. Las solicitudes directas permanecen PENDING hasta una publicación posterior: este contrato no inventa el estado de una exportación que aún no ocurrió.

Ejemplo de información exportable:

```json
{
  "unit_id":"<sha256>",
  "locator_id":"<sha256>",
  "file":"packs/items/_source/a.json",
  "json_path":["name"],
  "source_language":"en",
  "target_language":"es",
  "source_hash":"<sha256>",
  "target_hash":"<sha256>",
  "origins":["TM_EXACT","MANUAL"],
  "provider":null,
  "model":null,
  "quality":"PASS",
  "publication":"VALIDATED",
  "deduplicated":false,
  "incremental":false
}
```

`summary.json.translation_provenance` contiene estas ocurrencias sin source_text/translated_text ni texto circundante. Los cuatro archivos exportados se mantienen: summary/errors/warnings/skipped. El resumen admite campos nuevos opcionales, conserva `schema_version=1` y los contadores anteriores. Las ejecuciones grandes pueden tener resúmenes grandes: su retención sigue siendo la política de runs.

## Revisión persistente — T060

Nueva vista de escritorio **Memoria y revisión**, con búsqueda, filtro por estado, páginas de 50 entradas, original/target, contexto, procedencia y alternativas. Usa IPC exclusivamente; no recibe rutas de disco del renderer. Los textos privados se muestran como texto escapado, nunca como HTML ejecutable. Cada entrada listada incluye original_requested para distinguir la preferencia vigente del feedback hist?rico.

API:

```ts
listMemory({query?, status?, offset?, limit?})
// -> {revision, total, entries}; limit 1..100, query <=2000 caracteres
memoryConflicts()
// -> {revision, conflicts}
reviewMemory({id, action, revision, translatedText?})
// -> entrada resultante
```

Acciones:

| Acción | Resultado |
|---|---|
| ACCEPT | Revalida tokens, HTML cuando corresponda, calidad e idioma; aprueba explícitamente la variante. No elimina alternativas. |
| EDIT | Revalida el target; conserva/rechaza la variante anterior y guarda la edición como candidata MANUAL. Requiere ACCEPT separado. |
| REJECT | Conserva la entrada rechazada para revisión; impide reutilizar/regenerar silenciosamente ese target en ese contexto. |
| RESTORE | Mantiene el original en futuros lotes de ese contexto/fuente, sin llamar IA para esa unidad; genera recuperación WARNING. Conserva la variante histórica. |
| RESOLVE | Aprueba explícitamente la variante elegida y rechaza las alternativas del mismo contexto, sin afectar otros contextos. |

Los archivos ya exportados y los originales no se editan desde esta vista. Para aplicar una edición aprobada se genera otra copia con el pipeline normal. La restauración es una preferencia exacta de memoria, no una edición destructiva. Una solicitud directa sin recuperación granular devuelve error si encuentra esta preferencia; un lote conserva el original y continúa. La preferencia sobrevive a editar/rechazar y solo una aceptación/resolución posterior la levanta.

Las decisiones añaden `feedback {action, at, revision, previous_id?}`. `store.json` conserva version1 y admite `review_revision` y `original_choices`, estas últimas por clave contextual SHA-256. Estados siguen siendo CANDIDATE/APPROVED/REJECTED. Los archivos v1 previos sin estos campos se leen sin promoción automática; no se importan corpus históricos.

`revision` es obligatoria en IPC: un editor desactualizado recibe `MEMORY_REVISION_CONFLICT`. Se rechazan mutaciones durante trabajos/traducciones y se impide iniciar traducción mientras se guarda una revisión. Las mutaciones se serializan, se escriben a temporal/fsync/rename y un fallo previo al commit revierte el estado en memoria. La revisión invalida la caché y las claves de reutilización incremental mediante su revisión. Uso/estadísticas se actualizan en una sola transacción por ejecución, no por miles de escrituras individuales. No existe coordinación entre procesos: cerrar la aplicación antes de usar la CLI.

## Contextos y conflictos — T061

La compatibilidad incluye system/module/document_type/field_type y `surrounding_context_hash`. `json_path` describe la ocurrencia, no identifica globalmente una traducción. El contexto circundante se extrae solo de nombres/descripciones conocidos, excluye el propio texto, protege/elimina contenido técnico y se limita a 600 caracteres humanos. Se guarda privadamente, se muestra al revisor y puede aportar contexto humano al modelo; no se exporta en logs/procedencia. No se envía el JSON completo ni código al modelo.

La huella circundante es conservadora: cambios relevantes pueden impedir reuse aun con texto fuente intacto. Las entradas antiguas sin esta huella no se comparten a ciegas con contextos nuevos. No se borra su aprobación anterior ni se inventa contexto faltante.

Conflictos se agrupan por fuente exacta, idiomas y contexto semántico, no solo por palabra. Distintas traducciones activas del mismo grupo requieren revisión. Dos targets aprobados distintos bloquean exact y se excluyen del contexto fuzzy. Las variantes de `Charge` en contextos diferentes no se colapsan en un único target. RESOLVE aplica únicamente al grupo seleccionado y conserva las alternativas rechazadas. No hay resolución automática.

## Consistencia terminológica — T062

`summary.json.terminology_consistency`:

```json
{
  "schema_version":1,
  "warning_count":1,
  "issues":[{
    "source_hash":"<sha256>",
    "term":"Saving Throw",
    "reason":"TRANSLATION_VARIANTS",
    "variants":[
      {"target_hash":"<sha256>","term":"Tirada de Salvación","count":83,"contexts":["<sha256>"]},
      {"target_hash":"<sha256>","term":"Salvación","count":4,"contexts":["<sha256>"]}
    ]
  }],
  "known_terms_truncated":false,
  "policy":"REVIEW_ONLY"
}
```

Cuenta unidades PASS efectivamente publicadas, separadas por módulo/sistema/idioma. Excluye originales recuperados y resultados no publicados. Señala alternativas del mismo texto, conservando huellas de contexto para distinguir variaciones legítimas. También detecta variantes terminológicas conocidas dentro de prosa mediante términos del glosario y alternativas aprobadas cortas; el match más largo evita contar una variante contenida dos veces.

Es una heurística de revisión, no alineación semántica exhaustiva: no puede identificar cualquier traducción desconocida dentro de un párrafo. Máximo 1000 grupos de términos conocidos, con indicador de truncamiento. Solo muestra previews cortos (≤80 caracteres) sin markup/marcadores/credenciales aparentes; narrativas largas se representan por hashes. Avisos agregados aparecen en warnings.json y en el snapshot del lote. No cambia automáticamente textos, aprobación ni estados de integridad de archivos correctos.

## Inventario incremental — T063

Ruta privada: `userData/translation-memory/incremental/<namespace-sha256>.json`.

Un módulo con `module.json.id` válido usa su identidad nativa: puede reutilizarse aunque la actualización se descargue en otra carpeta. Si no hay identidad válida/legible, se usa la raíz real y su nombre, sin inventar identidad. Se rechazan enlaces y se limita la lectura del manifiesto; errores IO no se ocultan. El identificador nativo no se modifica. El inventario no reempaqueta ni modifica bases de compendios.

Formato privado:

```json
{
  "schema_version":1,
  "units":[{
    "locator_id":"<sha256>",
    "source_hash":"<sha256>",
    "reuse_key":"<sha256>",
    "target":"Espada",
    "provider":"ollama",
    "model":"translategemma:27b"
  }]
}
```

`locator_id` considera archivo relativo, ubicación por segmentos, idiomas y contexto estable. Localizaciones repetidas tienen `occurrence_scope` vinculado a su registro `module.json:languages[n]`, sin falsificar json_path. Scripts usan la posición ordinal del literal humano seguro; insertar/reordenar literales puede invalidar posiciones posteriores. Renombrar un archivo cuenta como removed/new; TM/caché todavía pueden reutilizar texto compatible. No se promete detectar movimientos por UUID automáticamente.

`source_hash` conserva el texto íntegro, referencias incluidas. `reuse_key` incluye contexto, glosario, proveedor/modelo/prompt/reglas/perfil y revisión de memoria. Una unidad intacta solo reutiliza un target cuyo perfil y productor sean compatibles y que pase de nuevo tokens/bytes técnicos, HTML/calidad y el gate del archivo. Un fallback LibreTranslate no se presenta como resultado Ollama ni se reutiliza bajo el modelo principal. La IA vuelve a intentarse si debe recuperarse el proveedor preferente.

Orden sigue siendo glosario/TM aprobada → inventario/caché → fuzzy → proveedor. Fuente intacta no implica aceptación ciega. Rechazo/restauración manual y modificaciones de modelo/glosario/reglas invalidan reuse. Las referencias de targets almacenados se comparan con las originales antes de convertirlas a placeholders: igual cantidad de marcadores no basta.

Resumen público `summary.json.incremental`:

```json
{
  "schema_version":1,
  "complete":true,
  "baseline_committed":true,
  "unchanged":4988,
  "changed":12,
  "new":0,
  "removed":0,
  "units":[{"locator_id":"<sha256>","status":"CHANGED","source_hash":"<sha256>","reuse_invalidated":true}]
}
```

Los contadores describen contenido por ubicación. `reuse_invalidated` distingue cambios de configuración/contexto/revisión que impiden reutilizar una fuente intacta. Una misma fuente puede clasificarse UNCHANGED y necesitar traducción si se invalidó el perfil o el productor. No se confunde esto con texto modificado.

La baseline solo avanza después de una ejecución completa sin recuperaciones/fallos, unidades PASS y archivos/localizaciones publicados y validados. Una ejecución cancelada, incompleta o con fallback de integridad mantiene la baseline anterior y no inventa REMOVED para datos aún no inspeccionados. La comparación parcial se exporta con complete=false. Errores al finalizar se reportan como error de job y no dejan archivos de módulo parcialmente escritos.

Persistencia: esquema estricto, IDs únicos, enlaces rechazados, temporal exclusivo, fsync y rename. Un inventario corrupto falla explícitamente antes de crear salida; no se trata silenciosamente como vacío. Los targets son datos privados de reutilización, no traducciones aprobadas. El origen se vuelve a recorrer/parsear y se produce una copia integral nueva: el incremental evita llamadas IA, no evita los checks ni promete saltarse IO.

## Evidencia y tareas ajenas

Regresiones en `tests/memory/{provenance,review,consistency,incremental}.test.ts`, más corpus/gates, disco, cancelación, native y proveedores existentes. Se verifican cero llamadas para módulo intacto sin caché ordinaria, changed/new/removed, identidad nativa entre carpetas, rechazo manual, referencias manipuladas, fallback real, cancelación/ENOSPC y registros nativos repetidos.

Las pruebas de traducción usan proveedores controlados. No acreditan benchmark real, calidad de TranslateGemma, Windows 10 limpio ni runtime Foundry 14.368. T055/T056 siguen pospuestas; T065 permanece intacta. T036/T037/T043 continúan pendientes. No se modifica el PRD original: esta extensión documenta el comportamiento del incremento y sus límites.
