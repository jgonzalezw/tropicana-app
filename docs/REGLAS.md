# Tropicana — reglas invariables

> **Nota (recorte 2026-10-04):** este archivo ya no se carga entero en cada sesión (la frase de abajo es histórica). Su texto se partió, sin cambios, en `docs/reglas/`; el índice de una línea por regla está en `CLAUDE.md`. **Leé el archivo del área antes de tocarla.**

| Sección | Dónde vive | Leelo antes de tocar |
| --- | --- | --- |
| 1. Glosario — un concepto, un nombre | `docs/reglas/glosario.md` | fechas, contadores, membresías, contactos, reservas |
| 2. Reglas de negocio (1–24) | `docs/reglas/negocio.md` | membresías, ventas, asistencia, liquidación, reservas, alquiler |
| 3. Reglas de proceso (1–12) | `docs/reglas/proceso.md` | pases a producción, pantallas nuevas, permisos, avisos, cierres |
| 4. Calidad del código (1–9) y 5. Controles | `docs/reglas/calidad.md` | cualquier código: errores, parámetros, pantallas, botones |


Este archivo se carga en **toda** sesión (vía `CLAUDE.md`). Es la fuente de
verdad de las reglas de negocio y de proceso: si algo de acá se contradice con
el código, **manda esta página** y el código es el que está mal.

Es corto a propósito. El detalle, la historia y el estado de cada hito viven en
`docs/ESTADO.md`; las decisiones de diseño en `docs/design/`. Nada de eso se
carga solo — esto sí.

> **Antes de afirmar que algo "no está implementado", leé el flujo completo.**
> Un `grep` por un nombre de campo no alcanza: en este producto varias reglas
> viven bajo otro nombre (ver el glosario). Buscar y no encontrar no es prueba.

---
