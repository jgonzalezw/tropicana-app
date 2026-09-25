# Tropicana — Clases Particulares, Alquiler de Sala y Talleres
## Definiciones consolidadas v2 (relevamiento 23/09/2026 + revisión con Natalia 25/09/2026)

*Especificación de negocio para C3. Reemplaza al relevamiento del 23/09. Guardar en `docs/`.*

## 0. Resumen de decisiones

- **Todo se vende por plan.** "Venta directa" es solo el nombre de los planes sencillos, sin cotización. No existe un camino de venta sin plan.
- **Cinco tipos de venta/servicio:** Cursos Regulares, Clases Particulares, Alquiler de Salas, Talleres y **Servicios Especiales** (con cotización). Los Servicios Especiales pueden combinar dentro de una misma venta elementos de los otros cuatro tipos; tienen flujo propio y van en una etapa siguiente.
- **Cinco criterios de liquidación**, elegidos por plan (dos de ellos solo para talleres). Donde decía "mes vencido" ahora dice **"período vencido"**: el período lo fija el parámetro del sistema ya existente (semana, mes o membresía).
- **Forma de pago al profesor**, abierta a profesores de Tropicana y externos: fee por hora, % sobre (precio neto − costo de sala), o monto fijo por membresía. Se elige en el plan.
- **Una membresía ya vendida puede extenderse** (por ejemplo, más horas), dentro de los márgenes que fija su plan.
- **Las sesiones de una membresía se pueden repartir en varias salas**, propias (con validación de disponibilidad) y/o externas (sin validación). Ya se venden planes así (paquetes de boda).
- **Estados de reserva:** Solicitada, Confirmada, Reprogramada, Reagendar, Suspendida, Ausente, Realizada. Se implementan todos, con sus flujos.
- **El horario hábil para notificaciones** reusa la lógica del horario de salas (patrón + excepciones): un espacio que no se reserva pero ofrece disponibilidad.

## 1. Tipos de venta y el plan como ordenador

Toda venta se hace sobre un plan. El plan ordena toda la variedad de ofertas, desde la más sencilla (equivalente a una venta directa, por ejemplo una hora suelta de particular) hasta la más armada. Los datos de tarifas ya construidos (tramos de horas, categorías) son los insumos con los que se arman los planes, no un camino de venta aparte.

| Tipo | Qué vende | Etapa |
| --- | --- | --- |
| Cursos Regulares | Membresía a clases de uno o varios cursos (ya en producción). | Existente |
| Clases Particulares | Paquetes de horas con profesor, en una o más salas propias o externas. | Primera entrega (C3) |
| Alquiler de Salas | Horas de sala por categoría de cliente, cantidad de personas y horas. | Primera entrega (C3) |
| Talleres | Serie de sesiones con fechas fijas, cupo, profesor propio o externo. | Primera entrega (C3) |
| Servicios Especiales | Ventas con cotización previa (eventos, coreografías complejas, varios conceptos de costo, subcontrataciones). Pueden combinar elementos de los otros cuatro tipos. | Etapa siguiente |

### 1.1 Venta directa vs. venta con cotización

- **Venta directa:** se vende el plan tal como se ofrece, ajustando al vender cantidades (horas), recursos, salas, etc. No pasa por cotización. Ejemplo: plan de boda con X horas en Tropicana y Y sesiones en el salón del evento (el concepto "salón" es fijo del plan; la dirección concreta se carga al vender).
- **Venta con cotización (Servicios Especiales):** requiere analizar costos, cantidades y subcontrataciones antes de ofertar. Tiene un estado previo, **cotización**: se envía al cliente en formato comercial, se confirma, se modifica/recotiza, se cancela o se declara perdida; al confirmarse con fechas y pago (o compromiso de pago) pasa a activa.

### 1.2 Cómo se arma un plan sencillo

- **Primera implementación:** plantillas de plan listas para vender ("Hora suelta", "Pack 5 horas"…), con opciones que se personalizan al vender.
- **Segunda implementación:** armado libre de un plan mínimo al momento de la venta.
- **Escenario más simple y urgente:** planes de paquetes de clases particulares que se personalizan al vender: cantidad de horas, salas (propias y/o externas), estilo-profesor, vigencia, fecha de inicio, fecha de la primera reserva, o calendario cerrado.

## 2. Categoría del cliente para tarifas de alquiler

La categoría depende de quién alquila y el sistema la determina a partir de los datos:

| Categoría | Se cumple si… |
| --- | --- |
| Alumno | Tiene una membresía activa en un curso regular o en un plan de clase particular, o cerró alguna en los últimos N días (parámetro, hoy 7). |
| Profesor de Tropicana | Tiene cursos regulares asignados activos, o planes de particulares vendidos por Tropicana activos, o cursos que cerraron hace N días o menos (parámetro, hoy 7). |
| Profesor externo | Profesor que no cumple lo anterior. |
| Tercero | Persona o empresa que no cumple ninguna de las anteriores. |

