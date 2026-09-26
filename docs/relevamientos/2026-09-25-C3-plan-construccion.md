# C3 — Plan de construcción: contraste con el repo y hitos

*Complementa `2026-09-25-C3-definiciones-v2.md` (las definiciones de negocio).
Este documento es el análisis técnico: qué choca con el repo hoy, con
evidencia, y el plan propuesto en hitos. Sin construir; espera el OK de
Javier. Armado 2026-09-25.*

---

## 1. Choques con el repo (evidencia)

| # | Tema | El v2 dice | El repo hoy | Choque |
|---|---|---|---|---|
| 1 | Tipo de servicio | Todo por plan, 5 tipos | `planes.tipo_servicio` admite 5 valores (`0010:43-46`), pero **todo el código fuerza `curso_regular`**: `planes/acciones.ts:85`, `planes/page.tsx:23`, `inscribir/page.tsx:33`, `cursos/acciones.ts:172,197`. `DatosPlan` ni siquiera tiene el campo (`tipos.ts:445`). | La pantalla de Planes y el mostrador de venta hay que abrirlos a los otros tipos. |
| 2 | Tablas de la 0035 | Todo se vende por plan | `paquetes_particular` y `alquileres_sala` no tienen `plan_id` (`0035:139-186`). En código solo las **cuenta** `/precios`, para saber si una tarifa se puede borrar (`precios/page.tsx:72-79`). No hay ningún insert. 0 filas en dev. | Son un camino de venta sin plan, justo lo que el v2 prohíbe. **Se reemplazan** por membresías de plan. |
| 3 | Titular de la venta | "Toda membresía tiene un único titular"; se le alquila a terceros y a profesores | `membresias.alumno_id` es `NOT NULL` (`0006:18`) | **Resuelto por la decisión del 25/09** (ver `DECISIONES.md`, fila "C3 — definiciones v2"): el titular pasa a ser un contacto; `alumno_id` queda obligatorio solo donde el servicio da clases a un alumno. |
| 4 | Criterio de liquidación | 5 criterios; el 4 y el 5 solo para talleres | Check `between 1 and 4` (`0010:47-48`, también en `comisiones_devengadas.criterio`). El motor **solo implementa el 1**: `liquidaciones/acciones.ts:43` y `criterio: 1` hardcodeado en `:627`. `planes.criterio_liquidacion` se guarda pero nunca se lee. | Hay que ampliar el check a 1–5, atar el 4 y el 5 a `tipo_servicio='taller'`, y escribir los criterios 2 a 5. |
| 5 | Período vencido | Lo fija el parámetro existente (semana, mes o membresía) | El parámetro existe: **`periodicidad_liquidacion`** (`0010:222`, valor `mes`). Se lee (`liquidaciones/acciones.ts:536`), pero **solo como etiqueta**. El rango está hardcodeado a mes calendario (`primerDiaMesVencidoISO` y `finMesVencidoISO`, `:31-41`). | Si alguien lo cambia a "semana", el cálculo no cambia: es una capacidad que miente (calidad 5). Hacer que el rango lo respete **también toca los cursos regulares**. |
| 6 | Estados de reserva | 7 estados | `check (estado in ('reservada','dictada','cancelada'))` (`0035:208`). **Ninguno de los 7 existe.** El EXCLUDE usa `where estado <> 'cancelada'` (`0035:238`). No hay historial. `cancelarReservaSala` solo opera bloqueos (`sala/acciones.ts:329`). | Hace falta un check nuevo, redefinir qué estados ocupan la sala y una tabla de historial. Los bloqueos existentes (que ya están en producción) necesitan su propio par de estados. |
| 7 | Descuento de la sesión | Descuenta al confirmar y se devuelve en Reagendar o Suspendida | Existen `horas_usadas` en la 0035, pero ningún código ni trigger las mueve | Se construye desde cero. Propuesta: **el saldo se calcula** desde las reservas, no se guarda paso a paso, igual que el fin de ciclo (regla 4). |
| 8 | Varias salas y sala externa | Sesiones repartidas en salas propias y externas; la externa es genérica, con nombre por membresía (o por plan, en talleres) y sin validar | `reservas_sala.sala_id NOT NULL` (`0035:199`). Todas las funciones de `sala.ts` trabajan con una sola sala. "externa" no aparece en ningún lado. | Hacen falta `salas.es_externa` más una sala externa sembrada, el nombre descriptivo, y que el EXCLUDE y `choquesCon` salteen la externa. |
| 9 | Categoría de alquiler | Los tramos de personas tienen nombres editables; el sistema propone la categoría y la guarda | `sala_tarifas.categoria` es un check de 4 literales (`0035:121`), sin FK. Existe el catálogo `categoria_comprador` con esos 4 valores y etiquetas (`0001:119-122`). `sala_tamanos.etiqueta` existe, pero **`/precios` solo edita `max_personas`** (`precios/acciones.ts:180-186`). | Las **claves quedan fijas**, porque la regla que propone la categoría depende de ellas. Los **nombres** salen de `catalogo_valores.etiqueta` y de `sala_tamanos.etiqueta`, y hay que hacerlos editables. No se guarda nada de la categoría en la venta todavía. |
| 10 | Pago al profesor | Fee por hora (en el profesor), % sobre margen o monto fijo (en el plan) | `profesores.comision_particular_pct` más el parámetro de default (`0035:272-279`), **sin ningún uso en `src/`**. No existe fee por hora. | Se reemplaza: `profesores.fee_hora`, y en el plan `forma_pago` + `pct_margen` + `descuenta_sala` + `monto_fijo`. `comision_particular_pct` queda OBSOLETA. |
| 11 | Handoff de agosto | — | El mockup (`docs/design/Vender servicio.dc.html`, `Confirmar sesión.dc.html`):<br>• elige la categoría a mano;<br>• trata al tercero como texto libre;<br>• vende una tarifa suelta sin plan;<br>• no tiene selector de sala;<br>• usa duraciones fijas 1/2/4/8 y 0,5/1/2 h;<br>• acredita la comisión en cada sesión y le cobra al profesor un "paquete de sala". | Contradice el v2 y las reglas 8, 13 y 21 en esos seis puntos. Ver §3. |
| 12 | Horario hábil | Reusar patrón + excepciones | La lógica ya es genérica: `ventanasDelDia` y `dentroDelHorario` (`sala.ts:289,332`) no reciben `sala_id`, y `horarios.ts` es puro. Lo que está atado a la sala son las **tablas** (`sala_horario_patron.sala_id NOT NULL`, `0036:45`) y las acciones. | Barato: reusar la misma lógica y una sala de tipo `calendario` que no se reserva, más que duplicar tablas. El v2 lo describe como "un espacio que no se reserva pero ofrece disponibilidad igual que una sala". |
| 13 | Suspender una reserva | Suspendida por decisión de Tropicana | `ejecutarSuspension` está atada a `curso_id`, `sesiones` y `membresia_cursos` (`asistencia/acciones.ts:1004`). `calcularImpacto` no mira reservas (R1). | Hace falta una acción propia para suspender una reserva, y extender `calcularImpacto`. Cierra el lado reservas de C5. |
| 14 | Talleres | Plan con calendario fijo, cupo, criterios 4 y 5 | Solo existen como valor de enum y como motivo de Caja (`0010:45`, `0020:36`, `caja.ts:20`). No hay tabla, pantalla ni mockup. | Se construye todo; necesita Design. |

