# Desarrollo guiado por especificaciones

> Alcance vigente 2026-10-03: [P0 producto / P1 calidad / P2 optimizacion](MVP_SCOPE.md). Overlay predeterminado; copia completa opcional. T077 no bloquea el MVP; T043/T036/T037/T065 siguen suspendidas. Esta correccion prevalece sobre el alcance historico siguiente.

Adopción: 2026-10-01. Spec Kit oficial 1.0.13, integración Codex, scripts PowerShell.
[Documentación oficial](https://github.github.io/spec-kit/).
Fuente: [PRD](PRD.md). Reglas: [constitución](../.specify/memory/constitution.md).

## Estructura

- .specify/: constitución, plantillas, scripts, integración y workflow oficiales.
- .agents/skills/speckit-*/SKILL.md: skills oficiales del proceso.
- specs/001-foundry-translator-mvp/: spec, plan, research, modelo, contratos,
  quickstart, tareas, trazabilidad y checklist.
- docs/roadmap.md: fases posteriores.

Feature activa: .specify/feature.json; independiente de rama Git. Versionar artefactos
SDD y .agents/skills/. CLI aislada fuera del repo en C:\Dev\Translate-SpecKit-tools.

## Uso

Invocar en chat del agente, no terminal:

```text
$speckit-analyze
$speckit-implement
$speckit-converge
```

Para nueva feature: $speckit-specify -> $speckit-plan -> $speckit-tasks.
$speckit-clarify para ambigüedad; $speckit-constitution para enmiendas.
Puede requerirse una sesión nueva para descubrir las skills instaladas.

## Verificación

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks
```

Bypass solo afecta ese proceso, sin cambiar política global. Otra feature se selecciona
con SPECIFY_FEATURE o .specify/feature.json.

## Mantenimiento

Especificaciones vivas: cambios actualizan contrato, plan, tareas y trazabilidad.
Una tarea se marca [x] con evidencia, no por existir un motor previo.
Esta adopción entrega estructura/documentos; tareas de producto siguen pendientes.

## Ejecución de escritorio

`bun run dev` compila y abre Electron; `bun run start` abre la build existente.
`bun run package:win` genera el portable en release/. No hay servidor web.
Detalles y límites: [DESKTOP.md](DESKTOP.md).
