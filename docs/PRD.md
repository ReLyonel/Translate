# Product Requirements Document
## Traductor de módulos Foundry VTT al español

**Versión:** 1.0  
**Producto:** Aplicación de escritorio para Windows  
**Formato objetivo:** Ejecutable `.exe`  
**Plataforma principal:** Windows 10/11  
**Idioma de interfaz:** Español  
**Idioma de destino de las traducciones:** Español

---

# 1. Visión del producto

Crear una aplicación de escritorio sencilla y segura que permita traducir al español archivos pertenecientes a módulos, sistemas y contenido de Foundry Virtual Tabletop sin alterar su funcionamiento.

La aplicación deberá poder recibir archivos individuales o carpetas completas y generar copias traducidas conservando la estructura original de los archivos y directorios.

El producto estará especialmente orientado a traducciones:

- Inglés → Español.
- Ruso → Español.

Sin embargo, deberá diseñarse pensando en soportar otros idiomas de origen en el futuro.

El objetivo fundamental no es simplemente traducir texto.

El objetivo es:

> Traducir contenido de Foundry VTT al español sin romper los archivos, referencias, packs, módulos o sistemas originales.

---

# 2. Problema

Muchos módulos y sistemas de Foundry VTT están disponibles únicamente en inglés, ruso u otros idiomas.

Traducir estos archivos manualmente presenta varios problemas:

- Puede haber miles de cadenas.
- Los archivos contienen texto mezclado con información técnica.
- Existen IDs y UUID que no deben modificarse.
- Existen rutas y referencias internas.
- Puede existir HTML dentro de cadenas.
- Los archivos JavaScript contienen código y texto simultáneamente.
- Una traducción indiscriminada puede romper el módulo.
- Las traducciones manuales son lentas.
- Mantener consistencia terminológica es difícil.
- Las actualizaciones de módulos obligan a repetir parte del trabajo.

Los traductores convencionales no conocen la estructura interna de Foundry VTT y pueden modificar información que debería permanecer intacta.

---

# 3. Propuesta de valor

El usuario podrá seleccionar:

**un archivo**

o

**una carpeta completa**

y solicitar su traducción al español.

La aplicación analizará los archivos, identificará el contenido que puede traducirse de forma segura y generará nuevos archivos conservando el formato y estructura necesarios para Foundry VTT.

Conceptualmente:

```text id="6ugp19"
Módulo original
      ↓
Foundry VTT Translator
      ↓
Módulo traducido
```

La estructura deberá mantenerse.

Ejemplo:

```text id="f1eug3"
module/
├── lang/
├── scripts/
├── packs/
├── templates/
└── module.json
```

Resultado:

```text id="ntrrd7"
module_es/
├── lang/
├── scripts/
├── packs/
├── templates/
└── module.json
```

Los archivos deberán conservar sus nombres y formatos salvo que una función específica requiera lo contrario.

---

# 4. Usuario objetivo

El producto está dirigido principalmente a:

- Usuarios de Foundry VTT.
- Game Masters.
- Traductores de módulos.
- Comunidades de localización.
- Desarrolladores de módulos.
- Administradores de servidores Foundry.
- Usuarios que quieran traducir contenido extranjero para sus partidas.

No deberá requerirse conocimiento de programación para utilizar la aplicación.

---

# 5. Objetivos del producto

## P0 — Objetivos esenciales

El producto deberá:

1. Ejecutarse como aplicación Windows.

2. Permitir seleccionar archivos individuales.

3. Permitir seleccionar carpetas completas.

4. Procesar carpetas y subcarpetas.

5. Traducir contenido al español.

6. Soportar inicialmente inglés y ruso como idiomas principales de origen.

7. Detectar automáticamente el idioma cuando sea posible.

8. Mantener la estructura original de los archivos.

9. Mantener la estructura de carpetas.

10. Proteger elementos técnicos de Foundry VTT.

11. Evitar modificar los originales por defecto.

12. Informar al usuario del progreso y de posibles errores.

---

# 6. Principio fundamental

La prioridad del producto será:

```text id="g9o09n"
INTEGRIDAD > TRADUCCIÓN
```

Cuando la aplicación no pueda determinar de forma suficientemente segura si un elemento debe traducirse, deberá conservar el original.

Es preferible:

```text id="01xyuk"
dejar una cadena sin traducir
```

antes que:

```text id="bgf2cf"
romper un módulo Foundry
```

---

# 7. Formatos objetivo

## Primera prioridad

```text id="4sq8n4"
.json
```

