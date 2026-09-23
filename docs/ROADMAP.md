# Tropicana — ROADMAP

Mejoras funcionales, deudas y pendientes que **no son del hito en curso**, para
poder priorizarlas después. Práctica permanente pedida por Javier el 2026-09-12:
*"Cuando aparezca algo nuevo que no es del hito en curso, no lo pierdas ni lo
metas a la fuerza: anotalo en el ROADMAP."*

**Se actualiza en cada cierre de hito, junto con `ESTADO.md`, y se hace push** —
así la sesión local y la de la nube no se desincronizan.

### Cómo se reparte con los otros dos documentos

Los tres existen para cosas distintas, y mezclarlos es lo que ya costó caro:

| Documento | Qué guarda |
| --- | --- |
| `REGLAS.md` | Las reglas invariables. Si el código las contradice, manda el documento. |
| `DECISIONES.md` | **Decisiones**: las tomadas, y las postergadas con su disparador. |
| `ROADMAP.md` (este) | **Trabajo pendiente**: mejoras, deudas y pendientes con su tamaño. |

Una decisión postergada (`D4`, `D11`…) vive en `DECISIONES.md` y **acá solo se la
referencia**, nunca se la copia: dos copias se contradicen y nadie sabe cuál vale.

Tamaño: **S** = un rato · **M** = un hito chico · **L** = un hito propio.

---

## 0. Bugs de corrección — cerrados

| # | Qué era | Estado |
| --- | --- | --- |
| R23 | **El padrón podía acreditar una clase a la membresía equivocada cuando un alumno tenía DOS membresías regulares del mismo curso** (renovación: ciclo viejo completado + ciclo nuevo activo). Caso real: Yubinca, Bachata Conexión, la clase del 15/09 quedó acreditada a la #22 (vieja) en vez de la #28 (activa). Causa: `filasPorAlumno` (`cargarPadron`, `asistencia/acciones.ts`) solo resolvía el choque regular-vs-prueba, no dos regulares — se quedaba con la primera del Map en vez de preferir la vigente. **CORREGIDO**: el desempate ahora prefiere la activa sobre la agotada/completada (empate exacto por fecha de inicio, la más nueva gana), y `guardarAsistencia` recalcula también la membresía que pierde la marca. Verificado en dev con datos descartables (alumno de prueba, curso Heels, renovación simulada) antes y después del guardado — el padrón ya ofrece la activa, y tras guardar la asistencia queda en la membresía correcta con ambas recalculadas. **PASADO A PRODUCCIÓN el 2026-09-17** (`main` `78e19a8`), con el OK explícito de Javier. Sin migración. | ✅ Cerrado |
| R24 | **El pago de una liquidación no se clasificaba en Caja.** Se asentaba con `motivo: "liquidacion"`, una clave inventada que no estaba en el catálogo `motivo_pago` ni en `BUCKET_POR_MOTIVO`: el egreso no saldaba ninguna deuda y no caía en ningún bucket. **CERRADO el 2026-09-18**, y más grande de lo anotado: Javier amplió el alcance a que la deuda del profesor se refleje y se pague bien en cualquier momento, así que se construyó **la cuenta del profesor** (saldo de todas sus liquidaciones, con los negativos compensándose solos), la imputación que hace cerrar los períodos al pagar (`src/lib/liquidacion/cuenta.ts`, 9 pruebas), y el lado de pagar de Caja (ver R3). Migración **0045** remapea el motivo viejo. | ✅ Cerrado |
| R25 | **`eliminarLiquidacionVacia` borraba sin mirar el estado.** **CERRADO el 2026-09-18**: exige `abierta`. Sin ítems ni pagos el estado siempre debería ser ese, así que no cambia ningún caso real — es la red por si deja de serlo, en una tabla que mueve plata. | ✅ Cerrado |
| R26 | **Control 17 marcaba como sospechosa la venta retroactiva legítima.** Desde la 0044 una venta retroactiva a un período pagado entra por complemento y es esperada; el control daba 21 en dev, casi todo falso positivo. **CERRADO el 2026-09-18**: cuenta solo hechos que no dejaron ni complemento ni ajuste, y **solo sobre membresías que eran elegibles** — al medirlo apareció un segundo falso positivo no previsto (membresías `activa` o con ciclo posterior al cierre, que no devengaron porque no les tocaba). De 21 pasó a 0. | ✅ Cerrado |

