# Tropicana — decisiones tomadas y decisiones postergadas

Este archivo se carga en **toda** sesión (vía `CLAUDE.md`, junto con
`REGLAS.md`). Existe por un motivo concreto: Javier no tiene cómo acordarse de
todo lo que se decidió y quedó para después, y sin registro esas decisiones se
pierden y se vuelven a discutir, o peor, se contradicen sin que nadie lo note.

**Cómo se usa, y no es opcional:**

1. Una decisión **vigente** se respeta siempre. Solo cambia con **otra decisión
   explícita** de Javier, y entonces se edita acá con la fecha y el porqué.
   Nunca se cambia "sobre la marcha" ni porque en el momento parezca mejor.
2. Toda decisión **postergada** vive en la tabla de abajo con su **disparador**:
   cuándo conviene hacerla y qué la vuelve urgente.
3. **Todo plan que se le proponga a Javier abre mostrando el backlog** de
   decisiones postergadas que ese plan toca o vuelve más caras. Si ninguna
   aplica, se dice "ninguna" — pero se dice.
4. Cuando se cumple el disparador de una decisión postergada, **se avisa**, aun
   si nadie preguntó.

---

## 1. Decisiones postergadas (backlog)

> **Prioridad vigente (Javier, 2026-09-12).** *"D1 y D2 esperan."* (D2 quedó cerrada definitivamente el 2026-09-23.) Lo que manda
> es lo que Natalia necesita: **gestión de clases particulares** (rebanada 2D) y
> **validar/reservar la disponibilidad de la sala** (Paso 5). Las dos van juntas
> —vender una hora sin validar la sala es vender dos veces la misma hora—, así
> que atenderlo implica **adelantar el Paso 5**, entero o en una versión mínima.
> **D5, D6 y D7 ya están decididas** (2026-09-12) y salieron del backlog: ver
> §1.b. D6 además ya está construida y en producción.
>
> **Las tres respuestas están dadas (2026-09-12). Ninguna queda abierta:**
> 1. ~~D20 — ¿una sala o varias?~~ **RESPONDIDA**: una hoy, varias después; se
>    modela para N y se muestra para 1 (ver §1.b).
> 2. ~~**Alcance**~~ **RESPONDIDA**: **validación mínima de choque primero**, y
>    la agenda visual después sobre la misma base. Javier agregó el encuadre que
>    la gobierna: son **dos ejes** —la venta de paquetes de horas con sus
>    contadores, y un motor de calendario de sala— y *"podemos partir por el eje
>    de las ventas y contadores… y algún mecanismo de confirmación de sesiones
>    que luego lo integramos al eje visual"*. **La agenda visual no es opcional
>    ni lejana**: *"es una herramienta fundamental para Natalia por su vista.
>    Debe ir, ya es hoy un problema para ella."*
> 3. ~~**Diseño**~~ **RESPONDIDA**: **código v1 y Design refina**. Y se descubrió
>    que la pregunta era más chica de lo que parecía: *Vender servicio* y
>    *Confirmar sesión* **ya tienen diseño aprobado** en `docs/design/` desde el
>    30 ago 2026. Lo único sin mockup es la agenda de sala.
>
> **Lo que el diseño de agosto NO cubre, y hay que construir igual:** reservar
> una sesión **a futuro** (elegir fecha y hora al vender). *Confirmar sesión*
> solo registra que una sesión **ya ocurrió**. Es la pieza que une los dos ejes.
>
> Lo que ya está listo para apoyarse: `src/lib/horarios.ts` tiene `seSolapan`
> con el criterio de choque ya fijado (intervalo medio abierto: una clase que
> termina 20:00 y otra que empieza 20:00 **no** chocan), y `src/lib/sala.ts` +
> la migración **0035** ya resuelven el costo de sala y la ocupación.


