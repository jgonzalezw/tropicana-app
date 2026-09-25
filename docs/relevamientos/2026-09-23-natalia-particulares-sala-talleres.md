> **Reemplazado** por las definiciones v2 del 25/09
> (`docs/relevamientos/2026-09-25-C3-definiciones-v2.md`). Se conserva como
> historia; su Anexo B quedó resuelto por el v2. Lo que vale es el v2.

# Relevamiento con Natalia — clases particulares, alquiler de sala y talleres

**Fecha:** 23/09/2026, 17:00–19:00 · **Participantes:** Natalia, Javier.

## 1. Categoría del cliente para tarifas especiales de alquiler
La tarifa de sala depende de la categoría de quien alquila. **La categoría se
valida, no se elige**:

| Categoría | Se cumple si… |
| --- | --- |
| **Alumno** | tiene una membresía activa en algún curso regular, **o** en un plan de clase particular, **o** cerró alguna de las dos en los últimos **7 días** (parámetro). |
| **Profesor de Tropicana** | tiene cursos regulares asignados activos, **o** planes de clases particulares vendidos por Tropicana activos, **o** cursos regulares asignados que cerraron hace **7 días** o menos (parámetro). |
| **Profesor externo** | profesor que no cumple lo anterior. Puede dar clases particulares, con condiciones distintas a las de un profesor de Tropicana. |
| **Tercero** | persona o entidad (empresa) que no cumple ninguna de las anteriores. |

## 2. Cuánto gana el profesor por las particulares que vende Tropicana
- **Profesor de Tropicana**, una de estas dos opciones:
  - (a) su **fee por hora** (monto fijo);
  - (b) opcionalmente, un **% de comisión sobre la diferencia** entre el precio
    de venta neto de descuentos y el costo de sala de las horas vendidas (a
    tarifa de profesor de Tropicana).
- **Profesor externo:** Tropicana puede vender clases particulares especiales
  aprovechando profesores externos. Ejemplo: profesores extranjeros que vienen
  a eventos en la ciudad y con los que se acuerda ofrecer clases o talleres. Se
  le paga un **monto fijo por cada membresía**. **El mismo criterio vale para
  talleres.**

## 3. Precios base
- **Clases particulares:** el precio base va por **tramos según las horas
  compradas** en el paquete o membresía, según lo que ofrezca el plan.
- **Alquiler de sala** (ya modelado):
  - Tramos **por cantidad de personas**. Hoy son tres: Individual (1), Pareja
    (hasta 2) y Grupo (hasta 16). **El nombre de cada tramo tiene que poder
    cambiarse.**
  - Tramos **por cantidad de horas vendidas**.

## 4. Talleres
- **Qué es:** una serie de una o más clases, con duración y fechas
  predefinidas, e inicio y fin determinados.
- Tiene un **objeto específico**.
- **Calendario:** N sesiones con fecha, hora, duración y sala fijadas **al
  abrirlo a la venta**.
- Lo dicta un profesor **propio o externo**.
- Se dicta en **salas propias o externas**; una sala externa tiene costo de
  alquiler.
- Recibe inscripciones hasta un **cupo máximo**.
- **Está activo** mientras está abierto a inscripciones. **Concluye** cuando se
  dictó su última sesión **y** se cobraron todas sus membresías.

## 5. Cómo se liquidan comisiones y fees: lo define el plan
1. **Como hoy:** plan agotado + pagado = completado. Se paga al cierre del
   período (mes vencido).
2. **Proporcional al avance de la membresía** por el paquete vendido con el
   plan, completamente cobrado, **al cierre del período (mes vencido)**.
   *(Corregido por Javier al revisar esta versión.)*
3. **Proporcional al avance de la membresía** por el paquete vendido con el
   plan, completamente cobrado. *(Texto original de las notas; ver Anexo B,
   punto 1.)*
4. **Al completarse la cobranza del taller** (solo talleres).

## 6. Módulo de clases particulares