---

## 1. Motor de sala y agenda (Paso 5)

| # | Qué es | Rebanada | Tamaño |
| --- | --- | --- | --- |
| R1 | **Conflicto bloqueo-vs-agendado (C5).** Cuando un bloqueo o un cierre cae sobre clases o reservas ya agendadas, el sistema **junta los conflictos y el humano decide** caso por caso — nunca una cancelación automática silenciosa. Para un curso regular, un bloqueo que pisa una clase **es una suspensión** (corre el fin de ciclo, regla de negocio 4). **Alcance del lado de cursos regulares** (Javier, 2026-09-16): el choque se pregunta contra **membresías activas que efectivamente toman esa clase esa fecha**, no contra el calendario del curso a secas — una clase sin nadie inscripto vigente no genera aviso ni confirmación (regla de negocio 18: una clase sin alumnos no existe para nadie). Del lado de particulares/alquiler no aplica el filtro: una reserva ya es un compromiso real por definición. **Lado de cursos regulares: CONSTRUIDO en dev el 2026-09-16** — al guardar un cierre, se detectan las clases afectadas, se pide confirmación explícita, y al confirmar se suspenden con aviso por alumno (ver `docs/ESTADO.md`). Lado de particulares/alquiler sigue sin construir — no hay reservas todavía (C2/C3). **Gap encontrado al construir C2 (2026-09-17):** `calcularImpacto` (el que corre al guardar una excepción de horario) solo mira cursos regulares — una excepción de cierre cargada **después** de un bloqueo de sala (D7) podría taparlo sin ningún aviso, porque el `EXCLUDE` de la base no cubre este caso (una excepción no es fila de `reservas_sala`). Falta extender `calcularImpacto` para preguntar también contra `reservas_sala` vigentes. | C5 | L |
| R17 | **Copiar el horario de una sala a otra.** Pedido de Javier (2026-09-12): *"que haya una forma de duplicar los valores… en horarios, de una sala a otra"*. Hoy cada sala se carga de cero, y la alterna suele abrir igual que la principal: se parte de la copia y se ajusta solo lo que difiere. La copia es **un punto de partida, no un vínculo** — después son horarios independientes. | Paso 5 | S |
| R18 | **Copiar las tarifas de alquiler de una sala a otra.** La otra mitad del mismo pedido. Hoy no hace falta porque las tarifas son generales (valen para todas las salas), pero en cuanto se diferencie una sala (R19) va a hacer falta partir de la copia en vez de cargar 48 celdas a mano. | Precios | S |
| R19 | **Editar la tarifa de alquiler propia de una sala.** El modelo ya lo soporta desde la 0037 —una fila con `sala_id` manda sobre la general— pero **desde la pantalla no hay forma de cargarla**: *Precios y paquetes* edita solo la general. Javier lo eligió así a propósito (2026-09-12: hoy las dos salas cuestan lo mismo), y la pantalla ahora **dice** que esos precios valen para todas las salas en vez de callarlo. Lo que falta es el selector de sala en la pestaña de alquiler. | Precios | M |
| R2 | **Agenda visual (C4).** La grilla-calendario día/semana/mes con intervalos de 30 min parametrizables, como mesa de operaciones: Nueva Reserva, Bloquear, Nueva Venta, marcar realizada, reprogramar, cancelar. **Pasa por Claude Design.** Javier: *"es fundamental para Natalia por su vista"* — va después del motor, no antes. | C4 | L |

## 2. Caja (2F)