| # | Decisión | Estado | Por qué se postergó | Disparador: cuándo hacerla |
| --- | --- | --- | --- | --- |
| D1 | ~~**Unificar el nombre de la membresía en lo YA EXISTENTE.**~~ **CERRADA el 2026-09-24.** Renombrado `inscripcion_id` → `membresia_id` en `asistencias`, `cuotas`, `pagos`, `corrimientos_ciclo` e `inscripcion_cursos`, y la tabla `inscripciones` → `membresias` (migración 0047), en dev y en producción. | **Cerrada** | — | — |
| D2 | ~~**Sacar el repo de OneDrive**~~ **CERRADA DEFINITIVAMENTE el 2026-09-23.** La mudanza se hizo el 2026-09-16 (miércoles, ~18:54): el repo vive en `D:\dev\tropicana-app`, clonado limpio; el `.env.local` quedó a salvo en un gestor de contraseñas (confirmado por Javier al arrancar el Paso 2D). El stash de la carpeta vieja se inspeccionó el 2026-09-18: estaba vacío (mismo contenido que su commit base), no había nada que rescatar. **La carpeta vieja de OneDrive ya fue eliminada** (Javier, 2026-09-23) — no queda ningún paso manual pendiente. La carpeta de handoff de Design **no se tocó** (`scripts/sync-design.mjs` sigue apuntando a la suya, que es otra carpeta). Procedimiento en `docs/MUDANZA_REPO.md`. | **Cerrada** | — | — |
| D3 | ~~**Renombrar `ClienteVentas.tsx`**~~ **CERRADA el 2026-09-24**, junto con D1: `MostradorVenta.tsx`, en dev y en producción. | **Cerrada** | — | — |
| D4 | **Generalizar el acceso al detalle**: hipervínculo o botón tipo "ojo", igual en toda lista de entidades. Hoy está suelto en Caja y en Alumnos. | Pendiente (pedido de Javier, 2026-09-08) | Es una decisión de diseño transversal: conviene que pase por Design. | Cuando se defina con Design, o cuando la tercera pantalla necesite el mismo gesto. |
| D5 | **Clasificar mejor el motivo del cobro** en el recibo: Membresía, Clase Particular, Clase de Prueba, Alquiler, Taller, Venta Producto, Ajuste. | **DECIDIDA — Javier confirmó el 2026-09-12** (*"Correcto"*). Falta construirla. | Se resolvió lo urgente (que el motivo elegido no se descarte). | **Se construye junto con los particulares (2D)**: es el primer servicio que deja corto el catálogo actual. Los motivos van a catálogo, no al código (regla de negocio 13). |
| D8 | **Pantalla "Precios y Paquetes" como punto único de los precios base.** Javier (2026-09-11): los tramos de precio por cantidad de clases —hoy definidos en la pantalla de Cursos— van a una pantalla propia, diseñada con Design, con una pestaña por bloque (entre ellas, valores de clase de prueba y tramos de precio por cantidad de clases). **De esos tramos** sale el valor unitario de cada clase para el precio referencial. Regla que la gobierna: **el precio pleno es por 4 semanas del calendario normal del curso** — 8 clases si el curso es de dos por semana. La pantalla unifica en un solo punto todas las definiciones de precio base de la aplicación, y desde ahí se cotiza y se adopta el precio de cursos, planes y ofertas especiales. | **SALE DEL BACKLOG — Javier la activó el 2026-09-12: *"ese debe ser el centro donde se definen los precios base de todos los servicios"*, y *"quiero aplicar esa pantalla como un paso"*.** Se construye como hito propio, con las **cinco** pestañas, antes de la venta de particulares/alquiler. | Se postergó por miedo a una migración de datos que **no existe**: medido el 2026-09-12, los precios ya viven en sus propias tablas (`curso_tarifas` para las parciales y la prueba, `descuentos_adelanto` para meses adelantados, `cursos.precio_mensual`, y `tarifas_particular` / `sala_tarifas` desde la 0035). D8 es una **pantalla que los junta, no un movimiento de datos**. | **Disparador cumplido.** Era "antes de cargar precios nuevos en producción", y los precios de particulares y alquiler son exactamente eso: sin esta pantalla no hay dónde cargarlos. Queda pendiente decidir si la pantalla de Cursos conserva sus columnas de tarifa o delega acá — dos superficies para el mismo dato es la clase de duplicación que esta decisión venía a cerrar. |
| D11 | **Inscribir a los acompañantes de una prueba grupal, con su crédito.** Hoy, en una prueba grupal, solo el **titular** puede convertir y se le acredita **su parte** (opción b: lo pagado ÷ personas). La parte de los acompañantes **existe pero no se puede reclamar**: no tienen nombre en el sistema. Javier: *"lo lógico es que el resto queda para cuando se inscriban los otros en plazo… haciendo referencia a algún ID que se entregue al momento de la inscripción, o referir al titular aunque no se haya inscrito… pero debe ir descontando la cantidad de beneficiarios. Si cualquiera deja pasar la fecha, igual lo pierde."* | **Pendiente** (2026-09-11) | Los acompañantes no tienen identidad en el modelo; darles una es un cambio de modelo, no un ajuste. Javier: *"dejarlo en b por ahora sin la inscripción de los restantes"*. | Cuando **aparezca el primer caso real** (un acompañante que quiere inscribirse y reclamar su parte), o en el paso siguiente si se prioriza. **Cada prueba grupal que se venda mientras tanto es un crédito que alguien puede venir a reclamar y no vamos a poder darle.** |
| D12 | ~~**Los estilos/especialidades tienen que ser catálogo, no parámetro.**~~ **CERRADA el 2026-09-24** (migración 0048, C3-0a.1), en dev: tabla `estilos` (clave, como `sala_tamanos`) + `profesor_estilos`; `cursos.estilo`, `tarifas_particular.estilo` y `paquetes_particular.estilo` pasan de texto libre a FK. Pantalla nueva en Catálogos → Estilos (agregar, renombrar, activar). `cursos.linea` y `profesores.especialidades` quedan marcados OBSOLETA (su borrado queda para una migración futura: la 0049 terminó siendo `sexo` en la matriz). **En producción desde el 2026-09-24** (ver §4). | **Cerrada** | — | — |
| D13 | **Aumentar un valor de catálogo sin salir de la operación.** En las listas de las pantallas, el usuario tiene que poder agregar un valor al catálogo mientras está haciendo otra cosa: cargando un profesor, poder agregar un estilo que no está; ídem en cursos. Hoy hay que abandonar la pantalla, ir a configurar y volver a empezar. Javier (2026-09-11): *"para versión posterior… el usuario pueda aumentar valores a la lista de algún catalogo mientras realiza una operación."* | **Pendiente — versión posterior** (2026-09-11) | Es un gesto transversal: conviene definirlo una vez con Design y montarlo igual en todos lados (regla de proceso 4), como D4. | Los catálogos que necesitaba (D12) ya existen de verdad desde la 0048. Junto con D4 —que es el mismo tipo de decisión: cómo se le ofrece un gesto al usuario en toda lista. |
| D19 | ~~**Al reemplazante no se le deja la plata para cobrar por caja.**~~ **RESUELTA el 2026-09-18** (migración 0046, R4): el reemplazante tiene su propia línea en "Por pagar", pagable apenas se registra la clase, y el descuento al titular se ve en su línea sin esperar a la liquidación. Ver §1.b. | **Resuelta** | — | — |
| D9 | **La tarjeta de confirmación de la venta tiene que ser específica**: plan + monto + cursos + días + fecha de la primera clase + si es clase de prueba. Hoy dice poco y hubo que ir a la base para saber qué había quedado. | Pendiente (pedido de Javier, 2026-09-11) | Se arregló lo urgente (que mostrara **todas** las fechas y el plural). Lo demás es un rediseño del mensaje. | Junto con D4, que también es cómo se le muestra una entidad a la persona. |
| D22 | **Comisión por referido de profesor.** `contacto_relaciones` (0048) ya modela `referido_por` entre dos contactos cualquiera, así que un profesor podría traer un alumno y quedar registrado como su referente. Falta decidir si eso paga algo, cuánto, y sobre qué (¿la venta inicial? ¿cada renovación?). | Pendiente (surgida en C3-0a.1, 2026-09-24) | Es una decisión de negocio nueva, no una consecuencia obligada del modelo — `contacto_relaciones` la deja *posible*, no la exige. | Cuando Javier quiera ofrecer un incentivo por referido a los profesores, o cuando aparezca el primer caso real que lo pida. |
| D23 | **Obligatoriedad del documento (CI/pasaporte/NIT) de un contacto.** `contactos_privados.numero` existe y se valida contra el `patron` de `tipos_documento` si se carga, pero hoy nada lo exige. ¿Para qué contexto pasa a ser obligatorio (matriz de mínimos, `nivel='O'`) — facturación, un alumno adulto, ningún caso hoy? | Pendiente (surgida en C3-0a.1, 2026-09-24) | La matriz de mínimos ya tiene la columna `documento` sembrada en `-` (oculto) para todo contexto: activarla es una decisión de negocio, no un cambio de modelo. | **Disparador cumplido el 2026-09-24 (C3-0a.3): ya se puede decidir sin código.** Desde que la matriz tiene efecto real en los formularios (editor en Administración → Catálogos → Matriz de mínimos), activar `documento` para un contexto es cambiar una celda, no escribir nada. Sigue pendiente que Javier decida el **para qué** contexto y **por qué** (facturación, un convenio, un requisito legal) — la capacidad ya está, falta la decisión de negocio. |
| D24 | **Multi-escuela.** Hoy todo el modelo (`contactos`, `membresias`, `liquidaciones`) asume una sola academia. Si Tropicana abre una segunda sede o se blanquea el modelo para otra academia, ¿los contactos se comparten o se separan? ¿Un profesor puede dictar en las dos? | Pendiente (surgida en C3-0a.1, 2026-09-24) | No hay ninguna necesidad medida hoy — es una pregunta abierta, no un problema con un caso real detrás. | Si aparece una segunda sede o academia real que use el sistema. |
| D25 | **El WhatsApp compartido entre familiares.** El relleno de la 0048 resolvió el caso medido (un número de familia lo reclama el tutor, no el menor — ver Sebastian Vivancos/Jessica Galvis en `ESTADO.md`) con una regla de orden, no con un modelo de "número compartido por varios contactos". Si aparecen más casos así, ¿conviene modelar el WhatsApp como algo que puede pertenecer a más de un contacto? | Pendiente (surgida en C3-0a.1, 2026-09-24) | La regla de orden (tutores antes que alumnos) resolvió el único caso medido; modelar "compartido" de verdad es más grande que el problema que hay hoy. | Si aparece un caso que la regla de orden no resuelve bien (dos contactos activos que genuinamente comparten un número, sin que uno sea claramente el "dueño"). |
| D26 | **Verificación automática del WhatsApp.** Hoy un WhatsApp se guarda tal cual lo escribe quien carga el contacto (normalizado, pero no verificado). ¿Conviene confirmar que el número existe/responde antes de darlo por bueno — vía un mensaje de verificación, una API de WhatsApp Business? | Pendiente (surgida en C3-0a.1, 2026-09-24) | Requiere una integración externa (WhatsApp Business API o similar) que hoy no existe en el proyecto. | Cuando el volumen de números mal cargados (los que el control 23 señala) se vuelva un problema operativo real, o cuando C3-0b (formulario público) necesite confirmar identidad sin intervención humana. |
| D27 | **Que un suplente abra la asistencia desde su propia cuenta.** Hoy, si el titular no puede dar la clase, la asistencia la carga el administrador o el asistente (con el padrón completo, sin depender de a quién ve el suplente) — el suplente no entra al sistema a registrar su propia clase. | **Decidida por ahora: no** (Javier, 2026-09-24, al aprobar el plan de C3-0a.1: *"Dejarlo así por ahora"*) | Habilitar esto exigía decidir de antemano cómo el RLS de `contactos` le muestra el padrón a un suplente que no es el titular del curso — la misma pregunta que motivó la corrección de concepción del plan (ver `ESTADO.md`). Javier prefirió no resolverla ahora. | Cuando un suplente necesite cargar la asistencia él mismo, sin pasar por el administrador o el asistente. |

