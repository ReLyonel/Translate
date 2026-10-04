# Corrección P0 de referencias y repetición T043

Alcance exclusivo: reabrir T046 (referencias Foundry), corregir el motor central utilizado por T049/T048/T050 y repetir T043. Sin nueva tarea, arquitectura, routing, migración ni traducción de FifthPendium completo. T036/T037/T065/T077 suspendidas.

## Auditoría anterior a la corrección

Los resultados anteriores están preservados en `reports/benchmark/before-protection-fix/`. La clasificación usa casos, no peticiones: un caso puede haber reintentado varias veces.

| Categoría primaria | Reason code existente | 4B | 12B | 27B |
|---|---|---:|---:|---:|
| FOUNDARY_REFERENCE_MUTATION | UUID_FAILURE, subtipo Reference HTML-encoded | 12 | 21 | 28 |
| PLACEHOLDER_MUTATION | PLACEHOLDER_FAILURE | 53 | 21 | 10 |
| HTML_CORRUPTION comprobada | HTML_FAILURE | 0 | 0 | 0 |
| UUID_MUTATION comprobada | UUID_FAILURE, UUID literal | 0 | 0 | 0 |
| ROLL_MUTATION primaria comprobada | ROLL_FAILURE | 0 | 0 | 0 |
| INTERPOLATION_MUTATION | SCRIPT_INTERPOLATION_FAILURE | 0 | 0 | 0 |
| OTHER | Otros códigos | 0 | 0 | 0 |
| **Total de casos estructurales** | | **65** | **42** | **38** |

Se conserva la etiqueta conceptual `FOUNDARY_REFERENCE_MUTATION` pedida por el usuario; no se introduce como nuevo código de producto. El código histórico `UUID_FAILURE` incluía referencias enriquecidas, no solo UUID.

27B tiene además un `ROLL_FAILURE` asociado a uno de sus10 casos de restauración/placeholder fallidos: no se suma otra vez al total. Las respuestas rechazadas por placeholders del experimento anterior no estaban guardadas; no se inventa qué token concreto se perdió ni se interpreta el cero observado como validación aprobada. Evidencia por caso: `before-protection-fix/failure-audit.json`.

## Causa raíz y etapas

1. **Parse/extracción:** el JSON o literal AST proporciona texto que aún contiene `&amp;Reference[...]`. Las fuentes no se alteran.
2. **Detección/protección, causa raíz:** el regexp combinado recorría el texto original. En la posición de `&amp;`, la regla de entidades encontraba la entidad; la antigua regla `&Reference[` no reconocía el prefijo codificado. Resultado: un placeholder para `&amp;` y `Reference[...]` expuesto.
3. **Normalización/decode/encode:** no se encontró conversión HTML destructiva en este recorrido. La solución no añade decode/encode. JSON.parse interpreta escapes JSON como antes; el contenido de la referencia se conserva exactamente en el valor de texto.
4. **Chunking/proveedor:** recibían esa salida parcialmente protegida. La división semántica no creó el defecto; simplemente propagó texto técnico al modelo.
5. **Restauración:** el antiguo mapa solo conocía la entidad, de modo que no podía detectar cambios dentro del resto de la referencia. El gate adicional T043 sí los rechazó.

## Corrección

`ProtectedContentEngine.rulesVersion = integrity-5`. El matcher reconoce la referencia completa antes de consumir entidades, con scan balanceado y rechazo de sintaxis incompleta. Conserva el fragmento original como un token opaco; no decodifica para después intentar reconstruirlo.

Familias cubiertas: `&Reference[...]`, `&amp;Reference[...]`, variantes de entidad numérica decimal/hexadecimal y codificación amp repetida; `@UUID`, `@Embed`, otras referencias `@...` y prefijos `@` codificados. También se reconocen delimitadores de corchete codificados. Los tags/atributos HTML completos siguen protegidos; las etiquetas humanas `{...}` pueden traducirse manteniendo sus delimitadores.

