# Tropicana — registro de pases a producción

Movido desde `DECISIONES.md` §4 el 2026-10-02 para que no se cargue en cada sesión. Historial; el estado vigente está en `docs/RETOMAR.md`.

## 4. Registro de pases a producción

- **Hito B + estandarización de /sala + gestión sin salir de la pantalla — PASADO A PRODUCCIÓN el 2026-10-02**, con el OK explícito de Javier (*"pasa producción hasta acá. Te lo solicito explícitamente"*). **Sin migraciones**: producción sigue en 0001–0062. PR #10, `main` `86a812b` (30 commits), un solo push de código; Javier confirmó el chip PROD. Incluye reservas de alquiler gestionables desde `/sala` (corrige el "Esa reserva no existe"), vista de trabajo con barra fija, asistencia embebida, avisos de WhatsApp al suspender/reabrir y navegación interna en la misma pestaña. Control nuevo en `control_migracion.sql` (no corrido en producción). Detalle en `docs/ESTADO.md`.

- **Cierre de cuentas al desasignar + fecha de inicio al asignar (migración 0062;
  D30) — PASADO A PRODUCCIÓN el 2026-10-01**, con el OK explícito de Javier
  (*"sube cierre de cuentas a producción. OK"*). **Independiente de H7**: rama
  `cierre-cuentas` desde `origin/main`, sin las migraciones 0060/0061 (por eso
  producción queda en 0001–0059 + 0062). Orden de §3: medido antes (6
  comisiones, 2 liquidaciones, 47 membresías, check de `tipo` sin `cierre`);
  ensayo en seco; **0062** aplicada en `pnvhpbxjbdmbktpwebtx` antes del código,
  con los mismos conteos después; control 43 en 0; PR #6 con CI en verde,
  `main` `95a0edb`, un solo push. Javier confirmó el chip PROD, desasignó a
  Isabel Góngora (Zumba, corte 10/09) con liquidación del avance y pagó desde
  Caja, todo OK. Pasa con él: `crearAsignacion` exige fecha de inicio, y
  `revertirDevengosAbiertos` no toca los devengos `cierre`. Detalle en
  `docs/ESTADO.md`, "Cierre de cuentas al desasignar".

- **H7 alquiler + ventas y contactos unificados (migraciones 0060 y 0061) —
  PASADO A PRODUCCIÓN el 2026-10-02**, con el OK explícito de Javier (*"ok los
  cambios. avanza a prod"*, y después la orden de aplicar cada migración con el
  contenido exacto del archivo). Orden de §3: medido antes (47 membresías, 47
  cuotas, 50 pagos, 15 reservas, 21 planes; `alquileres_sala` con 0 filas y
  `reservas_sala.alquiler_id` sin ninguna fila con valor); ensayo en seco en una
  transacción terminada en error provocado; **0060 → 0061** aplicadas en
  `pnvhpbxjbdmbktpwebtx` antes del código. Medido después: mismos conteos,
  16 permisos `alquileres`, 2 parámetros, NIT `O` en `tercero_org`,
  `alquileres_sala` borrada, `alumno_id` nullable y `alquiler_id` fuera.
  Controles 1, 5, 6, 42, 43, 44 y 45 en 0; `get_advisors` sin hallazgos nuevos
  (los que marca son previos). Un solo push de `h7-alquiler` a `main`.
  **Pendiente, a mano (Javier):** cargar la tabla de precios de alquiler en
  producción (1 paquete y 9 celdas hoy, contra 12 y 36 en dev) antes de vender
  el primer alquiler; el rol Profesor no tiene `alquileres` hasta que se lo dé en
  Roles y Permisos. Detalle en `docs/ESTADO.md`, "Cierre de la tanda de ventas".

**Pendiente de pase: ninguno.** Todo está en producción, con migraciones 0001–0062 en
producción (0060 y 0061, de H7, desde el 2026-10-02). Cuando algo quede **solo en dev** esperando el OK explícito de Javier
(regla de proceso 1), se anota arriba de esta línea. Abajo, en orden, cada pase ya hecho.

- **Informe de pre-liquidación (`/liquidaciones/pre-liquidacion`) — PASADO A
  PRODUCCIÓN el 2026-10-01**, con el OK de Javier (push a `main`, chip PROD
  `#9a9ff64` confirmado por él). Solo código, sin migración; reusa el permiso
  `liquidaciones.ver`. Probado por Javier en su local: al revisar el PDF vio que la
  liquidación #1 de dev (Núñez) tapaba las comisiones ya devengadas; se borró en dev
  (producción no tiene ninguna liquidación) y se agregó la marca de "membresía de N
  cursos, se prorratea" en "Ciclo que termina después del corte".

