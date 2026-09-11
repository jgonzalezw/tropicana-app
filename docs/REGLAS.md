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
| **Fin de ciclo** | `inscripciones.fecha_fin` | Fecha de la última clase del ciclo. **Se calcula** desde las clases que realmente ocurren (`finDeCicloReal`): una sesión suspendida no consume ciclo, lo corre. |
| **Renovación bonificada** | derivada (`renovacionBonificada`) | Hasta cuándo puede renovar sin perder el bono: la **siguiente clase después del fin de ciclo**. |
| **Corrimiento** | `corrimientos_ciclo` | La traza de qué suspensión corrió el ciclo de quién, con el antes/después. Idempotente por (inscripción, sesión). **Audita y explica; no es la fuente de verdad** — la fecha se recalcula. |
| **Plazo de pago** | `cuotas.vencimiento` | Hasta cuándo hay tiempo de pagar. **No es el fin de ciclo** y el corrimiento no lo toca (eso era la etapa 1, antes del motor de planes). |
| **Agotarse** | `cicloAgotado` (padrón), contadores | El ciclo se consumió. **No** es lo mismo que cerrarse. |
| **Cerrarse** | `inscripciones.estado = 'completada'` | La **venta** terminó: agotado **y** cobrado. |
| **Bono de tolerancia** | `inscripciones.bono_generado` / `bono_redimido` | Clases que se suman al ciclo siguiente por faltas con licencia. |
| **Membresía** | `inscripciones` | Una venta de plan a un alumno. Cada renovación es una fila nueva. |
| **Membresía de prueba** | `inscripciones.es_prueba` | Preliminar: 1 clase por curso elegido, sin tolerancia, bono ni renovación. Cuelga del **mismo plan regular**. `acompanantes` guarda la gente sin nombre del grupo. |
| **Conversión** | `inscripciones.membresia_anterior_id` | De dónde viene la membresía: el ciclo anterior (renovación) o la prueba (el prospecto se convirtió). |
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
4. **Una clase suspendida no consume ciclo: lo corre.** El fin de ciclo es la
   fecha de la clase N contando solo las que ocurren de verdad. Como se
   **calcula** y no se guarda paso a paso, da igual el orden de los hechos: una
   venta con fecha retroactiva sobre una clase ya suspendida queda bien sola.
   Una falta, con o sin licencia, **no** corre nada — la clase pasó.
5. **Una membresía ya devengada no cambia sus fechas en silencio.** Si el
   recálculo la tocaría, se reporta en vez de hacerse: la fecha define en qué
   período entró la comisión. Tampoco se reabre una membresía liquidada.
6. **Bono de tolerancia = ciclo sin faltas injustificadas.** Se acredita solo
   si hubo falta **con licencia** y **ninguna sin licencia** en el ciclo. Una
   sola falta sin licencia deja el bono en 0, aunque el plan tuviera cupo.
7. **Todo lo que se vende se cobra, y el mecanismo es la cuota.** Ninguna venta
   puede quedar con plata fuera de una cuota. Toda venta nueva crea la suya.
8. **La comisión se calcula sobre lo efectivamente cobrado** (el descuento no
   suma), criterio 1, a mes vencido.
9. **Precio del plan: el sistema propone, la persona decide.** La
   **referencia** es lo que costaría comprar por separado lo que el plan
   ofrece junto: se estima el **valor de una clase** del curso y se multiplica
   por las clases que el plan ofrece. El valor de una clase sale de la tarifa
   del **tramo** que corresponde a esa cantidad (clase suelta → semana → medio
   mes → mes), porque comprar suelto sale más caro por clase que comprar el
   mes. Un ilimitado escala el mensual a la duración del ciclo. El precio final
   lo fija quien crea el plan, y es **único** para el plan. La excepción es la
   prueba: ahí el monto es la **suma de los cursos que el alumno elige al
   comprar**, por la cantidad de personas.
