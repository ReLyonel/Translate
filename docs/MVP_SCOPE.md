# Alcance vigente y camino crítico

Corrección autorizada del 2026-10-03. Prevalece sobre requisitos anteriores de copia integral predeterminada, cobertura canónica o alineación documental como condición de entrega. No elimina implementaciones ni tareas existentes.

| Prioridad | Resultado | Condición de aceptación |
|---|---|---|
| P0 — Producto/MVP | Fuentes de módulo → JSON/scripts españoles nativos, overlay predeterminado o copia completa explícita | Original intacto; diferencias solo en textos humanos clasificados; estructura, referencias y lógica preservadas; validación, recuperación, logs, cancelación y publicación atómica; aceptación del ejecutable y Foundry 14.368 sin Babele. |
| P1 — Calidad | TM aprobada, corpus histórico, SRD, glosario, canonical/PDF y contexto | Usar cuando haya evidencia compatible; un miss continúa al proveedor. Cobertura incompleta o fuentes ausentes no impiden el P0. |
| P2 — Optimización | Cobertura adicional, AI avoidance, batching, concurrencia y routing | Solo después de integridad y autorización específica. No bloquean el MVP. |

El pipeline conserva reutilización segura → TranslateGemma para misses → validación → reinserción/publicación. Una respuesta inválida produce original + warning. No se relajan aprobación, contexto, conflictos ni integridad para mejorar porcentajes. TranslateGemma 27B continúa como modelo predeterminado. Nunca recibe un archivo completo para modificarlo libremente.

Los scripts forman parte del P0: clasificación AST conservadora, cambios por rangos, protección de interpolaciones, sintaxis y comparación de AST. No se ejecutan los scripts fuente durante traducción o pruebas de extracción. Las construcciones no reconocidas se conservan.

La entrega de salida amplía las tareas **T028/T029, T057/T058 y T066/T067** existentes; no crea una fase ni una cadena adicional de tareas. Contrato: [output-strategies.md](../specs/001-foundry-translator-mvp/contracts/output-strategies.md). T065 conserva su suspensión: esta autorización concreta sobre salida no reactiva su integración más amplia.

## Estado T077

La continuación de confianza histórica ya tiene evidencia: importación idempotente, traducciones aprobadas separadas de identidad canónica, conflictos excluidos, caché antigua aislada y hits explicables. [Resultados T077](T077_RESULTS.md) conserva el dry-run de su entrega: 3.984 hits históricos, 24.388 cadenas con IA y 29.958 solicitudes estimadas; no hubo inferencia.

Quedan pendientes los vínculos SRD canónicos reales y las 20 pruebas de identidad VERIFIED. No se inventan ni se convierten los 8.372 candidatos PDF en aprobados. **T077 permanece abierta en P1/P2; ese criterio no impide terminar ni utilizar el traductor P0.** Las cifras del dry-run son evidencia histórica de esa ejecución, no una promesa de cobertura futura ni una condición de viabilidad del MVP.

T043, T036 y T037 continúan suspendidas. No se ejecutan benchmark GPU, traducción masiva, batching ni concurrencia en esta corrección.

## Pendientes que sí condicionan aceptación P0

1. Consolidar los contratos globales de trabajos, progreso, cancelación e informes y las pruebas adversariales pendientes de T001–T006, T009, T014–T019 y T021 según el alcance concreto no cubierto por escritorio. Mantener los checks históricos; no duplicar componentes funcionales por sus antiguas rutas propuestas.
2. T023: Windows 10 y máquina limpia; el smoke local del ejecutable no acredita esos entornos.
3. T055/T056: módulo reempaquetado, mundo aislado Foundry **14.368**, sin Babele, carga y referencias/rolls/documentos/scripts funcionales. La aceptación controlada del 2026-10-03 ya encontró 14.368 y abrió ese mundo, pero FifthPendium quedó deshabilitado por dnd5e 6.0.5 frente a su máximo declarado 5.9.9. Ver [P0_ACCEPTANCE.md](P0_ACCEPTANCE.md).
4. T024/T025: cerrar aceptación y trazabilidad sobre esas evidencias reales.

Detección idiomática completa y reutilización adicional pendientes se evalúan como P1 cuando no afectan integridad. El listado histórico `tasks.md` mantiene IDs y estados; se prioriza el defecto real y la evidencia existente sobre el número de tarea.

## Evidencia de esta corrección

Versión 0.4.8: **466 pruebas / 42 archivos PASS**, lint y build PASS. Smoke del paquete ASAR y del portable PASS, verificando renderer, puente nativo, rechazo de payloads y runtime incluido sin Node/Bun en PATH. No acredita Windows 10, máquina limpia ni Foundry real.

Prueba íntegra de FifthPendium con proveedor identidad, sin Ollama: **4.109 JSON/scripts analizados, 4.109 sin cambios, 0 escritos**, 10.105 assets omitidos y **523.678.079 bytes** originales no duplicados. Se verificaron hashes de 4.193 archivos fuente elegibles/manifiesto/localizaciones; intactos. Ocho archivos con WARNING: dos JSON originales no pasan la validación y seis scripts tienen contextos inciertos que se conservan. Esta prueba no traduce ni evalúa calidad lingüística. Informe privado: [real-module.json](../reports/output-validation/real-module.json).

TM persistente intacta: SHA-256 `6edd82be68fb1da33d99f8124b2119e7e8d722a1b50ad5c248f854bad5a873a9`. No se alteraron confianza, candidatos PDF, corpus histórico ni caché para obtener este resultado.

Portable: [Traductor-Foundry-0.4.8-x64.exe](../release/Traductor-Foundry-0.4.8-x64.exe). SHA-256 `5F57D9D328E257711CDD67E91F2EEDE2EC1E63F86C1025C77082C6A54B059C6D`.