La restauración mantiene comparación estricta de identidad, multiplicidad y orden de placeholders, hash del token y firma técnica. No se relajó el quality gate ni se convirtió ninguna corrupción en warning publicable. La nueva versión forma parte de las claves de caché existentes; no se modifica ni migra la memoria del usuario.

## Regresiones sin Ollama

`tests/golden/encodedReferenceProtection.test.ts`:20 casos. Referencias reales del corpus (Prone, Incapacitated, Total Cover, Bloodied, Restrained, magic, UUID/Embed) y variantes de codificación; párrafos, etiquetas humanas, entidades adyacentes, referencias múltiples, brackets anidados/entrecomillados, sintaxis incompleta, arrays de textos largos y chunks. Incluye adaptador Ollama con HTTP simulado y reinserción JSON en items embebidos: IDs, assets, flags y rolls intactos; mutación deliberada → FAILED.

`tests/benchmark/frozenInput.test.ts`:3 casos de identidad del texto, instrucciones de prompt inalteradas y rechazo de prompts inconsistentes. Las regresiones previas de placeholders/golden siguen activas. Suite completa539 PASS antes de inferencia; regresión adicional de reinserción también PASS.

## Protocolo de repetición

El archivo `real-corpus.json` no se modifica ni regenera. Las120 muestras originales mantienen ID, texto, idioma, contexto y referencias aprobadas. El runner deriva en memoria los inputs con el protector corregido y conserva literalmente el prefijo/instrucciones de cada prompt congelado. Cambia solo el payload técnico protegido: por eso el hash del mensaje efectivo cambia, aunque no cambia el prompt de instrucciones.

Se mantienen193 chunks iniciales, configuración funcional y gate. Los tres modelos reciben la misma entrada corregida, serialmente4B→12B→27B. `--corrected-protection` escribe un experimento separado en `reports/benchmark/corrected-protection/`; `effective-input.json` permite auditar exactamente lo enviado. Las respuestas de intentos rechazados se guardan allí para diagnóstico.

Hash casos congelados: `87c0b280baf15069f17d03548896cad71cc4b5682700eb63e2896b0d9a030268`.
Hash de prompts original: `69d82a8dced75e7d188528bc806b8725a6b0630c21d7ea89a050d9c983832477`.
Hash de mensajes efectivos corregidos: `0f0aa1656a0fc7affb47c1d787cf42f769ea9b2277cabc39b684a938baf34ba3`.
SHA256 del archivo corpus: `02e28367a63343c84d29649366726a5017d78b7843b66f700ba3d0fc6b1f10dd`.

No es lícito presentar el benchmark anterior como una prueba con la protección corregida. Sus timings solo sirven como comparación histórica; la recomendación final debe usar el experimento nuevo.

## Nueva comparación 4B / 12B / 27B

| Resultado corregido | 4B | 12B | 27B |
|---|---:|---:|---:|
| Muestras ejecutadas | 120 | 120 | 120 |
| Aceptadas por gate | 65 | 101 | 110 |
| EN→ES aceptadas / 60 | 28 | 53 | 56 |
| RU→ES aceptadas / 60 | 37 | 48 | 54 |
| Fallos estructurales / validación | 55 | 19 | 10 |
| PLACEHOLDER_FAILURE, casos | 55 | 19 | 10 |
| Mutaciones de referencias Foundry | 0 | 0 | 0 |
| HTML/UUID: cambios comprobados en salidas restauradas | 0 / 0 | 0 / 0 | 0 / 0 |
| ROLL_FAILURE asociado a restauración | 0 | 0 | 1 |
| Archivos JS: fallos AST/interpolación | 0 | 0 | 0 |
| Segmentos JS aceptados / 15 | 14 | 11 | 15 |
| Wrong language / untranslated detectados | 0 / 0 | 0 / 0 | 0 / 0 |
| Reintentos | 57 | 19 | 9 |
| Fallbacks a original, casos | 55 | 19 | 10 |
| Peticiones / respuestas HTTP correctas | 204 / 204 | 199 / 199 | 199 / 199 |
| Chunks aceptados por gate de petición | 92 | 161 | 181 |
| Duración, s | 208.13 | 366.94 | 666.35 |
| Latencia media por petición, s | 0.98 | 1.77 | 3.25 |
| Strings/min procesadas | 34.59 | 19.62 | 10.81 |
| Strings/min aceptadas por gate | 18.74 | 16.51 | 9.90 |
| Tokens/s generación | 177.02 | 80.27 | 40.32 |
| VRAM máxima, MiB | 5363 | 10487 | 19532 |
| GPU máxima, °C | 77 | 80 | 80 |
| Temperatura VRAM | N/A | N/A | N/A |
| RAM servidor máxima, GiB | 8.64 | 9.65 | 10.04 |
| RAM runner máxima, MiB | 638.39 | 128.07 | 149.07 |
| THERMAL_ABORT | No | No | No |

