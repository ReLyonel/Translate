# Benchmark TranslateGemma: T043

> Corrección vigente 2026-10-03: [preparación real T043](BENCHMARK_T043.md) sustituye las condiciones históricas siguientes. T043 reactivada únicamente; T077/T036/T037/T065 suspendidas. `benchmark:plan` prepara 120 segmentos reales; runner histórico `--run` bloqueado. Sin modelos4B/12B no se inicia inferencia ni se exige cobertura canónica.

T043 sigue pendiente de resultados reales y revisión semántica. No se cambia el modelo predeterminado 27B ni se descargan modelos automáticamente.

`npm run benchmark:plan` produce reports/benchmark/matrix.json sin inferencia. Matriz 4B/12B/27B × EN/RU → ES × QUALITY_PURE/PIPELINE_REAL. Actualmente solo está instalado 27B: 4B/12B NOT_INSTALLED y 27B NOT_RUN.

`npx tsx scripts/benchmarkTranslateGemma.ts --run` exige primero preflight real con cobertura aprobada/canónica y GPU observada, fría y libre. Cero reutilización genera BLOCKED_BY_MEMORY_COVERAGE; no se acepta como baseline ni inicia IA. Usa el guard térmico existente y cancelación de diez minutos por celda, sin concurrencia, batching ni cambios de hardware.

QUALITY_PURE utiliza exactamente tests/golden/foundry_v14_368/benchmark/corpus.json para todos los modelos: nombres, reglas, referencias/HTML/rolls, narrativa y diálogo. PIPELINE_REAL usa una muestra determinista de ubicaciones reales del módulo con sus contextos e identidades, priorizando reutilización canónica; cada muestra registra hash para comparar modelos con las mismas entradas. La comparación de pipeline es una muestra, no una ejecución íntegra de 4.109 archivos ni una certificación Foundry.

Cada celda usa memoria temporal independiente: ninguna traducción del benchmark alimenta la memoria del usuario o a otro modelo. Registra métricas runtime, tokens/eval/load, tokens/s, strings/s, tiempo total, placement CPU/GPU, VRAM y muestras térmicas/potencia del driver. Temperatura de memoria ausente permanece null. Los casos fallidos cuentan como errores; resultado sin fallo de formato no certifica calidad semántica. Una coincidencia con traducción de referencia es informativa; las alternativas válidas necesitan revisión humana ciega de calidad, terminología y consistencia.

Corrección encontrada en T044: el glosario podía resolver todo el texto y aun así enviar placeholders al proveedor. Ahora los casos completamente protegidos/resueltos retornan localmente, respetando cancelación y sin invocar proveedor/fallback. Esto alinea ese caso con el preflight; no acredita una reducción medida en fifthpendium, cuyo glosario actual está vacío.

Preflight real 0.4.5 sin inferencia: 4.109 archivos, 29.971 cadenas, 29.348 únicas, 976 solo protegidas, 28.372 requieren IA, 33.942 peticiones iniciales estimadas, 0 canónicas/TM/PDF/cache/glosario. Dos archivos ambiguos se abstienen. NO_APPROVED_MEMORY y MEMORY_UTILIZATION_WARNING visibles. Caché5.000 conservada, pero no compatible con las claves actuales. Este estado se considera insuficiente para comenzar el benchmark real.

La ejecución antigua cancelada tradujo una parte: 10.614 cadenas y 12.325 solicitudes (incluye intentos/retries). No dividir por 33.942 estimaciones del módulo completo para anunciar un ahorro porcentual. Hace falta la misma selección y el mismo perfil de conteo antes/después; hasta entonces reduction_percent=null.
