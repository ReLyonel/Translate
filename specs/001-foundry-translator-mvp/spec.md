# Feature Specification: Traductor seguro de Foundry JSON para Windows

> Alcance vigente 2026-10-03: [P0 producto / P1 calidad / P2 optimizacion](../../docs/MVP_SCOPE.md). Overlay predeterminado; copia completa opcional. T077 no bloquea el MVP; T043/T036/T037/T065 siguen suspendidas. Esta correccion prevalece sobre el alcance historico siguiente.

**Feature Branch**: rama actual conservada; feature `001-foundry-translator-mvp`.
**Created**: 2026-10-01
**Status**: implementación incremental auditada; objetivo nativo 14.368 pendiente de certificación.
**Input**: [PRD v1.0](../../docs/PRD.md), secciones 1–36.

## User Scenarios & Testing

Las historias de producto son P0. P1 mejora calidad y P2 optimiza; su cobertura no bloquea el MVP. Prevalece la corrección de alcance del 2026-10-03 sobre requisitos históricos de copia completa o cobertura de memoria.
Pruebas automatizadas de integridad/disco y smoke manual Windows/Foundry requeridos.

### User Story 1 - Archivo individual (Priority: P0)

Como usuario selecciono un JSON y obtengo una copia española segura.
**Why this priority**: primer flujo útil sin necesidad de lotes.
**Independent Test**: fixture EN con name/description/id/icon y hash del original.
**Acceptance Scenarios**:

1. **Given** JSON válido, **When** traduzco, **Then** solo cambian valores elegibles,
   se valida salida y se conserva hash original.
2. **Given** campo ambiguo, **When** analizo, **Then** se conserva y se informa.
3. **Given** respuesta inválida/fallo del motor, **When** proceso, **Then** error
   comprensible y ninguna traducción inválida publicada.

### User Story 2 - Integridad Foundry (Priority: P0)

Como usuario conservo referencias y estructura necesarias para el módulo.
**Why this priority**: integridad es la condición central de aceptación.
**Independent Test**: proveedor adversarial elimina/duplica tokens; publicación bloqueada.
**Acceptance Scenarios**:

1. **Given** @UUID, @Compendium, @Actor, @Item, @JournalEntry, @RollTable, @Scene y @Macro,
   **When** traduzco prosa, **Then** valor y multiplicidad por ubicación son idénticos.
2. **Given** HTML, IDs, rutas, URLs, fórmulas y variables, **When** valido,
   **Then** elementos técnicos permanecen intactos.
3. **Given** clave/tipo/array/referencia alterada, **When** valido,
   **Then** ERROR; copia original permitida sin etiquetarla traducida.

### User Story 3 - Inglés/ruso y consistencia (Priority: P1)

Como usuario traduzco EN/RU con glosario y memoria consistentes.
**Why this priority**: ambos idiomas son esenciales en el PRD.
**Independent Test**: fixtures EN/RU y dos ejecuciones con memoria aprobada.
**Acceptance Scenarios**:

1. **Given** cirílico, **When** uso auto o ru, **Then** español y Unicode correcto.
2. **Given** idioma incierto/mixto, **When** inicio, **Then** puedo elegir en/ru;
   cadenas españolas o inciertas se conservan.
3. **Given** glosario y memoria contradictoria, **When** traduzco,
   **Then** prevalece glosario y solo se reutiliza memoria compatible validada.

### User Story 4 - Carpeta recursiva (Priority: P0)

Como usuario genero archivos traducidos con su jerarquía relativa; puedo elegir una copia completa explícita.
**Why this priority**: amplía el flujo individual a módulos completos.
**Independent Test**: subcarpetas con JSON válido/inválido, imagen y JS.
**Acceptance Scenarios**:

1. **Given** carpeta mixta, **When** proceso, **Then** JSON elegibles traducidos,
   overlay solo con archivos modificados y misma jerarquía; recursos intactos omitidos. En copia completa, recursos copiados byte a byte.