### 6.1 Objetivo
Un cliente contrata clases de baile para aprender una disciplina o preparar
una presentación, coreografía o evento. Puede ser individual, en pareja o en
grupo, en las salas de la academia o en una ubicación externa.

### 6.2 Qué se releva cuando alguien pide particulares
- **Qué quiere aprender** y **qué estilo**: baile social, coreografía, vals u
  otros.
- **Participación:** individual, pareja, grupo reducido o grupo numeroso.
- **Ubicación:** sala de la escuela, o ubicación externa que pone el cliente.
  Fuera de la escuela pueden sumarse costos de tiempo de traslado, transporte,
  desplazamiento del profesor y equipamiento adicional.

### 6.3 Tipos de servicio
| | Aprendizaje y perfeccionamiento | Preparación de coreografías |
| --- | --- | --- |
| Para quién | Aprender una disciplina, mejorar la técnica, practicar un estilo | Eventos: bodas, quinceaños, presentaciones, eventos empresariales, producciones audiovisuales |
| Preparación del profesor | Poca; planificación estándar | Diseño de coreografía, a veces edición de música, más horas de planificación |
| Costo | Principalmente horas de clase + sala | Mayor que una clase convencional |

### 6.4 Alcance que define una contratación
- **Horas totales contratadas.** Es el **contador**, y lo que más pesa en el
  precio.
- **Número de sesiones y duración de cada una.** La cantidad de clases es un
  **ordenador**, no el contador. Pesa más cuando las clases son fuera de sala,
  porque arrastran costos adicionales.
- **Forma de venta:**
  - horas sueltas;
  - paquetes de clases;
  - programas de duración determinada: **si no se usan las horas, se pierden**.
- **Ubicación:** cuántas clases en sala y cuántas externas.
- **Horarios:** como mínimo, la **primera clase**. El resto se reserva a
  pedido, según la disponibilidad del profesor y de la sala, si el plan lo
  permite. El plan también puede exigir un cronograma (días, franja horaria,
  frecuencia semanal; ej.: martes y jueves a las 20:00).

### 6.5 Modalidades de reserva (las fija el plan)
- **A — Agenda fija:** días, horarios y periodicidad desde el inicio. Las
  clases quedan programadas hasta completar el paquete.
- **B — Reserva flexible:** el cliente compra el paquete y reserva cada sesión
  según su disponibilidad, la del profesor y la de la sala, hasta consumir el
  paquete o hasta que venza.

## 7. Reservas de clases y salas

**Objetivo:** coordinar alumno, profesor y sala para que cada sesión pueda
dictarse sin superponer recursos.

**Recursos:**
- **Obligatorios:** saldo de horas en la membresía (una sesión pendiente), un
  profesor asignado y un horario disponible.
- **Opcionales:** una sala específica, un profesor adicional, equipamiento
  especial, servicios complementarios.

**Flujo:**
1. **Contratación.** El cliente compra horas o clases de cierta duración, un
   paquete o un programa. Desde ese momento hay sesiones disponibles para
   reservar.
2. **Solicitud.** Durante la inscripción o después. El origen puede ser la
   agenda fija, el propio alumno, el personal administrativo o una
   reprogramación.
3. **Validación**, antes de confirmar:
   - **Profesor:** sin otra clase en ese horario, con disponibilidad en ese
     horario y habilitado para el estilo.
   - **Sala:** libre en esa fecha y hora, con capacidad para los
     participantes.
   - **Sesiones:** quedan horas en la membresía y el paquete está vigente.
4. **Confirmación.** Se agenda la sesión, se bloquean la sala y los profesores,
   y se **descuenta la sesión del paquete**. La reserva queda **Confirmada**.

**Estados de una reserva:**

| Estado | Significa |
| --- | --- |
| Solicitada | Pedida (por el alumno, el personal o la agenda fija), todavía sin confirmar. *(Javier, al revisar: "Solicitada" describe mejor este estado que "Pendiente".)* |
| Confirmada | Todos los recursos asignados. |
| Reprogramada | Cambió la fecha, el horario o los recursos. |
| Cancelada | Anulada según las políticas vigentes. |
| Ausente | El alumno no asistió. |
| Realizada | La clase se dictó. |

