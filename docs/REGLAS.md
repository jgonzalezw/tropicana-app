# Tropicana — reglas invariables

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

## 1. Glosario — un concepto, un nombre

La confusión más cara de este proyecto fue tener dos campos llamados "fin de
ciclo". Antes de tocar fechas o contadores, mirá acá.

| Concepto | Dónde vive | Qué significa |
| --- | --- | --- |
| **Fin de ciclo (consumo)** | `inscripciones.fecha_fin` | Fecha de la última clase del ciclo. La calcula **la venta** proyectando los días del curso. La leen el comprobante de liquidación y el estado de cuenta. |
| **Fin de ciclo (plazo)** | `cuotas.vencimiento` | Hasta cuándo hay tiempo de pagar/renovar. Es el que **corre** cuando se suspende una clase. |
| **Corrimiento** | `corrimientos_ciclo` + `aplicarCorrimiento` | La traza de cada corrida del plazo, idempotente por (inscripción, sesión). `revertirCorrimientos` la deshace. |
| **Agotarse** | `cicloAgotado` (padrón), contadores | El ciclo se consumió. **No** es lo mismo que cerrarse. |
| **Cerrarse** | `inscripciones.estado = 'completada'` | La **venta** terminó: agotado **y** cobrado. |
| **Bono de tolerancia** | `inscripciones.bono_generado` / `bono_redimido` | Clases que se suman al ciclo siguiente por faltas con licencia. |
| **Membresía** | `inscripciones` | Una venta de plan a un alumno. Cada renovación es una fila nueva. |
| **Cuota** | `cuotas` | Lo devengado por una venta. Toda venta tiene la suya. |

## 2. Reglas de negocio

1. **Una membresía se cierra completada Y cobrada.** `estado='completada'`
   exige las dos: ciclo agotado **y** saldo cero. Agotada con deuda sigue
   `activa` — la venta no terminó. Vale para toda membresía, no solo paquetes.
   *Es la base del modelo, el punto de partida (Javier).*
2. **Agotarse ≠ cerrarse.** El padrón de asistencia **nunca** mira `estado`
   para dejar de listar a alguien: usa el consumo real (`cicloAgotado`). Si
   mirara el estado, un alumno con deuda tomaría clases gratis para siempre.
3. **Qué agota cada venta.** Plan con N: ocurrieron sus N sesiones
   **dictadas** (la falta no alarga el ciclo, la clase pasó). Paquete por
   clase: consumió las clases compradas (solo la asistencia consume; una falta
   no gasta el paquete). Ilimitadas: terminan por fecha, no por contador.
4. **Suspender una clase corre el fin de ciclo** de todos los alumnos
   mensuales del curso, sin gastar la tolerancia personal de nadie. Reabrir la
   sesión lo revierte. Hoy corre `cuotas.vencimiento`; ver el glosario.
5. **Bono de tolerancia = ciclo sin faltas injustificadas.** Se acredita solo
   si hubo falta **con licencia** y **ninguna sin licencia** en el ciclo. Una
   sola falta sin licencia deja el bono en 0, aunque el plan tuviera cupo.
6. **Todo lo que se vende se cobra, y el mecanismo es la cuota.** Ninguna venta
   puede quedar con plata fuera de una cuota. Toda venta nueva crea la suya.
7. **La comisión se calcula sobre lo efectivamente cobrado** (el descuento no
   suma), criterio 1, a mes vencido.
8. **Snapshot de precios y porcentajes.** Editar un precio o un % no reescribe
   lo ya vendido ni lo ya devengado.
9. **Sin hardcode.** Tarifas, tolerancias, umbrales, motivos, categorías, roles
   y permisos van a catálogo o parámetro.
10. **Diferenciación por rol/permiso, nunca por persona.**
11. **Toda lista de personas para localizar a alguien se ordena por apellido**
    (helper `compararPorApellido`), en cualquier entidad.

## 3. Reglas de proceso

1. **El pase a producción requiere el OK explícito de Javier, cada vez.**
   Validar en dev no lo dispara.
2. **Se trabaja en dev hasta que Javier pida el pase.** Dev es
   `tropicana-dev` (`hyhijzuomqpylcmrzdvw`); producción es `pnvhpbxjbdmbktpwebtx`.
3. **Pantalla o flujo nuevo sin mockup aprobado: avisar antes de construir.**
   Javier decide Design-first o Code v1 + Design refina. `docs/design/` es un
   espejo textual del handoff: **nunca** se edita a mano.
4. **Piezas reutilizables por entidad.** Un componente por entidad, montado
   idéntico en todos lados (contrato tipo `Cobro` / `EntidadAlumno`).
5. **Un cambio de datos en producción se respalda antes**, si no es reversible
   por sí solo, y se reporta con el antes/después exacto.
6. **Nunca pegar cadenas de conexión ni contraseñas** en el chat ni en el repo.
7. **`docs/ESTADO.md` se actualiza con cada hito cerrado.**

## 4. Controles

`scripts/control_migracion.sql` — controles de solo lectura que verifican
varias de estas reglas contra cualquiera de las dos bases. Cuando una regla se
pueda chequear, va ahí: una regla en prosa se pierde, una que rompe un control
no.
