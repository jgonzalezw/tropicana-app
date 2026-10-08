<!-- Reglas de negocio: texto literal de docs/REGLAS.md (partido en el recorte del 2026-10-04) -->

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
6. **Bono de tolerancia = ciclo sin faltas injustificadas, por curso (D35).**
   Cada curso de la membresía se evalúa aparte: se acredita en un curso solo si
   hubo falta **con licencia** y **ninguna sin licencia** en ese curso, con el
   tope de la tolerancia del plan por curso. Una falta sin licencia deja en 0
   el bono de **su** curso, no el de los demás. El bono vence en la renovación
   bonificada de su curso y se aplica en cualquier plan que incluya ese curso
   (suma clases de ese curso; en un ilimitado se consume sin efecto).
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
   **Alcance por tipo de membresía** *(Javier, 2026-09-30, corrigiendo una
   lectura que había generalizado de más)*. Las **formas de pago** (fee por
   hora, % sobre el margen, monto fijo por membresía) fijan lo que una
   **particular** le reporta al profesor al completarse, y miden en **horas**
   (`realizada` + `ausente`, sin cortesías). En **cursos regulares** (y la
   prueba, que es un plan regular) no cambia nada de lo ya implementado: base
   %, asignación, prorrata, criterio 1, medida en **clases**. Los criterios
   **2 y 3** también existirán para regulares, **sobre esa misma base** —sin
   cambiarla— y se construyen en una etapa aparte, con su propio OK.
   **El criterio 2 es la única excepción a la regla 16**: como mira el
   avance acumulado a la fecha, si una reserva de un período ya liquidado
   se corrige después, la diferencia entra en el **período actual** (no
   reabre el período original) — ver regla 16.
   **Excepción: cierre de cuentas de un profesor que se retira** *(Javier,
   2026-10-01)*. Al desasignarlo de un curso se puede liquidar de inmediato lo
   que ganó: el **avance al corte** (clases que dictó hasta esa fecha, base =
   lo cobrado hasta hoy —proporcional si hay saldo— y el criterio 2 como
   medida; ilimitados por calendario al corte). Es un **pago a cuenta**, solo
   de ese curso y solo de ese profesor: las membresías siguen pendientes hasta
   que un profesor las complete, y la liquidación final emite solo la
   diferencia (lo cobrado después llega como `ajuste`, regla 16). Nunca
   descuenta. El pago real se hace en Caja. Alcance: cursos regulares.
   **Retiro del profesor** *(Javier, 2026-10-07, D34)*: al retirarlo se cierran
   las cuentas de **todas** sus membresías, de cualquier tipo (regulares y
   particulares), en un solo paso con vista previa simulada que no guarda
   nada; confirmar es todo o nada. El alquiler no liquida al profesor.
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
    **Excepción decidida el 2026-10-01, construida en el Paso 4:** en planes
    **ilimitados** se cuentan solo las clases **asistidas por el alumno** (no
    hay compromiso previo de asistir); los planes con N clases siguen por
    calendario menos suspendidas. Una clase sin registrar sigue trabando el
    prorrateo multi-curso (regla 17). **El criterio 2 (avance) no se permite en
    planes ilimitados** (Javier, 2026-10-01): sin total de clases no hay
    avance que medir; lo valida el plan (`validarDatosPlan`).
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
    **Excepción, desde H5 (2026-09-27):** el **criterio 2** (proporcional al
    avance) no genera `ajuste` que reabra el período original. Como cada
    liquidación paga "el avance a la fecha menos lo ya devengado", la
    diferencia por una reserva corregida tarde entra directo como
    `avance` **en el período que se está liquidando ahora**. No hay nada
    que reabrir: el cálculo siempre mira el estado actual, no un corte
    congelado. Ver regla 8 y `docs/DECISIONES.md`, fila "H5 — liquidación
    de particulares".
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
    qué. **Si se puede cambiar a mano lo gobierna un parámetro**
    (`alquiler_categoria_modo`, migración 0060) **que fija la gerente según su
    política**: *automática* —no se cambia, y es como arranca— o *editable* —se
    puede cambiar con una **glosa obligatoria**, y la venta guarda la propuesta
    original junto a la aplicada—. *(Javier, 2026-10-01: antes la regla decía que
    la persona la podía cambiar; el mockup de H7 la dejó automática, y se decidió
    que no se cablea ninguna de las dos sino que la política la elige la
    gerente.)* Lo que se aplicó se guarda con la venta
    como histórico (regla 12): cambiar después la situación del cliente no
    reescribe lo vendido. Los **nombres** de las categorías y de los tramos de
    personas se editan; las **claves** no, porque de ellas depende la regla
    que propone. *(Definiciones v2 de C3, 2026-09-25.)*