| # | Qué es | Rebanada | Tamaño |
| --- | --- | --- | --- |
| R3 | ~~**Lista "Por pagar".**~~ **HECHO el 2026-09-18** para el bucket `profesores`: `lineasPorPagar` produce una linea por profesor con su saldo de liquidaciones, y Caja tiene su seccion. Queda pendiente solo lo que no tiene productor de lineas: `proveedores` y `gastos`. | 2F | ~~M~~ → S |
| R4 | ~~**Pago al reemplazante (D19).**~~ **HECHO el 2026-09-18** (migración 0046): línea propia en "Por pagar", pagable apenas se registra la clase, con `pagos.sesion_id` para saber qué clases se pagaron; y el descuento al titular se ve ya en su línea, sin esperar al cierre. Texto original: **Pago al reemplazante (D19).** A D17b le descuenta al titular lo que costó el reemplazo, pero no genera la contrapartida: al suplente se le paga de memoria. Ver **D19** en `DECISIONES.md`. **Destrabado el 2026-09-18**: R3 era su contenedor y ya existe, asi que ahora es agregar el concepto al saldo del profesor. | 2F | S |
| R5 | ~~**Liquidaciones pendientes con pago parcial.**~~ **HECHO el 2026-09-18**: el saldo del profesor incluye los parciales, y se paga desde Caja o desde Liquidaciones por el mismo camino. | 2F | ~~M~~ |
| R6 | **Arqueo / cierre de caja.** No existe. | 2F | M |
| R27 | **Ver la composición del monto de un "Por pagar" antes de pagarlo.** Javier (2026-09-18): *"será muy útil poder ver el detalle de composición del monto a pagar por un registro por pagar antes de pagarlo, si el usuario lo requiere."* Hoy la línea de un profesor muestra solo su saldo ("Saldo de liquidaciones · N períodos"); falta un desplegable **opcional** que abra de qué está hecho: por período, devengado, ajustes (con su signo), descuentos, lo ya pagado y el neto — el mismo desglose de `cuenta.ts`. Con C3 se le suman las otras fuentes (particulares, talleres, alquiler) como más renglones. Se aplica igual a cualquier "Por cobrar" que después tenga composición. | 2F | S |
| R7 | **Camino inverso del cobro** (anular o revertir un cobro asentado, dejando traza). Hoy no hay forma. | 2F | M |

## 3. Marco de roles y política (documento de Arquitectura, 12/09/2026)

| # | Qué es | Rebanada | Tamaño |
| --- | --- | --- | --- |
| R8 | **Cuatro roles donde hoy hay dos.** El sistema tiene `administrador` y `profesor`; el marco define Gerente, Comercial, Asistente y Profesor. Los permisos ya son configurables por rol, así que es mayormente datos. **El detalle que puede romper en silencio:** las políticas RLS de escritura usan `es_admin()`, que pregunta literalmente por `clave = 'administrador'`. Hay que verificar tabla por tabla, no asumir que alcanza con que las server actions usen `service_role`. | transversal | M |
| R9 | **Tope de descuento en dos niveles.** Hoy el paso `Cobro` permite descuento manual con motivo obligatorio pero **sin techo**. El marco pide un tope para el mostrador y que por encima la operación la ejecute el Gerente. Parámetro + validación **en el servidor** (el control no puede vivir en la pantalla). | transversal | M |
| R10 | **Precio del plan inmutable mientras tiene membresías activas.** Hoy rige *snapshot al vender* (regla 12), que protege lo ya vendido pero no impide editar el precio de un plan activo. El marco pide bloquear la edición: para cambiar el precio se inactiva el plan y se libera uno nuevo. **Es un cambio de comportamiento, no solo de pantalla.** | Planes | M |
| R11 | **Cursos deja de editar tarifas base.** Consecuencia directa del marco (§2.4): las tarifas base son política de Gerencia y viven solo en *Precios y paquetes*. Cursos a lo sumo las muestra en lectura. Cierra la doble superficie sobre el mismo dato que quedó abierta al construir D8. | Cursos | S |
| R12 | **Aprobación de planes (borrador → aprobado → publicado).** Fuera de alcance hoy —el Comercial publica directo— pero el modelo tiene que admitirlo después sin rehacerse. | Planes | — (previsión) |
| R13 | **Rol Alumno.** Visión futura: el alumno operando desde su celular (comprar, marcar asistencia con NFC/beacon). No se construye nada; el modelo de permisos no le cierra la puerta. | futuro | — (previsión) |