- **Depuración de los datos de inicio (sin migración) — PASADA A PRODUCCIÓN el
  2026-10-01**, con el OK explícito de Javier (*"avanza a prod"*), después de
  validarla en dev (refrescado con los datos de producción). Script
  `scripts/corregir_datos_inicio.sql`, que busca por nombre y no por id, aborta si
  no encuentra exactamente lo esperado y deja respaldo en
  `asignaciones_previo_datos_inicio`, `membresias_previo_datos_inicio` y
  `membresia_cursos_previo_datos_inicio`. **Qué cambió:** (1) `desde` de las
  asignaciones vigentes de Bachata Conexión (31/08 → 11/08), Heels (31/08 → 29/08) y
  Ladies (01/09 → 29/08), la primera sesión real de cada curso; (2) tres membresías
  de Zumba del 08/09 (Bs 30, las tres asistieron) que eran clases de prueba del
  "Plan Regular - Zumba" y estaban cargadas sin plan: pasan a prueba de 1 clase, con
  criterio 1, fecha de fin el 08/09 y su fila en `membresia_cursos` (días tomados de
  otra prueba de Zumba). Cobro, estado y asistencia no se tocaron. **Orden seguido:**
  ensayo en seco en producción (transacción terminada en `rollback`, idéntico a dev),
  luego aplicado. **Medido después:** 0 membresías sin plan, control 42 en 0, 0 pruebas
  sin curso; contra el respaldo cambiaron exactamente 3 asignaciones, 3 membresías y
  se agregaron 3 filas de curso (42 → 45); 45 membresías, 46 pagos, 0 liquidaciones y
  0 comisiones, sin cambio. Las tablas `*_previo_datos_inicio` quedan en producción
  como respaldo; se pueden borrar cuando se confirme la primera liquidación.

- **C3 H5 (liquidación de particulares) + Paso 4 (criterios 2 y 3 en regulares)
  — migraciones 0058 y 0059 — PASADO A PRODUCCIÓN el 2026-10-01**, con el OK
  explícito de Javier (*"ya hice esas pruebas. podes pasar a producción"*), después
  de que probara a mano todo en dev. Orden de §3: **1)** medido antes: 45
  membresías (3 sin plan: #17–#19), 45 cuotas, 46 pagos, 176 asistencias, 21
  planes, 15 reservas, **0** comisiones y **0** liquidaciones (producción nunca
  liquidó). **2)** ensayo en seco de las dos migraciones en una transacción que
  termina en un error provocado: las 42 membresías con plan reciben criterio, las
  3 sin plan quedan nulas, el parámetro nace, ningún plan con cortesía.
  **3)** **0058 → 0059** aplicadas una por una en `pnvhpbxjbdmbktpwebtx`, antes del
  código, con `notify pgrst`. Medido después: mismos conteos de membresías,
  cuotas, pagos, asistencias, planes y reservas; 42 con criterio, 3 sin plan;
  parámetro `particular_vencida_modo` presente. **4)** control **42** (nuevo,
  membresía de plan regular sin criterio) en **0**; `get_advisors` sin hallazgos
  nuevos (los que marca son previos). **5)** recién entonces el PR y el merge,
  en un solo push. **Pendiente, a mano (Javier):** activar "Permite sala externa"
  en los dos planes de boda. **Pendiente, a propósito después del pase:** depurar
  los datos de inicio de producción (asignaciones #22/#12–#14; membresías #17–#19)
  y el informe imprimible de pre-liquidación — antes de generar la primera
  liquidación de producción (septiembre). Detalle en `docs/ESTADO.md`,
  secciones "C3 — H5" y "C3 — H5, Paso 4".

- **"Agendamientos externos de hoy" en `/sala` — PASADO A PRODUCCIÓN el
  2026-09-27**, con el OK explícito de Javier ("ok a prod"). Sin migración:
  solo código, así que el orden fue directo — CI de Vercel en verde, PR #4
  (`sala-externa-visibilidad` → `main`) mergeado. `main` `c33d8da..46bb4d3`.
  Detalle completo del hito en `docs/ESTADO.md`, sección "Agendamientos
  externos de hoy, en /sala".

- **Fix de `contacto_id` + sala externa por plan + duplicados en Precios y
  paquetes (migración 0057) — PASADO A PRODUCCIÓN el 2026-09-27**, con el OK
  explícito de Javier ("te di mi ok explícito: ok para pasar a producción").
  Orden seguido, tal cual §3: **1)** medido antes: 16 planes (3 de
  particulares), la columna `permite_sala_externa` no existía. **2)** ensayo
  en seco en `pnvhpbxjbdmbktpwebtx` (la migración completa dentro de una
  transacción que termina en un error provocado y lo deshace todo) —
  confirmó que corre sin errores. **3)** migración **0057** aplicada de
  verdad: los 16 planes quedaron con `permite_sala_externa = false` (ningún
  dato de dominio tocado, igual que el ensayo). **4)** controles 1–8 y 28–31
  del script en **OK**; `get_advisors` sin hallazgos nuevos (los que marca
  son previos: tablas `*_previo_*`, la extensión `btree_gist`, las funciones
  `SECURITY DEFINER` ya conocidas). **5)** recién entonces el PR #3
  (`ajustes-particulares` → `main`) se mergeó, con el CI de Vercel en verde.
  `main` `2b43e87..962e45c`, confirmado por el chip PROD `#962e45c`.
  **Pendiente, a mano**: activar "Permite sala externa" en los dos planes de
  boda desde Planes — la migración no los toca a propósito. Detalle completo
  del hito en `docs/ESTADO.md`, sección "Ajustes tras cargar datos reales:
  contacto_id, sala externa por plan, duplicados en Precios".

