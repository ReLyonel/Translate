# Publicación nativa: overlay y copia completa

Contrato vigente, 2026-10-03. Amplía `desktop/contracts.ts`, `desktop/jobs.ts` y la publicación atómica existente; no introduce un formato runtime ni una dependencia Babele.

`startBatch(handle, language, terminology?, preflightToken?, outputStrategy?)` admite:

| Estrategia | Comportamiento |
|---|---|
| `TRANSLATION_OVERLAY` (predeterminada) | Solo archivos modificados, en sus rutas relativas originales. No incluye recursos intactos ni directorios vacíos. |
| `FULL_PORTABLE_COPY` | Copia completa explícita: conserva recursos, originales recuperados, archivos sin cambios y directorios vacíos. |

Se rechazan estrategias desconocidas, destinos existentes y destinos dentro del origen. El resultado vive en una carpeta nueva, sin modificar fuentes. Ambas estrategias validan antes de publicación atómica. Cancelación o fallo de disco no publican archivos parciales. No hay operación de sincronización ni eliminación de archivos de un módulo destino.

El overlay se identifica en interfaz/informe como **«Archivos traducidos para integrar con el módulo original»**. No es un módulo autónomo. Para integrarlo se sustituyen exclusivamente los archivos presentes; los ausentes se conservan. El usuario reempaqueta las fuentes cuando corresponda.

Aceptación P0: el CLI Foundry 3.0.4 elimina del pack registros ausentes de su entrada al compilar. **Nunca se debe compilar el overlay parcial directamente**. Primero integrarlo en una copia completa de las fuentes; después compilar desde esa carpeta `_source` completa hacia el pack de prueba. No ejecutar `clean`, sincronización destructiva ni reempaquetado sobre el original. Esta precaución pertenece al flujo de aceptación existente, no a una funcionalidad nueva de integración.

Ejemplo: `packs/bestiary/_source/vampire.json` permanece en esa ruta dentro de la salida. `_id`, `_key`, UUID, claves, tipos, arrays, estructura, flags técnicos, referencias, recursos, rutas y fórmulas se conservan. Solo cambian campos humanos clasificados y validados. Un JSON sin cambios conserva sus bytes originales, incluido formato, BOM y terminadores; el overlay no lo escribe.

`module.json` solo aparece en el overlay si se añaden registros `languages` necesarios para diccionarios españoles nuevos validados. No cambia `id`, `compatibility`, packs ni dependencias. Se preservan localizaciones ES existentes. Si no cambia ningún valor humano del diccionario, no se crea una localización ES idéntica ni se altera el manifiesto. Una colisión con una ruta existente en la fuente se rechaza también en overlay. Un fallo de publicación de localización retira los diccionarios nuevos y conserva el manifiesto original.

## Contadores y estados

Los eventos `BatchProgress` y `summary.json.publication` contienen:

| Campo | Definición |
|---|---|
| `files_scanned` | Archivos elegibles JSON/scripts cuyo procesamiento comenzó; excluye recursos y el paso de localización. |
| `files_translated` | Archivos elegibles cuyo contenido final difiere del original, incluidos recuperados parcialmente. |
| `files_unchanged` | Archivos elegibles que conservan bytes originales, incluidos fallbacks. |
| `files_written` | Archivos físicos publicados: incluye recursos en copia completa y diccionarios/manifiesto nuevos en overlay. Un reemplazo del manifiesto ya copiado no se cuenta dos veces. |
| `assets_skipped` | Recursos omitidos con extensiones de imagen/audio/vídeo/fuentes y `.bin`, `.db`, `.ldb`, `.pdf`, `.zip`. Otros archivos intactos también se omiten, aunque no se clasifican como assets. |
| `bytes_avoided` | Bytes originales no duplicados: recursos omitidos y archivos elegibles sin cambios. Excluye el manifiesto cuando se publica modificado. No es una medición de compresión ni de espacio asignado del disco. |

`summary.json.output_strategy` identifica el modo. `FileOutcome.written` distingue validación de publicación física: un archivo `UNCHANGED` puede estar validado y no escrito. Un fallback mantiene estado `WARNING`; en overlay se registra `ORIGINAL_RESTORED` sin duplicar el original. Un archivo recuperado parcialmente se escribe únicamente si contiene cambios válidos. En una ejecución finalizada normalmente, `files_scanned = files_translated + files_unchanged`; con interrupción puede existir un archivo iniciado sin resultado final.

Las métricas históricas `metrics.files_scanned` mantienen su significado de descubrimiento de todos los archivos para compatibilidad. Los contadores de publicación miden únicamente el contrato definido arriba. El informe permanece en logs; no se agrega un archivo auxiliar intacto al overlay.

## Scripts

Acorn clasifica nodos y obtiene rangos. Se admiten literales en contextos UI reconocidos: Dialog/DialogV2, ChatMessage.create, configuración de settings/sheets, notificaciones y asignaciones DOM visibles; las configuraciones UI explícitas existentes también conservan soporte. Un objeto técnico desconocido no se convierte en UI por tener una propiedad `name` o `title`.

Se reemplazan rangos de literales/quasis, conservando comillas originales cuando procede, comentarios y formato externo. Las expresiones `${...}` no se recorren para traducir, ni siquiera sus literales internos. El resultado se reparsea y compara tanto por bytes fuera de rangos aprobados como por estructura AST, conservando imports/exports, identificadores, claves y expresiones. Protección/restauración de tokens conserva HTML, URLs, atributos y referencias. Un fallo restaura el script original y registra `SCRIPT_TRANSLATION_VALIDATION_FAILED`. Campos que parecen humanos pero carecen de contexto UI reconocido permanecen intactos con `SCRIPT_TRANSLATION_CONTEXT_UNCERTAIN` y estado WARNING; no se envían al modelo.

Pruebas: `tests/jobs/outputStrategy.test.ts`, `tests/contracts/moduleBatch.test.ts`, `tests/native/localization.test.ts`, regresiones de recuperación/publicación y corpus golden. La sintaxis y estructura no sustituyen la aceptación real en Foundry 14.368 sin Babele.