**Reprogramación.** Se hace cuando la pide el alumno, el profesor no está
disponible, hay un conflicto operativo o la sala está fuera de servicio.
Libera los recursos anteriores, vuelve a validar la disponibilidad y deja
historial del cambio.

**Cancelación:**
- **Dentro del plazo:** la sesión vuelve al saldo del alumno y la sala y los
  profesores quedan libres.
- **Fuera del plazo:** la sesión puede darse por consumida, según la política
  comercial, y se registra el incumplimiento.

## 8. Salas
- **Cada sala configura:** nombre, capacidad máxima, características,
  equipamiento disponible y estado operativo.
- **Reglas:**
  - Una sala no puede tener dos reservas a la vez.
  - La capacidad tiene que alcanzar para los participantes.
  - Ciertos estilos pueden requerir una sala específica.
  - Ciertas actividades pueden requerir equipamiento determinado.

## 9. Políticas (todas parametrizables)
- **Cancelación:** con al menos **8 horas** de anticipación. Fuera de plazo, la
  clase se da por consumida.
- **Recordatorio:** por WhatsApp, como mínimo **10 horas hábiles** antes de la
  reserva.
- **Vigencia de los paquetes:** la fija la política; por ejemplo, 2 o 3 meses.
  Lo que no se usa dentro de la vigencia **vence y se pierde**. Se avisa al
  cliente **antes**, para prevenir la pérdida, y **después** de vencido.

## 10. Estructura de costos
- **Base:** valor por hora.
- **Adicionales:**
  - **Recursos humanos:** profesor adicional, asistente.
  - **Logística:** traslado, transporte, desplazamiento, recargo por clase
    fuera de sala.
  - **Equipamiento** (propio o de proveedores): parlantes, amplificación,
    equipos especiales.
  - **Producción:** registro de video, edición de video, edición de música
    para la coreografía.
  - **Terceros:** proveedores subcontratados, alquileres externos.
- **Grupos grandes:**
  - tarifas de sala por tramos y, si corresponde, tarifas de clase por tramos;
  - profesores adicionales;
  - más equipamiento;
  - servicios externos;
  - mayor costo logístico.

## 11. Servicios complementarios de video
- **Video de coreografía:** registro profesional, de unos 3 minutos.
- **Video de evento:** registro y material editado; puede incluir entrevistas.
- **Video institucional:** producción para promoción o comunicación
  institucional.

## 12. Modelo conceptual propuesto

| Entidad | Qué es |
| --- | --- |
| Cliente | Quien contrata. |
| **Contratación** | El acuerdo comercial que agrupa todo lo vendido. |
| Plan o paquete | Clases compradas, con vigencia. |
| Sesión de clase | Un evento concreto, con fecha y hora. |
| Participante | Alumno que toma la clase. |
| Profesor | Instructor asignado. |
| Ubicación | Dónde se hace la sesión. |
| Servicio adicional | Videos, alquileres, transporte, profesores extra, etc. |
| Proveedor externo | Terceros que prestan servicios complementarios. |
| Reserva | La fecha y hora asignadas a una sesión. |
| Pago | Cobros y condiciones comerciales. |

**Hallazgo de negocio.** La entidad central no es la clase particular sino la
**Contratación de servicio (plan)**. Una contratación puede sumar varias clases,
uno o más profesores, coreografía personalizada, video, equipamiento alquilado,
transporte y servicios de terceros.

**Dos flujos de venta, no uno** *(precisión de Javier al revisar esta
versión)*:
- **Venta directa**, el flujo normal y usual: se vende un plan de clases
  particulares, con horas que se consumen en una sala con un profesor. **No
  pasa por cotización.**
- **Venta con cotización**, para una realidad más compleja: eventos,
  coreografías, varios conceptos de costo. **Puede ser un tipo de plan
  distinto.** La cotización es el estado previo que tiene solo este flujo; no
  es un paso de toda venta.

