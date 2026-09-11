# Caso abierto — las tres clases de prueba (inscripciones 17, 18, 19)

**Levantado de producción (`pnvhpbxjbdmbktpwebtx`) el 2026-09-11.** Todo lo de
acá está leído de la base, no reconstruido de memoria. Dev coincide (se
refrescó desde producción el 2026-09-10).

Existe para que el modelo de la clase de prueba se defina con el caso real a la
vista. **No propone una solución** — describe qué hay y qué falta.

---

## 1. Qué pasó

El 08/09/2026 Karola Urbari vino con sus dos hijas a una clase de prueba de
Zumba. Se cargaron las tres personas, se les vendió una clase suelta a Bs. 30
cada una, se cobró en efectivo, y se les tomó asistencia en la sesión de ese
día. La operación, desde el mostrador, salió bien: la plata entró y las tres
figuran presentes.

Lo que no ocurrió es invisible desde la pantalla: **la profesora que dio esa
clase no va a cobrar comisión por ella.**

## 2. Las personas

| Alumno | Nombre | ¿Menor? | Tutor | WhatsApp | Canal |
| --- | --- | --- | --- | --- | --- |
| 31 | karola urbari | No | — | 77460335 | whatsapp |
| 32 | hija karola | **Sí** | 31 (karola urbari) | — (del tutor) | referido |
| 33 | hija 2 karola | **Sí** | 31 (karola urbari) | — (del tutor) | referido |

Las dos menores siguen la clave compuesta del producto (WhatsApp del tutor +
nombre sin apellido), por eso su `apellido` es el nombre de la madre. Es la
convención vigente, no un error de carga.

## 3. Las tres membresías

Las tres son idénticas salvo el alumno.

| Campo | Valor | Comentario |
| --- | --- | --- |
| `id` | 17, 18, 19 | |
| `alumno_id` | 32, 33, 31 | |
| `curso_id` | 3 — Zumba (martes y jueves), precio mensual Bs. 170 | |
| **`plan_id`** | **`null`** | **Bloqueante.** Son anteriores al motor de planes |
| `modalidad` | `clase` | Paquete por clase, no mensual |
| `clases_total` | 1 | Una clase comprada |
| `clases_hechas` | 1 | Consumida |
| `clases_plan` | `null` | No tiene N de plan |
| `estado` | `completada` | Lo dejó así la `0018` |
| `fecha_inicio` | 2026-09-08 | |
| **`fecha_fin`** | **`null`** | **Bloqueante** |
| `precio_aplicado` | Bs. 30,00 | Precio de prueba, no el mensual |
| `ciclo_numero` | 1 | |
| `tolerancia_faltas` / `bono_generado` / `bono_redimido` | null / 0 / false | |
| `creado_en` | 2026-09-08 23:23–23:24 | |
| `actualizado_en` | 2026-09-10 21:11 | La `0018` al cerrarlas |

## 4. Qué cuelga de ellas

| Tabla | Filas | Detalle |
| --- | --- | --- |
| `cuotas` | 3 (16, 17, 18) | Período sep-2026, devengado Bs. 30,00, **pagada**, vencimiento 08/09 |
| `pagos` | 3 (15, 16, 17) | Bs. 30,00 c/u, efectivo, sin descuento, motivo `membresia` (remapeado por `0020`), **sin glosa** |
| `asistencias` | 3 | Las tres **presentes**, sin licencia, en la sesión 21 |
| `sesiones` | 1 (id 21) | 08/09/2026, **dictada**, profesora **Isabel Gongora** (id 4) |
| `inscripcion_cursos` | **0** | **No tienen días cargados** |
| `corrimientos_ciclo` | 0 | Sin suspensiones en su período |
| `comisiones_devengadas` | **0** | **Nunca devengaron** |

## 5. Qué las excluye de la liquidación, exactamente

`calcularPendientes` (`src/app/(privado)/liquidaciones/acciones.ts:50-55`) pide
las cuatro condiciones a la vez:

```
.eq("estado", "completada")        -> OK, las tres cumplen
.not("plan_id", "is", null)        -> FALLA: plan_id es null
.not("fecha_fin", "is", null)      -> FALLA: fecha_fin es null
.lte("fecha_fin", hastaISO)        -> no se evalúa
```

**Fallan dos condiciones, no una.** Poner solo la fecha no alcanza; poner solo
el plan, tampoco.

Dos cosas que conviene saber antes de decidir cómo se arregla:

- **`comisiones_devengadas.plan_id` acepta null.** El bloqueo está en el filtro
  de la consulta, no en el esquema del devengo. La tabla puede recibir una
  comisión sin plan.
- **Sin filas en `inscripcion_cursos`, `finDeCicloReal` devuelve `null`.** El
  cálculo de fin de ciclo que se puso en producción el 2026-09-10 necesita los
  días de la membresía. Aunque se les asignara un `plan_id`, la fecha no se
  calcularía sola: hay que darles días, o tratarlas por otro camino.

## 6. La plata en juego

| | |
| --- | --- |
| Cobrado a las tres | **Bs. 90,00** (3 × Bs. 30,00, efectivo, 08/09/2026) |
| Profesora | Isabel Gongora (id 4) |
| Su % vigente en el curso | **50 %** (asignación abierta del curso 3) |
| Comisión que correspondería con criterio 1 | **Bs. 45,00** |
| Devengado hasta hoy | **Bs. 0,00** |

La plata del alumno **sí** está bien registrada: entró a caja, tiene su cuota y
su pago, y figura en el estado de cuenta. Lo que falta es el lado del profesor.

## 7. Preguntas que el modelo tiene que responder

No las respondo acá; son las que quedan abiertas mirando este caso.

1. ¿La clase de prueba es un **plan** (con su `tipo_servicio` propio) o un tipo
   de venta aparte del motor?
2. ¿Su precio sale de una tabla por curso, o es un parámetro de la academia?
3. ¿Devenga comisión con el mismo criterio 1, o con uno propio? El % de 50 de
   arriba es el del curso regular — puede no ser el que corresponde.
4. ¿Qué pasa cuando el alumno de prueba se inscribe después? ¿La prueba se
   descuenta de la primera cuota, queda como antecedente, o no se relacionan?
5. ¿Ocupa cupo del curso? Hoy entra al padrón de la sesión como cualquier otro.
6. ¿Estas tres se migran al modelo nuevo, o se devengan a mano por única vez?
   Son Bs. 45 de una profesora concreta, y la respuesta cambia si mañana hay
   treinta casos en vez de tres.

## 8. Estado

**Congelado a propósito.** Javier (2026-09-11): *"eso lo vamos a resolver con un
modelo definido, no sobre la marcha"*. No se toca ningún dato de estas tres
hasta que el modelo esté cerrado.
