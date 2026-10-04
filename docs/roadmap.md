# Roadmap basado en el PRD

## MVP

specs/001-foundry-translator-mvp: Windows .exe, JSON, EN/RU -> ES, archivo/carpeta,
recursión, originales intactos, referencias, validación, progreso, cancelación,
informe y memoria. Reutilizar glosario básico y motor local existentes.

## Fase 2

Nueva spec después de estabilizar integridad JSON: JS/MJS mediante AST y literales
visibles conservadores, sin alterar código/imports/exports; validación sintáctica.
Vista previa, edición, reconocimiento Foundry, glosarios avanzados, motores/idiomas.

## Fase 3

Specs independientes: instalaciones, selección módulos, incrementales, diferencias,
perfiles, packs y modelos locales integrados. Packs binarios actuales se copian
intactos; traducción requiere herramientas/validación propias.

## Fuera del alcance inicial

Editor completo, instalación/publicación automática, colaboración online, gestión Git,
imágenes/OCR/audio/vídeo. Auxiliares PDF/corpus existentes no amplían el MVP.