2. **Given** error aislado, **When** continúa lote, **Then** resto se procesa;
   archivo fallido conserva original + WARNING; en overlay no se duplica el original y en copia completa se incluye su copia intacta.
3. **Given** destino igual/interior al origen o existente, **When** inicio,
   **Then** bloqueo escritura y solicito destino nuevo.

### User Story 5 - Progreso y cancelación (Priority: P0)

Como usuario observo, cancelo y conozco el resultado de cada archivo.
**Why this priority**: permite operar lotes sin resultados corruptos.
**Independent Test**: proveedor lento simulado; cancelar y comprobar disco/informe.
**Acceptance Scenarios**:

1. **Given** trabajo activo, **When** proceso, **Then** interfaz responde y muestra
   archivo actual, encontrados, compatibles, procesados, traducidos, omitidos y errores.
2. **Given** cancelación, **When** se confirma, **Then** no hay nuevas solicitudes
   ni commits; se abortan activas, limpian temporales y conservan completados válidos.
3. **Given** fin/cancelación, **When** reviso informe, **Then** hay estado/severidad/motivo
   por archivo y opción de abrir carpeta.

### User Story 6 - Escritorio y privacidad (Priority: P0)

Como usuario ejecuto .exe e identifico dónde se procesa el contenido.
**Why this priority**: concreta la plataforma del PRD.
**Independent Test**: Windows 10/11 sin Node, motor preparado aparte.
**Acceptance Scenarios**:

1. **Given** .exe instalado, **When** abro, **Then** interfaz española y selección
   nativa de archivo/carpeta/destino sin terminal.
2. **Given** motor local/externo, **When** inicio, **Then** se indica antes de envío.
3. **Given** credenciales configuradas, **When** traduzco, **Then** no aparecen
   en renderer, archivos o logs.

### Edge Cases

JSON inválido, claves duplicadas (rechazar), raíces escalares/arrays, BOM UTF-8,
Unicode, disco lleno, permisos, bloqueo, rutas largas, colisiones de mayúsculas;
enlaces/junctions no se siguen y se reportan. Packs LevelDB/.db se copian intactos.
Proveedor lento, lote incompleto y tokens alterados. No sobrescribir destino.
Archivo individual: carpeta hermana <nombre-sin-extensión>_es, nombre original conservado.

## Requirements

### Functional Requirements

- **FR-001**: .exe Windows 10/11 e interfaz española.
- **FR-002**: Selección nativa archivo/carpeta y destino separado.
- **FR-003**: Recursión sin enlaces y rutas relativas conservadas.
- **FR-004**: Origen auto/en/ru con elección manual; destino es.
- **FR-005**: Extraer solo valores visibles seguros; claves y ambiguos intactos.
- **FR-006**: Proteger IDs, UUID, rutas, URLs, referencias Foundry, fórmulas,
  variables, namespaces, código y HTML técnico.
- **FR-007**: Validar sintaxis, claves, tipos, arrays y contenido protegido por ubicación.
- **FR-008**: Publicación atómica solo tras validación; originales intactos.
- **FR-009**: Copiar intactos recursos incompatibles y originales fallidos.
- **FR-010**: Proveedor sustituible; MVP usa motor local configurable existente.
- **FR-011**: Glosario configurable explícito > memoria > proveedor.
- **FR-012**: Memoria persistente validada separada por idioma/contexto/glosario/reglas;
  candidatos no aprobados nunca se reutilizan automáticamente.
- **FR-013**: Progreso sin bloquear interfaz y continuidad ante error aislado.
- **FR-014**: Cancelación aborta solicitudes y evita publicación parcial.
- **FR-015**: Resultado Traducido/Sin contenido traducible/Omitido/Advertencia/Error;
  severidad independiente OK/WARNING/ERROR.
- **FR-016**: Informe exportable localmente y apertura de salida.
- **FR-017**: Logs comprensibles, detalles opcionales y secretos redactados.
- **FR-018**: Indicar procesamiento local/externo antes del envío; secretos solo host.