10. **La comisión de un plan multi-curso se reparte a prorrata.** Cada
    profesor cobra sobre **su parte de lo efectivamente cobrado**, con peso =
    precio de su curso × clases que ese curso realmente dictó (× personas, en
    las pruebas). Un curso que no dictó nada no cobra nada. La prueba no es un
    caso especial: es el caso general con 1 clase por curso.
11. **La clase de prueba es una membresía preliminar de un plan regular**, no
    un plan aparte. El plan regula si la acepta, en cuántos cursos distintos
    se puede probar, si el fee se acredita al convertir y por cuántos días.
    Los cursos se eligen **siempre al comprar**. Un grupo es un titular
    identificado más N acompañantes sin nombre, un solo monto, y **una sola
    asistencia por curso** — todos van a la misma clase.
12. **Snapshot de precios y porcentajes.** Editar un precio o un % no reescribe
    lo ya vendido ni lo ya devengado.
13. **Sin hardcode.** Tarifas, tolerancias, umbrales, motivos, categorías, roles
    y permisos van a catálogo o parámetro.
14. **Diferenciación por rol/permiso, nunca por persona.**
15. **Toda lista de personas para localizar a alguien se ordena por apellido**
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

## 4. Calidad del código

1. **Un fallo nunca se disfraza de ausencia.** Si el dato es necesario para que
   la pantalla haga su trabajo, un error de lectura **se muestra**; nunca se
   convierte en "no hay nada". El patrón cómodo de Supabase
   —`const { data } = await sb.from(...)`— tira el error, y después `data ?? []`
   hace que la pantalla mienta: dice "no hay planes" cuando la consulta se
   rompió. Usar **`exigir()`** de `@/lib/datos`; el `error.tsx` de `(privado)`
   lo muestra con su mensaje. Si vacío es un resultado legítimo (contar
   dependencias, un dato opcional), no hace falta.
   *Costó dos veces: el recibo que daba 404 sobre un pago que existía, y la
   venta que se quedaba sin planes. Las dos veces se fue el tiempo buscando el
   problema donde no estaba.*
2. **Agregar una columna al `select` rompe la consulta entera** si la API
   todavía no conoce la columna. Después de una migración que agrega columnas y
   se empiezan a leer, correr `notify pgrst, 'reload schema';`.
3. **Antes de dar por hecho un diagnóstico, mirar el dato.** Las dos veces que
   se perdió tiempo fue por afirmar una causa sin medirla. Medir es barato:
   una consulta de lectura contra la base responde en segundos.
4. **Si un cambio no aparece en pantalla, descartar el build antes que el
   código.** El orden correcto es: confirmar el archivo en disco
   (`Select-String -Path <archivo> -Pattern <texto nuevo>`), cortar el server,
   `Remove-Item -Recurse -Force .next`, `npm run dev`, y recargar con Ctrl+F5.
   Recién si después de eso sigue igual, el problema es el código.
   *Costó dos veces (commits `2a26010` y `8fb648c`): las dos se fue el tiempo
   revisando datos, RLS y componentes que estaban bien. El repo vive dentro de
   OneDrive, que sincroniza por debajo y pelea con el watcher de Turbopack —
   moverlo fuera (p. ej. `C:\dev\tropicana-app`) sacaría la causa de raíz.*
5. **Una capacidad que no está disponible se explica; no desaparece.** Es la
   regla 1 aplicada a la pantalla. Si una pestaña, un botón o una opción se
   ocultan cuando falta su configuración, "todavía no lo configuré" y "algo se
   rompió" se ven idénticos: no está. Se muestra igual, deshabilitada o con un
   panel que diga **qué falta y dónde cargarlo**.
   *Costó la pestaña "Clase de prueba": se ocultaba sola y no había forma de
   saber desde la pantalla si faltaba el precio del curso o si la consulta
   había fallado.*

## 5. Controles

`scripts/control_migracion.sql` — controles de solo lectura que verifican
varias de estas reglas contra cualquiera de las dos bases. Cuando una regla se
pueda chequear, va ahí: una regla en prosa se pierde, una que rompe un control
no.
