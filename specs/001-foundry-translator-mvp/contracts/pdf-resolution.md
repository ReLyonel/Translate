# T076 — Resolución de memoria por evidencia

La clasificación no es el estado de aprobación de MemoryEntry. Se devuelve un plan determinista con policy pdf-resolution-1, input_hash, fingerprint del corpus, revision, grupos, variantes, contadores y auto_approvable. No modifica la memoria al clasificar.

| Clase | Evidencia | Acción |
|---|---|---|
| VERIFIED | Pareja EN/ES idéntica ya aprobada, contexto/edición compatibles, corpus válido y sin conflicto aprobado | Propagar aprobación a duplicados mediante transacción atómica |
| HIGH_CONFIDENCE | Selección explícita EN/ES o vínculo previamente preparado, válido y sin alternativas | Revisión rápida; no autoaprobar por score |
| AMBIGUOUS | Alineación heurística sin prueba bilingüe, traducciones alternativas o conflicto aprobado | Resolver por grupo o aportar evidencia adicional |
| REJECTED | Rechazo/restauración del usuario o evidencia inválida/obsoleta | Ignorar para reutilización; conservar registro |

EXACT es un modo de coincidencia textual; solo equivale a VERIFIED cuando existe autoridad aprobada compatible. Coincidir con una palabra española en un PDF verificado no demuestra su relación con una palabra inglesa o rusa. Página, nombre y score tampoco certifican semántica.

Los grupos consideran idioma, sistema, módulo, tipo/campo, texto normalizado solo por espacios, edición y, para vínculos, UUID/versión/ruta/hash/uso. Las variantes equivalentes conservan IDs/páginas de procedencia. El plan contiene texto de revisión privado, nunca credenciales. input_hash cambia ante revisión, corpus o variantes; un plan obsoleto se rechaza. approvePdfBatch valida todo antes de cambiar estados y revierte todos ante fallo de disco. Cache se invalida únicamente al modificar aprobaciones.

Memoria y revisión > SRD PDF muestra clases y permite filtrar; Resolver verificadas aplica únicamente la lista comprobada de ese plan, con bloqueo durante trabajos activos. No acepta listas de IDs arbitrarias desde el renderer.

## Vínculos canónicos

El resolutor exige identidad completa Foundry, sistema dnd5e, versión, ruta/campo/tipo/módulo compatibles y texto nativo actual idéntico al importado. La importación española solo aporta el mapa estable de identidad: su texto sigue CANDIDATE. El destino debe coincidir exactamente con una pareja SRD ya aprobada, única y no conflictiva. No se une un `_id` de packs distintos ni se infieren nombres. El nuevo vínculo aprobado registra texto/hash nativo y referencias PDF; no aprueba el registro JSON importado. Rechazos/restauraciones bloquean el proceso. Si la estructura técnica no permite sustitución, no se autoaprueba como EXACT.

Memoria y revisión > Resolver vínculos canónicos verificados selecciona la raíz, calcula y vuelve a comprobar evidencia antes de aplicar. El mecanismo está probado con RU y fuentes aprobadas sintéticas. En fifthpendium aún no existen parejas aprobadas suficientes: no se inventan vínculos para aumentar métricas.

## Evidencia T075/T076

Dos regeneraciones aisladas: 8.372 propuestas, cero nuevas, mismo hash de IDs 9745c089542057f086703c819bbb25135e6a9407f039644c8a0d21ddf04895a9; sin cambios en store.json activo. 3.574 grupos y 625 variantes duplicadas. Clasificación real: VERIFIED0, HIGH_CONFIDENCE0, AMBIGUOUS8372, REJECTED0. Es el resultado de evidencia disponible, no un umbral ajustado para forzar aprobaciones.

Mapa nativo: 5.074 ubicaciones mapeadas, 3 conflictivas y 5.071 sin correspondencia SRD aprobada; cero vínculos verificables. Son ubicaciones, no entradas JSON distintas. Auditoría de admisibilidad: 4.291 ubicaciones únicas estructuralmente compatibles, que tampoco equivalen a conocimiento aprobado.

Informe privado completo: reports/pdf-resolution/resolution.json; herramienta readonly: npm run memory:resolve:audit. Reproducción se ejecuta en copia temporal comprobada, limpiada al terminar. Fuente PDF y módulos originales permanecen intactos.