### Key Entities

Trabajo, archivo, unidad traducible, token protegido, validación, proveedor, término
 y memoria. Detalles: [data-model.md](data-model.md).

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100 % elementos identificados como protegidos conservados en salidas OK.
- **SC-002**: 100 % archivos Traducido superan todas las validaciones.
- **SC-003**: Hash original idéntico tras éxito/error/cancelación.
- **SC-004**: Corpus 100 archivos/1.000 cadenas con jerarquía/contadores correctos
  e interfaz utilizable; sin imponer tiempo del motor IA.
- **SC-005**: Cancelación visible <=1 segundo, sin commits tras confirmación
  ni temporales al terminar.
- **SC-006**: Seleccionar -> traducir -> resultado sin parámetros técnicos
  tras preparar motor.
- **SC-007**: Reejecución compatible evita llamadas para memoria aprobada;
  fixtures EN/RU pasan revisión de español.
- **SC-008**: .exe probado en Windows 10/11 sin Node; secretos ausentes.

## Assumptions

Motor local se instala/prepara aparte. No sobrescritura de origen en MVP.
Preservación JSON semántica; no exige whitespace original. No se cambian manifiestos
ni se instala automáticamente el módulo. Smoke Foundry registra versión y sistema;
integridad no promete compatibilidad universal. Base web no acredita desktop.

## Scope Boundaries

MVP JSON según sección 29. Fase 2: JS/MJS con AST, preview, edición, proveedores/idiomas.
Fase 3: instalaciones, incrementales, perfiles, packs y modelos locales integrados.
PDF/corpus existentes son auxiliares. Sin editor completo, instalación/publicación,
colaboración online, gestión Git ni traducción multimedia/OCR.

## Cambio de alcance - 2026-10-01

Por instrucción del usuario, escritorio será la única aplicación. No se mantiene
interfaz servida por HTTP ni modalidad de navegador. React se reutiliza como renderer
local aislado en Electron. El host conecta con proveedores locales intercambiables: TranslateGemma 12B/27B mediante Ollama preferente y LibreTranslate seleccionable o fallback configurable.


## Ampliación autorizada: proveedores y carpeta (2026-10-01)

- FR-026: Elegir Ollama con TranslateGemma 12B/27B o LibreTranslate local; fallback opcional ante fallo de Ollama, nunca por cancelación. Conservar protección técnica y glosario con ambos proveedores.
- FR-027: Traducir todos los JSON de una carpeta y subcarpetas hacia una salida nueva externa; conservar estructura relativa y recursos auxiliares, validar por archivo, mostrar avance y errores, permitir cancelación y conservar originales.


## Alcance de raíz de módulo (2026-10-01)

FR-028: La selección de carpeta del escritorio representa la raíz del módulo. Traducir JSON solo dentro de `_source` descendientes de `pack` o `packs`; traducir textos humanos seguros en scripts JS/MJS/CJS descendientes de `scripts`. Omitir carpetas ausentes. Generar copia integral de la raíz, con archivos auxiliares byte por byte y carpetas vacías; preservar originales, nombres, rutas y lógica ejecutable. Ante fallo por archivo, conservar su copia original y registrarlo.


## Requisitos vigentes 2026-10-02: Foundry nativo y aprendizaje validado

Prioridad: INTEGRIDAD > CALIDAD > CONSISTENCIA > RENDIMIENTO. Ante duda conservar original. Objetivo 14.368 y posteriores verificadas individualmente, sin Babele. TranslateGemma27B sigue principal; 4B/12B y proveedores futuros no cambian el default por velocidad.

Reglas: nunca enviar archivo entero; parse/extraccion/proteccion preceden TM/cache/glosario/proveedor. Glosario usuario prevalece sobre exact TM, que requiere 100% aprobado/contexto compatible; fuzzy solo contexto; cache versionada no equivale a aprobacion. No fine-tuning automatico.

