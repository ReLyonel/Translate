# Decisiones y contexto

Fecha: 2026-10-01. Inspección estática; no prueba de funcionamiento.

| Área | Evidencia | Brecha |
|---|---|---|
| UI | JsonTranslator.tsx y SettingsView.tsx | carpeta/desktop |
| Extracción | src/services/json/jsonEngine.ts | ambiguos y claves duplicadas |
| Protección | protectedContentEngine.ts | cobertura completa PRD |
| Validación | foundryValidator.ts | referencias por ubicación y arrays |
| Proveedor | server.ts, translationService.ts | interfaz sustituible y abort |
| Memoria | translationSourceManager.ts, memoryContext.ts, translationMemory.ts | persistencia de resultados/contexto |
| Pruebas | foundryPipeline.test.ts y translation/*.test.ts | jobs/FS/.exe |

## Host desktop

**Decision**: Electron propuesto con renderer aislado.
**Rationale**: reutiliza Node/React; no requiere trasladar motores.
**Alternatives considered**: Tauri añade backend/puente distinto; navegador no cubre
.exe ni escritura fiable. Validar versiones/licencias en T001 antes de instalar.

## Proveedor inicial

**Decision**: Ollama existente, configurable y preparado aparte.
**Rationale**: integración ya presente; PRD admite un único proveedor inicial.
**Alternatives considered**: nube añade secretos/adaptadores; incluir modelo en
instalador altera tamaño/licencias y queda fuera del MVP.

## Integridad JSON

**Decision**: igualdad estructural y tokens por ubicación/multiplicidad; rechazar
claves duplicadas antes de JSON.parse.
**Rationale**: parser ordinario pierde duplicados; comparar tokens globales no
revela intercambios entre campos.
**Alternatives considered**: regex o contar tokens no garantiza integridad.

## Salida

**Decision**: destino nuevo, copia intacta de recursos, temporal en mismo volumen
y rename tras validar, sin sobrescritura ni seguimiento de enlaces.
**Rationale**: árbol utilizable y sin ciclos/corrupción.
**Alternatives considered**: solo exportar JSON pierde recursos; editar origen
contradice salida segura.

## Memoria y estados

**Decision**: glosario > memoria aprobada compatible > proveedor; memoria clave por
idioma/contexto/glosario/reglas. Resultado funcional separado de severidad.
**Rationale**: no reutilizar ruso como inglés ni ignorar términos nuevos; copia
tras fallo sigue siendo ERROR.
**Alternatives considered**: hash textual solo ignora contexto; fuzzy automático
no está aprobado; un enum de severidad no explica resultado.

## Decisión ejecutada - 2026-10-01

Electron 44.5.1 y electron-builder 26.15.3 incorporados como herramientas de desarrollo.
Host/preload CJS empaquetados por esbuild; renderer Vite local. Sin servidor Express.
Dependencias frontend se compilan, no se incluyen node_modules en runtime.
Licencias: Electron MIT, electron-builder MIT; Chromium/Node incluidos por Electron.
Motor Ollama/modelo permanece instalado aparte; no se redistribuyen modelos/corpus.
PDF worker empaquetado localmente, sin fuentes ni workers descargados desde CDN.


## Incidente termico / reutilizacion: T069-T073 (2026-10-02)

Requisito urgente autorizado: no batching, no concurrencia adicional, reducir primero inferencia. Auditar ejecucion fifthpendium RU->ES y fuente manual C:/Users/leond/OneDrive/Escritorio/spanish. Base activa encontrada: 9918 candidatas RU->ES, cero aprobadas, 5000 cache y cero glosario persistente; no equivale al glosario del renderer. Historicos no cargados automaticamente en host por falta de idioma/aprobacion/contexto. Preservar datos y habilitar importacion por identidad verificable, sin promover resultados IA ni coincidencias por nombre.

Prioridad nueva del usuario, que sustituye la regla previa en caso de contradiccion: CANONICAL_APPROVED_TRANSLATION -> EXACT TM -> CACHE -> GLOSSARY -> FUZZY CONTEXT -> TRANSLATEGEMMA. Elegir original/rechazar y validacion tecnica siguen precediendo toda reutilizacion. Canonica exige modulo/pack/_id/UUID/campo/sistema/version y target aprobado no conflictivo; PDFs y converters complejos no acreditan identidad y quedan fuera del importador inicial. Salida sigue siendo nativa, sin Babele.

Contrato: [thermal-memory-preflight.md](contracts/thermal-memory-preflight.md). Telemetria opcional solo lectura, pausa propia con cancelacion y reanudacion conservadora; sensor ausente null, sin garantia sobre GPU usada por otros procesos o VRAM no observable. Prompt TranslateGemma especifico, una unidad/solicitud, marcadores opacos y validacion estricta; num_ctx4096 y presupuesto UTF-8 conservador incluyendo output. No se cambian motores por velocidad ni se instalan modelos.

Preflight es lectura previa a inferencia, sellado por hash de inventario/configuracion/revision y revisado antes de destino/ejecucion. Estimacion sin reintentos/fallos y con archivos no elegibles declarados; deteccion de fuente invalida antes del proveedor evita trabajo que terminaria recuperado. No modifica originales. Importar memoria crea candidatas por defecto; la aprobacion requiere autoridad explicita. No hay importacion al userData desde los scripts de auditoria.

T043 se adelanta tras esta fase; medir EN/RU con corpus identico, calidad y sensores disponibles, conservar27B predeterminado. T036/T037 no se implementan y T065 no cambia. La aceptacion real Foundry y la comparacion12B/27B conservan estado NOT_RUN.


## T075 - Memoria PDF SRD

T075: paginacion/nombres similares no prueban identidad. Se excluye Manual del Jugador de alineacion SRD5.2.1, aunque sigue referencia verificada. Lineas aisladas derivadas de paginas selladas se ofrecen solo a seleccion humana. Par exacto EN aprobado y vinculo RU probado evitan IA; fuzzy aporta una referencia <=200 bytes. Auditoria real: 8.372 propuestas, 0 aprobadas, 0 vinculos; ahorro GPU aun no demostrado. Contrato: [pdf-srd-reuse.md](contracts/pdf-srd-reuse.md).


## T076/T077 y T044/T043

Clasificacion por evidencia separada del estado de aprobacion, grupos normalizados y propagacion atomica VERIFIED. Varios scores altos o identidad aislada no certifican alineacion bilingue. Vinculos RU exigen identidad Foundry completa y pareja SRD previamente aprobada; el JSON importado permanece candidato. Corpus/gate de regresiones y benchmark con memoria aislada, mismo corpus/modelos e informe sin inferencia antes de GPU. Contratos: [pdf-resolution.md](contracts/pdf-resolution.md); benchmark: [BENCHMARK.md](../../docs/BENCHMARK.md). T077 y benchmark real siguen pendientes: cobertura actual cero.
