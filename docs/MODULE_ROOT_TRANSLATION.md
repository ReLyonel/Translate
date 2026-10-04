# Traducción desde la raíz del módulo — 0.4.0

Selecciona la carpeta raíz del módulo en **Archivos JSON → Seleccionar carpeta → Traducir carpeta completa**. Elige una carpeta de salida nueva y externa a la original. No selecciones solamente `_source` para este modo.

La aplicación realiza estos pasos:

1. Busca las carpetas `pack` y `packs` directamente bajo la raíz. Dentro de ellas encuentra todas las carpetas llamadas exactamente `_source` y traduce sus archivos JSON, incluyendo subcarpetas. Si no existen, omite ese paso.
2. Busca `scripts` directamente bajo la raíz y procesa recursivamente `.js`, `.mjs` y `.cjs`. Si no existe, omite ese paso.
3. Produce una copia de toda la carpeta raíz, conservando nombres, rutas, directorios vacíos y recursos auxiliares. Los archivos traducidos reemplazan el contenido de su copia; los originales nunca se modifican. JSON fuera de `_source` y demás archivos se copian byte por byte.

El contador incluye JSON y scripts seleccionados. Si ninguna carpeta existe, se genera igualmente una copia completa sin traducciones. La salida debe ser nueva; no se sobrescriben destinos existentes. Se rechazan enlaces y se admiten hasta 100.000 archivos. JSON y scripts tienen un límite individual de 50 MB; los recursos auxiliares se copian sin cargarlos completos en memoria.

## Preservación de scripts

Acorn analiza la sintaxis sin ejecutar el código. Se traducen literales visibles en propiedades como `name`, `title`, `label`, `hint`, `description`, `content`, `text`, `tooltip`, `caption`, `message`, opciones `choices`, notificaciones y asignaciones de contenido HTML/texto.

Se conservan imports, identificadores, claves de localización, rutas, llamadas técnicas y expresiones `${...}`. Las etiquetas HTML y atributos, incluidas etiquetas con atributos interpolados, permanecen protegidos. La reconstrucción escapa comillas, barras y delimitadores; el resultado se vuelve a analizar y se compara el código fuera de los segmentos autorizados. Los textos cuyo uso no se puede identificar con seguridad se conservan.

La traducción no cambia la lógica del módulo ni agrega registros de idiomas. Los archivos de localización de `lang` y el manifiesto se copian sin cambios. Las macros incrustadas como código en campos JSON tampoco se reescriben.

Si un archivo tiene sintaxis no admitida, falla el proveedor o no pasa validación, se guarda su copia original y se muestra el error. Cancelar deja una copia parcial con los archivos ya guardados.

## Verificación

50 pruebas automatizadas cubren ambos proveedores, lotes anteriores, selección de `_source`, carpetas ausentes, copia completa, recursos, directorios vacíos y traducción segura de scripts con interpolaciones y escapes. `scripts/inspectModule.ts` inspecciona el módulo real; `scripts/validateModuleCopy.ts` verifica copia integral con proveedor identidad; `scripts/validateScriptLive.ts` verifica un script real con Ollama. Los informes y copias de prueba se guardan en `reports/module-validation/`, fuera del módulo original.

La prueba de copia integral utiliza respuestas identidad para verificar estructura y recursos; no es una traducción lingüística de los 4.073 JSON. La importación de la copia en Foundry se debe comprobar en una instancia de prueba.


Verificación final 0.4.0: 50 pruebas aprobadas; copia integral con proveedor identidad de 14.444 archivos, incluidos 4.073 JSON y 36 scripts. Los 10.335 recursos auxiliares conservan su SHA-256 y todos los originales permanecen intactos. Un JSON (Armor of Vulnerability) ya contiene HTML desbalanceado: se conserva su copia original y se informa como fallo. Traducción real de nueve textos en translation.mjs con TranslateGemma 27B, sintaxis y original preservados. No se ejecutó inferencia sobre los 4.073 JSON del módulo completo. Portable 0.4.0 verificado sin Node en PATH. Informes: reports/module-validation/{copy-report,script-report,discovery}.json.


## Alcance actualizado 2026-10-02

El usuario prepara _source y reempaqueta la copia; automatizar reconstruccion es secundario. El comportamiento actual sigue copiando lang/module.json sin cambios. T066/T067 agregaran traduccion de valores de localizacion y registro seguro en languages, sin alterar compatibilidad de version ni datos tecnicos. Detalle: [SOURCE_TRANSLATION_SCOPE.md](SOURCE_TRANSLATION_SCOPE.md); tareas T065-T068.


Entrega posterior T066-T068: generacion de localizaciones y registro seguro ya implementados; las descripciones anteriores de pendiente corresponden al estado previo. Contrato vigente: [native-localization.md](../specs/001-foundry-translator-mvp/contracts/native-localization.md). ES existente se conserva sin sobrescritura. Runtime Foundry y reempaquetado manual no verificados en esta entrega.
