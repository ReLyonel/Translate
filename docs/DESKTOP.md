# Aplicación de escritorio

La única aplicación es Electron. No necesita navegador, servidor HTTP ni Node instalado
para usar el ejecutable portable. Ollama y el modelo se preparan por separado.

## Desarrollo y distribución

```powershell
bun install --frozen-lockfile
node node_modules/electron/install.js
bun run dev
bun run lint
bun run test
bun run package:win
```

Portable: release/Traductor-Foundry-0.4.1-x64.exe. Build descomprimida: release/win-unpacked/.
`bun run start` abre build actual; `bun run smoke:desktop` prueba UI, bridge y motor.
El launcher elimina ELECTRON_RUN_AS_NODE del proceso hijo para evitar heredar modo Node.

## Uso

En Ajustes configurar Ollama local (por defecto http://127.0.0.1:11500) y modelo
translategemma:27b. Solo endpoints loopback sin credenciales están permitidos.
En Traducir JSON seleccionar archivo o carpeta. Carpetas muestran JSON recursivos para
abrir uno individualmente; procesamiento automático de lotes espera T014.
Exportar abre diálogo nativo; elegir un nombre nuevo. Originales/archivos existentes
no se sobrescriben. Tras guardar se abre carpeta de salida. Glosario exporta igual.

## Seguridad y persistencia

Renderer aislado con sandbox, Node desactivado, navegación/ventanas/permisos bloqueados;
sin conexiones de red del renderer ni descargas de fuentes/workers. Ollama se llama
desde host. IPC valida ventana, frame, URL y payload. No API genérica de filesystem.
Configuración en %APPDATA%/foundry-translator/provider.json, sin API keys.
Memoria local opcional en %APPDATA%/foundry-translator/translation-memory.json
(formato terms compatible con memoryContext); no se distribuyen corpus personales.
En desarrollo se conserva lectura del corpus del repositorio.

## Validación y límites

TypeScript, 34 pruebas y smoke Electron aprobados. Evidencia Windows 11 Pro
10.0.26200; El portable final también pasó smoke con Node fuera del PATH. Windows 10 y
máquina limpia independiente aún pendientes.
El binario no está firmado. T021 sigue pendiente de integración de trabajos/lotes
 y T023 de verificaciones Windows adicionales. La traducción actual conserva el
flujo de motores existente; idiomas/memoria incremental/cancelación completa
pertenecen a las tareas anteriores del MVP.

Validacion de interfaz y corpus real: [UI_VALIDATION.md](UI_VALIDATION.md).
# Actualización 0.3.0

TranslateGemma 12B/27B vía Ollama es el proveedor preferente. LibreTranslate local se puede seleccionar o activar como fallback. La selección de carpeta permite procesar todos sus JSON, incluyendo subcarpetas, hacia una copia nueva con progreso y cancelación. Ver [configuración y uso](PROVIDERS_AND_BATCH.md).



Actualización 0.4.0: la selección de carpeta procesa una raíz de módulo con pack/packs y scripts y crea una copia integral. Ver [instrucciones y alcance](MODULE_ROOT_TRANSLATION.md).


Actualizacion 0.4.1: primera fase de integridad para objetivo Foundry14.368. Parse estricto, diff allowlist, segmentos y proteccion ampliada; 102 tests y portable verificado. Auditoria: AUDIT_V14_368.md. Publicacion de compendios nativos/TM avanzada/logs siguen pendientes.


## Memoria y revision: T059-T063 (2026-10-02)

TranslateGemma27B sigue como motor principal. La nueva vista Memoria y revision permite buscar traducciones, ver contexto/alternativas, editar y aprobar, rechazar o elegir el original para futuras copias. Guardar una edicion crea una candidata; Aceptar es una decision separada. Las revisiones no modifican las copias anteriores ni los archivos de origen. Durante un trabajo activo se bloquean las decisiones.

La memoria vigente se guarda privadamente en %APPDATA%/foundry-translator/translation-memory/store.json; el inventario incremental en su subcarpeta incremental. No hay importacion/aprobacion automatica del corpus historico. Cerrar la aplicacion antes de usar herramientas CLI de memoria.

Las copias por modulo revalidan JSON/scripts/referencias y pueden reutilizar unidades intactas sin llamar al proveedor. La identidad module.json.id permite comparar actualizaciones descargadas en carpetas distintas. El reporte exportable contiene procedencia por hashes, inventario y avisos terminologicos revisables, sin textos narrativos completos. Contrato: [review-incremental.md](../specs/001-foundry-translator-mvp/contracts/review-incremental.md).

340 pruebas automatizadas PASS; no sustituyen aceptacion real Foundry14.368 ni Windows10/maquina limpia. T065 no se implementa en este incremento. Las secciones anteriores conservan evidencia historica de versiones previas.


## Versi?n 0.4.2 ? preflight y condiciones térmicas

Antes de Traducir, pulsa Analizar antes de traducir: muestra resoluciones de memoria/cach?/glosario, cadenas IA y estimaci?n de peticiones. Importar memoria espa?ola abre un di?logo de carpeta y agrega exclusivamente candidatas; revisarlas en Memoria y revisión antes de aceptar. Cambios de fuentes/configuraci?n/revisión exigen repetir preflight.

Observaci?n NVIDIA opcional activada por defecto en Ajustes; durante pausa térmica Cancelar sigue disponible. Sin temperatura VRAM del driver, la app no puede detectar calor de memoria observado con otra herramienta. No cambia par?metros del hardware. Contrato, l?mites y aceptaci?n pendiente: [auditoría](THERMAL_MEMORY_AUDIT.md).
## Versión 0.4.3 — referencia PDF verificada

El preflight muestra documentos PDF verificados, páginas y segmentos como estadística separada de traducciones TM aprobadas. Se registraron privadamente los tres PDFs autorizados de spanish sin modificar sus originales ni aprobar los JSON. Todavía no se recuperan automáticamente esos fragmentos en prompts: T075 cubre correspondencias bilingües y recuperación segura. Contrato: [verified-pdf-memory.md](../specs/001-foundry-translator-mvp/contracts/verified-pdf-memory.md). 365 pruebas, lint/build y smoke empaquetado PASS.



## T075 - version 0.4.4

Memoria PDF SRD: revision bilingue, seleccion manual, exact aprobado, vinculo Foundry RU y contexto protegido. 385 tests/33 archivos PASS; no inferencia real ni cambios de hardware. 8372 propuestas y 0 aprobadas: no se acredita ahorro GPU hasta revision. Contrato: [pdf-srd-reuse.md](../specs/001-foundry-translator-mvp/contracts/pdf-srd-reuse.md). T036/T037/T065 siguen suspendidas.


## Resolucion 0.4.5

T075 reproducida dos veces sin nuevos IDs/aprobaciones. T076 implementada y T044 cerrada: 398 pruebas/37 archivos, lint/build y smoke empaquetado PASS. UI SRD con clasificacion y resolucion verificada; vinculacion canonica solo por identidad completa y par aprobado. T077 real pendiente: 5074 ubicaciones mapeadas,3 conflictos,0 correspondencias SRD aprobadas. Sin ahorro GPU declarado; preflight completo ai28372,estimacion33942 peticiones,memoria sin cambios. Se corrigio glosario-only que aun invocaba proveedor. Benchmark preparado pero NOT_RUN; 4B/12B no instalados. Sin batching/concurrencia/T065. Contrato: specs/001-foundry-translator-mvp/contracts/pdf-resolution.md; docs/BENCHMARK.md.
