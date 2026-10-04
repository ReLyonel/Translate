# T043 — resultados del corpus congelado

> Experimento anterior a la corrección P0; se conserva como baseline histórico. Los [resultados de la repetición corregida](T043_PROTECTION_FIX.md) prevalecen para la recomendación actual. No modificar este baseline para recalificarlo con otro protector.

2026-10-03. Comparación ejecutada serialmente: 4B → 12B → 27B, 120 muestras por modelo (60 EN→ES y 60 RU→ES). Sin modificar muestras, prompts, fuentes o TM. Sin batching, concurrencia, routing ni traducción completa de FifthPendium.

**Ningún modelo supera el gate estructural del corpus completo.** El experimento queda realizado, pero no acredita traducción lista para producción. Recomendación: conservar **DEFAULT_MODEL = translategemma:27b, provisionalmente**, por sus menores fallos de placeholders y mayor cobertura aceptada RU. No se cambió la configuración de la aplicación.

## Comparación final

| Medida | 4B | 12B | 27B |
|---|---:|---:|---:|
| Muestras ejecutadas | 120 | 120 | 120 |
| Aceptadas por gate | 55 | 78 | 82 |
| EN→ES aceptadas / 60 | 18 | 31 | 29 |
| RU→ES aceptadas / 60 | 37 | 47 | 53 |
| Fallos estructurales, casos | 65 | 42 | 38 |
| Fallos de validación, casos | 65 | 42 | 38 |
| Fallos de placeholders, casos | 53 | 21 | 10 |
| Referencias enriquecidas alteradas, casos | 12 | 21 | 28 |
| HTML: fallos comprobados en salidas restauradas | 0 | 0 | 0 |
| UUID: cambios comprobados en salidas restauradas | 0 | 0 | 0 |
| Rolls: fallo asociado a restauración | 0 | 0 | 1 |
| JavaScript: fallos AST/interpolación de archivo | 0 | 0 | 0 |
| Segmentos JS rechazados / 15 | 1 | 4 | 0 |
| Wrong language detectado | 0 | 0 | 0 |
| Untranslated detectado | 0 | 0 | 0 |
| Reintentos | 56 | 21 | 9 |
| Fallback a original, casos | 65 | 42 | 38 |
| Peticiones / respuestas HTTP correctas | 203 / 203 | 201 / 201 | 199 / 199 |
| Chunks aceptados por gate de petición | 94 | 159 | 181 |
| Duración, s | 172.44 | 350.97 | 688.51 |
| Latencia media por petición, s | 0.80 | 1.67 | 3.36 |
| Strings/min procesadas | 41.75 | 20.51 | 10.46 |
| Strings/min aceptadas por gate | 19.14 | 13.33 | 7.15 |
| Tokens/s de generación | 174.35 | 80.16 | 40.27 |
| VRAM máxima, MiB | 6033 | 11154 | 20233 |
| GPU máxima, °C | 79 | 81 | 81 |
| Temperatura VRAM | N/A | N/A | N/A |
| RAM máxima servidor, GiB | N/A | 9.62 | 10.01 |
| RAM máxima runner, MiB | 635.20 | 644.48 | 131.59 |
| THERMAL_ABORT | No | No | No |

Aceptación por gate no equivale a fidelidad lingüística. Los fallos pueden solaparse: el fallo de rolls de 27B corresponde al mismo caso que falló restauración. Fallback significa conservar el original en la evaluación; no se invocó LibreTranslate ni se publicaron archivos del módulo.

Las salidas rechazadas antes de restauración no permiten atribuir exactamente qué tag/UUID/roll se perdió. Quedan como fallo de placeholder, no como evidencia de que esos elementos hayan pasado. Los ceros de idioma son heurísticos. `reference_failure_cases` incluye referencias enriquecidas Foundry; no significa pérdida de UUIDs únicamente.

## Mediciones separadas EN/RU

| Medida | 4B EN | 4B RU | 12B EN | 12B RU | 27B EN | 27B RU |
|---|---:|---:|---:|---:|---:|---:|
| Duración, s | 89.97 | 82.01 | 134.17 | 216.38 | 271.69 | 416.38 |
| Peticiones | 96 | 107 | 73 | 128 | 71 | 128 |
| Reintentos | 32 | 24 | 9 | 12 | 4 | 5 |
| Strings/min | 40.01 | 43.90 | 26.83 | 16.64 | 13.25 | 8.65 |
| Tokens/s | 175.82 | 173.06 | 80.41 | 80.02 | 40.40 | 40.19 |