## Segunda prioridad

```text id="trrxfs"
.js
.mjs
```

La aplicación deberá estar preparada para ampliar posteriormente los formatos soportados.

---

# 8. Traducción de JSON

La aplicación deberá comprender la estructura JSON.

No deberá traducir indiscriminadamente todo el contenido textual.

Ejemplo:

```json id="j9o38z"
{
  "name": "Fireball",
  "description": "A bright streak flashes from your pointing finger.",
  "id": "fireball",
  "icon": "icons/magic/fire/fireball.webp"
}
```

Resultado esperado:

```json id="vhwv9s"
{
  "name": "Bola de fuego",
  "description": "Un brillante destello surge de tu dedo.",
  "id": "fireball",
  "icon": "icons/magic/fire/fireball.webp"
}
```

Se traducen:

```text id="f47vbn"
name
description
```

Se conservan:

```text id="fdsmff"
id
icon
```

---

# 9. Traducción de JavaScript

La aplicación deberá poder identificar textos destinados al usuario dentro de archivos JavaScript sin modificar código necesario para el funcionamiento del módulo.

Ejemplo:

```javascript id="xv75y3"
ui.notifications.info("Attack completed successfully");
```

podrá convertirse en:

```javascript id="3r5vp8"
ui.notifications.info("Ataque completado correctamente");
```

Pero elementos técnicos como:

```javascript id="08ttsn"
game.settings.get("my-module", "attackMode");
```

deberán permanecer intactos.

La aplicación deberá adoptar una política conservadora ante cadenas ambiguas.

---

# 10. Protección de Foundry VTT

La aplicación deberá reconocer y proteger referencias utilizadas por Foundry VTT.

Ejemplos:

```text id="e9u4hu"
@UUID[...]
@Compendium[...]
@Actor[...]
@Item[...]
@JournalEntry[...]
@RollTable[...]
@Scene[...]
@Macro[...]
```

Ejemplo:

```text id="9xvd4p"
Use @UUID[Compendium.module.items.Item.abc123] to attack.
```

podrá convertirse en:

```text id="0uwx8p"
Usa @UUID[Compendium.module.items.Item.abc123] para atacar.
```

La referencia deberá permanecer exactamente igual.

---

# 11. Contenido protegido

La aplicación deberá evitar modificar elementos como:

- IDs.
- UUID.
- Claves estructurales.
- Rutas.
- URLs.
- Referencias Foundry.
- Nombres internos de módulos.
- Referencias a archivos.
- Imports.
- Exports.
- Variables.
- Funciones.
- Código ejecutable.
- Namespaces.
- Fórmulas.
- Expresiones técnicas necesarias para Foundry.

---

# 12. Selección de entrada

La pantalla principal deberá ofrecer dos operaciones claramente diferenciadas.

## Seleccionar archivo

Permite procesar un archivo individual.

## Seleccionar carpeta

Permite procesar una carpeta completa.

Cuando se seleccione una carpeta, la aplicación deberá localizar automáticamente los archivos compatibles dentro de ella y sus subdirectorios.

---

# 13. Salida

Los resultados deberán ser nuevos archivos traducidos.

Por defecto, los originales no deberán modificarse.

Ejemplo:

```text id="mqb22r"
Original:

C:\Modules\my-module\
```

Resultado:

```text id="8xy9ur"
C:\Modules\my-module_es\
```

La jerarquía interna deberá conservarse.

---

# 14. Experiencia principal

El flujo ideal será:

```text id="gvff8n"
Abrir aplicación
       ↓
Seleccionar archivo o carpeta
       ↓
Detectar archivos
       ↓
Detectar idioma
       ↓
Seleccionar Español
       ↓
Iniciar traducción
       ↓
Procesar
       ↓
Validar
       ↓
Mostrar resultado
```

El usuario no debería necesitar configurar parámetros técnicos para realizar una traducción estándar.

---

# 15. Interfaz principal

La aplicación deberá mostrar como mínimo:

```text id="u8azge"
Seleccionar archivo

Seleccionar carpeta

Idioma origen:
[ Automático ]

Idioma destino:
[ Español ]

Carpeta de salida:
[ ................. ]

[ TRADUCIR ]
```

Durante el procesamiento deberá mostrar:

```text id="ht5n3x"
Progreso

Archivo actual

Archivos encontrados

Archivos procesados

Archivos traducidos

Archivos omitidos

Errores
```

---

# 16. Estados de archivos

Cada archivo podrá terminar en uno de los siguientes estados:

```text id="z5i4in"
Traducido

Sin contenido traducible

Omitido

Advertencia

Error
```

El usuario deberá poder identificar qué ocurrió con cada archivo.

---

# 17. Validación

Antes de considerar correcta una traducción, la aplicación deberá verificar que el archivo generado sigue siendo válido.

Para JSON deberá comprobarse como mínimo:

- Sintaxis válida.
- Estructura conservada.
- Claves conservadas.
- Identificadores protegidos conservados.
- Referencias protegidas conservadas.

Para JavaScript deberá comprobarse que las modificaciones realizadas no hayan invalidado el archivo.

---

# 18. Traducción consistente

La aplicación deberá intentar mantener traducciones consistentes.

Por ejemplo, si:

```text id="dx0w1k"
Saving Throw
```

se traduce como:

```text id="un4jwv"
Tirada de Salvación
```

deberá evitar que posteriormente aparezca traducido de maneras diferentes sin motivo.

---

# 19. Glosario

El producto deberá contemplar un glosario configurable.

Ejemplo:

```text id="cy7f00"
Armor Class → Clase de Armadura

Hit Points → Puntos de Golpe

Saving Throw → Tirada de Salvación

Spell Slot → Espacio de Conjuro
```

Las traducciones definidas explícitamente por el usuario deberán tener prioridad.

---

# 20. Memoria de traducción

Las traducciones realizadas previamente deberán poder reutilizarse.

Esto permitirá:

- Reducir tiempo.
- Reducir llamadas al proveedor.
- Reducir costes.
- Mantener consistencia.
- Facilitar futuras actualizaciones de módulos.

---

# 21. Proveedor de traducción

El producto no deberá estar ligado conceptualmente a un único proveedor.

Deberá permitir incorporar motores como:

```text id="1ej8di"
OpenAI

DeepL

Google

modelos locales
```

El usuario podrá configurar el proveedor disponible.

El MVP podrá comenzar con un único proveedor siempre que la arquitectura del producto permita añadir otros posteriormente.

---

# 22. Procesamiento por lotes

Al seleccionar una carpeta, la aplicación deberá poder procesar múltiples archivos automáticamente.

Ejemplo:

```text id="e7umkz"
154 archivos encontrados

126 compatibles

98 contienen texto traducible

28 sin contenido traducible
```

Un error en un archivo no deberá necesariamente detener todo el proceso.

---

# 23. Cancelación

El usuario deberá poder cancelar una traducción en curso.

Los archivos ya completados correctamente podrán conservarse.

Los archivos parcialmente procesados no deberán dejar resultados corruptos.

---

# 24. Informe final

Después de finalizar deberá mostrarse un resumen.

Ejemplo:

```text id="3rtuou"
Traducción completada

Archivos encontrados: 154
Procesados: 126
Traducidos: 98
Sin cambios: 25
Advertencias: 2
Errores: 1

Carpeta de salida:
C:\Modules\my-module_es
```

El usuario deberá poder abrir directamente la carpeta resultante.

---

# 25. Manejo de errores

Los errores deberán presentarse de manera comprensible.

En lugar de mostrar únicamente:

```text id="pbpyc3"
Exception ParserError 0x934
```

la interfaz deberá intentar mostrar:

```text id="f4vjxg"
No se pudo procesar:

scripts/combat.js

El archivo contiene una estructura JavaScript que no puede modificarse de forma segura.

El archivo original no ha sido alterado.
```

Los detalles técnicos podrán estar disponibles mediante una vista avanzada o log.

---

# 26. Requisitos de seguridad

Las API keys utilizadas para servicios externos no deberán escribirse en los archivos traducidos.

Tampoco deberán aparecer en los logs.

Los archivos originales deberán permanecer intactos salvo que el usuario active explícitamente una función de sobrescritura.

---

# 27. Requisitos de privacidad

El usuario deberá saber cuándo el contenido se envía a un proveedor externo de traducción.

Cuando se utilice un motor local, deberá indicarse que el procesamiento se realiza localmente.

---

# 28. Requisitos de rendimiento

La interfaz deberá continuar respondiendo mientras se realiza una traducción.

El usuario deberá poder observar el progreso.

La aplicación deberá poder procesar módulos con cientos o miles de cadenas sin requerir intervención manual constante.

---

# 29. MVP

La primera versión funcional deberá centrarse en:

