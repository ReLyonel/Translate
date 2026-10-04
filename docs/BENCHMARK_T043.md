# T043 — preparación histórica del corpus

> Estado vigente: los tres modelos ya fueron ejecutados serialmente sobre estas mismas 120 muestras. Ver [resultados finales y limitaciones](BENCHMARK_T043_RESULTS.md). Los estados NOT_INSTALLED/NOT_RUN siguientes son históricos y quedan sustituidos por ese informe; no regenerar el corpus.

> Actualización posterior: corregido el defecto P0 y repetido el experimento sin modificar las muestras. [Auditoría, corrección y resultados vigentes](T043_PROTECTION_FIX.md). La recomendación nueva prevalece sobre la del primer experimento.

2026-10-03. Solo T043 reactivada; T036/T037/T065/T077 siguen suspendidas. No routing, migraciones, descargas ni traducción masiva.

Ollama `/api/tags` en `http://127.0.0.1:11500` confirma únicamente `translategemma:27b`. Faltan `translategemma:4b` y `translategemma:12b`. Se detiene antes de inferencia, conforme a la instrucción del usuario.

| Resultado | 4B | 12B | 27B |
|---|---|---|---|
| Estado | NOT_INSTALLED | NOT_INSTALLED | NOT_RUN |
| Calidad / RU→ES / EN→ES | No medida | No medida | No medida |
| Fallos / reintentos | No medidos | No medidos | No medidos |
| Duración / strings/min | No medidos | No medidos | No medidos |
| VRAM / temperatura GPU / memoria | No medidas en carga | No medidas en carga | No medidas en carga |

`DEFAULT_MODEL = translategemma:27b` conservado provisionalmente. No hay evidencia comparativa para recomendar otro tamaño ni demostrar que 27B sea el más eficiente.

## Corpus real congelado

`npm run benchmark:plan` usa `scripts/prepareTranslateGemmaBenchmark.ts`, sin carga/inferencia. Salida privada ignorada por Git: `reports/benchmark/real-corpus.json` (textos, archivo/ruta, contexto, prompts/chunks y fuentes AST) y `preparation.json` (matriz y disponibilidad).

120 segmentos FifthPendium: **60 EN / 60 RU**, selección determinista y estratificada. No se inventa la versión inglesa/rusa de un texto. Hash: `87c0b280baf15069f17d03548896cad71cc4b5682700eb63e2896b0d9a030268`.

| Cobertura, categorías solapadas | Segmentos |
|---|---:|
| Nombres | 24 |
| Cortos / descripciones intermedias / largos | 44 / 50 / 26 |
| HTML / placeholders | 80 / 81 |
| UUID / rolls-fórmulas | 22 / 42 |
| Contenido embebido | 12 |
| JavaScript visible | 15 |
| Contexto Dialog / notifications | 9 / 4 |
| Segmentos de template literal | 2 |

Dialog/notifications son anotaciones por proximidad dentro del script; la elegibilidad siempre proviene del AST. Se conservan fuentes completas, rangos autorizados y expresiones para comprobar interpolaciones/AST en la ejecución. No se decide qué traducir mediante sustituciones globales.

Hay **2 referencias TM aprobadas compatibles**. El resto requiere revisión lingüística humana. Los candidatos PDF ambiguos no son ground truth. Los textos incluyen nombres y terminología D&D real. La muestra representa **193 peticiones iniciales por modelo**, no ejecutadas; cada segmento admite hasta ocho chunks.

## Condiciones y mediciones pendientes

Los modelos recibirán el mismo corpus sellado, orden, prompts, glosario congelado (vacío), protecciones y configuración funcional: ejecución serial, sin batching/concurrencia, contexto4096/output2048 y guard térmico existente activo. Cada modelo usa memoria aislada; las referencias se emplean para evaluación, sin resolver automáticamente la muestra de calidad pura. Las respuestas no alimentan la memoria del usuario ni otro modelo.

Registrar translation_failures, wrong_language, untranslated_text, placeholder_failures, html_failures, uuid_failures, roll_failures, script_interpolation_failures, validation_retries y fallbacks. Alterar contenido protegido/estructura es fallo grave; fallback no cuenta como éxito del modelo. Scripts requieren validación AST, expresiones y bytes fuera de rangos autorizados, no solo éxito de una string.

Evaluación lingüística ciega por EN/RU y longitud: fidelidad, español natural, terminología, consistencia y nombres propios; escala1–5 con observaciones. Exactitud literal con una referencia no basta para medir calidad, y una variante válida no es automáticamente un error. No declarar ganador sin calidad/integridad suficientes.

Medir requests, successful_requests, retries, chunks, duration, average_latency, tokens/s si Ollama reporta tokens/eval_duration, strings/min. Registrar GPU/VRAM/temperaturas, RAM/CPU del proceso y alcance/disponibilidad de RAM/CPU del servidor Ollama. Datos ausentes permanecen null; nunca estimar temperatura de memoria como medida. GPU de preparación: RTX3090,47°C, memoria N/A, VRAM2163/24576MiB, utilización2%; **no son mediciones de inferencia**.

## Diferencia strings/peticiones del baseline

Baseline conservado:29339 únicas,3984TM,0cache,0glosario,623dedup,24379strings requiring model,29949solicitudes estimadas.

**29949−24379=5570** peticiones iniciales adicionales. Para cada miss, el preflight suma `semanticChunks(protectedText).length`: una cadena larga se divide por presupuesto UTF-8/contexto. Con el glosario/cache actuales, la diferencia corresponde a chunking.

En esta estimación se excluyen reintentos y fallback: componentes0 en el estimador, no resultados medidos. No hay otras llamadas de inferencia añadidas al cálculo. En una ejecución real los reintentos se registrarán separadamente. No se repitió el preflight ni se intentó mejorar sus cifras.

## Qué falta

1. Disponibilidad de 4B/12B mediante instalación explícitamente autorizada; ningún script hace pull/install.
2. Adaptar/verificar el runner real sobre este corpus y las mediciones descritas. El runner histórico de seis casos queda bloqueado con `--run` para evitar ejecutar/presentar su muestra antigua como esta comparación.
3. Ejecutar la muestra serial con seguridad térmica y revisión lingüística antes de recomendar tamaño.

Se retiró del gate T043 la exigencia de cobertura canónica/TM: T077 no bloquea esta comparación. Se mantienen GPU observable, fría y disponible. Pruebas de política/corpus:5 PASS; lint PASS. Memoria y scripts comprobados intactos,0inferencia/0descargas.

T043 permanece abierta, preparada parcialmente y detenida por modelos ausentes. No se recomiendan cambios de default ni routing con métricas no medidas.