Los10 rechazos27B incluyen un fallo al validar la restauración de una respuesta cuyos marcadores pasaron el control de petición: se conserva como fallo y original, no como untranslated ni éxito. Su ROLL_FAILURE se solapa con PLACEHOLDER_FAILURE. No se suman categorías solapadas. Las respuestas no restaurables no prueban que UUID/HTML/rolls hayan pasado; los ceros son cambios comprobados en salidas restauradas, no absolución de las rechazadas. Idioma y untranslated siguen siendo heurísticos.

Un fallback es recuperación lógica del original, no un segundo proveedor ni archivo publicado. La validación de scripts utiliza originales para segmentos rechazados; cero fallos AST de archivo no significa que los15 segmentos se hayan traducido en todos los tamaños.

| Medición por idioma | 4B EN | 4B RU | 12B EN | 12B RU | 27B EN | 27B RU |
|---|---:|---:|---:|---:|---:|---:|
| Duración, s | 124.13 | 83.57 | 149.44 | 217.13 | 248.68 | 417.30 |
| Peticiones | 97 | 107 | 71 | 128 | 71 | 128 |
| Reintentos | 33 | 24 | 7 | 12 | 4 | 5 |
| Strings/min | 29.00 | 43.08 | 24.09 | 16.58 | 14.48 | 8.63 |
| Tokens/s | 177.76 | 176.35 | 80.80 | 79.95 | 40.59 | 40.18 |

Tiempo total incluye carga, observación y validaciones; excluye enfriamiento. Tokens/s usa eval_count/eval_duration y cuenta también tokens de intentos rechazados. Son193 chunks iniciales idénticos en número, pero un fallo temprano omite los restantes de esa string: no se generó la misma cantidad de trabajo efectivo. En especial, el throughput de4B no representa cobertura equivalente de textos largos. Los picos VRAM son framebuffer del dispositivo, incluyendo escritorio; RAM suma working sets de todos los procesos Ollama/llama-server, incluida memoria retenida del host, no solo pesos del modelo. Son máximos muestreados, no instantáneos garantizados.

GPU observada cada2s; guard activo con warning80/pause85 y memoria warning90/pause96°C. Se esperó GPU ociosa y enfriamiento antes de cada modelo. No cambios de clocks/fans/power limit. Temperatura VRAM no disponible: este benchmark corto **no certifica seguridad térmica de memoria ni ejecuciones largas**.

## Calidad lingüística y decisión 12B frente a 27B

Solo se compararon lingüísticamente salidas que pasaron el gate. Revisión cualitativa por el asistente, no ciega ni certificación humana completa. Dos referencias TM aprobadas aplicables por modelo; PDFs ambiguos excluidos. Las observaciones por ID de muestra están en `corrected-protection/linguistic-review.json`.

| Categoría | 4B | 12B | 27B |
|---|---|---|---|
| EN→ES | Errores semánticos; baja cobertura | Más literal en algunas unidades; errores de terminología | Más cobertura; también errores y conversiones no solicitadas |
| RU→ES | Errores claros, como conjuro→maldición | Calidad mixta, varios mensajes fieles | Calidad mixta; mejoras puntuales y errores propios |
| Short text: gate / 44 | 41 | 41 | 44 |
| Long text: gate / 26 | 3 | 15 | 19 |
| Terminología D&D | Insuficiente | Errores persistentes | Errores persistentes, algunas mejoras puntuales |
| Referencias aprobadas, coincidencia literal | 0 / 2 | 0 / 2 | 0 / 2 |