- **Al vender:** el plan determina el precio por categoría según horas y cantidad de personas, en base a las tablas de Precios y Paquetes. El sistema **propone** la categoría y el precio, mostrando por qué; el usuario puede cambiarla. **La categoría aplicada se guarda con la venta** como histórico.

## 3. Cuánto gana el profesor

Para profesores de Tropicana y externos por igual, el plan elige una de estas formas de pago:

- **(a) Fee por hora:** monto fijo por hora. El valor del fee vive en el profesor.
- **(b) % sobre el margen:** porcentaje sobre (precio de venta neto de descuentos − costo de sala de las horas vendidas). Si se descuenta o no el costo de sala lo define el plan.
- **(c) Monto fijo por membresía.**
El mismo esquema vale para talleres. El **momento** en que se paga lo define el criterio de liquidación (sección 6).

## 4. Precios base

- **Clases particulares:** por tramos según las horas compradas.
- **Alquiler de sala:** tramos por cantidad de personas (hoy Individual 1, Pareja hasta 2, Grupo hasta 16; **los nombres de los tramos deben poder editarse**) y tramos por cantidad de horas.

## 5. Talleres

- Serie de una o más sesiones con objeto específico, fechas predefinidas, inicio y fin.
- Calendario: N sesiones con fecha, hora, duración y sala fijadas al abrirlo a la venta.
- Profesor propio o externo; salas propias o externas (una sala externa tiene costo de alquiler).
- Cupo máximo de inscripciones.
- Activo mientras acepta inscripciones; **concluye** cuando se dictó su última sesión y se cobraron todas sus membresías.

## 6. Criterios de liquidación (los elige el plan)

Cada plan elige un criterio de una lista. "Período vencido" significa: se paga en la liquidación del período siguiente, donde el período (semana, mes o membresía) lo fija el parámetro del sistema ya existente.

| # | Etiqueta sugerida para el selector | Qué significa | Aplica a |
| --- | --- | --- | --- |
| 1 | Al completar la membresía — período vencido | Se liquida cuando la membresía se agotó y está totalmente cobrada (completada). Se paga al cierre del período. | Todos (hoy lo usan los cursos regulares) |
| 2 | Proporcional al avance — período vencido | Se liquida la parte proporcional al avance de la membresía, siempre que esté totalmente cobrada. Se paga al cierre del período. | Todos |
| 3 | Al completar la membresía — inmediato | Igual que el 1 (agotada + totalmente cobrada), pero se paga al completarse, sin esperar el cierre del período. | Todos |
| 4 | Taller: al completar el taller, sobre lo cobrado | Cuando se dictaron todas las sesiones del taller se liquida y paga de inmediato lo cobrado; lo que se cobre después genera una nueva liquidación. | Solo talleres |
| 5 | Taller: monto fijo al completar el taller | Al completarse el taller se paga el monto acordado con el profesor. | Solo talleres |

> Los criterios 1 a 3 consideran cada membresía individualmente, aunque incluya varios alumnos (pareja o grupo). Los criterios 4 y 5 son para talleres, con muchos compradores. Toda membresía tiene un único titular, típicamente quien compra. Los criterios 4 y 5 solo deben ofrecerse en el selector cuando el plan es de tipo taller.

## 7. Clases particulares

### 7.1 Qué se releva al vender

- Qué quiere aprender y qué estilo (baile social, coreografía, vals u otros).
- Participación: individual, pareja, grupo reducido o numeroso.
- Ubicación: salas de la escuela y/o ubicación externa (puede sumar costos de traslado, transporte y equipamiento).

### 7.2 Alcance de una membresía de particulares

- **Horas totales contratadas:** es el contador y lo que más pesa en el precio.
- **Número de sesiones y duración:** ordenan, no cuentan.
- **Forma de venta:** horas sueltas, paquetes o programas de duración determinada (lo no usado se pierde).
- **Horarios:** como mínimo la primera clase; el resto a pedido si el plan lo permite, o un cronograma fijo si el plan lo exige.
- **Salas:** las sesiones pueden repartirse en varias salas propias y/o externas (ver sección 9).

### 7.3 Extensión de una membresía ya vendida

Una membresía ya inscrita puede extenderse durante su ejecución, dentro de los márgenes que fija su plan. Ejemplo: un plan de boda incluye 4 horas en Tropicana y 1 en el salón; el cliente pide más clases para afianzar la coreografía. Como el paquete tenía precio especial, lo adicional se cobra a precio de lista o con un recargo unitario, según defina el plan.

### 7.4 Membresías con varios asistentes

- Hay un titular obligatorio. Los demás asistentes se registran uno a uno o no, según el plan.
- No se toma asistencia individual: la sesión se da por dictada salvo que no asista nadie, tratando al grupo como un todo.
- No afecta la liquidación al profesor.

### 7.5 Modalidades de reserva (las fija el plan)

- **A — Agenda fija:** días, horarios y periodicidad desde el inicio; las sesiones quedan programadas hasta completar el paquete.
- **B — Reserva flexible:** se reserva cada sesión según disponibilidad del cliente, del profesor y de la sala, hasta consumir el paquete o hasta que venza.

## 8. Reservas

### 8.1 Flujo