```text id="s0e4nz"
Windows .exe

JSON

Inglés → Español

Ruso → Español

Selección de archivo

Selección de carpeta

Procesamiento recursivo

Protección de IDs

Protección de UUID

Protección de rutas

Protección de referencias Foundry

Traducción automática

Validación JSON

Carpeta de salida independiente

Progreso

Logs

Memoria de traducción
```

JavaScript podrá introducirse progresivamente después de garantizar la estabilidad del procesamiento JSON.

---

# 30. Fuera del MVP

Inicialmente no es obligatorio implementar:

- Editor completo de módulos.
- Integración directa con Foundry VTT.
- Instalación automática de módulos.
- Publicación automática.
- Traducción colaborativa online.
- Gestión de repositorios Git.
- Traducción de imágenes.
- OCR.
- Traducción de audio o vídeo.

Estas funciones podrán evaluarse posteriormente.

---

# 31. Fase 2

Una vez estabilizado el MVP:

```text id="36tkcl"
.js

.mjs

mejor detección de contenido Foundry

vista previa

edición manual

glosarios avanzados

más proveedores

más idiomas
```

---

# 32. Fase 3

El producto podrá evolucionar hacia:

```text id="wip7tv"
detección de instalaciones Foundry

selección directa de módulos instalados

actualización incremental

detección de diferencias entre versiones

traducción únicamente de contenido nuevo

perfiles específicos por sistema

soporte avanzado para packs

modelos completamente locales
```

---

# 33. Historias de usuario principales

## US-001 — Archivo individual

Como usuario de Foundry VTT quiero seleccionar un archivo y traducirlo al español para no tener que editarlo manualmente.

### Criterios de aceptación

- Puedo seleccionar un archivo compatible.
- El sistema identifica contenido traducible.
- Se genera un nuevo archivo.
- El original permanece intacto.
- El archivo generado conserva su estructura.

---

## US-002 — Carpeta completa

Como usuario quiero seleccionar la carpeta de un módulo para traducir todos sus archivos compatibles automáticamente.

### Criterios de aceptación

- Puedo seleccionar una carpeta.
- Se analizan sus subdirectorios.
- Se identifican los archivos compatibles.
- Los resultados mantienen la misma jerarquía.
- Un error aislado no destruye el resto del proceso.

---

## US-003 — Protección Foundry

Como usuario quiero que referencias internas de Foundry permanezcan intactas para que el módulo continúe funcionando.

### Criterios de aceptación

Las referencias protegidas presentes antes de la traducción deberán ser idénticas después de ella.

---

## US-004 — Traducción ruso/español

Como usuario quiero poder procesar módulos escritos en ruso y obtener su contenido en español.

### Criterios de aceptación

- El sistema reconoce texto cirílico.
- Se procesa correctamente Unicode.
- El resultado utiliza español.
- La estructura original permanece intacta.

---

## US-005 — Resultado seguro

Como usuario quiero saber si una traducción puede haber producido problemas antes de utilizarla en Foundry.

### Criterios de aceptación

Cada archivo recibe un estado final:

```text id="b0y9x4"
OK
WARNING
ERROR
```

Los archivos que no superen las validaciones no deberán presentarse como traducciones seguras.

---

# 34. Métricas de éxito

El producto deberá aspirar a:

### Integridad estructural

```text id="8s9lxh"
100 %
```

de elementos identificados como protegidos conservados.

### Archivos válidos

```text id="ejc1v0"
100 %
```

de los archivos marcados como completados deberán superar la validación correspondiente.

### Facilidad de uso

Una traducción estándar deberá poder iniciarse aproximadamente mediante:

```text id="9pv4ap"
Seleccionar
→
Traducir
→
Resultado
```

sin requerir conocimientos técnicos.

---

# 35. Restricción fundamental

Ningún archivo deberá marcarse como traducido correctamente simplemente porque el proveedor de traducción haya devuelto una respuesta.

Un resultado satisfactorio requiere:

```text id="tdw5eo"
Traducción correcta
+
estructura válida
+
elementos protegidos intactos
+
formato compatible
```

---

# 36. Criterio general de aceptación del producto

Dado un módulo compatible de Foundry VTT en inglés o ruso:

```text id="xwhkxc"
INPUT
  ↓
Traductor
  ↓
OUTPUT español
```

el usuario deberá poder utilizar los archivos generados manteniendo el mismo formato de origen y sin que el proceso de traducción haya alterado las referencias o estructuras necesarias para el funcionamiento del contenido.

La regla de producto será:

> Traducir todo lo que sea seguro traducir y conservar exactamente todo aquello que pueda afectar al funcionamiento de Foundry VTT.