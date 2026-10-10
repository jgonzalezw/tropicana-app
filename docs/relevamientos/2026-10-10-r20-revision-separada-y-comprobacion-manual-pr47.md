# R20 · PR #47 — Revisión separada del cableado de E2 y comprobación manual

**Fecha:** 2026-10-10. **Rama:** `r20-notificaciones`. **Revisó:** una sesión distinta de la que escribió el código (fork sin la implementación; modelo Sonnet 5.5), sobre el diff, sin editar código fuente.
**Alcance:** el cableado de E2 (N01–N21) en las cinco acciones de la operación. El motor de plantillas **no** está conectado a ninguna operación (`grep` en `src/app`, `src/components` y `src/lib` fuera de `comunicaciones/`: solo importan `comunicaciones/legado/*`).

## Commits revisados
- `HEAD` de la rama: `df9859d2a7e5a9f25e5a0e59a0b3b1d631123f26`.
- Base común con `main`: `4b1d4c6e0fb4c62048e6f94b0ca05767f31291bd`. Rango: `main..HEAD` = 16 commits, 40 archivos.
- Commits de cableado revisados: `5f7414f` (referencias de reservas), `b0ca2de` (N07–N18), `980b2e0` (motivo vacío/nulo), `2f82c73` (referencias de clases), `0e8558d` (N19–N21), `b525d28` (referencias de ventas), `d139c2f` (N01–N06 + inventario), `68fe8d1` (informes). Antecedentes: `ee77526`, `a3c7e8e` (H1/H2, N09–N10).
- Archivos de operación del diff: `particulares/acciones.ts`, `asistencia/acciones.ts`, `inscribir/acciones.ts`, `inscribir/accionesAlquiler.ts`, `src/lib/avisosClase.ts`.

## Resultados de las comprobaciones automáticas (reales, sobre `df9859d`)
| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0, sin errores |
| `npm test` | 791 pruebas, 791 ok, 0 fallan, 0 omitidas |
| `npm run inventario:avisos` | «Inventario completo: 9 consumidores, 16 operaciones, 21 casos con referencias y plantilla» |

## Revisión: qué se contrastó
Se leyó el diff completo de las cinco acciones y los módulos `legado/reserva.ts`, `legado/venta.ts`, `legado/clase.ts`, y se comparó cada texto movido con el que borra el diff.

- **Reservas (N07–N18):** cada plantilla en línea borrada coincide carácter por carácter con su función `mensajeReserva…` (mismos separadores, «Hola!» sin coma, «Te quedan…» tras los dos puntos, mayúscula inicial solo en N11). `textosDeReserva` conserva el respaldo del plan y «el alumno»/«el titular». `avisosDeReserva` conserva las reglas de destinatario y de profesor. `avisaCambioDeEstado` equivale al `if` anterior.
- **Con contexto nulo:** antes se armaba un texto con «undefined» que `avisos()` descartaba; ahora se pasa `""` y se descarta igual. Sin diferencia observable.
- **Ventas (N03–N06):** `mensajePrueba`, `mensajesParticular`, `mensajeAlquiler`, `restoCoordina`, `restoAlquiler`, `introsDeAgenda` y `gentePrueba` reproducen las expresiones borradas (incluida la condición `!!leftoverMin` / `leftoverMin ?`). `avisaRecibo` equivale a `porPlata > 0`.
- **Clases (N19–N21):** `armarAvisosSuspension`, `armarAvisoProfesor` y `armarAvisosReapertura` conservan orden por nombre (`localeCompare("es")`), ids, respaldos «Alumno #id» / «Profesor #id» / «tu curso» y la condición de no-aviso.
- **`ErrorPlantilla`:** no puede bloquear ni disfrazarse en una operación, porque el motor no está conectado. Las funciones de `legado/` no lanzan ese error.
- **Cobertura:** hay equivalencia en tres vías (referencia capturada del código anterior = función movida = plantilla) para los 21 casos, con 284 variantes únicas y condiciones de no-aviso. Lo que **no** cubre ninguna prueba es el cableado dentro de las acciones (necesita base y sesión): es lo que debía cubrir la comprobación manual.

### Hallazgos
No encontré regresiones de comportamiento ni rutas por las que llegue a un cliente un texto distinto del original.

| # | Severidad | Dónde | Hallazgo |
|---|---|---|---|
| 1 | Baja (información) | `src/lib/comunicaciones/legado/venta.ts` (`mensajePrueba`) y `inscribir/acciones.ts` (`venderPrueba`) | `clasesDePrueba` se calcula dos veces (una para el resumen y otra dentro de `mensajePrueba`). Mismo resultado; solo trabajo repetido. |
| 2 | Baja (información) | `src/lib/comunicaciones/legado/clase.ts` (`armarAvisosReapertura`) y `asistencia/acciones.ts` | `avisaReapertura` se evalúa dos veces (en la acción para decidir la consulta del curso y dentro de `armarAvisosReapertura`). Mismo resultado. |
| 3 | Baja (cobertura) | `particulares/acciones.ts`, `asistencia/acciones.ts`, `inscribir/acciones.ts`, `accionesAlquiler.ts` | El paso de argumentos desde la acción a cada `mensaje…` (por ejemplo, que `motivo`, `plazoHoras` o `lugar` no se crucen) solo lo verifican `tsc` y la lectura. No hay prueba automática de la acción; los tipos de varios argumentos son `string`, así que `tsc` no detecta un cruce entre ellos. En esta revisión, la lectura del diff muestra el orden correcto en las 14 llamadas de reservas. |