N026-N060 son requisitos trazables de la nueva fase y se corresponden con T030-T064 en tasks.md. Incluyen TM contextual persistente, dedup/cache/exact/fuzzy/glosario/IDs, logs y retencion/metricas, benchmark/regresion/perfil/referencias/rolls/HTML/placeholders/idioma/golden/diff, carga nativa/sin Babele/publicacion/recuperacion/procedencia/feedback/conflictos/consistencia/incremental/gate. Los criterios completos estan en cada tarea y AUDIT_V14_368.md.

Cambios frente al PRD: scripts AST ya autorizados, alcance carpeta pack/packs/_source y scripts vigente, ahora soportar formato efectivo nativo de compendios y localizaciones para aceptar compatibilidad. Copia de LevelDB sin reconstruccion no cuenta como pack traducido. Soporte de formato por perfil; formatos no soportados se conservan y reportan. COMPLETED de archivo exige todos los checks; job terminado puede contener warnings/fallos y debe declararlos. Windows 10/11 limpio y runtime Foundry sin Babele siguen obligatorios.


## Ajuste autorizado: fuentes preparadas (2026-10-02)

El usuario desempaqueta y reempaqueta los packs. La reconstruccion automatica queda fuera del camino critico; T055 conserva aceptacion real del paquete recompilado. T065 completa este contrato; T066 genera localizaciones ES conservando claves; T067 permite solo registro aditivo seguro en languages de module.json; T068 agrega corpus real de lectura bajo la carpeta modules autorizada y regresiones. No cambiar compatibility/coreTranslation ni entradas ES existentes. No acreditar Foundry por traduccion de fuentes. Alcance y criterios: [SOURCE_TRANSLATION_SCOPE.md](../../docs/SOURCE_TRANSLATION_SCOPE.md). T001-T064 conservadas.


### Entrega T066-T068

Localizacion nativa implementada como etapa post-copia en jobs; archivos separados por entrada EN/RU y registro aditivo exclusivo de languages. ES existente se conserva; fallo revierte archivos nuevos y mantiene manifiesto. Contrato normativo: [native-localization.md](contracts/native-localization.md). 127 pruebas/lint/build PASS; corpus real identidad en tres modulos con originales intactos, calidad/runtime NOT_RUN. No completa las dependencias generales de publicacion/gate ni T055/T056.


## Incremento de reutilizacion y diagnostico (2026-10-02)

T030-T035, T038-T042 y T051-T052 implementadas en host desktop, sin cambiar los formatos nativos publicados. Contrato normativo: [translation-reuse-diagnostics.md](contracts/translation-reuse-diagnostics.md). Memoria/contexto/procedencia/estadisticas separados; CANDIDATE no aprobado por defecto, exact requiere aprobacion/contexto/reglas y fuzzy solo da contexto. Cache versionada y glosario persistente scoped, hits revalidados, dedup conserva referencias/case/espacios. Store unico con escritura serial/fsync/rename; no migracion automatica del corpus historico. CLI de revision/glosario disponible con aplicacion cerrada; UI de feedback T060 entregada en el incremento posterior descrito al final de este documento.

Runtime reutiliza proveedores y gates existentes; metadatos sourceText por unidad vinculados a placeholders permiten claves seguras. Validacion sospechosa/idioma precede cache/candidato; critica conserva original por unidad y archivo WARNING; advertencias no cuentan como COMPLETED validado. Logs con allowlist y reportes schema_version1 privados bajo userData, exportacion nativa, politicas de retencion y metricas HTTP/monotonic. Archivos fuente/recursos/localizaciones adicionales mantienen contadores distintos. Esquemas, ejemplos, limites y comandos en el contrato.

Se consolidan componentes estrechamente relacionados en MemoryStore/TranslationRuntime/RunLogger en vez de crear modulos vacios separados para cada tarea. TranslateGemma27B permanece principal; T065 no modificada. Runtime Foundry14.368 T055/T056 permanece NOT_RUN; las pruebas automatizadas no acreditan calidad real del modelo. Dependencias globales pendientes mantienen su estado.