## 1.b Decisiones tomadas que están pendientes de construir

No son backlog: Javier ya decidió que **así se debe trabajar**. Están acá para
que no se pierdan hasta que el código las alcance.

| # | Decisión | Estado |
| --- | --- | --- |
| **El orden del Paso 5: la disponibilidad antes que la venta** (C1→C5) | Javier, 2026-09-12, en el documento de instrucciones del Paso 2. **Reemplaza el orden acordado esa misma mañana** ("validación mínima de choque dentro de 2D", con *Vender servicio* como paso siguiente). El motivo es un reencuadre del modelo, no una preferencia: *"la unidad atómica no es «la venta con horario» sino «la reserva de una franja de sala». Vender un paquete crea un saldo de horas; reservar consume ese saldo ocupando la sala — son actos distintos que pueden ocurrir juntos o separados en el tiempo."* Construir la venta primero dejaría la reserva colgada de la venta, y habría que desacoplarla después. Orden: **C1** horario base → **C2** disponibilidad + reserva con lista textual (sin grilla) → **C3** venta apoyada en la disponibilidad → **C4** agenda visual (pasa por Design) → **C5** conflicto bloqueo-vs-agendado. | **VIGENTE desde 2026-09-12.** C1 en curso; C4 y C5 anotados en `ROADMAP.md` (R2 y R1). |
| **Cómo se clasifica por qué está tomada la sala** | Javier (2026-09-12): el motivo se **elige de una lista** y el responsable o la aclaración van en una **glosa abierta** — *"clasificar los motivos en un campo de motivos, y aclararlo o poner el responsable en un campo glosa abierto"*. Los motivos que salen del **horario base** no se eligen a mano, y el horario base son **dos piezas distintas**: el **patrón** —la regla semanal de apertura, de donde sale "fuera de horario"— y las **excepciones por fecha** —feriados y cualquier otro cierre o apertura especial—. Un feriado **no** es un bloqueo que alguien carga a mano: es una excepción del horario. Además, una reserva lleva **notas**, y no son un memo: *"pueden ser incluso usadas como instrucciones o recomendaciones para el asistente coordinador de la sala"*, así que se muestran donde se opera la sala. **Vacío significa cerrado, no abierto**: un horario sin cargar deja la sala no reservable, porque el default contrario produce justo el bug que C1 viene a evitar. | **DECIDIDA.** Se construye en C1 (migración 0036). |
| **Una sala hoy, varias después** (ex D20) | Javier (2026-09-12): *"por el momento una sola sala, posteriormente podrían haber varias."* **Consecuencia de diseño, y es la parte que importa: se modela para N y se muestra para 1.** Existe la entidad `salas` desde el principio, con una sola fila; cada clase y cada bloqueo dicen en cuál están; y la pregunta de choque se hace **por sala** aunque hoy siempre sea la misma. La pantalla **no muestra el selector** mientras haya una sola —elegir entre una opción es ruido—, y aparece solo cuando se cargue la segunda. Agregar la dimensión después sería rehacer el modelo y remapear lo ya agendado, no agregar un campo. | **DECIDIDA, sin construir.** Va en la primera migración del Paso 5. |
| **La sala se puede bloquear sin venta** (ex D7) | **Sí**: la agenda de sala es un **calendario real**, no el reflejo de lo vendido. Javier (2026-09-12): *"la sala se puede reservar/bloquear sin paquete vendido. Aplica motivos de capacitaciones internas, preparación de coreografías de los profesores, mantenimiento, etc."* Consecuencias de diseño: un bloqueo **existe sin dueño comercial** —no cuelga de una venta ni de una membresía—, necesita **motivo de catálogo** (regla de negocio 13) y ocupa la sala igual que una clase para la validación de choque. | **DECIDIDA, sin construir.** Es el corazón del Paso 5. |
| **Duración de la clase** (ex D6) | Un curso declara **cuánto dura una clase**, en el maestro de cursos. Javier (2026-09-12): *"implementá la duración de las sesiones de cursos en el maestro de cursos, con eso se obtiene la hora de fin."* **La hora de fin se calcula, no se guarda**: guardar inicio y fin sería tener el mismo hecho en dos campos que pueden contradecirse — la confusión más cara de este proyecto fue exactamente esa. | **CONSTRUIDA** en dev el 2026-09-12 (migración 0034 + `src/lib/horarios.ts`). Los 9 cursos quedaron en 60 min, que es lo único que se puede suponer sin inventar: Javier corrige el que no sea. |
| **El nombre de la membresía, de acá en adelante** (mitad de D1) | **Todo campo nuevo que apunte a `membresias.id` se llama `membresia_id`.** Nunca más `inscripcion_id`, ni una tercera grafía. Javier (2026-09-12): *"en adelante usa siempre el mismo nombre para membresía."* | **CERRADA el 2026-09-24**: con D1 (migración 0047, en producción) ya no queda ningún `inscripcion_id` ni tabla `inscripciones` — la tabla es `membresias` y la llave es `membresia_id` en todos lados, sin excepción. |
| **Vigencia del curso** (ex D15) | Un curso tiene **fecha de activación y de baja**. El registro de asistencia es exigible **solo** entre esas fechas: fuera de ellas nunca se pide y nada queda "sin registrar". No se pueden vender planes ni pruebas con un curso inactivo — eso **inactiva el plan**. Si aparecen clases retroactivas, la fecha de activación **se corrige** (el usuario la ajusta antes de inscribir y la revalida): que haya clase retroactiva significa que sí había profesor, alumno y clase. Javier (2026-09-12): *"No lo veo como backlog. Es así como se debe trabajar."* Y el marco general: **todo lo retroactivo es una excepción de la operativa, no el día a día.** | **CONSTRUIDA** en dev el 2026-09-12 (migración 0033 + `src/lib/vigencia.ts`). Falta que Javier valide y dé el OK del pase. |
| **Intervalo estándar de tiempo** (ítem 3) | Un solo parámetro (`tiempos_incremento_min`, 30 min default / 1 hora) gobierna **todo** lo que se carga en minutos: duración de curso, duración mínima de una clase (`duracion_minima_curso_min`), horario de sala (patrón y excepciones). Javier (2026-09-16): *"usar siempre y como estándar el intervalo en minutos... Crear cualquier otro parámetro de tiempos de sala o duración de clases/sesiones o uso de paquetes que se requiera manteniendo el criterio de incrementos establecido."* **Cuando se construya C2/C3** (venta de clases particulares y alquiler de sala, hoy sin pantalla), sus horarios de reserva **tienen que reusar este mismo parámetro** — no crear uno nuevo ni asumir un paso propio. | **CONSTRUIDA** en dev el 2026-09-17 (migración 0039 + `src/lib/horarios.ts`: `opcionesDuracion`/`esMultiploDe`). La duración de un curso pasó de texto libre a una lista de múltiplos del incremento; `duracion_clase_min` (0034) queda de baja, su lista fija {45,60,75,90,120} no era múltiplo de nada. Falta que Javier valide y dé el OK del pase. |
| **Gerente y Asistente quedan configurables, no roles de sistema** | Javier (2026-09-17), al ver que la visibilidad "propio/todo" se estaba por resolver cableando `if (rol.clave !== 'administrador' && rol.clave !== 'gerente' && ...)`: *"los roles de gerente y asistente cada vez están quedando más cableados a la lógica del sistema. Creo que debes confirmarme si no hay riesgo que el sistema se caiga si esos roles se eliminan, o lo correcto es que queden implementados como roles sistema."* Medido antes de responder (regla de calidad 3): la única clave cableada en `src/` es `'administrador'`; `gerente`/`asistente`/`comercial` no aparecen en ningún lado del código, y `eliminarRol` + la FK `perfiles.rol_id` ya bloquean borrar un rol con usuarios. **Eliminarlos vacíos no rompe nada.** Javier decidió: **dejarlos configurables** (`es_sistema=false`) — el mecanismo de visibilidad (fila de abajo) ya elimina el riesgo de que el sistema dependa de ellos, así que no hace falta protegerlos cableándolos. | **DECIDIDA, sin migración** (no cambia `es_sistema`, ya estaba en `false`). |
| **Visibilidad de datos propios, configurable por (rol, módulo)** | Un profesor con acceso a un módulo veía TODO, no solo lo suyo (todos los cursos en Asistencia; por URL directa, la liquidación de cualquiera). En vez de cablear más claves de rol, una dimensión nueva y configurable: `rol_visibilidad(rol_id, modulo, alcance)`, `alcance` = `'propio'`/`'todo'`, sin fila = `'todo'` (retrocompatible). Solo aplica a los módulos con "dueño" de fila: Asistencia, Liquidaciones, Caja (`MODULOS_CON_ALCANCE`). Se configura desde Roles y Permisos, un toggle por módulo — ningún `if (rol.clave === ...)` nuevo en la app. | **EN PRODUCCIÓN** desde el 2026-09-17 (migración 0043 + `src/lib/sesion.ts`: `alcanceDe`/`obtenerProfesorActual`). Verificado con la cuenta real de Oscar Núñez. |
| **Las clases solo afectan contadores: lo pagado se compensa, no se reescribe** (reemplaza al congelador; ex D21) | El congelador prohibía tocar una clase de la que dependía una comisión ya pagada, sobre la premisa de que la clase tenía plata encima. **La premisa era falsa** y Javier la corrigió (2026-09-18): la plata sale de las membresías completadas y cobradas al 100%; el conteo de clases es apenas el insumo del prorrateo. Entonces prohibir era la respuesta equivocada: hay que **dejar hacer** —registrar tarde, corregir, suspender son hechos que pasaron— y **compensar la diferencia** con un `ajuste` firmado que entra como complemento del período de la comisión original, sin reescribir lo pagado y sin tocar lo devengado por otras membresías de la misma clase. Queda un **aviso** antes de guardar, que nombra la liquidación y el profesor que se van a mover: informa, no pide permiso. **Se llegó acá por un camino equivocado, y conviene recordarlo**: primero se documentó como D21 una política de autoridad (que un Gerente confirmara y reliquidara), que era una feature grande e innecesaria; Javier la descartó dos veces hasta dejar el principio en una línea. | **CONSTRUIDA** en dev el 2026-09-18 (migración **0044** + `src/lib/liquidacion/motor.ts` + `src/lib/periodos.ts`, que pasó de bloqueador a informador). Certificada con 15 pruebas deterministas (`npm test`) y reconciliada contra datos reales. Falta que Javier valide y dé el OK del pase. |
| **La deuda con un profesor es su CUENTA, no cada liquidación** | Una liquidación deja deuda y una reliquidación también, con la diferencia de que el ajuste puede ser negativo y dejar un período con plata **pagada de más** (0044). Javier (2026-09-18): *"todos los pagos (o aplicación del negativo en caso que sea deducción) contra estas deudas debe reflejarse correctamente en los pagos que se hagan en cualquier momento, correctamente clasificados."* Se compararon dos modelos con números reales. **Gana la cuenta**: el saldo suma todos sus períodos, así el negativo se compensa solo. El argumento decisivo fue que, si el recupero dependiera de generar la liquidación siguiente, un profesor que deja de devengar se llevaría el saldo sin que apareciera en ningún lado. Javier agregó una condición: **que además los períodos cierren al pagar**, así que la imputación primero cancela los negativos y después reparte el efectivo entre los positivos, del más viejo al más nuevo. **La frontera, que importa no equivocar**: este saldo es el de las LIQUIDACIONES (comisiones de cursos regulares y pruebas, más el pago al reemplazante y el descuento al reemplazado). Los conceptos ad-hoc —multas, bonificaciones, débitos y créditos de administración— se resuelven enteros en Caja y **no entran al saldo**; por eso la línea dice "Saldo de liquidaciones" y no "lo que se le debe": `otro_pago_profesor` cae en el mismo bucket y no lo salda — **y el código lo hace cumplir** (`saldaLiquidacion()` en `caja.ts`): solo `comision_profesor` se imputa a la cuenta; un pago suelto queda a nombre del profesor (`pagos.profesor_id`), sin `liquidacion_id`, con monto libre. **Corrección del 2026-09-18, mismo día (Javier):** el pago al reemplazante **no es parte del saldo de liquidaciones**. El costo del reemplazo *"no pasa por prorrateo de ninguna forma: se descuenta de la cuenta del profesor reemplazado y se le paga al reemplazante. Nada más"*. Por eso el suplente tiene **su propia línea** en Caja (`pago_reemplazante`, bucket `reemplazos`), pagable apenas se registra la clase —cobra por tarifa, regla 20—, con cada pago atado a las clases que salda (`pagos.sesion_id`, de la más vieja a la más nueva). Y el descuento al titular se resta **ya** de su línea (como "a descontar") aunque su liquidación del mes todavía no exista; cuando esa liquidación lo incorpora, deja de estar pendiente y pasa a restar en su período, así que nunca cuenta dos veces. **Lo que viene con C3**: se suman a la liquidación las comisiones por clases particulares y talleres y los cargos por alquiler de sala, así que el saldo se escribió como *la suma de los conceptos liquidables*, para que agregar una fuente sea sumar un sumando. | **CONSTRUIDA** en dev el 2026-09-18 (migración **0045** + `src/lib/liquidacion/cuenta.ts` con 9 pruebas + `lineasPorPagar` y la sección "Por pagar" de Caja). Cierra R24, R25, R26 y el núcleo de R3/R5. Falta que Javier valide y dé el OK del pase. |