## 4. Interfaz y consistencia

| # | Qué es | Rebanada | Tamaño |
| --- | --- | --- | --- |
| R14 | **App Shell a 7 grupos.** La barra lateral tiene 3 grupos (General · Gestión · Administración); el App Shell diseñado tiene 7. Es el **Paso 3**. | Paso 3 | M |
| R15 | **Alineación UX del resto de pantallas.** Cursos, Profesores, Dashboard y navegación siguen en el backlog de `docs/PLAN_UX_DANZE.md`. | Paso 6 | L |

## 5. Datos pendientes

| # | Qué es | Rebanada | Tamaño |
| --- | --- | --- | --- |
| R16 | **Alumnos: fecha de nacimiento y sexo.** Migración aditiva + los dos campos en la ficha (sexo desde catálogo, no hardcodeado). Surgió de una revisión de uso. | Alumnos | S |

---

## 6. Notificaciones

Surgió al construir el aviso de C5 (feriado → alumnos afectados, 2026-09-16):
armar el mensaje a mano ahí mostró que el patrón se va a repetir, y sin
modelarlo cada pantalla lo va a resolver distinto.

| # | Qué es | Rebanada | Tamaño |
| --- | --- | --- | --- |
| R20 | **Modelar el sistema de notificaciones — sin hardcodear.** Javier (2026-09-16): *"ya se ve la necesidad de modelar el sistema de notificaciones, para no hardcodear nada"*. Hoy el mensaje de C5 (motivo + glosa + qué cambió) está armado a mano en `administracion/sala/acciones.ts`. Con más de un caso (asistencia, cobros, sala…) hace falta una plantilla por tipo de evento — catálogo o parámetro, regla de negocio 13 — no una función de texto por pantalla. | transversal | M |
| R21 | **"Copiar para enviar" en toda notificación de pantalla — regla nueva, hacia adelante.** Javier (2026-09-16): *"en adelante toda notificación que entregue una pantalla, que tenga el mecanismo de copiar para poder mandarla al cliente."* Pasa a `REGLAS.md` como regla de calidad — ver ahí el texto exacto. Esta fila es el trabajo de **volver hacia atrás**: revisar todas las pantallas que hoy terminan en un banner verde de éxito (asistencia guardada, inscripción confirmada, cobro registrado…) y decidir, una por una, cuáles necesitan el botón de copiar. | transversal | M |
| R22 | **Eliminar una excepción de horario no revierte las suspensiones que generó.** Encontrado al probar C5 (2026-09-16): guardar el cierre suspende las clases correspondientes, pero borrar la excepción después **no** las reabre — hoy hay que hacerlo a mano por `Tomar asistencia → Reabrir`, curso por curso. Falta el camino simétrico: si la excepción que las causó se borra, ofrecer reabrirlas. | Paso 5 / C5 | S |

---

## Decisiones postergadas que además son trabajo

No se copian acá — viven en `DECISIONES.md` con su disparador. Se listan para no
perderlas de vista al priorizar: **D1** (unificar `membresia_id` en lo existente),
**D3** (renombrar `ClienteVentas.tsx`),
**D4** (acceso al detalle en toda lista), **D9** (tarjeta de confirmación de venta
específica), **D11** (inscribir acompañantes de una prueba grupal),
**D12**/**D13** (estilos a catálogo, y aumentar un catálogo sin salir de la
operación).