## Entrega de revision, procedencia e incremental (2026-10-02)

T059-T063 implementadas. Contrato normativo: [review-incremental.md](contracts/review-incremental.md). La vista Memoria y revision incorpora busqueda/paginacion, alternativas y ACCEPT/EDIT/REJECT/RESTORE/RESOLVE. Editar guarda candidata manual y exige aprobacion separada. Revision optimista y bloqueo durante trabajos protegen el estado; decisiones invalidan cache/inventario. La preferencia de original persiste hasta aceptacion explicita. Estadisticas se guardan en una transaccion por ejecucion validada.

Contextos acotados de texto humano y huella semantica separan system/module/document/field; los items embebidos usan su propio tipo. Conflictos exactos no eligen target global. Procedencia por unidad exporta hashes, productor real y estado de publicacion, sin narrativa privada. Reporte terminologico heuristico REVIEW_ONLY conserva variantes legitimas y separa modulo/sistema/idioma; no corrige automaticamente.

Inventario privado por module.json.id valido o raiz real conserva ubicaciones/hash/reuse_key/target/productor. Un modulo intacto evita llamadas IA sin omitir parse/proteccion/gates/copia completa. Configuracion, contexto y feedback pueden invalidar reutilizacion aun con fuente UNCHANGED. Solo una ejecucion completa PASS publica baseline; cancelacion, recuperacion o fallo previo al commit conservan la anterior. Entradas persistidas no se convierten en aprobadas por su uso.

340 pruebas/27 archivos PASS; pruebas con proveedores controlados, no benchmark linguistico ni runtime Foundry. TranslateGemma27B sigue predeterminado. T065 intacta, T055/T056 pospuestas. El esquema y limites de privacidad, contexto, almacenamiento y compatibilidad hacia atras quedan en el contrato.


## Incidente termico / reutilizacion: T069-T073 (2026-10-02)

Requisito urgente autorizado: no batching, no concurrencia adicional, reducir primero inferencia. Auditar ejecucion fifthpendium RU->ES y fuente manual C:/Users/leond/OneDrive/Escritorio/spanish. Base activa encontrada: 9918 candidatas RU->ES, cero aprobadas, 5000 cache y cero glosario persistente; no equivale al glosario del renderer. Historicos no cargados automaticamente en host por falta de idioma/aprobacion/contexto. Preservar datos y habilitar importacion por identidad verificable, sin promover resultados IA ni coincidencias por nombre.

Prioridad nueva del usuario, que sustituye la regla previa en caso de contradiccion: CANONICAL_APPROVED_TRANSLATION -> EXACT TM -> CACHE -> GLOSSARY -> FUZZY CONTEXT -> TRANSLATEGEMMA. Elegir original/rechazar y validacion tecnica siguen precediendo toda reutilizacion. Canonica exige modulo/pack/_id/UUID/campo/sistema/version y target aprobado no conflictivo; PDFs y converters complejos no acreditan identidad y quedan fuera del importador inicial. Salida sigue siendo nativa, sin Babele.

Contrato: [thermal-memory-preflight.md](contracts/thermal-memory-preflight.md). Telemetria opcional solo lectura, pausa propia con cancelacion y reanudacion conservadora; sensor ausente null, sin garantia sobre GPU usada por otros procesos o VRAM no observable. Prompt TranslateGemma especifico, una unidad/solicitud, marcadores opacos y validacion estricta; num_ctx4096 y presupuesto UTF-8 conservador incluyendo output. No se cambian motores por velocidad ni se instalan modelos.

Preflight es lectura previa a inferencia, sellado por hash de inventario/configuracion/revision y revisado antes de destino/ejecucion. Estimacion sin reintentos/fallos y con archivos no elegibles declarados; deteccion de fuente invalida antes del proveedor evita trabajo que terminaria recuperado. No modifica originales. Importar memoria crea candidatas por defecto; la aprobacion requiere autoridad explicita. No hay importacion al userData desde los scripts de auditoria.