| **Orden dentro de C3-0, y qué construye C3-0a.3** | Javier (2026-09-24), al probar C3-0a.2 y encontrar que cambiar la matriz no movía nada en los formularios: la matriz necesitaba un paso propio para que dejara de ser configuración muerta. Se sumó **C3-0a.3** (que los formularios de alta lean la matriz), **antes que C3-0b** (captación pública) — y C3-0b deja de ser urgente: *"puede esperar al desarrollo de C3 (paso 5)"*. Orden actualizado: C3-0a.1 ✅ → C3-0a.2 ✅ → **C3-0a.3** ✅ → C3-0b (cuando arranque C3). Javier fijó tres criterios para construirla: **(1)** se construyen todos los campos que ya tienen tabla (red social, email, documento, fecha de nacimiento, consentimiento) — no solo los que la siembra dejaba visibles; interés y facturación quedan bloqueados en el editor por no tener dónde guardarse. **(2)** las celdas de las que depende la lógica del sistema (nombre/razón social por `tipo`, WhatsApp o tutor que identifica al alumno, tipo de profesor) se **bloquean con candado y explicación**, no quedan libres. **(3)** una clase de prueba de un menor usa las reglas de **alumno menor** (tutor obligatorio), no las de `prueba` — para no vender una prueba a un menor sin ningún adulto registrado. | **CONSTRUIDA** en dev el 2026-09-24 (`src/lib/matrizMinimos.ts`, `CamposContacto.tsx`, wired en `EntidadAlumno`/`EntidadProfesor` y las 5 acciones de alta/edición; control 27 nuevo). Verificado en el navegador: cambiar una celda cambia de verdad qué se pide, servidor y cliente de acuerdo. **EN PRODUCCIÓN desde el 2026-09-24**, junto con C3-0a.1/a.2 (migraciones 0048 + 0049, ver §4). |