**Estado previo del flujo con cotización.** Como una contratación para eventos
junta varios conceptos de costo, su membresía necesita un estado anterior,
**cotización**:
- se puede **enviar al cliente en formato comercial**, con todos los ítems
  ofertados;
- se puede **confirmar**, **modificar/recotizar** según la negociación,
  **cancelar** o **declarar perdida**;
- una cotización confirmada pasa a **activa** cuando se fijan las fechas y se
  declara el pago o el compromiso de pago.

---

## Anexo A — Parámetros mencionados

| Parámetro | Valor dicho | Para qué |
| --- | --- | --- |
| Días de gracia de la categoría (alumno / profesor) | 7 | Conservar la tarifa especial después de cerrar la membresía o el curso |
| Anticipación mínima para cancelar | 8 horas | Pasado ese plazo, la sesión se da por consumida |
| Anticipación del recordatorio | 10 horas hábiles | Recordatorio por WhatsApp |
| Vigencia del paquete | 2–3 meses | Vencimiento del saldo de horas |
| Nombres de los tramos de personas | editables | Individual / Pareja / Grupo |

## Anexo B — Puntos a confirmar
Son ambigüedades del relevamiento o choques con lo ya decidido o construido.
**No son decisiones**; entran como preguntas al plan de C3.

1. **Criterio 4 de liquidación.** El plan del motor (`PLAN_CIERRE_ETAPA1_v2_MOTOR.md`)
   definía el 4 como "pago inmediato por sesión, neto de sala (externo)"; el
   relevamiento lo define como "al completarse la cobranza del taller". La base
   ya tiene `planes.criterio_liquidacion` 1–4 (0010). Hay que decidir cuál vale.
   Después de la corrección de Javier, el 2 y el 3 dicen casi lo mismo
   ("proporcional al avance de la membresía, completamente cobrado"). La
   única diferencia escrita es que el 2 paga **al cierre del período (mes
   vencido)**. ¿El 3 paga **sin esperar el cierre** (a medida que avanza), o es
   otra cosa?
2. **La regla de negocio 8** hoy dice que la plata sale de membresías
   completadas y cobradas al 100% (criterio 1). Los criterios 2 a 4 la amplían:
   hay que registrarlo como decisión nueva.
3. **La particular como membresía de un plan.** El relevamiento habla de
   "membresía activa en plan de clase particular", y `planes.tipo_servicio` ya
   admite `particular`, `taller` y `alquiler` (0010). La 0035, en cambio, armó
   una tabla aparte, `paquetes_particular`, que hoy tiene 0 filas.
4. **Cuándo se descuenta la sesión:** ¿al confirmar la reserva (así dice el
   relevamiento) o al dictarla? Además:
   - ¿"Ausente" consume la sesión?
   - ¿"Reprogramada" es un estado o un historial sobre una reserva que sigue
     confirmada?
5. **Disponibilidad del profesor.** Hoy no existe una agenda declarada del
   profesor, solo sus cursos. ¿Alcanza en una primera versión con validar
   choques contra sus cursos y reservas?
6. **Fee del profesor de Tropicana.** La 0035 guarda `comision_particular_pct`
   (un % sobre el precio). El relevamiento pide fee fijo por hora o % sobre
   (precio neto − costo de sala). Falta saber dónde vive y si es por profesor o
   por plan.
7. **Categoría de alquiler.** El mockup de agosto la hace elegir a mano; el
   relevamiento dice que **se valida**. Además, `sala_tarifas.categoria` es un
   `check` fijo de 4 valores.
8. **Sala:** capacidad, características, equipamiento y estado no existen hoy
   en `salas`. **Ubicación externa**, **servicios adicionales**, **proveedores**
   y **cotización** son entidades nuevas. Falta definir el alcance de la
   primera entrega. Como la cotización es un flujo propio (otro tipo de plan),
   la venta directa puede salir sin ella.
9. **"10 horas hábiles"** necesita un calendario hábil. ¿Se usa el horario
   base de la sala (C1)?