---

## 2. Plan de C3 por hitos

**Backlog que toca (regla de proceso 10):**
- **D5** se termina en H2.
- **D9**: el caso de particulares queda resuelto en H2; D4 sigue abierta para el resto.
- **D11**: la política de asistentes del plan en H1 le da el modelo (caso distinto, prueba grupal sigue igual).
- **R1 y R22** (lado reservas de C5) en H4.
- **R20 y R21** (notificaciones y copiar para enviar): cada aviso de reserva lleva su botón de copiar (regla 12).
- **R27** (composición de "Por pagar") en H5.
- **R11 y R19** (precios): se tocan en H7.
- **R2** (agenda visual, C4) va después de H4.
- **D23**: el documento de un tercero empresa no se exige en C3.
- **D4, D13, D22, D26:** no se tocan.

**Principio de orden.** Primero lo que Natalia necesita: planes de
particulares con plantillas, su venta y su reserva con estados. Después la
plata. Alquiler y talleres van al final porque reusan lo anterior. Cada hito
se valida y pasa a producción por separado.

### Decisiones de Javier (25/09) que gobiernan el diseño

1. **El titular de la membresía es un contacto** (regla 21).
   - Migración de H2: `membresias.contacto_id NOT NULL`, rellenado desde
     `alumnos.contacto_id`.
   - **El rol alumno se adquiere solo al comprar**: quien es titular de una
     membresía de curso regular, particular, taller o prueba pasa a ser
     alumno automáticamente (la venta crea la fila en `alumnos` si hace
     falta); en esos tipos `alumno_id` queda obligatorio, con un check según
     `tipo_servicio`.
   - **En alquiler no aplica**: el titular queda solo como contacto y no
     entra al padrón.
   - **En servicios especiales** (etapa siguiente) puede ir de las dos
     maneras según quién compra.
   - Antes de aplicarla, ensayo en seco en producción, como con la 0048.
