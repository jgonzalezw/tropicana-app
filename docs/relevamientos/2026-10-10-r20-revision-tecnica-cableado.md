# R20 · E2 — Revisión técnica del cableado de las funciones trasladadas

**Fecha:** 2026-10-10.
**Alcance:** el diff `main...HEAD` de la rama `r20-notificaciones`, en los cinco archivos de la operación:
- `particulares/acciones.ts`
- `asistencia/acciones.ts`
- `inscribir/acciones.ts`
- `inscribir/accionesAlquiler.ts`
- `src/lib/avisosClase.ts`

**Quién la hizo: AUTORREVISIÓN.**
- La hizo la misma sesión de Claude Code que escribió el código (con Opus).
- **No es una revisión separada.** Este documento deja el análisis por escrito, pero **no resuelve** la revisión independiente que pidió Javier.
- **Para resolverla**, la revisión la tiene que hacer otra persona, o una sesión nueva sin el contexto de la implementación, sobre este mismo diff. Una opción es `/code-review ultra`, que lanza Javier.

## Por qué importa
Las funciones trasladadas **forman parte del camino operativo actual**: las acciones de la operación ya las llaman para armar los avisos que ve el operador. El motor de plantillas nuevo no está conectado; las funciones de `legado/`, sí.

## Qué cambia por archivo
| Archivo | Cambio | Equivalencia |
|---|---|---|
| `particulares/acciones.ts` (7 operaciones de reserva) | Los textos en línea pasan a `mensajeReserva…` de `legado/reserva.ts`. `avisos()` delega en `avisosDeReserva`. El filtro de estados pasa a `avisaCambioDeEstado`. Se mueven `horario`, `h` y `fechaHoraCorta`. | Mismos argumentos que usaba el texto en línea. Con `c = null`, antes se armaba un texto con «undefined» que `avisos()` descartaba (devuelve `{}`); ahora se pasa `""` y se descarta igual. No hay diferencia observable. |
| `asistencia/acciones.ts` (`reabrirSesion`) | La condición y el armado de N21 pasan a `avisaReapertura` y `armarAvisosReapertura`. | La consulta del curso sigue dentro de la misma condición. El respaldo «tu curso», el orden por nombre y los ids se conservan. |
| `src/lib/avisosClase.ts` | Re-exporta los tipos y los textos movidos. `avisosSuspensionAlumnos` y `avisoProfesorTitular` delegan en `armar…`. | Los importadores existentes no cambian. Se conserva el retorno temprano `profesorId == null`, así que no se consulta con `eq("id", null)`. |
| `inscribir/acciones.ts` (`inscribirYCobrar`, `venderPrueba`, `venderParticular`) | La guarda del recibo pasa a `avisaRecibo(porPlata)`. N03 pasa a `mensajePrueba` (con `gentePrueba` y `clasesDePrueba`). N04 y N05 pasan a `mensajesParticular`. | `gente` y los intros se siguen usando en el `resumen` con los mismos valores. `quien` se recorta dentro de la función, igual que antes. |
| `inscribir/accionesAlquiler.ts` (`venderAlquiler`) | N06 pasa a `mensajeAlquiler`, y el resto a `restoAlquiler`. | La comparación `destino.nombre === contacto.nombre` decide el texto, igual que antes. |

**Sin cambios:** no cambian `await`s, consultas, permisos, orden de efectos ni la resolución de destinatarios (`destinatarioAviso`, `destinatarioDeTitular`, `contactosDeAlumnos`). Los importes y las fechas los sigue formateando la acción.

## Qué está demostrado y qué no
- **Textos y condiciones de aviso:** 284 variantes únicas, contra referencias capturadas **antes** de mover el código. 0 diferencias.
- **Llamadas desde las acciones:**
  - `tsc` sin errores;
  - el build de Vercel en SUCCESS;
  - esta revisión del diff, que es autorrevisión.
- **No demostrado en vivo:**
  - Ninguna prueba automática ejecuta las acciones de reservas particulares, clases ni ventas contra una base.
  - El e2e de humo (14 de 14) cubre membresías.

## Pendiente acordado: comprobación manual en dev (antes de cualquier pase)
Se hace en dev, con datos ficticios. Por cada operación se compara el texto del botón de WhatsApp con el que genera `main` en las mismas condiciones:
1. **Reserva particular:** crear solicitada, confirmar, suspender (por estado y operativa), restablecer, reprogramar y cancelar (dentro y fuera de plazo).
2. **Clase de curso:** suspender, con el aviso a los alumnos y al profesor, y reabrir.
3. **Ventas:** inscripción con y sin cobro (el recibo aparece solo si hubo cobro), prueba, paquete particular (alumno y profesor) y alquiler (titular y persona de contacto).

**Estado: pendiente.**

## Mejora opcional (no hecha)
Agregar a `scripts/inventario-avisos.mjs` una verificación de que cada operación sigue llamando a su función de `legado/`. Así, volver a un texto en línea fallaría el inventario.
