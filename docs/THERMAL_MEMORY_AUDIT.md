# Auditoría urgente de memoria e inferencia — 2026-10-02

Esta entrega implementa T069–T073 en alcance local verificable. **No acredita que el problema de rendimiento/calidad esté completamente resuelto.** Las traducciones de `spanish` se importaron como candidatas por decisión expresa del usuario; no se ejecutó inferencia ni benchmark para esta auditoría.

## Evidencia y respuestas al Definition of Done

1. **Exact TM = 0:** la base privada activa tenía 9.918 entradas RU→ES y **0 aprobadas**. Exact solo reutiliza aprobadas. El corpus histórico de 3.354 entradas carece de idioma/aprobación/contexto suficiente y no se carga automáticamente como conocimiento confiable. No se encontró importación activa de `C:\Users\leond\OneDrive\Escritorio\spanish` a esa base; no existe evidencia suficiente para fechar cuándo dejó de formar parte del plan.
2. **Fuzzy TM = 0:** también exige aprobación. No faltaba necesariamente contenido: faltaba autoridad de revisión. Se conserva esa protección para no contaminar futuras traducciones.
3. **12.325 peticiones:** el informe registra solo **1 retry**; hubo 12.324 intentos iniciales. El adaptador anterior de TranslateGemma separaba fragmentos alrededor de placeholders y hacía peticiones por grupos de fragmentos, por lo que cadenas y HTTP no tenían relación 1:1. No hay trazas antiguas por unidad suficientes para reconstruir la distribución exacta. El nuevo adaptador envía cada unidad protegida en texto; solo textos que exceden presupuesto requieren varios fragmentos. No promete que fragmentar reduzca llamadas en todos los casos.
4. **Resolución SRD/manual:** el catálogo `spanish` ofrece 5.078 pares candidatos, 4.295 comprobaciones estructurales positivas, **4.291 campos canónicos únicos** y **3 campos con alternativas en conflicto**. Como máximo 4.288 de esos campos tienen una única alternativa estructuralmente admisible; esto no certifica traducción ni identidad semántica humana. PDFs, claves por nombre y converters no se relacionan automáticamente. No se debe denominar SRD aprobado a todo este catálogo.
5. **Cadenas que requieren realmente IA:** dependen de revisión, glosario, idioma, caché compatible y baseline. El preflight enumera explícitamente esas resoluciones antes de confirmar; hasta aprobar candidatos, **canonical/exact aprobados siguen en 0**. La estimación excluye reintentos/fallos y puede sobreestimar si existe baseline incremental reutilizable. El reporte actual reproducible está en `reports/thermal-memory/preflight.json`.
6. **GPU/CPU:** una consulta anterior `/api/ps` informó size = size_vram = 17.496.885.165 bytes para 27B Q4_K_M: residencia del modelo completamente en GPU en esa foto. No acredita todo el trabajo de CPU ni la colocación histórica del trabajo cancelado. Una consulta posterior NOT_LOADED no implica que se descargara deliberadamente; la auditoría no carga ni descarga modelos. Ver [API Ollama ps](https://docs.ollama.com/api/ps).
7. **Contexto:** el snapshot anterior comunicaba 16.384. La nueva solicitud pide 4.096 con salida máxima de 2.048; referencias/contexto acotados. Un modelo ya cargado puede seguir mostrando otro contexto hasta la próxima inferencia; no se fuerza una para verificarlo.
8. **Prompt:** un mensaje user, idiomas RU/EN y ES explícitos, texto exclusivo y placeholders opacos. Prompt real sintético, límites y formato se especifican en [contrato](../specs/001-foundry-translator-mvp/contracts/thermal-memory-preflight.md). No se envía JSON/JavaScript completo.
9. **12B frente a 27B:** **NOT_RUN**. Solo se encontró instalado 27B. T043 permanece pendiente: mismo golden EN/RU, calidad/errores, tokens/s, strings/s, VRAM, temperaturas disponibles, potencia y tiempo. No se instala 12B/4B ni se cambia default/routing automáticamente.
10. **Pausa segura:** pruebas controladas acreditan abort de petición propia, espera/reanudación tras tres muestras frías, pérdida de sensor, cancelación y conservación de original/baseline sin archivo parcial. No acreditan seguridad física de una ejecución prolongada. En esta RTX3090, `nvidia-smi` retorna **temperatura de memoria N/A**; no es posible detectar con ese sensor los 105°C observados externamente. El abort HTTP tampoco garantiza detener de inmediato todos los kernels del servidor o actividad de otros procesos.

## Importación autorizada

Se hizo backup privado antes de escribir. Se preservaron todas las 9.918 entradas anteriores y las 5.000 entradas de caché. Se agregaron **5.077 entradas nuevas** (un par repetido fue deduplicado): total **14.995**, RU→ES 14.265, EN→ES 730, aprobadas 0, glosario persistente 0. Informe con hashes y ubicación del backup: `reports/thermal-memory/spanish-import.json`. No se copiaron textos privados al informe ni se modificaron archivos de origen.

Revisar las entradas del motor `manual-spanish-import` en Memoria y revisión. La revisión debe verificar significado, correspondencia entre versiones y terminología además de estructura. Aceptar una traducción no es lo mismo que importar una candidata. Cambiar aprobación invalida preflight y claves dependientes de revisión; repetir el análisis antes de iniciar inferencia.

La nueva versión de prompt/perfil invalida reutilización automática de la caché antigua, conservándola en disco. Esto puede aumentar misses en la primera ejecución y debe verse en preflight: no es motivo para saltarse los invariantes ni aprobar automáticamente caché o resultados históricos.

## Reproducción y límites

`npx tsx scripts/auditThermalMemory.ts` realiza discovery, lectura de memoria/catálogo y consultas de metadatos/sensores; comprueba que la memoria no cambie. No llama `/api/chat`. La importación CLI separada exige cerrar el traductor y usa `scripts/importSpanishCandidates.ts moduleRoot spanishFolder`; importa solo candidatas, con backup y transacción atómica. Los reportes privados están excluidos de git.

T036/T037 siguen sin implementar, T065 sin integración. T055/T056 Foundry14.368 real permanecen pospuestas. Las 360 pruebas locales, TypeScript y build no sustituyen benchmark térmico, Windows10/máquina limpia ni aceptación Foundry. No se aceleró la carga GPU para investigar estos datos.


Validación de entrega: 360 pruebas/30 archivos PASS; lint/build y smoke del ASAR empaquetado PASS. Artefacto [portable 0.4.2](../release/Traductor-Foundry-0.4.2-x64.exe), SHA-256 D1DD9C09A006358D768C397C532B8BDEE6A85A4422279C2627E0064E026C6C55. El rechazo de un payload inválido durante smoke es una comprobaci?n esperada, no fallo de arranque.


## Aclaración posterior: los PDFs son referencia verificada

El usuario confirm? los PDFs de spanish como memoria verificada. Se extrajeron y registraron privadamente 3 documentos, 1150 páginas y 38720 segmentos: SRD5.2.1 ES/EN y Manual del Jugador ES. Esta aclaración sustituye la exclusión inicial de PDFs como fuente. No aprueba los JSON ni certifica alineaciones automáticas. El preflight/reportes muestran la referencia documental separada de hits; recuperación de esos segmentos y aprobación de correspondencias PDF permanecen en T075. Ver [contrato](../specs/001-foundry-translator-mvp/contracts/verified-pdf-memory.md).


## T075 - version 0.4.4

Memoria PDF SRD: revision bilingue, seleccion manual, exact aprobado, vinculo Foundry RU y contexto protegido. 385 tests/33 archivos PASS; no inferencia real ni cambios de hardware. 8372 propuestas y 0 aprobadas: no se acredita ahorro GPU hasta revision. Contrato: [pdf-srd-reuse.md](../specs/001-foundry-translator-mvp/contracts/pdf-srd-reuse.md). T036/T037/T065 siguen suspendidas.


## Resolucion 0.4.5

T075 reproducida dos veces sin nuevos IDs/aprobaciones. T076 implementada y T044 cerrada: 398 pruebas/37 archivos, lint/build y smoke empaquetado PASS. UI SRD con clasificacion y resolucion verificada; vinculacion canonica solo por identidad completa y par aprobado. T077 real pendiente: 5074 ubicaciones mapeadas,3 conflictos,0 correspondencias SRD aprobadas. Sin ahorro GPU declarado; preflight completo ai28372,estimacion33942 peticiones,memoria sin cambios. Se corrigio glosario-only que aun invocaba proveedor. Benchmark preparado pero NOT_RUN; 4B/12B no instalados. Sin batching/concurrencia/T065. Contrato: specs/001-foundry-translator-mvp/contracts/pdf-resolution.md; docs/BENCHMARK.md.