T043 se adelanta tras esta fase; medir EN/RU con corpus identico, calidad y sensores disponibles, conservar27B predeterminado. T036/T037 no se implementan y T065 no cambia. La aceptacion real Foundry y la comparacion12B/27B conservan estado NOT_RUN.


### Aclaración de autoridad PDF (2026-10-02)

Los PDFs de spanish son fuentes documentales verificadas por el usuario y forman parte de la memoria SRD/referencia. Esta confianza no se transfiere a los JSON candidatos ni valida alineaciones heur?sticas entre p?rrafos EN/ES o documentos RU. Registrar hashes, páginas e idioma; reutilización requiere correspondencia demostrada y preservaci?n estructural. Ver contracts/verified-pdf-memory.md y T074/T075.


## T075 - Memoria PDF SRD

T075: reutilizacion SRD5.2.1 dnd5e solo con pares aprobados, identidad nativa y hash para RU. Correspondencias manuales y heuristicas comienzan CANDIDATE; PDF verificado no implica alineacion aprobada. HTML incompatible obliga CONTEXT_ONLY, nunca sustitucion plana. Contrato: [pdf-srd-reuse.md](contracts/pdf-srd-reuse.md).


## T076/T077 y T044/T043

Clasificacion por evidencia separada del estado de aprobacion, grupos normalizados y propagacion atomica VERIFIED. Varios scores altos o identidad aislada no certifican alineacion bilingue. Vinculos RU exigen identidad Foundry completa y pareja SRD previamente aprobada; el JSON importado permanece candidato. Corpus/gate de regresiones y benchmark con memoria aislada, mismo corpus/modelos e informe sin inferencia antes de GPU. Contratos: [pdf-resolution.md](contracts/pdf-resolution.md); benchmark: [BENCHMARK.md](../../docs/BENCHMARK.md). T077 y benchmark real siguen pendientes: cobertura actual cero.

### Aclaración T077 — 2026-10-03

No existe un corpus previo completo de packs españoles nativos. El producto debe crearlos desde los originales RU. La ruta es RU Foundry → identidad demostrada → SRD EN/ES con relación bilingüe verificada → campo español; en paralelo, memoria histórica RU/ES revisada por texto/contexto. Los JSON Babele son procedencia histórica, nunca producto ni dependencia. La ausencia de evidencia de revisión impide APPROVED_MANUAL. El SRD ES tiene autoridad sobre traducciones históricas/modelo cuando la correspondencia SRD está demostrada; no todo FifthPendium pertenece al SRD.

El preflight debe explicar los ceros, separar VERIFIED/APPROVED/HISTORICAL/AMBIGUOUS/REJECTED y comparar contra 4.109 archivos, 29.971 strings detectadas, 29.348 únicas, 28.372 que requieren IA y 33.942 solicitudes iniciales estimadas. Una coincidencia histórica sin aprobar no es ahorro. T043 y traducción masiva no se ejecutan; T036/T037 permanecen suspendidas. Contrato actualizado: [canonical-reuse-audit.md](contracts/canonical-reuse-audit.md).

La declaración posterior del usuario aprueba el corpus Babele como traducción manual histórica. Se incorpora confianza explícita por snapshot/corpus, importación atómica/idempotente, contexto obligatorio para términos cortos/polisémicos y exclusión de conflictos. La aprobación no establece identidad canónica ni verifica los candidatos PDF. Fuente RU no observable en un campo histórico exige comprobación independiente de su asociación antes de auto-reuse. Caché heredada sin descriptor queda LEGACY_CACHE_UNVERIFIED, preservada sin hits. SRD ES es referencia de autoridad solo para correspondencias demostradas. T077 sigue siendo la tarea vigente, sin crear fase nueva; detener después del dry-run y sus evidencias.