Duración total incluye arranque, observación y validación AST; excluye enfriamiento entre modelos. Tokens/s usa `eval_count / eval_duration`, excluye carga e incluye tokens de intentos rechazados. Latencia incluye todos los intentos HTTP. El corpus representa 193 chunks iniciales por modelo, pero un fallo temprano interrumpe los restantes de esa string: no se ejecutó el mismo número de chunks. La velocidad bruta de 4B no equivale a trabajo válido de calidad comparable.

## Calidad después del gate

Revisión cualitativa por el asistente, no ciega ni certificación de un traductor humano. Se revisaron las salidas cortas aceptadas, las dos referencias aprobadas y pasajes de descripciones EN/RU aceptadas. Las salidas estructuralmente corruptas se excluyen de esta comparación lingüística. No se asignan puntuaciones numéricas sin fundamento ni se emplean PDFs ambiguos como ground truth.

| Categoría | 4B | 12B | 27B |
|---|---|---|---|
| EN→ES | Errores de sentido y terminología | Mejor fidelidad en frases; errores D&D | Mejor en algunas descripciones; errores D&D y conversiones de unidades |
| RU→ES | Errores semánticos claros | Mejora frente a 4B; inconsistencias | Mejor en varios mensajes y pasajes; errores persistentes |
| Short text: gate / 44 | 39; términos ambiguos incorrectos | 39; puntuación y labels poco naturales | 42; persisten términos ambiguos incorrectos |
| Long text: gate / 26 | 2; cobertura insuficiente | 12; terminología inconsistente | 14; mejor cobertura, terminología irregular |
| Terminología D&D | Insuficiente | Insuficiente | Insuficiente |
| Referencias aprobadas aplicables | 2 | 2 | 2 |
| Coincidencia literal con referencias | 0 / 2 | 0 / 2 | 0 / 2 |

Ejemplos aceptados por el gate:

- RU `Это не заклинание!`: 4B «¡Esto no es una maldición!» cambia el significado; 12B «¡Esto no es un hechizo!»; 27B «¡Esto no es un conjuro!».
- RU `Обычные постройки`: 4B «Edificios residenciales» cambia «comunes»; 12B «Edificaciones comunes» y 27B «Edificios comunes» conservan mejor el sentido.
- EN `Charge`, nombre de acción: 4B «Costo», 12B/27B «Cargo». EN `Save`, actividad de salvación: los tres «Guardar». El prompt congelado carece de contexto adicional; no se modificó para favorecer ningún modelo.
- Referencia aprobada RU `Сотворение заклинаний` → «Lanzamiento de Conjuros»: todos producen variantes de «Creación de hechizos», cambiando la función. La otra referencia aprobada es «Caída de Pluma»; todos la parafrasean. Una divergencia literal no implica automáticamente error semántico.
- En una descripción EN aceptada los tres traducen «Foundry Note» como herrero/fundición. 27B convierte 2 pies a 60 centímetros, una conversión aproximada no solicitada. En pasajes RU aceptados persisten mezclas de tú/usted y términos como «ranura» para espacio de conjuro.

27B logra 53/60 muestras RU aceptadas, frente a 47/60 y37/60: principal razón para conservarlo provisionalmente. 12B necesita bastante menos VRAM y aproximadamente la mitad del tiempo, por lo que merece reevaluación después de corregir el defecto concreto de protección. **No hay ganador apto para producción**. No se implementó routing.

## Defecto concreto de preservación

El protector actual protege `&amp;` pero puede dejar `Reference[...]` expuesto. Los tres modelos modifican `&amp;Reference[...]`: traducen las claves técnicas o las eliminan. Es un defecto P0 compartido del pipeline y no una razón para relajar validaciones.

Se añadió comprobación estricta **solo al gate del benchmark**, con regresiones. Todas las respuestas guardadas se reevaluaron offline con el mismo gate, sin repetir inferencia ni modificar prompts. 4B mostraba inicialmente67 aceptadas; el resultado final correcto es55. Un caso27B restauró el original tras fallar; permanece como fallo, nunca como éxito o texto sin traducir.