**El ejemplo que estaba acá era falso, y conviene decirlo:** se afirmaba que
"Salsa y Bachata Inicial tiene su primera sesión el 31/08 y el conteo le
atribuye 8 clases de agosto". Medido el 2026-09-12 contra dev: el **31/08 es su
fecha de creación en el sistema**; su primera sesión y su primera asignación son
del **03/08**. Ese curso sí corría en agosto. El agujero que la vigencia cierra
es real —el calendario no tenía principio— pero no se demostraba con ese caso.
*(Regla de calidad 3: antes de dar por hecho un diagnóstico, mirar el dato.)*

## 2. Decisiones vigentes que ya se violaron una vez

Las que ya costaron. Se listan aparte porque el antecedente es el que evita la
recaída.

| Decisión | Vigente desde | Cómo se violó | Qué la protege ahora |
| --- | --- | --- | --- |
| **El fin de ciclo lo corre la suspensión** (regla de negocio 4) | siempre | Se afirmó que el motor no tocaba `fecha_fin`, tras un `grep` que no encontró el campo. | Glosario de `REGLAS.md` + controles 9 y 10. |
| **El corrimiento no toca el plazo de pago de la cuota** | 2026-09-10 | Se arrastró la definición de la etapa 1. | Glosario de `REGLAS.md`. |
| **Un fallo no se disfraza de ausencia** (calidad 1) | 2026-09-11 | Dos veces: el recibo 404 y la venta sin planes. | `exigir()` + `error.tsx` + regla de calidad 1. |
| **Un concepto, un nombre** | siempre (glosario) | Se agregó `membresia_anterior_id` en la 0023, con el resto del esquema en `inscripcion_id`. | **Control 15** + D1. |
| **El padrón no mira el estado de la venta** (regla de negocio 2) | siempre | `cargarPadron` filtraba por `estado === "activa"`, así que una membresía `completada` desaparecía del padrón de sus propias clases pasadas. La clase se veía vacía y se suspendía "sin alumnos", borrándole al profesor el peso de esa clase. Pasó con Heels en agosto. | Corregido el 2026-09-12, y el consumo se pregunta **al día** que se mira, no con los totales de hoy. |
| **`asistencia_semanas_retro` vuelve a 2** (D10, cerrada) | 2026-09-12 | Se subió a 8 el 11/09 para alcanzar agosto y validar la prorrata. Quedó en 8 más de un día: mientras tanto, Natalia podía editar asistencias de hace dos meses. | Javier la devolvió a **2** el 2026-09-12, verificado en dev. |
| **Quién dictó la clase no se supone** (regla de negocio 20) | 2026-09-12 | `sesiones.profesor_id` existía y se llenaba por inferencia: se estampaba la asignación **abierta**, sin mirar la fecha de la clase. O sea, el campo del hecho se completaba con una conjetura, y encima con la equivocada. | Corregido en 0030 (D17a): se elige al registrar la asistencia, con el titular del día a la vista y el reemplazo obligatorio si el curso está desasignado. |
| **La comisión es de quien dictó** (regla de negocio 10) | siempre | El cálculo leía solo las asignaciones vigentes (`hasta is null`), así que un cambio de titular a mitad de mes le daba el período entero al nuevo y el anterior no cobraba las clases que sí dictó. Lo detectó Javier el 2026-09-12 al revisar D16. | Corregido: el reparto usa el **historial** de asignaciones (migración 0029) + **control 20**. |
| **La config que el código lee nace en una migración** (calidad 7) | 2026-09-12 | `liquidacion_reparto_pantalla` y `_impreso` se crearon a mano en dev; la 0028 los daba por existentes y solo los actualizaba. El pase a producción no los llevó: 4 parámetros en dev, 2 en producción. Lo detectó Javier al recorrer la pantalla. | Migración **0031** (idempotente, aplicada en las dos bases) + regla de calidad 7. |
| **Una fecha de la que depende plata no se asigna sola** (regla de negocio 5) | 2026-09-12 | La primera versión de la vigencia del curso estampaba `vigente_hasta = hoy` al desactivar. De esa fecha depende cuántas clases pone el curso en el prorrateo: ponerla por default es decidir plata por omisión. Lo frenó Javier antes de que se validara: *"es delicada como para que la asignes sin intervención."* | La baja pide la fecha y la persona la confirma; una baja hacia atrás por encima de clases o membresías en curso **se rechaza** nombrando el tope, y el mismo guard corre al editar la ficha. |
| **Un valor con alternativas se elige de una lista** (calidad 6) | 2026-09-11 | Los dos parámetros del reparto (`liquidacion_reparto_pantalla` / `_impreso`) quedaron como texto libre, con otros parámetros ya resueltos con desplegable. De paso abrieron un grupo "Liquidaciones" cuando ya existía "Liquidación". | `parametros.opciones` (0028) + validación en el servidor + regla de calidad 6. |