2. **Una Solicitada ya ocupa la franja (sala y profesor), con una validez
   máxima.** *"No tiene sentido ver disponibilidad y tomar la decisión de
   actuar en base a un espacio disponible mientras coordino los demás
   recursos, y que cuando todo esté coordinado el espacio horario ya se
   asignó a otra persona."*
   - `reservas_sala.solicitada_hasta` = creación + parámetro nuevo
     `reserva_solicitud_validez_horas`, **24 horas** por defecto (Javier,
     25/09), sembrado por migración.
   - Mientras está vigente, ocupa: la validación de choque cuenta las
     Solicitadas vigentes.
   - Al vencer se libera sola sin cambiar de estado (se calcula, no se
     guarda paso a paso); confirmarla exige volver a validar.
   - El EXCLUDE de la base cubre los estados confirmados; dos solicitudes
     sobre la misma franja las frena el código al crearlas.
   - No descuenta saldo hasta confirmarse.
3. **Cancelación fuera de plazo → Ausente**, con una marca "canceló fuera de
   plazo" en el historial. Se mantienen los 7 estados, no un octavo.
4. **Code v1 + Design refina** para las pantallas que reemplazan el handoff
   (venta y reservas), como se decidió el 12/09. **Talleres (H8) pasa por
   Design antes**, sin mockup de donde partir.
5. **Alquiler con el mismo tratamiento de reservas que las particulares**
   (horas vendidas/consumidas, los 7 estados, cierres, cancelaciones). **En
   talleres la reserva de sala es del plan**, no de cada membresía: se agenda
   al abrirlo y vale para todos los inscritos; la sala externa, si aplica, se
   nombra en el plan.
   - Consecuencia para H3: una reserva cuelga de exactamente una de estas
     tres cosas, con un check que exige una sola: una **membresía**
     (particular/alquiler), un **plan** (taller), o **nada** (bloqueo, con
     motivo). El saldo de horas se calcula por membresía; las reservas de un
     taller no descuentan saldo a nadie.
6. **Cada slot horario es una reserva independiente** *(Javier, 25/09)*.
   Aunque se pidan varios slots juntos al planificar una membresía, cada uno
   es su propia fila en `reservas_sala`, con su estado, sala, profesor e
   historial. Por eso cada uno se reagenda, suspende, cambia de sala o pasa a
   una sala externa sin tocar a los demás. Vale para particulares (salas
   propias o externas), alquileres y talleres. Las particulares descuentan
   **horas de clase** y los alquileres **horas de alquiler** de su
   membresía, según el tipo: es el mismo mecanismo con distinto nombre.

### Hitos

> **H1: ✅ construido y validado en dev por Javier (2026-09-25).** Migración
> `0052_plantillas_particulares.sql`, commits `cd9a179` y `ecb8566` (el
> segundo, el ajuste de rótulo de las tarifas del profesor que pidió al
> validar). Detalle completo en `docs/ESTADO.md`, sección "C3 — H1:
> plantillas de plan de particulares". Sin pase a producción todavía.

