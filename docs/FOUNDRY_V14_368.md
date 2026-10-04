# Perfil Foundry VTT 14.368

Aceptación vigente 2026-10-03: [P0_ACCEPTANCE.md](P0_ACCEPTANCE.md). Instalación real 14.368, mundo aislado ES y Babele ausente; FifthPendium no se activa con dnd5e 6.0.5 por máximo original 5.9.9. Las notas históricas sobre 14.364/prueba pospuesta quedan superadas; T055/T056 siguen pendientes.

Objetivo: core **14.368**, español, sin dependencia Babele, TranslateGemma 27B predeterminado. Versiones posteriores requieren ejecutar la matriz de regresión y el smoke real; no se promete compatibilidad futura universal. Perfil ejecutable: `desktop/compatibility/foundryV14.ts`.

Fuentes verificadas el 2026-10-02: [release 14.368](https://foundryvtt.com/releases/14.368), [TextEditor v14](https://foundryvtt.com/api/v14/classes/foundry.applications.ux.TextEditor.html) y [formato de packs](https://foundryvtt.com/article/v11-leveldb-packs/). La documentación core no determina esquemas particulares de cada sistema.

| Formato | Soporte actual | Validación nativa |
|---|---|---|
| JSON documento fuente | Parse estricto, clasificación conservadora, protección y diff; semántica JSON, no whitespace idéntico | NOT_RUN |
| pack/packs/**/_source/*.json | Traducción de fuentes y copia completa de raíz | NOT_RUN; el usuario reempaqueta la base efectiva |
| JS/MJS/CJS scripts | Literales visibles mediante AST, expresiones/imports/código intactos; sintaxis no admitida restaura original | NOT_RUN |
| LevelDB/.db | Solo copia byte por byte; no se llama pack traducido | NOT_IMPLEMENTED publicación nativa |
| lang/manifiesto | Generacion EN/RU a ES y registro aditivo seguro; ES existente intacto | NOT_RUN |
| Macros como código/formatos desconocidos | Conservación, sin ejecución ni traducción libre | NOT_RUN |

Política inicial: orden estricto de todos los elementos técnicos extraídos por cadena. HTML/plantillas nunca se reordenan. Permitir movimiento lingüístico de referencias aisladas requerirá regla explícita y fixtures de semántica; no se habilita por rendimiento.

## Protocolo de aceptación real pendiente

1. Registrar core.version/build, sistema y versión, versión del módulo y hashes del paquete original; usar un mundo de prueba aislado, sin abrir/copiar bases activas para editarlas.
2. Babele no instalado. Verificar dependencies obligatorias del origen e integraciones condicionales; no quitarlas automáticamente.
3. El usuario reconstruye compendios efectivos desde la copia traducida con herramienta compatible verificada, preservar colección/IDs/UUID/manifiesto y abrir cada documento.
4. Cargar módulo, actors/items/journals/compendios; renderizar descripciones, links, UUID relativos/absolutos, HTML e inline rolls. Registrar warnings/errors de consola y resultado por fixture.
5. Verificar EN→ES y RU→ES, localizaciones nativas y contenido efectivo en español; comparar estructura y hash originales. Toda prueba no ejecutada permanece NOT_RUN.

Los fixtures `tests/golden/foundry_v14_368` de esta entrega son representativos sintéticos y **no** acreditan este protocolo. El corpus personal contiene fuentes con `_stats.coreVersion=14.367`; no se renombra esa evidencia como certificación 14.368.


Alcance actualizado: desempaquetado/reempaquetado manual por el usuario; reconstruccion automatica opcional, sin bloquear el traductor. La localizacion nativa y el registro seguro de languages siguen pendientes T066/T067. Ver [alcance](SOURCE_TRANSLATION_SCOPE.md).


T066/T067 implementadas: localizaciones en lang/fvtt-translator/es-NNN.json y registro seguro. Contrato: [native-localization.md](../specs/001-foundry-translator-mvp/contracts/native-localization.md). Validacion runtime sigue NOT_RUN.


## Herramientas de aceptacion disponibles

T055/T056 ahora cuentan con preflight de solo lectura, generador de plan/informe y sonda para mundo aislado. Uso y formato: [native-acceptance.md](../specs/001-foundry-translator-mvp/contracts/native-acceptance.md). 151 pruebas automatizadas PASS, pero no runtime real. La instalacion encontrada es14.364.0/build364; el usuario pospone validacion14.368 sin Babele. Ambas tareas siguen abiertas.