## Comprobación operativa en dev (2026-10-10): **hecha para ventas N01–N02, clases N19–N21 y reservas particulares N09/N15/N17**

**Cómo.** Con la autorización expresa de Javier de usar `QA_CLOUD_PASSWORD` solo para iniciar sesión en dev, se corrieron tres specs de Playwright (`e2e/r20-cableado-reservas.spec.ts`, `-clases.spec.ts`, `-ventas.spec.ts`) por el `login.setup.ts` del proyecto: la credencial la lee el proceso de pruebas desde `.env.local` y no se mostró, copió ni guardó. Cada spec acciona la pantalla real, lee el texto exacto de cada tarjeta de WhatsApp y falla si trae `{{ }}`, `undefined`, `null`, `NaN` o queda vacío. Los textos quedan en `test-results/r20-avisos-*.json` (no se versionan). Rama `r20-notificaciones`, base `df9859d`; servidor `npm run dev` contra tropicana-dev.

| Caso | Acción en pantalla | Texto visto (resumen) | Resultado |
|---|---|---|---|
| N09 reserva confirmada (alumno) | Ficha de membresía → «+ Nueva reserva» → Confirmar directo | «Hola! Confirmamos tu clase particular (…) con Natalia Salek: mar 13/10 de 08:30 a 09:30, en Tropicana (Sala principal). Te quedan 1 h de tu paquete de 2 h. ¡Te esperamos!» | **OK**, igual al texto de referencia |
| N15 reserva reprogramada (alumno) | Reprogramar a la última franja libre | «Hola! Reprogramamos tu clase particular (…): pasa del mar 13/10 de 08:30 a 09:30 al mar 13/10 de 21:30 a 22:30, … Te quedan 1 h de tu paquete de 2 h.» | **OK** |
| N17 cancelada a pedido, en plazo (alumno) | Cancelar la reserva vigente | «Hola! Cancelamos tu clase particular (…) del mar 13/10 de 21:30 a 22:30, como pediste. Esa hora vuelve a tu paquete: Te quedan 2 h de tu paquete de 2 h. Coordinamos una nueva fecha.» | **OK** (estructura idéntica a `reservas.json`) |
| N19 clase suspendida (alumno) | /asistencia → curso con alumnos → «Marcar esta clase como suspendida» (motivo «E2E R20») | «Hola Bruna! Te avisamos que tu clase de Tropicoreografico del mié 7 oct quedó suspendida por E2E R20. Tu ciclo se corrió: ahora vence el mié 21 oct. …» (4 alumnos) | **OK** |
| N20 clase suspendida (profesor) | ídem | «Hola Natalia! Te avisamos que la clase de Tropicoreografico del mié 7 oct quedó suspendida por E2E R20. No hace falta que la dictes.» | **OK** |
| N21 clase restablecida (alumno) | «Reabrir clase (se dictó)» (corrida con otra clase: Contemporaneo jue 8 oct) | «Hola Daniela! Te avisamos que tu clase de Contemporaneo del jue 8 oct se restableció: se dicta con normalidad. Tu ciclo vuelve a vencer el jue 22 oct. …» (3 alumnos) | **OK** |
| N01 inscripción | /inscribir → contacto «E2E-PRUEBA Venta …» → plan «CR - TU RITMO 1» → cuota entera, efectivo | «Hola! Confirmamos tu inscripción en CR - TU RITMO 1 …: Cursos: • Bachata Conexión: martes y jueves, 20:30 → 21:30 … Incluye: 1 clase. … Precio: Bs. 50,00. Pagado: Bs. 50,00 (Efectivo). Cuota saldada. ¡Te esperamos!» | **OK** |
| N02 recibo | ídem | «Recibo de pago — sáb 10 oct / Recibimos de E2E-PRUEBA Venta …: Bs. 50,00 (Efectivo). Concepto: CR - TU RITMO 1 …» | **OK** |

**No comprobado en pantalla (sin pretender cubrirlo):** N03 (prueba), N04–N05 (venta de particular), N06 (alquiler), N07–N08 (solicitada), N10, N16 y N18 (lado profesor de reservas: la pantalla de la ficha solo mostró la tarjeta del alumno), N11–N14 (suspender/restablecer reservas) y N17/N18 fuera de plazo. Para estos, la evidencia sigue siendo la equivalencia en tres vías y la lectura del diff. Ningún hallazgo nuevo de severidad media o alta; los hallazgos 1–3 de arriba no cambian.

**Datos que quedaron en dev (todos marcados «E2E-PRUEBA» o con motivo «E2E R20»):**
- Reservas: contactos/membresías «E2E-PRUEBA Prueba …» (6 de esta sesión) con reservas en «reagendar» y la membresía en «baja» (el historial de solo agregar impide borrarlas; limpieza ya conocida de `membresiaDePrueba.ts`).
- Clases: Tropicoreografico del mié 7 oct (suspendida y reabierta) y Contemporaneo del jue 8 oct (ídem). Ambas quedaron reabiertas.
- Ventas: contacto «E2E-PRUEBA Venta …» inscripto en «CR - TU RITMO 1» con su cuota saldada y su cobro de Bs. 50 en efectivo (membresía en «baja»); el cobro queda en caja de dev.
- Corridas fallidas del spec de ventas y del de clases (selectores) no dejaron datos de venta; los contactos huérfanos se borraron.