El pipeline de producto queda sin cambios, conforme al alcance exclusivo T043. Antes de aceptar publicación de ese markup debe corregirse ese defecto existente, sin abrir una fase arquitectónica.

Los scripts se reconstruyeron en memoria usando rangos AST congelados y traducciones aceptadas; segmentos fallidos/no seleccionados conservaron original. El gate existente comprobó AST/interpolaciones/imports/exports y bytes protegidos fuera de rangos. Cero fallos de archivo no implica que todos sus segmentos se tradujeran.

## Recursos y condiciones

Opciones idénticas: temperatura0, `num_ctx4096`, `num_predict2048`, glosario congelado vacío, máximo dos intentos por chunk y mensajes del corpus sin regenerarlos. No descargas ni instalaciones.

RTX3090 observada cada2s: GPU warning80/pause85, memoria warning90/pause96 °C. No cambios de clocks, voltajes, fans o power limit. Se descargó cada modelo tras terminar y se esperó GPU ociosa y≤50°C antes del siguiente. El primer arranque de12B quedó bloqueado por actividad residual del propio4B; se conservaron resultados y se reanudó desde12B tras enfriamiento. Sin repetir4B ni continuar forzando ningún aborto térmico.

Temperatura VRAM no expuesta por el driver: **esta prueba corta no certifica seguridad térmica de memoria ni de ejecuciones largas**. VRAM máxima es framebuffer del dispositivo, incluido escritorio. Ollama reportó27B `Q4_K_M`, contexto4096 y `size_vram == size` (17484302253bytes) durante inferencia: carga informada completamente en GPU en esta prueba.

RAM servidor suma working sets de Ollama y `llama-server`, muestreados cada~3s durante12B/27B. El muestreo inicial4B omitió `llama-server`: dato N/A; no se repitió inferencia por esa carencia. RAM del runner es RSS y se informa aparte. Son máximos observados, no instantáneos garantizados.

## Artefactos y reproducción

Corpus privado: `reports/benchmark/real-corpus.json`; SHA casos `87c0b280baf15069f17d03548896cad71cc4b5682700eb63e2896b0d9a030268`; prompts `69d82a8dced75e7d188528bc806b8725a6b0630c21d7ea89a050d9c983832477`. Cobertura solapada:24 nombres,44 cortos,26 largos,80 HTML,81 placeholders,22 UUID,42 rolls,12 embedded,15 JS,9 Dialog,4 notifications,2 templates.

- `scripts/runFrozenTranslateGemmaBenchmark.ts`: runner serial, sin reconstruir corpus ni descargar modelos.
- `scripts/evaluateFrozenTranslateGemmaBenchmark.ts`: evaluación offline común, sin Ollama ni escritura TM.
- `reports/benchmark/results.json`: respuestas, latencias, motivos, telemetría/checkpoints brutos.
- `reports/benchmark/evaluation.json`: gate final por muestra, categorías y lenguaje. Prevalece para la comparación.
- `reports/benchmark/server-ram.jsonl` y `27b-residency.json`: evidencia de recursos.
- `tests/benchmark/`:9 pruebas PASS; lint PASS.

Informes con textos privados ignorados por Git. Reevaluación sin inferencia: `npx tsx scripts/evaluateFrozenTranslateGemmaBenchmark.ts`. **No ejecutar `benchmark:plan` sobre este experimento: regeneraría el corpus.** Hashes de memoria/fuentes/corpus comprobados antes/después; intactos. Las respuestas no alimentan TM ni se publicaron como módulo.

## Baseline y cierre

24379 strings requiring model,29949 requests estimadas: **5570 llamadas iniciales adicionales por chunking semántico/presupuesto**. La estimación excluye retries/fallbacks; aquí los reintentos se midieron aparte. No se repitió ni intentó mejorar el preflight de29339 únicas/3984 TM/0cache/0glosario/623dedup.

T043 termina como experimento comparativo, con limitaciones y sin aprobación de producción. T036/T037/T065/T077 suspendidas. Detenido, sin traducción masiva, migraciones Foundry/dnd5e ni continuación de otras tareas.
