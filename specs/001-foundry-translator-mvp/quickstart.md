# Guía de validación

> Correccion vigente 2026-10-03: [alcance P0/P1/P2](../../docs/MVP_SCOPE.md). Overlay es el default; copia completa requiere seleccion explicita. Los ejemplos historicos de copia completa representan ese modo opcional.

## Estructura disponible ahora

Desde C:\Dev\Translate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks
```

Bypass solo aplica al proceso. Feature activa: .specify/feature.json.
CLI aislada: C:\Dev\Translate-SpecKit-tools\Scripts\specify.exe (1.0.13).

## Aplicación desktop

Preparar dependencias con bun.lock y Ollama/modelo por separado; configurar motor en Ajustes:

```powershell
bun install --frozen-lockfile
node node_modules/electron/install.js
bun run lint
bun run test
bun run build
bun run dev
```

Estos comandos abren Electron. Generar portable con `bun run package:win`;
arrancar build actual con `bun run start`. Sin servidor web.

## Escenarios después de implementar

1. EN: name/description traducidos, id/icon/UUID intactos y mismo hash original.
2. RU: Unicode, origen auto/manual y español revisado.
3. Proveedor adversarial: token eliminado/duplicado, HTML alterado o referencias
   intercambiadas -> ERROR y ninguna traducción publicada.
4. Carpeta mixta: jerarquía y copias intactas; JSON inválido no detiene resto.
5. Destino igual/interior/existente -> bloqueo antes de escribir.
6. Cancelación con motor lento: UI <=1s, abort, sin commits posteriores ni temporales.
7. Memoria: contador de llamadas evita repetición compatible; cambios de glosario
   y contexto invalidan reutilización; EN/RU separados.
8. .exe Windows 10/11 sin Node, diálogos, apertura salida, privacidad y logs seguros.
9. Abrir módulo representativo en Foundry y registrar versión Foundry/sistema,
   referencias resueltas y funcionamiento; no prometer versiones no probadas.

Registrar evidencia por tarea. Comandos desktop concretos se añaden en T020/T023.


## T075 - Memoria PDF SRD

T075: Memoria y revision > SRD PDF > Preparar propuestas o elegir fragmentos EN/ES > revisar > aceptar. Para RU, vincular a documento Foundry y aprobar la nueva candidata; ejecutar preflight antes de traducir. Revisar contrato contracts/pdf-srd-reuse.md y no asumir que propuestas sean traducciones confiables. Contrato: [pdf-srd-reuse.md](contracts/pdf-srd-reuse.md).


## T076/T077 y T044/T043

Clasificacion por evidencia separada del estado de aprobacion, grupos normalizados y propagacion atomica VERIFIED. Varios scores altos o identidad aislada no certifican alineacion bilingue. Vinculos RU exigen identidad Foundry completa y pareja SRD previamente aprobada; el JSON importado permanece candidato. Corpus/gate de regresiones y benchmark con memoria aislada, mismo corpus/modelos e informe sin inferencia antes de GPU. Contratos: [pdf-resolution.md](contracts/pdf-resolution.md); benchmark: [BENCHMARK.md](../../docs/BENCHMARK.md). T077 y benchmark real siguen pendientes: cobertura actual cero.
