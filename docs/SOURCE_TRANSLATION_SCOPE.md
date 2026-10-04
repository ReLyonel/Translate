# Alcance optimizado: traduccion de fuentes preparadas

La aplicacion Windows recibe una carpeta raiz de modulo cuyos packs han sido desempaquetados previamente por el usuario. Busca recursivamente todas las carpetas `_source` dentro de `pack` o `packs` y traduce al espanol exclusivamente el contenido humano de sus JSON. Procesa tambien los textos visibles identificables con seguridad de los scripts bajo `scripts`, sin ejecutar ni modificar su logica. Si una carpeta no existe, omite ese paso.

Genera una copia completa en un destino nuevo, preservando la estructura, recursos, IDs, UUIDs, referencias, formulas, placeholders y valores tecnicos. Nunca modifica los originales. Ante duda o fallo conserva el contenido original y registra el motivo. El usuario reempaqueta la copia con una herramienta compatible; la reconstruccion automatica es una mejora opcional de menor prioridad.

Cuando existan diccionarios de localizacion nativa traducibles, genera sus equivalentes espanoles y modifica unicamente `languages` en la copia de `module.json`, solo si los archivos registrados existen y superan validacion. Conserva las traducciones espanolas y registros existentes; no altera `compatibility`, `coreTranslation`, identificadores, rutas de packs, dependencias ni otros campos tecnicos. Si no puede garantizar integridad, conserva el manifiesto y emite una advertencia. El registro del idioma no sustituye la traduccion de scripts ni la reconstruccion de compendios.

La aceptacion final requiere cargar el modulo reempaquetado en Foundry VTT 14.368 sin Babele, verificar documentos, referencias, HTML y rolls, y registrar los resultados. Versiones posteriores requieren verificacion propia. No declarar compatibilidad de un modulo que el manifiesto original excluya de esa version.

## Evidencia y limites

Ya existen descubrimiento de fuentes, scripts mediante AST, copia completa, proteccion, parse estricto y diff estructural. La generacion de localizaciones ES y la edicion segura del manifiesto siguen pendientes en T066/T067. T065 completa la experiencia de preparacion manual; T068 agrega regresion real restringida a la carpeta autorizada.

Se inspeccionaron en modo lectura los manifiestos de fifthpendium, colorsettings y ActiveAuras bajo `C:/Users/leond/AppData/Local/FoundryVTT/Data/modules`: los tres declaran espanol. ActiveAuras declara version maxima 13; esto demuestra que idioma y compatibilidad de version son requisitos diferentes. No se ejecutaron pruebas de traduccion nuevas ni carga Foundry en esta revision documental.

Fuentes oficiales: [manifiesto de modulos](https://foundryvtt.com/article/module-development/) y [localizacion nativa](https://foundryvtt.com/article/localization/). `languages` registra diccionarios; `compatibility` establece versiones del core. Registrar ES en un modulo de contenido no implica convertirlo en proveedor de traduccion del core mediante `coreTranslation`.

## Desviacion autorizada del plan anterior

T055 conserva la validacion nativa, pero sustituye el adaptador obligatorio de reconstruccion automatica por el reempaquetado manual del usuario. La integridad y la prueba real sin Babele siguen siendo obligatorias. T001-T064 se conservan y se agregan T065-T068, sin renumerar tareas ni marcar nuevas capacidades como implementadas.


Entrega posterior T066-T068: generacion de localizaciones y registro seguro ya implementados; las descripciones anteriores de pendiente corresponden al estado previo. Contrato vigente: [native-localization.md](../specs/001-foundry-translator-mvp/contracts/native-localization.md). ES existente se conserva sin sobrescritura. Runtime Foundry y reempaquetado manual no verificados en esta entrega.
