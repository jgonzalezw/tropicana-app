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
| **Fin de ciclo** | `membresias.fecha_fin` | Fecha de la última clase del ciclo. **Se calcula** desde las clases que realmente ocurren (`finDeCicloReal`): una sesión suspendida no consume ciclo, lo corre. |
| **Renovación bonificada** | derivada (`renovacionBonificada`) | Hasta cuándo puede renovar sin perder el bono: la **siguiente clase después del fin de ciclo**. |
| **Corrimiento** | `corrimientos_ciclo` | La traza de qué suspensión corrió el ciclo de quién, con el antes/después. Idempotente por (inscripción, sesión). **Audita y explica; no es la fuente de verdad** — la fecha se recalcula. |
| **Plazo de pago** | `cuotas.vencimiento` | Hasta cuándo hay tiempo de pagar. **No es el fin de ciclo** y el corrimiento no lo toca (eso era la etapa 1, antes del motor de planes). |
| **Agotarse** | `cicloAgotado` (padrón), contadores | El ciclo se consumió. **No** es lo mismo que cerrarse. |
| **Cerrarse** | `membresias.estado = 'completada'` | La **venta** terminó: agotado **y** cobrado. |
| **Bono de tolerancia** | `membresias.bono_generado` / `bono_redimido` | Clases que se suman al ciclo siguiente por faltas con licencia. |
| **Membresía** | `membresias` | Una venta de plan a un alumno. Cada renovación es una fila nueva. Se llamó `inscripciones` hasta la migración **0047 (D1)**, cerrada el 2026-09-24: hoy la tabla es `membresias` y la llave que apunta a ella se llama **siempre** `membresia_id`, sin ninguna otra grafía en ningún lado. **Ningún campo nuevo con `inscripcion_id`.** |
| **Curso de una membresía** | `membresia_cursos` | Los cursos que la membresía habilita, con sus días y —si es prueba— la fecha de su clase. **`membresias.curso_id` NO es "el curso" de la membresía**: es un resabio que solo significa algo en un plan mono-curso, y queda como respaldo para filas viejas. Para saber qué cursos toca una membresía —padrón, liquidación, cualquier cosa— se mira `membresia_cursos`. *(Javier, 2026-09-11: "no existe curso principal de la membresía, salvo que sea mono curso".)* Se llamó `inscripcion_cursos` hasta la 0047. |
| **Membresía de prueba** | `membresias.es_prueba` | Preliminar: 1 clase por curso elegido, sin tolerancia, bono ni renovación. Cuelga del **mismo plan regular**. `acompanantes` guarda la gente sin nombre del grupo. |
| **Conversión** | `membresias.membresia_anterior_id` | De dónde viene la membresía: el ciclo anterior (renovación) o la prueba (el prospecto se convirtió). |
| **Cuota** | `cuotas` | Lo devengado por una venta. Toda venta tiene la suya. |
| **Contacto** | `contactos` | Desde la migración **0048 (C3-0a.1, D12)**: el único registro de una persona u organización. Nombre, WhatsApp, canal de captación, documento (en `contactos_privados`) y relaciones (tutor, referido) viven acá, **una sola vez**, sea cual sea el rol que después tenga. |
| **Extensión de rol** | `alumnos`, `profesores` | Lo que hace un contacto en la academia, no quién es. Apuntan a `contactos` por `contacto_id` (NOT NULL + UNIQUE desde la 0048): un contacto puede tener cero, uno o los dos roles, pero su identidad —nombre, WhatsApp— vive una sola vez. **Nunca** se le agrega nombre/apellido/whatsapp propio a una tabla de rol nueva: eso va en `contactos`. |
| **Prospecto** | `contactos` sin fila en `alumnos` ni `profesores` | Un contacto sin ningún rol todavía. Es un estado **válido** del modelo, no un error a mitad de alta: si falla la escritura del rol después de crear el contacto, no hace falta compensar nada — queda un prospecto. |
| **Consentimiento vigente** | vista `consentimientos_vigentes` | El último consentimiento otorgado por un contacto para una finalidad. `consentimientos` es **de solo agregar** (trigger `consentimientos_no_update`): un consentimiento es un hecho que pasó, nunca se edita ni se borra — para cambiarlo se registra uno nuevo y la vista muestra el más reciente. |
| **Referencias ≠ Referido** | catálogo `canal_captacion` | Dos cosas distintas que suenan igual. **Referencias** = boca a boca, sin una persona identificada detrás (un canal de captación más, como Instagram o un letrero). **Referido** = `contacto_relaciones` tipo `referido_por`, una relación con un contacto concreto que lo trajo. Confundirlos pierde la trazabilidad de a quién agradecer o, eventualmente, comisionar por el referido. |
| **Matriz de mínimos** | `matriz_minimos` | Qué tan obligatorio es cada campo de un contacto (nombre, WhatsApp, red social, documento...) según el **contexto** en que se carga: alumno adulto, alumno menor, prueba, profesor, tercero, etc. Tres niveles — `O` obligatorio, `V` visible opcional, `-` oculto. El formulario (`CamposContacto`, C3-0a.3) elige el contexto solo — `alumno_menor` si está marcado "es menor", **incluso viniendo de una clase de prueba** (Javier, 2026-09-24: "las reglas de alumno menor", no las de `prueba` — no se vende una prueba a un menor sin tutor). **La valida el servidor** (`validarContraMatriz`), nunca solo la pantalla. Algunas celdas están **bloqueadas** (`CELDAS_BLOQUEADAS` en `matrizMinimos.ts`, control 27): de ellas depende la detección de duplicados o un `check` de la base (nombre/razón social por `tipo`), y cambiarlas rompería eso, no solo un campo visual. `interes` y `facturacion` quedan sembradas pero **sin columna donde guardarse**: no editables, con aviso (regla de calidad 5). |
| **Plan de servicio** | `planes` + `planes.tipo_servicio` | Lo único que se vende (regla 22). Cinco tipos: `curso_regular`, `particular`, `alquiler`, `taller` y servicio especial (etapa siguiente). El plan fija el criterio de liquidación, la forma de pago al profesor, la vigencia, la modalidad de reserva y los márgenes de extensión. *(Hasta C3 el código fuerza `curso_regular`: los otros tipos se abren con C3.)* |
| **Reserva** | `reservas_sala` | Una franja de sala (propia o externa) para una sesión. Cuelga de **una sola** cosa: una membresía (particular, alquiler), un plan (taller) o nada (bloqueo, con motivo). Siete estados: Solicitada, Confirmada, Reprogramada, Reagendar, Suspendida, Ausente, Realizada; qué hace cada uno con el saldo, en la regla 23. *(Los 7 estados se construyen en C3; hoy existen `reservada`/`dictada`/`cancelada`.)* |
| **Sala externa** | `salas` (genérica) | Una ubicación fuera de Tropicana —el salón de una boda, un hotel—. Hay **una sola** sala externa genérica; al vender se le pone un nombre descriptivo por membresía (en talleres, por plan). **No se valida su ocupación.** |
| **Período vencido** | parámetro `periodicidad_liquidacion` | Se paga en la liquidación del período siguiente; el período (semana, mes o membresía) lo fija el parámetro. Reemplaza a "mes vencido". *(Hoy el cálculo está fijo en mes calendario aunque el parámetro diga otra cosa; se corrige en C3.)* |
| **Extensión** | *(se construye en C3)* | Sumar horas a una membresía ya vendida, dentro de los márgenes que fija su plan; lo adicional se cobra a precio de lista o con recargo, según el plan, con su propia cuota. |
| **Horario hábil** | *(se construye en C3)* | Un patrón semanal + excepciones, con la misma lógica que el horario de sala, que **no se reserva**: solo dice qué horas son hábiles para calcular recordatorios y avisos no urgentes ("10 horas hábiles antes"). |

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
   **Paquete de horas** (particular o alquiler): se agota cuando se
   consumieron sus horas, contando las reservas que consumen (regla 23), o
   cuando vence su vigencia —lo no usado se pierde—. **Taller**: se agota con
   su última sesión dictada. *(Definiciones v2 de C3, 2026-09-25.)*
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
   suma), **según el criterio que elige el plan**, a **período vencido**.
   **Cinco criterios** *(definiciones v2 de C3, 2026-09-25)*: **(1)** al
   completarse la membresía —agotada y cobrada al 100%—, a período vencido;
   **(2)** proporcional al avance de la membresía, siempre que esté cobrada al
   100%, a período vencido; **(3)** como el 1, pero se paga al completarse,
   sin esperar el cierre; **(4)** taller: al completarse el taller, sobre lo
   cobrado —lo que se cobre después abre otra liquidación—; **(5)** taller:
   monto fijo al completarse. El 4 y el 5 **solo** en planes de taller. Los
   criterios 1 a 3 miran cada membresía sola, aunque tenga varios alumnos.
   **Período vencido** = la liquidación del período siguiente, donde el
   período lo fija el parámetro `periodicidad_liquidacion` (hoy `mes`).
   **Cuánto** gana el profesor lo fija la **forma de pago** que elige el plan:
   fee por hora (el valor vive en el profesor), % sobre el margen (precio neto
   − costo de sala, si el plan lo descuenta) o monto fijo por membresía. Vale
   igual para profesores de Tropicana y externos.
   **De dónde sale la plata del profesor en el criterio 1, con todas las
   letras** *(Javier, 2026-09-18)*: de las membresías **completadas (agotadas)
   y cobradas al 100%** hasta el último día del período pasado. La liquidación toma esas y devenga:
   **directo** si la membresía es mono-curso, **a prorrata** si es multi-curso
   (regla 10). Una membresía agotada pero con saldo **no entra** — no terminó la
   venta (regla 1).
   *Es el piso de la regla 16: si la plata sale de la membresía, entonces la
   clase no la tiene, y tocar una clase vieja no reescribe nada — se recalcula
   la membresía y se compensa la diferencia.*
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
    precio de su curso × clases que ese curso puso en el ciclo (× personas, en
    las pruebas). Un curso que no puso ninguna no cobra nada. La prueba no es un
    caso especial: es el caso general con 1 clase por curso.
    **Las clases se cuentan por calendario menos suspendidas**, igual que el fin
    de ciclo (regla 4): las del calendario del curso que el alumno eligió, entre
    el inicio y el fin del ciclo, descontando las suspendidas. Una falta no
    descuenta —la clase ocurrió—; una asistencia sin cargar tampoco, porque es
    un trámite pendiente y no algo que haya pasado en la sala. Su contrapeso es
    la regla 17. *(Javier, 2026-09-11: "Vamos por el criterio calendario menos
    suspendidas".)*
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
    **Y es de quien DICTÓ, no de quien está asignado hoy.** Si el titular de un
    curso cambia a mitad de ciclo, las clases de antes son del anterior y las de
    después del nuevo: ese curso deja **dos líneas**, una por profesor, cada una
    con sus clases y su %. La parte del curso se divide por las clases que puso
    cada uno. Una clase que ese día no tenía a nadie asignado **no se paga**:
    su plata no se devenga, repartirla sería pagarle a alguien por una clase que
    no dio. *(Javier, 2026-09-12: "puede haber más de un profesor que dictó la
    misma clase… es parte del diseño desde el inicio.")*
11. **La clase de prueba es una membresía preliminar de un plan regular**, no
    un plan aparte. El plan regula si la acepta, en cuántos cursos distintos
    se puede probar, si el fee se acredita al convertir y por cuántos días.
    Los cursos se eligen **siempre al comprar**. Un grupo es un titular
    identificado más N acompañantes sin nombre, un solo monto, y **una sola
    asistencia por curso** — todos van a la misma clase.
    **Al convertir se acredita la parte de QUIEN se inscribe, no el total del
    grupo**: lo pagado ÷ personas. En un grupo cada uno paga lo suyo y el
    titular solo presta sus datos para simplificar el registro — no tiene por
    qué llevarse el crédito de los demás. La parte del resto queda disponible
    hasta la misma fecha de vencimiento; hoy **no hay forma de reclamarla**
    porque los acompañantes no tienen nombre (D11).
    *(Javier, 2026-09-11, opción b.)*
12. **Snapshot de precios y porcentajes.** Editar un precio o un % no reescribe
    lo ya vendido ni lo ya devengado.
13. **Sin hardcode.** Tarifas, tolerancias, umbrales, motivos, categorías, roles
    y permisos van a catálogo o parámetro.
14. **Diferenciación por rol/permiso, nunca por persona.**
15. **Toda lista de personas para localizar a alguien se ordena por apellido**
    (helper `compararPorApellido`), en cualquier entidad.
16. **Las clases solo afectan contadores. Lo pagado no se reescribe: se
    compensa.** *(Javier, 2026-09-18 — esta regla reemplaza al "congelador".)*
    La cadena es: clase → **contadores** (clases hechas, ciclo agotado,
    corrimiento del fin de ciclo, bono) → la membresía se **completa** (agotada
    **y** cobrada al 100%) → recién ahí, al liquidar el mes, se **devenga**.
    Una clase **nunca tiene plata encima**: el conteo es apenas un insumo del
    prorrateo de la membresía que se está liquidando.
    **Por lo tanto, registrar, corregir o suspender una clase vieja siempre se
    puede.** Son hechos que pasaron y el sistema tiene que poder reflejarlos.
    Lo que no se hace **nunca** es reescribir lo ya liquidado.
    **Si el recálculo de esa membresía da otro número, la diferencia sale como
    un `ajuste`**, firmado: positivo si hay que pagarle más al profesor,
    negativo si hay que descontarle. Entra como **complemento del período de la
    comisión original** —reabriendo esa liquidación, aunque esté pagada— y la
    comisión original queda intacta.
    **Nada de lo devengado por OTRAS membresías que compartieron esa misma
    clase cambia.** Cada venta se reparte sola, con su propia plata.
    Mientras la liquidación esté `abierta` (nada pagado) no hace falta ajuste:
    el devengo **se revierte solo** y se recalcula — si no, la membresía
    quedaría marcada como "ya devengada" y la corrección nunca llegaría a la
    comisión. **El corte es el primer pago**, no el pago total: una liquidación
    `cerrada` tiene pago parcial y esa plata ya salió.
    **Lo que queda es el aviso, no el bloqueo.** Quien va a tocar una clase de
    un período ya liquidado y cobrado ve, **antes de guardar**, qué liquidación
    se va a mover y de quién, y confirma. Informa; no pide permiso.
    *De acá se sigue que una **venta retroactiva** nunca se bloquea: devenga lo
    suyo como complemento, sin tocar lo cobrado.*
    *Historia, porque el error costó: hasta el 2026-09-17 esto era un
    "congelador" que prohibía tocar la clase, sobre la premisa de que la clase
    tenía plata encima. Se descubrió con el caso Heels 29/08 —una inscripción
    retroactiva que no podía sumar su alumno a una asistencia ya cargada— y lo
    corrigió Javier: la premisa era falsa, y por eso la respuesta (prohibir) lo
    era también. El mecanismo de ajuste es la migración 0044.*
17. **Registrar las sesiones es imperativo para liquidar — pero solo donde hay
    prorrateo.** Una membresía de **dos o más cursos** no se liquida mientras
    alguna clase de su ciclo no tenga ni asistencia ni suspensión: ahí el conteo
    es lo que reparte la plata. Una membresía de **un solo curso se liquida
    igual**: su número no cambia con el conteo.
    **El bloqueo es de esa membresía, no del profesor ni del período.** Las
    demás se liquidan normalmente y la que espera entra después como
    complemento (regla 16). La pantalla muestra qué falta —**por curso y
    fecha**, comprimido y expandible; el plan y el alumno no hacen falta, el
    problema es del curso— y con el link a dónde cargarlo.
    *Es el contrapeso de la regla 10: como las clases se cuentan por calendario,
    una clase sin registrar pesa igual que una dictada.*
    *(Javier, 2026-09-11; alcance corregido el 2026-09-12.)*
18. **Una clase sin alumnos no existe para nadie.** Si ningún alumno tenía clase
    ese día, no hay que registrarla: no cuenta para el prorrateo, no traba
    ninguna liquidación, y no obliga ni al profesor ni a la academia. La
    pantalla de asistencia la muestra marcada como tal —no la esconde— para que
    no se confunda con una asistencia pendiente de cargar.
    *Javier, 2026-09-12: "Solo se compromete al profesor para dictar clases
    donde hay alumnos, sin ellos, él no tiene obligación alguna en esa clase de
    la fecha, ni la academia con él."*
19. **El motivo de una suspensión dice a quién se le atribuye, y la plata no
    cambia por eso.** Tres causas: **sin alumnos** (no hay nada que correr ni
    que pagar), **atribuible al profesor** y **fuerza mayor** (feriado,
    administración). En las dos últimas el alumno tiene **corrimiento**, y en
    las tres **el profesor no cobra una clase que no dictó**. "No le afecta" en
    la fuerza mayor quiere decir que no hay multa ni se le descuenta un
    reemplazante — no que se le pague la clase.
    *(Javier, 2026-09-12: "El profesor no cobra por clases que no dicta. Punto.")*
20. **Una clase con asistencia registrada la dictó alguien.** No se puede
    asumir que no la dio nadie: si no la dio el titular, la dio un **suplente**.
    Un suplente **no entra en el prorrateo** y **no cobra por liquidación, sino
    por tarifa** — un monto por clase dictada, confirmado al registrar la
    asistencia (la tabla de profesores da la referencia). **En los dos casos la
    clase cuenta igual para el conteo del prorrateo**: se dictó.
    Lo que cambia es de quién es la plata de esa clase:
    **(a) Reemplazo atribuible al titular** (faltó, no avisó). Su liquidación
    va **normal** —esa clase le cuenta y la cobra— y **al total se le descuenta**
    lo que se le pagó al reemplazante, más cualquier multa. El descuento es un
    concepto aparte en la liquidación: no es una comisión.
    **(b) Reemplazo por causa administrativa de la academia** (el curso estaba
    desasignado, una decisión de administración). La parte de esa clase **queda
    para Tropicana**, que es de donde sale el costo del reemplazo. No se le
    descuenta a nadie, y **no se le muestra a los demás profesores** — es una
    cuenta interna de la academia, no de ellos.
    **Al tomar asistencia se muestra el titular vigente de esa fecha**, y si el
    curso está desasignado ese día, **registrar el reemplazo es obligatorio**
    salvo que la clase se cancele.
    *(Javier, 2026-09-12: "Si una clase no se canceló y se registró la
    asistencia, alguien la dictó, no podés asumirlo, mala decisión." Y la
    corrección de las dos ramas, el mismo día.)*
21. **Toda contraparte nueva apunta a `contacto_id`.** Desde la migración 0048
    (C3-0a.1), ninguna tabla nueva guarda su propio nombre/apellido/whatsapp:
    si necesita una persona u organización, referencia a `contactos` por
    `contacto_id`. `alumnos` y `profesores` son extensiones de rol con este
    mismo patrón (ver glosario); una clase particular, un alquiler de sala o
    cualquier venta futura a un tercero se cuelgan igual, nunca con un campo
    de texto libre ni un tercer camino de identidad.
    **El titular de una membresía es un contacto** *(Javier, 2026-09-25)*. En
    curso regular, particular, taller y prueba, el titular **adquiere el rol
    alumno al comprar** (la venta lo crea si falta); en alquiler no, y queda
    solo como contacto, fuera del padrón.
22. **Todo se vende por plan.** No existe un camino de venta sin plan. "Venta
    directa" es solo el nombre de los planes sencillos, los que no pasan por
    cotización. Las tarifas ya construidas (tramos de horas, categorías,
    tamaños) son los **insumos** con que se arman los planes, no un camino
    aparte. Cinco tipos de servicio: curso regular, particular, alquiler,
    taller y servicio especial (con cotización, etapa siguiente).
    *(Definiciones v2 de C3, 2026-09-25.)*
23. **Una reserva descuenta el saldo al confirmarse, y cada estado dice qué
    pasa con él.** **Cada slot horario es una reserva independiente**:
    aunque se pidan varios juntos, cada uno se reagenda, suspende o cambia de
    sala (propia o externa) por su cuenta. Una particular descuenta **horas
    de clase** y un alquiler **horas de alquiler** de su membresía.
    *Solicitada* no descuenta, pero **ya ocupa** la sala y al profesor hasta
    su validez máxima (parámetro, hoy 24 h); vencida, se libera sola.
    *Confirmada* descuenta. *Reprogramada* es historial sobre una reserva
    confirmada: sigue siendo una sola sesión descontada. *Reagendar* (lo pidió
    el alumno a tiempo) y *Suspendida* (lo decidió Tropicana) **devuelven** la
    sesión al saldo y liberan sala y profesor. *Ausente* y *Realizada*
    consumen. Cancelar **fuera de plazo** (parámetro, hoy 8 h) deja la reserva
    en **Ausente**, con la marca de incumplimiento en el historial. El saldo
    **se calcula** desde las reservas, no se guarda paso a paso (como el fin
    de ciclo, regla 4). Una **sala externa** no se valida: no tiene
    ocupación. En un **taller**, las reservas son del plan y no descuentan el
    saldo de nadie. *(Definiciones v2 de C3 + precisiones de Javier,
    2026-09-25.)*
24. **La categoría de alquiler la propone el sistema, y queda guardada con la
    venta.** Se deduce de los datos —alumno, profesor de Tropicana, profesor
    externo o tercero, con los días de gracia del parámetro— y se muestra por
    qué; la persona la puede cambiar. Lo que se aplicó se guarda con la venta
    como histórico (regla 12): cambiar después la situación del cliente no
    reescribe lo vendido. Los **nombres** de las categorías y de los tramos de
    personas se editan; las **claves** no, porque de ellas depende la regla
    que propone. *(Definiciones v2 de C3, 2026-09-25.)*

## 3. Reglas de proceso

1. **El pase a producción requiere el OK explícito de Javier, cada vez.**
   Validar en dev no lo dispara. **Desde el 2026-09-25 esto es un control
   técnico, no solo una instrucción**: `.claude/settings.json` (versionado)
   trae un hook (`.claude/hooks/guardia-produccion.mjs`) que pide aprobación
   antes de cualquier SQL o migración contra `pnvhpbxjbdmbktpwebtx`, antes de
   un `git push` a `main`, y antes de tocar `.claude/` — para que ninguna
   sesión pueda aflojar este mismo control sin que Javier lo vea. Los
   permisos personales de cada sesión van en `.claude/settings.local.json`,
   que **no se versiona** (`.gitignore`): lo que se apruebe al paso en una
   máquina queda en esa máquina.
2. **Se trabaja en dev hasta que Javier pida el pase.** Dev es
   `tropicana-dev` (`hyhijzuomqpylcmrzdvw`); producción es `pnvhpbxjbdmbktpwebtx`.
3. **Pantalla o flujo nuevo sin mockup aprobado: avisar antes de construir.**
   Javier decide Design-first o Code v1 + Design refina. `docs/design/` es un
   espejo textual del handoff: **nunca** se edita a mano.
4. **Piezas reutilizables por entidad.** Un componente por entidad, montado
   idéntico en todos lados (contrato tipo `Cobro` / `EntidadAlumno`).
5. **Un cambio de datos en producción se respalda antes**, si no es reversible
   por sí solo, y se reporta con el antes/después exacto. Si el respaldo es un
   **script de rollback que transforma datos** (no solo estructura, como el
   de la 0047 — un puro renombre), probarlo comparando también el
   **contenido reconstruido, fila por fila, contra el dato real**: el hash de
   esquema solo prueba que la forma quedó idéntica, no que el dato que el
   script reconstruye adentro de esa forma es correcto.
   *Costó: el rollback de la 0048 (`scripts/rollback_0048_contactos.sql`)
   pasó el hash de esquema contra producción a la primera, pero tenía dos
   bugs de datos que el hash no podía ver — el whatsapp quedaba normalizado
   con `+591` en vez del formato crudo original, y `tutor_nombre`/
   `tutor_whatsapp` se anulaban cuando el tutor también era alumno,
   contradiciendo el dato real de producción (que tiene las dos cosas a la
   vez). Los encontró recién la comparación fila por fila contra producción,
   2026-09-24.*
6. **Nunca pegar cadenas de conexión ni contraseñas** en el chat ni en el repo.
7. **`docs/ESTADO.md` se actualiza con cada hito cerrado.**
8. **Una decisión tomada se respeta hasta que otra decisión la cambie.** No se
   revisa "sobre la marcha" ni porque en el momento parezca mejor: si hay que
   cambiarla, se plantea, se pondera y se anota en `docs/DECISIONES.md` con la
   fecha y el porqué. Javier no tiene cómo revisar cada decisión pasada en cada
   cambio — llevar ese control es trabajo de esta sesión, no suyo.
9. **La sesión sabe dónde corre, y no promete lo que ese entorno no puede.**
   Claude Code **local** (el `claude` de PowerShell) ve el disco de Javier;
   una sesión **en la nube** ve solo su propio clon del repo. Levantar el
   server, leer `.env.local` o ver un stash es del local; las migraciones, el
   código y los controles van por red y se pueden desde los dos. Si el paso
   necesita su disco, se le pasa el comando para que lo corra él — no se
   intenta y se le informa un resultado que midió otra máquina. **GitHub es el
   único puente entre los dos**, así que la copia local se atrasa sola si no se
   pullea. Detalle en `docs/ENTORNOS_CLAUDE.md`.
   *Costó una vez: la sesión en la nube no podía ver el `stash` de la carpeta
   de Javier, y ese stash tenía trabajo sin commitear que la mudanza del repo
   habría borrado sin que nadie se enterara.*
10. **Toda decisión postergada vive en `docs/DECISIONES.md` con su disparador**
   (cuándo conviene hacerla, qué la vuelve urgente). **Todo plan que se le
   proponga a Javier abre mostrando el backlog** de decisiones postergadas que
   ese plan toca o encarece; si no aplica ninguna, se dice "ninguna". Y cuando
   se cumple un disparador, se avisa aunque nadie haya preguntado.
   *Costó tres veces: se reintrodujo una decisión ya tomada por no tenerla a
   mano, y el retrabajo lo pagó Javier en horas y en tokens.*
11. **Toda pantalla o paso nuevo incluye su opción de permisos por rol, antes
    de darse por concluido.** No es un paso aparte para después: si la pantalla
    o la operación no tiene su módulo en `Roles y Permisos` (o usa uno que no
    le corresponde), no está terminada.
    *Costó una vez: Planes, Liquidaciones y Precios y paquetes se construyeron
    usando el permiso de otro módulo (`cursos`, `comisiones`, `administracion`)
    porque no existía uno propio. Un asistente con permiso de `cursos` veía
    Planes sin que hubiera forma de evitarlo — encontrado por Javier ya con el
    asistente operando la aplicación, 2026-09-16.*
12. **Toda notificación que entrega una pantalla lleva su mecanismo de
    copiar, para poder mandarla al cliente.** Vale para cualquier aviso que
    nombre a una persona y algo que le pasó o le va a pasar (una clase
    suspendida, un cobro, un vencimiento) — no para los banners de éxito
    genéricos que no hablan de nadie en particular. Sin envío automático
    todavía, el mínimo es poder copiar el texto ya armado en vez de tener que
    redactarlo a mano por cada persona.
    *(Javier, 2026-09-16, al construir el aviso de C5.)* La revisión retroactiva
    de las pantallas existentes con notificación queda en `ROADMAP.md` (R21).

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
   revisando datos, RLS y componentes que estaban bien. El repo vivía dentro
   de OneDrive, que sincroniza por debajo y pelea con el watcher de Turbopack
   —no hay arreglo por configuración, la doc de Next prohíbe sacar `distDir`
   del proyecto—. **La causa de raíz se sacó el 2026-09-16**: el repo se mudó
   a `D:\dev\tropicana-app`, fuera de OneDrive (D2, cerrada). Desde
   2026-09-11 `npm run dev` **avisa** cuando detecta el repo dentro de una
   carpeta que sincroniza sola, y el aviso queda por si vuelve a pasar.*
5. **Una capacidad que no está disponible se explica; no desaparece.** Es la
   regla 1 aplicada a la pantalla. Si una pestaña, un botón o una opción se
   ocultan cuando falta su configuración, "todavía no lo configuré" y "algo se
   rompió" se ven idénticos: no está. Se muestra igual, deshabilitada o con un
   panel que diga **qué falta y dónde cargarlo**.
   *Costó la pestaña "Clase de prueba": se ocultaba sola y no había forma de
   saber desde la pantalla si faltaba el precio del curso o si la consulta
   había fallado.*
6. **Un valor con alternativas se elige de una lista; nunca se escribe a mano.**
   Vale para parámetros, catálogos y cualquier campo con un conjunto cerrado de
   valores. Escribirlo a mano deja pasar `compactoo`, que no falla: cae al
   default y la aplicación se comporta distinto sin decir por qué — la regla 1
   otra vez. La lista la sirve el dato (`parametros.opciones`), no el código
   (regla de negocio 13), y **el que valida es el servidor**: el desplegable
   ayuda, no decide. Dejar unos campos con lista y otros a mano es peor que
   ninguna: enseña que la lista no significa nada.
   *Pedido de Javier, 2026-09-11: "SIEMPRE que se tengan valores alternativos a
   elegir, debes poner un control que permita hacerlo desde una lista de
   opciones… el que dejes algunos para escritura manual es baja calidad de
   desarrollo e inconsistente."*

7. **Todo parámetro o valor de catálogo que el código lea nace en una
   migración.** Cargarlo a mano en dev —con SQL suelto o desde la pantalla—
   lo deja fuera de producción **para siempre**: el pase lleva migraciones, no
   filas sueltas. Y no hay control que lo note, porque cada base se mira sola.
   El síntoma es engañoso: sin el parámetro el código cae a su default y no
   falla nada visible, pero la configuración **no existe** y por lo tanto no se
   puede cambiar — una capacidad que no está y no lo dice (regla 5).
   *Costó una vez: `liquidacion_reparto_pantalla` y `_impreso` se crearon a
   mano en dev; la migración 0028 los daba por existentes y solo los
   actualizaba. El pase del 2026-09-12 no los llevó, y la pantalla de
   Parámetros mostró 4 en dev y 2 en producción. Lo corrigió la **0031**.*

8. **Toda pantalla arranca en el mismo borde: se arma con `<Pagina>`**
   (`src/components/Pagina.tsx`), **nunca** con su propio contenedor ni con
   `mx-auto`. `<Pagina>` fija el padding y el borde izquierdo; cada pantalla
   elige solo su ancho máximo (`ancho="lg" … "6xl"`). Una barra fija abajo
   arranca después de la barra lateral (`min-[900px]:left-64`) y alinea sus
   botones con el mismo padding, sin centrarlos. Lo hace cumplir
   `src/lib/pantallas.test.ts`: falla si aparece un `mx-auto` o un contenedor
   de pantalla propio.
   *Costó dos veces el mismo día (Inscribir y Cuenta del alumno,
   2026-09-24): cada pantalla tenía su contenedor y algunas se centraban
   solas. Javier: "estandarizar que siempre se comporten igual".*

## 5. Controles

`scripts/control_migracion.sql` — controles de solo lectura que verifican
varias de estas reglas contra cualquiera de las dos bases. Cuando una regla se
pueda chequear, va ahí: una regla en prosa se pierde, una que rompe un control
no.