> **H3: construido y verificado en dev, esperando validación de Javier en su
> local (2026-09-26).** Migración `0054_reservas_siete_estados.sql`, con los
> 7 estados recorridos de punta a punta en el navegador contra datos reales.
> Detalle completo en `docs/ESTADO.md`, sección "C3 — H3: reservas con los 7
> estados". Sin pase a producción — se acumula con H1 y H2 hasta el OK
> explícito de Javier.

| Hito | Qué | Migración | Pantallas | Permisos | Design |
|---|---|---|---|---|---|
| **H1** Plantillas de plan de particulares | La pantalla de Planes se abre a `tipo_servicio`, con un formulario de plan particular. Todo lo que se personaliza al vender queda configurable en la plantilla: horas y tramos desde `tarifas_particular`, vigencia, modalidad de reserva A o B, salas permitidas, forma de pago al profesor, criterio 1–3, reglas de extensión y política de asistentes. | **Sí:**<br>• columnas de particular en `planes`;<br>• `criterio_liquidacion` 1–5 con check de taller;<br>• `profesores.fee_hora`;<br>• `comision_particular_pct` OBSOLETA;<br>• parámetros nuevos (gracia 7 d, cancelación 8 h, vigencia default) sembrados por migración (calidad 7). | Planes: filtro o pestaña por tipo más el formulario particular. Ficha del profesor: fee por hora. | `planes` (existe) | Code v1 + Design refina |
| **H2** Vender un plan de particulares | Se elige la plantilla y se personaliza: horas, salas propias o externas con nombre, estilo y profesor, vigencia, inicio y **primera reserva**, o el calendario cerrado si es agenda fija. Crea la membresía, su cuota con motivo `clase_particular` (D5) y la tarjeta de confirmación específica (D9). | **Sí:**<br>• `membresias.contacto_id`;<br>• snapshot de horas, vigencia, forma de pago y precio;<br>• `salas.es_externa` + capacidad + sala externa sembrada;<br>• `membresia_salas` (sala y nombre descriptivo);<br>• se eliminan `paquetes_particular` y el FK de `comisiones_devengadas.paquete_particular_id`, después de medir 0 filas en las dos bases. | "Vender servicio" **reemplaza** al handoff: se vende un plan, no una tarifa. Vive como pestaña de `/inscribir`. | `particulares` (ya existe sin pantalla) | Code v1 + Design refina |
| **H3** Reservas con 7 estados | Solicitar, confirmar, reprogramar, reagendar, suspender, marcar ausente o realizada. Valida:<br>• sala propia libre y con capacidad;<br>• externa sin validar;<br>• profesor sin choque con sus cursos ni sus reservas;<br>• saldo y vigencia.<br>La Solicitada ocupa hasta su validez (decisión 2). La cancelación a pedido respeta el plazo de 8 h y deja Ausente con marca (decisión 3). Todo cambio deja historial, y cada aviso trae su texto para copiar. | **Sí:**<br>• `reservas_sala` gana el check de "membresía XOR plan XOR bloqueo" (decisión 5), `profesor_id`, `solicitada_hasta` y el check de 7 estados; los bloqueos conservan su par de estados;<br>• parámetro `reserva_solicitud_validez_horas` (24 h);<br>• EXCLUDE solo sobre los estados que ocupan la sala y sin la externa;<br>• `reservas_historial`;<br>• el saldo se calcula (`src/lib/reservas.ts` nuevo, con pruebas). | "Reservas de la membresía" (nueva), que **reemplaza a Confirmar sesión**: ya no hay duraciones fijas ni comisión por sesión, y el estado reemplaza al botón "dictada". `/sala` muestra las reservas en su lista textual. | `particulares` para reservas; `sala` para bloqueos | Code v1 + Design refina |
| **H4** Cierres de sala sobre reservas (C5 lado reservas) | Un cierre o un bloqueo que pisa reservas las lista, pide confirmación y las pasa a **Suspendida**, que devuelve la sesión al saldo, con aviso para copiar. Si se borra la excepción, se ofrece revertir (R22). | No | La confirmación de cierre existente en Administración → Sala | `sala` | No |
| **H5** Liquidación de particulares | Criterios 1, 2 y 3 y formas de pago a/b/c en el motor. El rango del período respeta `periodicidad_liquidacion`: solo `mes` es válido hasta que se pruebe el resto. La cuenta del profesor suma particulares, con un desglose en "Por pagar" (R27). | **Sí:** `comisiones_devengadas` con `membresia_id` para particulares y el check del criterio 1–5 | Liquidaciones y comprobante: renglones de particulares | `liquidaciones` | No |
| **H6** Extensión de membresía | Sumar horas a una membresía viva, a precio de lista o con recargo según el plan. Genera su propia cuota. | Sí, chica: registro de extensiones | Acción "Extender" desde la membresía | `particulares` | No |
| **H7** Alquiler de sala | Plan de tipo alquiler. La categoría la **propone el sistema**, con el porqué y los días de gracia, y queda guardada con la venta. Los nombres de los tramos y de las categorías se editan en `/precios`. Mismo tratamiento de reservas que las particulares (decisión 5): H3 se construye genérico desde el principio, así que H7 solo agrega la venta y la categoría. | **Sí:**<br>• columnas de alquiler en `planes`;<br>• `membresias.categoria_aplicada`;<br>• se elimina `alquileres_sala` (0 filas);<br>• se deja de exigir `sala_tarifas.categoria` como check, pasa a validarse contra el catálogo. | Venta de alquiler, que es la segunda mitad de "Vender servicio" y **reemplaza** al handoff. `/precios`: etiquetas editables. | `particulares` o uno nuevo, `alquileres` *(se decide en H7)* | Code v1 + Design refina |
| **H8** Talleres | Plan de tipo taller con calendario fijo de N sesiones (fecha, hora, duración, sala), cupo, criterios 4 y 5, y cierre cuando se dictó la última sesión y se cobró todo. Las reservas de sala son del plan, no de cada membresía (decisión 5): se reservan al abrirlo a la venta y valen para todas las membresías inscritas; si alguna sesión es afuera, se usa la sala externa con su nombre en el plan. | **Sí:**<br>• columnas de taller en `planes`;<br>• `reservas_sala` admite `plan_id`, además de `membresia_id` y del bloqueo;<br>• `plan_salas` (sala y nombre descriptivo), que espeja a `membresia_salas`. | Talleres: abrir, vender o inscribir, ver cupo, tomar asistencia | módulo nuevo `talleres` | **Design-first** (no hay mockup) |
| **H9** Horario hábil | Un calendario "hábil" con la misma lógica que el horario de sala, que no se reserva. Sobre él se calcula "10 horas hábiles antes". Se usa para mostrar cuándo corresponde recordar; el envío automático queda en R32. | Sí, chica | Administración → horario hábil | `administracion` | No |

### Cómo se verifica cada hito
- `tsc`, lint y `npm test`, con pruebas nuevas del saldo y los estados (`reservas.ts`) y de los criterios del motor.
- Migración en dev y `scripts/control_migracion.sql`, con controles nuevos para el saldo de reservas y los criterios.
- Navegador con Playwright en dev (`qa-cloud@tropicana.local`), recorriendo el flujo del hito.
- Javier valida en dev. El pase es en un solo push (`DECISIONES.md` §3).

---

## 3. Pantallas que cambian respecto del handoff de agosto

**Vender servicio:**
- se vende un plan, no una tarifa;
- la categoría se propone, no se elige;
- el tercero es un contacto (regla 21);
- aparecen salas propias y externas;
- se reserva la primera sesión;
- no hay "paquete de sala" del profesor.

**Confirmar sesión** pasa a ser la **gestión de reservas**:
- siete estados en vez de un botón "dictada";
- la duración sale del intervalo estándar, no de 0,5/1/2 fijos;
- no se acredita comisión por sesión: se liquida según el criterio elegido en
  el plan (reglas 8 y 16).
