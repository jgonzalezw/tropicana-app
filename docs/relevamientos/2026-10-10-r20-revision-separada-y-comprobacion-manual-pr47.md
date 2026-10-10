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

## Comprobación manual en dev: **NO se pudo completar**
- Se levantó `npm run dev:limpio` contra tropicana-dev (`.env.local` apunta al proyecto de dev; el servidor respondió 200 en `/login`).
- **Primer intento:** tras `navigate`, la extensión devolvió «Can't interact with browser-internal or unparseable URLs» en dos pestañas (la primera compilación de `/login` tardó ~25 s y la pestaña seguía figurando como `chrome://newtab/`). Se paró según la regla de reintentos.
- **Segundo intento, con el servidor ya compilado:** la extensión sí leyó `/login` (formulario con «Correo», «Contraseña», «Ingresar»).
- **Bloqueo real: el inicio de sesión.** El usuario QA de dev necesita la contraseña de `QA_CLOUD_PASSWORD` (`.env.local`). El clasificador de permisos de la sesión **denegó leerla** («Credential Materialization»), y no se buscó otra vía para sortearlo. Sin sesión iniciada no se pudo ejecutar ninguna acción.
- **No se creó ni modificó ningún dato en dev.**
- El servidor quedó apagado y la pestaña creada, cerrada.

| Caso | Acción | Texto visto | Resultado | Dato creado |
|---|---|---|---|---|
| N01–N02 inscripción | no ejecutada | — | **No comprobado** | ninguno |
| N03 prueba | no ejecutada | — | **No comprobado** | ninguno |
| N04–N05 particular | no ejecutada | — | **No comprobado** | ninguno |
| N06 alquiler | no ejecutada | — | **No comprobado** | ninguno |
| N07–N18 reservas (solicitar, confirmar, suspender, restablecer, reprogramar, cancelar) | no ejecutada | — | **No comprobado** | ninguno |
| N19–N21 clases (suspender, restablecer) | no ejecutada | — | **No comprobado** | ninguno |

## Qué queda pendiente y cómo cerrarlo
- La comprobación manual operativa sigue **abierta**. Opciones: (a) que Javier inicie sesión con el usuario QA en la pestaña de Chrome conectada (o autorice a la sesión a leer `QA_CLOUD_PASSWORD`) y se repita; (b) que Javier haga el recorrido en dev con `npm run dev:limpio`, comparando el texto del botón de WhatsApp con `src/lib/comunicaciones/__referencias__/*.json`; (c) una prueba de acción con base de dev.
- Mientras tanto, la evidencia es: revisión del diff sin hallazgos de severidad media o alta, `tsc` limpio, 791 pruebas ok e inventario completo. La comprobación de datos y destinatarios reales sigue siendo, como dice RETOMAR, de la conexión de cada caso.