- **1. Contratación:** la membresía crea sesiones disponibles para reservar.
- **2. Solicitud:** al vender o después; la origina la agenda fija, el alumno, el personal o una reprogramación.
- **3. Validación:** profesor sin choque con sus cursos ni con otras reservas; sala propia libre y con capacidad (las externas no se validan); saldo de horas y membresía vigente.
- **4. Confirmación:** se agenda, se bloquean sala y profesor, y **se descuenta la sesión del saldo**.

### 8.2 Estados

| Estado | Quién / cuándo | Efecto sobre el saldo |
| --- | --- | --- |
| Solicitada | Pedida (alumno, personal o agenda fija), sin confirmar. | No descuenta. |
| Confirmada | Todos los recursos asignados. | Descuenta al confirmar. |
| Reprogramada | El alumno pidió cambiar fecha u horario y ya tiene la fecha nueva, confirmada. Es un historial sobre una reserva confirmada. | Sigue descontada (una sola sesión). |
| Reagendar | El alumno pidió a tiempo suspender su clase pero todavía no tiene fecha nueva. Mismo efecto que Suspendida; aclara que lo pidió el alumno. | La sesión vuelve al saldo; requiere una nueva reserva. |
| Suspendida | Por decisión de Tropicana: profesor no disponible, conflicto operativo o sala fuera de servicio. Libera los recursos y deja historial. | La sesión vuelve al saldo; requiere una nueva reserva. |
| Ausente | El alumno no asistió. | Consume la sesión. |
| Realizada | La clase se dictó. | Consumida. |

### 8.3 Cancelación a pedido del alumno

- **Dentro del plazo** (parámetro, hoy 8 horas): pasa a **Reagendar**; la sesión vuelve al saldo y se liberan sala y profesor.
- **Fuera del plazo:** la sesión se da por consumida y se registra el incumplimiento.

### 8.4 Disponibilidad del profesor

- En esta etapa alcanza con validar que no choque con sus cursos ni con sus otras reservas.
- Se notifica al profesor antes del agendamiento (al principio, verbalmente) y después (mensaje). Más adelante: horario de disponibilidad declarado por el profesor.

## 9. Salas

- **Salas propias:** una sala no puede tener dos reservas a la vez; la capacidad debe alcanzar para los participantes. Configuración: nombre, capacidad, características, equipamiento, estado operativo.
- **Salas externas:** existe una sala externa genérica; al vender se le agrega un nombre descriptivo para esa membresía (ej. "Salón Conquistador — Hotel Los Tajibos"). No se valida su ocupación.
- **Reparto:** las sesiones de una misma membresía pueden agendarse en varias salas, propias (con validación) y/o externas (sin validación).

## 10. Políticas y horario hábil de notificaciones

- **Cancelación:** con al menos 8 horas de anticipación (parámetro).
- **Recordatorio:** por WhatsApp, al menos 10 horas hábiles antes de la reserva (parámetro).
- **Vigencia de paquetes:** la fija la política (ej. 2 o 3 meses); lo no usado vence. Se avisa antes y después del vencimiento.
- **Horario hábil de notificaciones:** se modela reusando la lógica del horario de salas (patrón semanal + excepciones). Es un espacio de tiempo que no se reserva, pero ofrece disponibilidad igual que una sala. Sobre él se calculan las "horas hábiles" de recordatorios y avisos no urgentes.

## 11. Costos adicionales y video (Servicios Especiales)

Estos conceptos pertenecen principalmente a los Servicios Especiales (etapa siguiente): recursos humanos adicionales, logística y traslados, equipamiento propio o de proveedores, producción (video, edición de música), terceros subcontratados, y los servicios de video (coreografía, evento, institucional). Se conservan acá para no perderlos.

## Anexo A — Parámetros

| Parámetro | Valor | Para qué |
| --- | --- | --- |
| Días de gracia de categoría (alumno / profesor) | 7 | Conservar la tarifa especial después de cerrar la membresía o el curso |
| Período de liquidación | Ya existe en el sistema | Define "período vencido" (semana, mes o membresía) |
| Anticipación mínima para cancelar | 8 horas | Dentro del plazo → Reagendar; fuera → sesión consumida |
| Anticipación del recordatorio | 10 horas hábiles | Recordatorio por WhatsApp |
| Vigencia del paquete | 2–3 meses | Vencimiento del saldo de horas |
| Nombres de tramos de personas | Editables | Individual / Pareja / Grupo |

## Anexo B — Alcance por etapas

| Etapa | Incluye |
| --- | --- |
| Primera entrega (C3) | Planes de particulares con plantillas personalizables al vender; alquiler de sala; talleres; reservas con los siete estados; reparto de sesiones en salas propias y externas; extensión de membresías; los cinco criterios de liquidación y las tres formas de pago al profesor; categoría de alquiler propuesta por el sistema y guardada con la venta. |
| Después | Armado libre de planes al vender; Servicios Especiales con cotización; agenda de disponibilidad declarada del profesor; costos adicionales y servicios de video; recordatorios automáticos (dependen del esquema de notificaciones). |