Ejemplos de comparación sobre salidas aceptadas:

- EN caso17:12B conserva30 pies;27B los convierte a9 metros sin instrucción. Es una aproximación no solicitada. Los números humanos de reglas no se convierten en fórmulas técnicas por esta corrección: es un problema de fidelidad, no de referencias.
- RU caso65:ambos traducen la etiqueta de caballo de monta como caballo de tiro. En el texto posterior12B mantiene el concepto montura;27B lo convierte a animal de carga, cambiando el sentido.
- RU caso115:27B «Hechicería aberrante» es más específico que12B «Magia aberrante».
- RU caso82:12B «hechizo» y27B «conjuro» conservan el sentido;4B «maldición» lo altera.
- RU caso91:los tres producen «creación de hechizos», frente a la referencia aprobada «Lanzamiento de Conjuros». La otra referencia, «Caída de Pluma», se parafrasea. Cero coincidencias literales no implica automáticamente que todas las variantes sean incorrectas.
- RU casos100/110:ambos muestran errores de enlace entre frases, tú/usted o terminología poco natural. No se ha demostrado superioridad lingüística general de27B sobre12B.

**DEFAULT_MODEL recomendado para considerar: translategemma:12b, provisionalmente y con gate/fallback estrictos.** En las salidas aceptadas no hubo corrupción técnica en ninguno;12B ofrece calidad próxima en los ejemplos comparables revisados,45% menos tiempo y46% menos pico VRAM que27B. El coste reconocido es9 fallbacks adicionales:19 frente a10, incluyendo6 muestras RU y3 EN; además12B conserva originales en4 segmentos JS que27B traduce. 27B es mejor en cobertura y reduce reintentos, pero no ha demostrado una ventaja lingüística general que justifique automáticamente su coste en este corpus.

Esta recomendación no declara ganador definitivo ni acredita calidad de producción. No se cambia la configuración de la aplicación ni la preferencia guardada del usuario: **27B continúa configurado como provisional**, conforme al alcance indicado. No routing. No ejecutar traducción masiva a partir de esta recomendación.

## Antes / después

| Medida | 4B antes → después | 12B antes → después | 27B antes → después |
|---|---:|---:|---:|
| Aceptadas | 55 → 65 | 78 → 101 | 82 → 110 |
| Fallos estructurales | 65 → 55 | 42 → 19 | 38 → 10 |
| Mutaciones de Reference | 12 → 0 | 21 → 0 | 28 → 0 |
| Fallos de placeholders | 53 → 55 | 21 → 19 | 10 → 10 |
| Duración, s | 172.44 → 208.13 | 350.97 → 366.94 | 688.51 → 666.35 |

La corrección elimina la exposición de referencias, no los errores del modelo con marcadores. Las pequeñas variaciones de placeholders entre corridas no se presentan como cambio de política ni garantía determinista de inferencia. Las duraciones no atribuyen todo el cambio a la corrección: cambian el payload y la cantidad efectiva de generación, y el nuevo runner guarda respuestas rechazadas. Condiciones funcionales idénticas entre los tres modelos del experimento nuevo.

## Cierre y evidencia

Suite final **540 tests en51 archivos PASS, lint PASS, build PASS**. El build conserva los avisos existentes de configuración Vite/tamaño de bundle; no se cambió configuración para silenciarlos. T046 cerrada por esta corrección y pruebas; T043 realizada de nuevo como experimento comparativo, no aceptación de producción.

Archivos privados: `corrected-protection/{effective-input.json,results.json,evaluation.json,responses.jsonl,failure-audit.json,linguistic-review.json}`. Los hashes al final confirman originales, memoria y corpus intactos. No se publicaron packs/overlay ni se modificaron fuentes. Los informes anteriores permanecen preservados y no se reevalúan con reglas distintas para alterar su baseline.

Detenido. T036/T037/T065/T077 siguen suspendidas; sin otras tareas, nuevas features, migraciones ni benchmark adicional.