- **C3 H4 (cierres de sala sobre reservas) + navegación enfocada desde `/sala`
  y alcance propio de Particulares — PASADO A PRODUCCIÓN el 2026-09-26**, con
  el OK explícito de Javier ("Podemos avanzar a producción PR", confirmado
  después de revisar el CI: *"confirmado."*). Javier había probado los dos
  bloques a fondo en su local antes de pedirlo — H4 en el recorrido inicial, y
  el fix de navegación/permisos con su propia cuenta y con la de Oscar Núñez
  (rol Profesor, alcance real).
  Orden seguido, tal cual §3: **1)** migraciones **0055** y **0056**
  aplicadas en `pnvhpbxjbdmbktpwebtx`, cada una precedida de un ensayo en
  seco (una transacción con las dos migraciones juntas que termina en un
  error provocado y lo deshace todo) para confirmar que corrían sin errores
  antes de tocar producción de verdad. Medido antes: 1 reserva, 67 sesiones,
  4 valores del catálogo `motivo_suspension_reserva`, 0 filas en
  `disponibilidad_sala`/`rol_visibilidad(particulares)`. Aplicadas una por
  una, sin tocar ningún dato de dominio (mismos conteos de reservas/sesiones
  después); el catálogo pasó a 6 valores, `disponibilidad_sala` quedó con 17
  filas (copiadas de `sala` para cada rol, incluido el rol `comercial` propio
  de producción), el Profesor con `disponibilidad_sala.ver = true` y
  `particulares` en alcance `propio`. Controles 1–8 y 32–38 del script en
  **OK**; `get_advisors` sin hallazgos nuevos atribuibles a estas dos
  migraciones (los que marca son previos: tablas `*_previo_*`, la extensión
  `btree_gist`, las funciones `SECURITY DEFINER` ya conocidas). **2)** recién
  entonces el PR #2 (`h4-cierres-reservas` → `main`) se mergeó, con el CI de
  Vercel en verde (deploy + preview comments, los dos `pass`). `main`
  `23176a6..f4e01af`. Detalle completo del hito en `docs/ESTADO.md`, sección
  "C3 — H4: cierres de sala sobre reservas".

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
  **0050** (que cierra ese hallazgo) se confirmaron en dev (*"confirmo mi ok
  con el arreglo del documento +0050 aplicados en DEV"*) y pasaron junto con
  lo de abajo.*
- **Arreglo del documento + 0050 y abrir perfil de red / chat de WhatsApp +
  0051 — EN PRODUCCIÓN el 2026-09-24.** Las dos migraciones figuran
  aplicadas en `pnvhpbxjbdmbktpwebtx` a las 16:06 UTC (`list_migrations`) y
  el código está en `main` (`baba6c7`, `f995dee`). **Este registro se
  escribió después**: el pase se hizo sin actualizar este documento, que
  seguía diciendo "en dev". Medido al registrarlo: 4/4 redes con
  `patron_url`; `anon` ya no ejecuta ninguna función `SECURITY DEFINER` de
  la 0048 (solo `es_admin` y `handle_new_user`, viejas e idénticas en dev).
- **Todas las pantallas arrancan en el mismo borde (`<Pagina>`, regla de
  calidad 8) + Inscribir alineado, prueba sin estado ambiguo y ficha que
  abre para ver — PASADO A PRODUCCIÓN el 2026-09-24**, con el OK explícito
  de Javier (*"estoy listo para pasar a prod"*), después de la verificación
  en navegador de las 19 pantallas a 1600px y 375px (detalle en
  `docs/ESTADO.md`). **Sin migración.** `main` fast-forward desde `f995dee`,
  en un solo push (§3).
- **C3 H1 + H2 + H3 (migraciones 0052, 0053 y 0054) + WhatsApp app-primero —
  PASADO A PRODUCCIÓN el 2026-09-26**, con el OK explícito de Javier (*"ok,
  pase."*), después de probar H3 en su local en dos rondas. Orden de §3:
  - **Antes de tocar nada**, se comprobó que los archivos del repo fueran lo
    que corrió en dev: la 0052 idéntica por hash; la 0053 y la 0054 difieren
    solo en comentarios y en el `set search_path = public` de sus cuatro
    funciones, que dev ya tenía aplicado (medido en `pg_proc.proconfig`).
    Los archivos son el estado final de dev.
  - **Medido en producción antes**: `paquetes_particular` 0 filas (el drop
    de la 0053 no pierde nada), 0 alquileres, 0 comisiones/reservas con
    paquete, 1 sola reserva (un bloqueo `cancelada`), las 39 membresías con
    contacto (el backfill de la 0053 pasa).
  - **Ensayo en seco en producción**: las tres migraciones juntas dentro de
    una transacción que termina en un error provocado y lo deshace todo,
    devolviendo los conteos (39 membresías, 0 sin contacto, 3 salas con la
    externa, 1 reserva con su historial, los 3 parámetros, los 4 motivos,
    cuotas/pagos/asistencias intactos). Verificado después que producción
    quedó sin tocar.
  - **0052 → 0053 → 0054** aplicadas una por una en `pnvhpbxjbdmbktpwebtx`,
    **antes** del código. El SQL guardado en `schema_migrations` da el
    **mismo hash que cada archivo del repo** (lo aplicado es exactamente lo
    versionado). Resultado igual al ensayo; ningún dato de dominio cambió
    (39 membresías, 39 cuotas, 38 pagos, 145 asistencias, 13 planes, 7
    profesores). `notify pgrst` corrido.
  - **Controles** de `scripts/control_migracion.sql` (1–36) en **OK** en
    producción, salvo el 23 (WhatsApp fuera de formato, en REVISAR a
    propósito — bajó de 2 casos a 1). `get_advisors` sin hallazgos nuevos:
    las 4 tablas nuevas con RLS y sus políticas, las 4 funciones nuevas
    `security invoker` con `search_path` fijo; lo que marca es anterior.
  - **Código**: `main` fast-forward desde `3416659` hasta el commit que
    trae este registro, en **un solo push** (PR #1).
  - **Hallazgo menor, sin efecto hoy**: el trigger de historial de la 0054
    es `AFTER`, así que su "limpiar las columnas de último cambio" no hace
    nada. No deja rastro equivocado porque las tres acciones que actualizan
    reservas completan las cuatro columnas en cada update; queda anotado
    para cuando se toque ese trigger (H4).

- **2026-10-07 (noche) — I-001 e I-009** (OK explícito de Javier). **Sin migraciones:** producción sigue en 0001–0062; no hubo SQL ni cambio de datos, así que no hay antes/después ni rollback de datos.
  - **Código:** PR #15 (`fix/i-009` → `main`), merge `29fb879`, **un solo push**. Vercel: deploy de Producción del commit `29fb879` en estado `success`.
  - **Qué llega:** mensaje de confirmación de inscripción con recibo por WhatsApp (I-001) y «Clase N de M · quedan K» con la pastilla «Última clase» en Asistencia (I-009).
  - **Verificado:** `tsc`, `lint` y `npm test` (286) antes del pase; ambos validados por Javier en dev. Pendiente de Javier: ver en producción el chip PROD con `29fb879`.