## 3. Orden del pase y del refresh dev↔prod

El orden importa y equivocarlo borra trabajo. Vale para **todo** cambio con
migración — D8 incluida.

1. **Migración + código en dev.** La migración la aplica la sesión; Javier no
   pega SQL a mano.
2. **Javier valida en dev.** Nada avanza sin esto.
3. **OK explícito de Javier** (regla de proceso 1). Validar en dev no lo
   dispara.
4. **Migración en producción**, y recién entonces el deploy del código (Vercel
   publica solo al mergear a `main`). Si el código llega antes que la
   migración, la pantalla lee columnas que no existen y se cae entera.
5. **Correr `scripts/control_migracion.sql` en producción** y comparar con lo
   que dio en dev.
6. **Recién después, si hace falta, refrescar dev desde prod.**

> **Un solo push por pase.** Vercel construye cada commit por separado y **en
> paralelo**: si se empujan varios seguidos, termina último el que empezó
> primero y ese queda como el deploy activo, con código viejo. Costó el
> 2026-09-18: el chip mostraba `#3a07c73` cuando lo publicado era `#929721a`, y
> parecía que un arreglo se había revertido. Se empuja **una vez**, con todo
> junto, y se confirma que el chip PROD muestre el último commit. Si quedó el
> equivocado: Vercel → Deployments → el commit correcto → **⋯ → Promote**.

> **La trampa:** `refresh-dev.mjs` **vacía** las tablas de dominio de dev y las
> reemplaza con las de producción. Todo lo que se haya cargado en dev para
> probar —planes, precios de prueba, inscripciones— **se pierde**. Nunca
> refrescar entre los pasos 1 y 4: se pierde justo lo que se está por validar.
> Los catálogos y parámetros sí se sincronizan por clave y sin borrar, así que
> una clave que solo existe en dev sobrevive.

## 4. Pendiente de pase a producción

Lo que está **solo en dev** y espera el OK explícito de Javier (regla de
proceso 1). No es un backlog de decisiones: es el estado del release.

- **Migraciones 0023–0030: APLICADAS EN PRODUCCIÓN el 2026-09-12**, con el OK
  explícito de Javier. Ningún dato de dominio se modificó (detalle y controles
  en `docs/ESTADO.md`).
- **Código desplegado**: `main` actualizado `31da6ae..ed44fbd` el 2026-09-12
  (fast-forward, 47 commits). Vercel publica solo al mergear.
- **Control 3 en producción: resuelto.** Daba 2 (membresías 23 y 24, Zumba);
  al regrabarse esas asistencias el motor recalculó los contadores. Verificado
  el 2026-09-12: da **0**. (Dev sigue en **1**, desvío propio de dev.)
- **Migraciones 0032 y 0033: APLICADAS EN PRODUCCIÓN el 2026-09-12**, con el OK
  explícito de Javier ("avanzá con las migraciones"). Las dos son aditivas y no
  modificaron ningún dato de dominio. Los 21 controles dan **OK**, salvo el 15
  —la deuda D1— que da REVISAR a propósito. Detalle en `docs/ESTADO.md`.
- **Código desplegado (D17b + vigencia)**: `main` `5f547f0..2c29cf1` el
  2026-09-12, con el OK explícito de Javier. Confirmado por él en la app: chip
  **PROD**, commit `#2c29cf1`.
- **Migración 0034: APLICADA EN PRODUCCIÓN el 2026-09-12**, con el OK explícito
  de Javier (*"ok 0034"*). Aditiva: el backfill dejó los 9 cursos en 60 min y no
  tocó nada más. Los controles dan **OK**. Medido después de aplicar: **ningún
  par de cursos se pisa** con esa duración — los que comparten hora no comparten
  día—, así que la grilla de producción es consistente con **una sola sala**.
- **Código desplegado (D6)**: `main` `2c29cf1..650ae6d` el 2026-09-12, con el
  OK explícito de Javier (*"mergea y publica"*). Migraciones 0001–0034 en las
  dos bases.
- **Bug de asistencia (padrón duplicado) — PASADO A PRODUCCIÓN el
  2026-09-16**, con el OK explícito de Javier (*"pasalo"*). Alcance acotado
  aposta: solo `asistencia/acciones.ts` e `inscribir/acciones.ts`, sin
  arrastrar las migraciones de abajo. `main` `b0766ac..11c37f9`, confirmado
  por el chip PROD de la app. Sin migración. Detalle en `docs/ESTADO.md`,
  bloque *"Un alumno duplicado en el padrón de asistencia"*.
