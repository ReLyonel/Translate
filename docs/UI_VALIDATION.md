# Interfaz compacta y validación con FifthPendium

Fecha: 2026-10-01. Aplicación exclusivamente Electron, versión 0.2.0.

## Diseño

Navegación lateral estable, inicio en Archivos JSON, tipografía del sistema,
paleta oscura con acento turquesa y acciones compactas. El flujo principal muestra
abrir, traducir y guardar. Los ejemplos quedan plegados y el inspector muestra
los textos traducibles por defecto; el contenido técnico sigue disponible mediante filtros.
Ventana inicial 1180 × 800; comprobación adicional a 900 píxeles de ancho.

El selector de origen ofrece automático, inglés y ruso. El estado de Ollama se
actualiza periódicamente y refleja cambios hechos en Ajustes.

## Correcciones detectadas por pruebas reales

El proveedor solicitaba siempre inglés, aunque el corpus contenía ruso. Ahora
la selección se propaga al host y el modo automático detecta cirílico.
Una descripción volvió sin seis marcadores protegidos. El host ahora conserva
los marcadores y solicita traducción solo de los fragmentos humanos entre ellos.
También rechaza marcadores inventados como `[[PROTECTED_###]]`.

## Evidencia

- TypeScript aprobado y 34 pruebas automatizadas aprobadas.
- 57 JSON reales: 1.179 cadenas detectadas y 102 campos traducibles.
- Protección/restauración exacta y reconstrucción de todos los JSON verificadas.
- Pruebas adversariales de eliminación/duplicación de tokens y cambio de IDs.
- Traducción real con Ollama: 58 unidades (57 nombres y una descripción rusa).
- Las 58 unidades pasaron restauración y validación estructural.
- Cero advertencias de validación de origen; hashes de los 57 originales intactos.
- Electron: cuatro secciones navegables, ejemplo cargado, sin desbordamiento
  en los dos tamaños, IPC inválido rechazado y renderer sin Node.

Informe detallado local: `reports/foundry-validation/report.json`.
Capturas: `reports/ui/empty.png` y `reports/ui/loaded.png`.
Los informes contienen texto del corpus del usuario y se excluyen de Git.

## Reproducir

```powershell
bun run lint
bun run test
bun run build
bun run smoke:desktop
bun x tsx scripts/validateFoundry.ts 'C:\Users\leond\AppData\Local\FoundryVTT\Data\modules\fifthpendium\packs\bastion\_source' --live
bun run package:win
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-desktop.ps1 -ExecutablePath 'release/Traductor-Foundry-0.2.0-x64.exe'
```

La prueba real es una muestra de traducción, no la traducción completa del pack.
El resto del corpus se comprobó estructuralmente. No se ha abierto la copia en
Foundry ni validado Windows 10; la calidad lingüística requiere revisión humana.
La selección de carpeta sigue procesando los JSON individualmente; el motor de
lotes automático permanece pendiente en el backlog.
