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
| **Membresía** | `inscripciones` | Una venta de plan a un alumno. Cada renovación es una fila nueva. **La llave foránea se llama `inscripcion_id` en `asistencias`, `cuotas`, `pagos`, `corrimientos_ciclo` e `inscripcion_cursos`, y `membresia_id` en `comisiones_devengadas` y `liquidacion_items`.** Son el mismo campo: la inconsistencia es deuda conocida (D1 en `docs/DECISIONES.md`). **Ningún campo nuevo con una tercera grafía.** |
| **Curso de una membresía** | `inscripcion_cursos` | Los cursos que la membresía habilita, con sus días y —si es prueba— la fecha de su clase. **`inscripciones.curso_id` NO es "el curso" de la membresía**: es un resabio que solo significa algo en un plan mono-curso, y queda como respaldo para filas viejas. Para saber qué cursos toca una membresía —padrón, liquidación, cualquier cosa— se mira `inscripcion_cursos`. *(Javier, 2026-09-11: "no existe curso principal de la membresía, salvo que sea mono curso".)* |
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
    **El "precio de su curso" es el valor de UNA clase del curso —su tarifa de
    clase suelta—, no el valor por tramo.** El tramo es para *proponer* un
    precio (regla 9): ahí la pregunta es cuánto costaría comprar eso por
    separado. Repartir plata ya cobrada es otra cosa: la pregunta es cuánto vale
    una clase de cada curso, comparadas **entre sí**. Midiendo cada curso con el
    tramo que le tocó según cuántas clases dictó, dos cursos igual de caros
    pesarían distinto solo por eso y el reparto dejaría de estar ecualizado.
    **La comisión es de un profesor por un curso**, no por una membresía: si un
    profesor dicta dos cursos del mismo plan y el alumno fue a los dos, su
    liquidación lleva **dos líneas**, una por curso, cada una con su parte.
    *(Javier, 2026-09-11.)*
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
16. **Un período liquidado y pagado está cerrado.** Ningún hecho con fecha
    dentro de él se crea ni se modifica: ni una venta retroactiva, ni suspender
    o reabrir una clase, ni corregir una asistencia. Si hay que corregir algo de
    un período cerrado, se hace con un **ajuste con fecha de hoy**, que deja
    rastro; el pasado no se reescribe. **El corte es el primer pago**, no el
    pago total: una liquidación `cerrada` tiene pago parcial y esa plata ya
    salió. Mientras esté `abierta` (nada pagado) el cambio se permite, y el
    devengo afectado **se revierte solo** para que se recalcule — si no, la
    membresía quedaría marcada como "ya devengada" y la corrección nunca
    llegaría a la comisión.
    *Importa desde la regla 10: la comisión depende de cuántas clases dictó
    cada curso, así que tocar una clase vieja mueve plata ya pagada.*
    *(Decisión de Javier, 2026-09-11, opción a.)*

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
8. **Una decisión tomada se respeta hasta que otra decisión la cambie.** No se
   revisa "sobre la marcha" ni porque en el momento parezca mejor: si hay que
   cambiarla, se plantea, se pondera y se anota en `docs/DECISIONES.md` con la
   fecha y el porqué. Javier no tiene cómo revisar cada decisión pasada en cada
   cambio — llevar ese control es trabajo de esta sesión, no suyo.
9. **Toda decisión postergada vive en `docs/DECISIONES.md` con su disparador**
   (cuándo conviene hacerla, qué la vuelve urgente). **Todo plan que se le
   proponga a Javier abre mostrando el backlog** de decisiones postergadas que
   ese plan toca o encarece; si no aplica ninguna, se dice "ninguna". Y cuando
   se cumple un disparador, se avisa aunque nadie haya preguntado.
   *Costó tres veces: se reintrodujo una decisión ya tomada por no tenerla a
   mano, y el retrabajo lo pagó Javier en horas y en tokens.*

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
   y arrancar con **`npm run dev:limpio`** (borra la build y levanta, en un
   comando y en cualquier sistema), recargando con Ctrl+F5. Recién si después
   de eso sigue igual, el problema es el código.
   **Síntoma que engaña:** no es solo "el cambio no aparece" — también una ruta
   que existe y devuelve **404 propio de Next**, llevándose puesto el app-shell.
   Un 404 así es de resolución de ruta, no de datos: ninguna pantalla de este
   proyecto devuelve 404 cuando no encuentra un registro.
   *Costó dos veces (commits `2a26010` y `8fb648c`): las dos se fue el tiempo
   revisando datos, RLS y componentes que estaban bien. El repo vive dentro de
   OneDrive, que sincroniza por debajo y pelea con el watcher de Turbopack —
   moverlo fuera (p. ej. `C:\dev\tropicana-app`) sacaría la causa de raíz —
   no hay arreglo por configuración, la doc de Next prohíbe sacar `distDir` del
   proyecto. Desde 2026-09-11 `npm run dev` **avisa** cuando detecta el repo
   dentro de una carpeta que sincroniza sola, para que el riesgo no vuelva a
   aparecer disfrazado de bug.*
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