- **Migraciones 0035–0038 + todo lo validado en dev — PASADO A PRODUCCIÓN el
  2026-09-16**, con el OK explícito de Javier (*"pasa todo"*), después de
  mostrarle el listado completo de lo pendiente. Incluye:
  - **0035–0037**: *Precios y paquetes* (D8), *Sala y horarios* (C1) y la
    segunda sala — ya validadas por Javier en dev (*"veo todo ok"*, *"probado
    ok"*) desde el 2026-09-12, esperaban su propio OK de pase.
  - **0038 + Roles y Permisos**: Planes, Liquidaciones, Precios y Sala como
    módulos propios (nuevo el 2026-09-16, ver regla de proceso 11).
  - **C5**: cierre de sala avisa y suspende con confirmación (sin migración,
    cambia el comportamiento de `suspenderClase`).
  - **Cuenta del alumno**: membresías multi-curso completas + fecha de fin
    real o estimada, aplicado también a la glosa del Recibo (sin migración).
  - Dos correcciones de UI (menú retráctil en celular, botón "Guardar" que
    dejaba de invitar a repetir).

  Las 4 migraciones se aplicaron una por una contra producción
  (`pnvhpbxjbdmbktpwebtx`), en orden (0035→0038), y **antes** del deploy del
  código, siguiendo el orden de §3. Los controles de `scripts/
  control_migracion.sql` corridos después dan **OK** en producción — control
  15 en REVISAR a propósito (deuda conocida D1), igual que en dev. Se
  verificó además que los permisos de Asistente quedaron idénticos a lo
  validado en dev (solo "ver" en Planes, nada en Liquidaciones/Precios/Sala).
  **Código desplegado**: `main` `11c37f9..7003295` (merge, no fast-forward,
  porque el bug de asistencia se había pasado por separado con alcance
  acotado — ver el punto de arriba). Detalle completo en `docs/ESTADO.md`.
- **Ítem 3 (intervalo estándar de tiempo, migración 0039) — PASADO A
  PRODUCCIÓN el 2026-09-17**, con el OK explícito de Javier, después de dos
  correcciones que encontró probando en dev (mensaje de error deformaba un
  campo de Parámetros; selector de hora de Sala con `step` confuso, revertido
  a simple). `main` `7f2f4e1`.
- **R23 (bug del padrón con renovaciones) — PASADO A PRODUCCIÓN el
  2026-09-17**, con el OK explícito de Javier, verificado dos veces con datos
  descartables (antes y después del merge a `main`). Sin migración. `main`
  `78e19a8`. Con esto, la cola completa de bugs (1, 5, 4, 3, 2) y R23 quedan
  cerrados y en producción.
- **C2 (disponibilidad de sala + bloqueos) — PASADO A PRODUCCIÓN el
  2026-09-17**, con el OK explícito de Javier (*"avanza. ok"*), después de que
  probara en dev y se corrigieran dos bugs que encontró (el botón "Cancelar"
  no funcionaba — usaba `confirm()` nativo, fácil de confundir con el propio
  diálogo — y el formulario de bloqueo quedaba "invitando a repetir" tras
  grabar, con un mensaje de una acción anterior pegado). Javier además corrigió
  la ubicación: la disponibilidad es "totalmente cotidiana" y no debía vivir
  solo bajo Administración — pasó a pantalla propia `/sala`, grupo Gestión del
  menú, mostrando todas las salas activas a la vez. Migraciones **0040**
  (`glosa`/`notas` en `reservas_sala`) y **0041** (rol Profesor ve la
  disponibilidad — `es_sistema=true`, migrado; Asistente y Gerente son roles
  configurables y ESE ajuste queda para que Javier lo haga desde Roles y
  Permisos, no por migración) aplicadas en `pnvhpbxjbdmbktpwebtx` antes del
  código, siguiendo el orden de §3. Controles de `scripts/control_migracion.sql`
  en **OK** en producción (control 15 en REVISAR a propósito, deuda D1).
  `main` `65aa8d9..accaa70`, confirmado por el chip PROD `#accaa70`. Detalle
  completo en `docs/ESTADO.md`, bloque *"C2 — Disponibilidad + reserva mínima
  de sala"*.
- **El trigger de alta no copiaba el email a `perfiles` — PASADO A PRODUCCIÓN
  el 2026-09-17**, con el OK explícito de Javier (*"si pasala"*). Encontrado al
  crear la cuenta de Oscar Núñez y no poder ver con qué correo quedó. Migración
  **0042** (aditiva: corrige el trigger `handle_new_user()` + backfill) aplicada
  en `pnvhpbxjbdmbktpwebtx` antes del código — sin backfill que hacer ahí, los 3
  usuarios ya tenían su correo. `main` `94fd1d3..59356a3`, confirmado por el
  chip PROD `#59356a3`. Detalle en `docs/ESTADO.md`, bloque *"El trigger de
  alta no copiaba el email a `perfiles`"*.
- **Visibilidad de datos propios por rol (migración 0043) + fix del mensaje
  de error pegado en Asistencia — PASADO A PRODUCCIÓN el 2026-09-17**, con el
  OK explícito de Javier (*"A PRODUCCIÓN"*, confirmando que ya lo había
  probado en dev). Migración **0043** (tabla `rol_visibilidad` + RLS + seed:
  Profesor → asistencia/liquidaciones propio, Asistente → caja propio)
  aplicada en `pnvhpbxjbdmbktpwebtx` antes del código, siguiendo el orden de
  §3. Verificado el seed correcto post-migración y `get_advisors` (security)
  sin hallazgos nuevos atribuibles a `rol_visibilidad`. Controles de
  `scripts/control_migracion.sql` en **OK** en producción (1–10, 17, 20, 21;
  control 15 en REVISAR a propósito, deuda D1), igual que en dev. `main`
  `59356a3..4e1aebc`. Incluye también el fix de `ClienteAsistencia.tsx` (el
  mensaje de rechazo quedaba pegado al cambiar de curso o fecha). **D21 quedó
  sin efecto al día siguiente**: no era una política de autoridad por
  construir, sino la regla 16 mal planteada — ver §1.b, "Las clases solo
  afectan contadores". Detalle completo en `docs/ESTADO.md`.
- **La regla 16 reescrita + el ajuste de comisión (migración 0044) — PASADO A
  PRODUCCIÓN el 2026-09-18**, con el OK explícito de Javier (*"adelante con
  producción"*). Es la corrección de un **error de modelo**, no una mejora: se
  creía que una clase "tenía plata encima" y por eso el congelador prohibía
  tocarla. La plata sale de las membresías completadas y cobradas al 100%; el
  conteo de clases es apenas el insumo del prorrateo. Ahora registrar, corregir
  o suspender siempre se puede, y si el recálculo de una membresía ya liquidada
  da otro número, la diferencia entra como un `ajuste` firmado —complemento del
  período original— sin reescribir lo pagado.
  Migración **0044** aplicada en `pnvhpbxjbdmbktpwebtx` **antes** del código,
  siguiendo el orden de §3. Es puramente estructural: `comisiones_devengadas`
  tenía **0 filas** en producción antes y después. Verificado el `check` con
  `'ajuste'`, el índice único ya parcial (`tipo='comision'`) y la columna
  `ajusta_comision_id`; `get_advisors` sin hallazgos nuevos. Controles de
  `scripts/control_migracion.sql`: **todos OK** en producción. `main`
  `f6f446a..75d33d5` (9 commits).
  **Riesgo medido antes del pase**: producción **nunca liquidó nada** — cero
  liquidaciones y cero comisiones—, así que no hay deltas históricos que
  arrastrar. Su primera liquidación corre en **octubre**, por septiembre, y
  este código es el que la va a gobernar. Certificado con 15 pruebas
  deterministas (`npm test`) y reconciliado contra datos reales en dev, donde
  además **corrigió un descuadre preexistente**: la membresía que el control 18
  marcaba (818,08 devengado contra 800,00 cobrado) pasó a sumar exactamente
  800,00. Detalle completo en `docs/ESTADO.md`.
- **La cuenta del profesor + Caja "Por pagar" (migración 0045; R24, R25, R26) —
  PASADO A PRODUCCIÓN el 2026-09-18**, con el OK explícito de Javier (*"a
  producción"*). Migración **0045** aplicada en `pnvhpbxjbdmbktpwebtx` **antes**
  del código (§3): remapea `pagos.motivo='liquidacion'` → `comision_profesor`
  con respaldo en `pagos_motivo_previo_0045`. Producción tenía **0** pagos con
  el motivo viejo, **0** liquidaciones y **0** comisiones: no tocó ningún dato.
  `get_advisors` sin hallazgos nuevos. Controles en **OK**. `main`
  `4d9e760..3a07c73` (4 commits, incluye las correcciones de Caja: fila
  clicable, glosa que se reinicia, pago suelto a profesor que no toca su saldo,
  y el movimiento suelto que no dejaba guardar).
  **Hallazgo de configuración**: en producción `comision_profesor` está
  **inactivo** en el catálogo `motivo_pago` (y con la etiqueta "Comisiones
  profesor"; en dev está activo). Sin activarlo, el botón de pagar de Caja abre
  el panel con otro motivo. Queda para decisión de Javier.
  *(Resuelto el mismo día: Javier lo reactivó en producción.)*
- **Pago al reemplazante + pago suelto a cualquier profesor (migración 0046;
  D19 / R4) — PASADO A PRODUCCIÓN el 2026-09-18**, con el OK explícito de
  Javier (*"avanza con el pase a PROD"*). Migración **0046** aplicada en
  `pnvhpbxjbdmbktpwebtx` **antes** del código (§3): `pagos.sesion_id` (aditiva,
  con índice) y el motivo `pago_reemplazante` en el catálogo `motivo_pago`, que
  la propia migración inserta (verificado activo). Medido antes: producción
  tenía **0** clases con reemplazo y 34 pagos, ninguno tocado; nada aparece como
  pagable hasta que se registre el primer reemplazo. `get_advisors` sin
  hallazgos nuevos. `main` `816bd9c..929721a`.
  **Cruce de deploys, y cómo se resolvió**: se empujaron cuatro commits
  seguidos y Vercel dejó activo `3a07c73` (terminó último), con código viejo:
  el chip decía `#3a07c73` y parecía que la lista de profesores se había
  revertido. Javier lo corrigió con **Promote** sobre `929721a`. Desde entonces:
  un solo push por pase (§3).
- **Ajustes de Caja sobre lo anterior — PASADO A PRODUCCIÓN el 2026-09-18**, con
  el OK explícito de Javier (*"aplica todo a producción"*), en **un solo push**:
  el nombre de cada motivo sale del catálogo (no de una tabla en el código), el
  total de "Por pagar" suma solo lo que hay que desembolsar y los negativos
  van aparte, y el panel explica cuando no hay a quién elegir. Sin migración.
  `main` `5ad288e..4d897c8`, confirmado por Javier con el chip PROD `#4d897c8`.
- **D1 + D3 (migración 0047) — PASADO A PRODUCCIÓN el 2026-09-24**, con el OK
  explícito de Javier. Antes del pase se armó y se probó de punta a punta un
  **script de rollback** (`scripts/rollback_0047_d1_membresias.sql`): se
  aplicó sobre dev, se comparó por hash contra el esquema pre-D1 real de
  producción (idéntico, `16f59f494766254151e63085520f593d`), y se volvió a
  aplicar la 0047 para dejar dev como estaba. Migración **0047** aplicada en
  `pnvhpbxjbdmbktpwebtx` **antes** del código (§3): las 6 filas de conteo no
  cambiaron (39 membresías, 39 membresia_cursos, 145 asistencias, 39 cuotas,
  38 pagos, 44 corrimientos_ciclo). Los **21 controles en OK**, incluido el
  15 (la deuda propia de D1, ahora resuelta). `get_advisors` sin hallazgos
  nuevos. Código: `main` `f91be80..574636c` (3 commits en un solo push: D1+D3,
  el fix de búsqueda de profesores por nombre, y el script de rollback).
  Detalle completo en `docs/ESTADO.md`, bloque "D1 + D3 — un solo nombre para
  la membresía".
- **C3-0a.1 + C3-0a.2 + C3-0a.3 (migraciones 0048 y 0049) — PASADO A
  PRODUCCIÓN el 2026-09-24**, con el OK explícito de Javier (*"procede con
  los commits pendientes y a producción"*). La 0048 del archivo difería de
  la aplicada en dev (correcciones posteriores, entre ellas el orden del
  relleno: tutores antes que alumnos), así que antes se hizo un **ensayo en
  seco en producción**: la migración entera dentro de un bloque que termina
  en un error provocado y lo deshace todo, devolviendo los conteos y el hash
  del SQL (idéntico al archivo). Recién después, **0048 → 0049** en
  `pnvhpbxjbdmbktpwebtx`, antes del código (§3). Resultado igual al ensayo:
  53 contactos, 0 alumnos/profesores sin contacto, 9/9 menores con tutor, 2
  casos en `contactos_revision_0048` (los esperados), 144 filas en
  `matriz_minimos`. Controles **OK**, salvo el 23 (los 2 WhatsApp fuera de
  formato ya conocidos, en REVISAR a propósito). Código: `main`
  `94308d4..2590c96`, un solo push, chip PROD `#2590c96` confirmado por
  Javier. **Hallazgo abierto:** `get_advisors` marca que las 5 funciones
  `SECURITY DEFINER` de la 0048 son ejecutables por `anon`; sin exposición
  hoy (`contactos_privados` vacío), se cierra con una migración chica
  **antes de cargar el primer documento**. Detalle en `docs/ESTADO.md`.
  *Ese mismo día Javier empezó a cargar documentos en producción y apareció
  un bug al guardarlos. El arreglo, la búsqueda por documento y la migración
  **0050** (que cierra ese hallazgo) están en dev y esperan su propio OK de
  pase.*
