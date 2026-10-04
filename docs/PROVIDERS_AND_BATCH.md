# Proveedores locales y traducción por carpeta

La aplicación de escritorio permite cambiar de proveedor en **Ajustes**:

- **TranslateGemma mediante Ollama**, preferente: `translategemma:12b` o `translategemma:27b`. Se conserva 27B como valor inicial y el endpoint local existente `http://127.0.0.1:11500`. Si tu instalación utiliza el puerto habitual 11434, cámbialo en Ajustes.
- **LibreTranslate**, opción ligera: servicio local en `http://127.0.0.1:5000`. Debe disponer de inglés, ruso y español. Se puede seleccionar directamente o activar como fallback de Ollama. El fallback está desactivado inicialmente y no se ejecuta después de cancelar.

Los servicios se instalan y ejecutan por separado. El ejecutable no incluye modelos ni arranca servidores. Para obtener un modelo: `ollama pull translategemma:12b` o `ollama pull translategemma:27b`, en la instalación de Ollama configurada. En el equipo de prueba está instalado 27B; 12B no se ha descargado. LibreTranslate autenticado y endpoints remotos no están soportados en esta versión.

Referencias: [TranslateGemma en Ollama](https://ollama.com/library/translategemma) y [API de LibreTranslate](https://docs.libretranslate.com/api/operations/translate/).

## Uso por carpeta

1. En **Archivos JSON**, pulsa **Seleccionar carpeta**.
2. Selecciona detección automática, inglés o ruso, y pulsa **Traducir carpeta completa**.
3. Elige el nombre de una carpeta de salida nueva, fuera de la carpeta original; por defecto se propone el sufijo `_es`.
4. Consulta progreso y errores o cancela el lote. **Abrir carpeta de salida** abre los resultados.

El lote recorre las subcarpetas, conserva las rutas relativas y copia sin cambios los archivos auxiliares. Solo traduce los campos humanos reconocidos por el clasificador; campos ambiguos y técnicos se conservan. Aplica el glosario y términos PDF actuales, protege HTML, UUID, dados y referencias, reconstruye y valida cada JSON antes de guardarlo. Si un JSON es inválido, el proveedor falla o la validación rechaza el resultado, guarda una copia original y registra el archivo como sin traducir. El contador de procesados incluye esas copias; el contador de fallos las distingue.

La salida nunca sustituye un archivo existente. Se rechazan enlaces y carpetas de más de 10.000 archivos; límite por archivo: 50 MB. Cancelar conserva los archivos ya guardados y evita guardar la traducción en curso. Las carpetas de salida parciales permanecen disponibles. La configuración del proveedor y el glosario se capturan al iniciar el lote.

## Implementación y verificación

`desktop/providers.ts` define el contrato y registro de adaptadores; `desktop/ollama.ts` implementa Ollama. LibreTranslate traduce fragmentos de texto y mantiene los marcadores técnicos en el host. Las coincidencias exactas del glosario se sustituyen localmente con ambos proveedores. `desktop/jobs.ts` ejecuta el lote sin depender de Electron; el host controla selección nativa, permisos, cancelación y publicación de progreso.

`tests/contracts/providersBatch.test.ts` cubre selección/fallback, cancelación sin fallback, privacidad de marcadores, glosario, recursividad, originales, archivos auxiliares, JSON inválido, destino existente y traducción corrupta. `scripts/validateFolder.ts` permite ejecutar el lote real y comparar SHA-256 de todos los originales; el informe se guarda en `reports/folder-validation/report.json`.

No se garantiza la calidad lingüística de cada respuesta ni se ha verificado la importación de los resultados en Foundry. El fallback de LibreTranslate se verifica con respuestas simuladas si no hay servicio local activo.


Validación real final: 57/57 JSON de Bastion procesados, cero fallos, estado COMPLETED y SHA-256 de originales sin cambios. Proveedor real: TranslateGemma 27B / Ollama. 12B no descargado; LibreTranslate sin servicio activo, validado mediante pruebas simuladas. Ejecutable 0.3.0 generado y comprobado sin Node en PATH; Windows 11. Informe local: `reports/folder-validation/report.json`.


Actualización 0.4.0: el escritorio selecciona la raíz del módulo y procesa pack/packs/_source y scripts, conservando una copia integral. Ver `MODULE_ROOT_TRANSLATION.md`; el lote JSON genérico sigue disponible como servicio interno para pruebas.
