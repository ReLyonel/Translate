<!-- Sync Impact Report: plantilla -> 1.0.0. Cinco principios añadidos; restricciones,
flujo y gobernanza definidos. Sin pendientes. Retirar comentario antes de ratificar en Git. -->
# Foundry Translator Constitution

## Core Principles

### I. Integridad antes que traducción
DEBE conservarse estructura, claves y contenido técnico protegido. Ante ambigüedad se
conserva el original. Una respuesta del proveedor no acredita éxito: todo resultado
DEBE pasar validación sintáctica, estructural y de referencias antes de publicarse.

### II. Originales intactos y salida segura
El MVP DEBE escribir copias en un destino nuevo e independiente. DEBE impedir destino
igual o interior al origen y colisiones. La publicación DEBE ser atómica; error y
cancelación no dejan archivos parciales. El overlay predeterminado publica solo archivos modificados; la copia completa explícita copia recursos no traducibles sin cambios. Ningún modo altera el origen ni elimina archivos ausentes del overlay en un destino de integración.

### III. Privacidad y secretos
La interfaz DEBE indicar motor local/externo antes de iniciar. Credenciales solo en host,
nunca en navegador, traducciones o logs. Solo unidades traducibles protegidas se envían
al proveedor. El motor local existente será el proveedor inicial.

### IV. Reutilización y límites claros
Se DEBEN reutilizar React/TypeScript y los motores existentes. La interfaz no escribe
archivos directamente ni ejecuta código del módulo. Proveedores intercambiables mediante
contrato. Glosario explícito prevalece sobre memoria y proveedor; memoria separa idiomas,
contexto y versiones de glosario/reglas.

### V. Verificación y observabilidad
Cambios en extracción, protección, validación, persistencia o cancelación DEBEN incluir
regresiones relevantes. Progreso y estado por archivo obligatorios. Logs en español y sin
secretos ni texto completo. Una tarea solo se completa con evidencia de aceptación.

## Restricciones del producto

Windows 10/11 .exe; interfaz y destino español; origen inglés/ruso. JSON y scripts JS/MJS/CJS con AST según alcance autorizado. Packs binarios solo se copian hasta disponer de reconstrucción nativa validada. Objetivo Foundry 14.368 sin Babele; posteriores requieren prueba por versión. Prioridad: integridad > calidad > consistencia > rendimiento. Preservación JSON semántica, sin prometer
whitespace idéntico. IDs, UUID, rutas, fórmulas y referencias se preservan exactamente.

## Flujo de desarrollo

PRD -> constitución -> spec -> plan -> tareas -> análisis -> implementación -> convergencia.
Especificaciones vivas: cambios actualizan conjuntamente contrato, plan y trazabilidad.
Revisar cumplimiento antes de implementar y ejecutar checks pertinentes antes de entregar.

## Governance

Esta constitución gobierna decisiones dentro de las instrucciones del usuario.
Enmiendas registran motivo, impacto y migración si aplica. Versionado semántico:
MAJOR cambia principios incompatibles; MINOR añade principios; PATCH aclara.
Cada revisión comprueba cumplimiento y justifica excepciones. Guía: docs/SDD.md.

**Version**: 1.2.0 | **Ratified**: 2026-10-01 | **Last Amended**: 2026-10-02


Enmienda 1.1.0: armoniza JS AST ya autorizado, perfil nativo sin Babele y prioridad de calidad. Memoria confiable solo con aprobacion/contexto, fuzzy no automatico y no fine-tuning automatico. No cambia conservacion de originales ni impone reescritura de componentes.


Enmienda1.2.0 (2026-10-02): prioridad urgente del usuario ante sobrecalentamiento y cero hits TM. Aprendizaje aprobado/canonico y preflight antes de GPU; observacion termica sin cambios de hardware; no batching/concurrencia hasta T069-T073. Sustituye precedencia anterior del glosario ante memoria aprobada, conservando veto de integridad, rechazo/restauracion y originales intactos. Una fuente manual se incorpora como candidata salvo aprobacion explicita verificable.
