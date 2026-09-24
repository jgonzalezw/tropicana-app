# Tropicana — ESTADO (fuente única de verdad del avance)

> Este documento es la memoria del proyecto entre sesiones. Se versiona en cada
> hito. Ante contradicción entre este doc y el repo, **gana el repo** (y se
> corrige acá). Documentos hermanos: `docs/PLAN_ETAPA1.md` (plan técnico),
> `docs/design/README.md` (fuente de verdad del **diseño**), `docs/CONTEXTO_AVANCE.md`
> (bitácora larga de Etapa 0), `docs/DESIGN_SYNC.md` (cómo entran los handoffs).
>
> **Última actualización:** 2026-09-24 — **D1 + D3: la membresía queda con un
> solo nombre, en producción.** Migración **0047** (`inscripciones`→`membresias`,
> `inscripcion_cursos`→`membresia_cursos`, `inscripcion_id`→`membresia_id` en
> las 5 tablas que lo tenían) aplicada primero en dev y, con el OK explícito
> de Javier, después en producción, más el renombre de
> `ClienteVentas.tsx`→`MostradorVenta.tsx` (D3). Javier decidió hacerla ahora,
> antes de C3-0a.1, para que el código de contactos se escriba una sola vez
> con el nombre correcto (evaluación completa en el plan de C3-0). Antes del
> pase se armó y se probó de punta a punta un **script de rollback**
> (`scripts/rollback_0047_d1_membresias.sql`), verificado por hash contra el
> esquema real de producción. En producción: los **21 controles en OK**
> (control 15, la deuda de este mismo D1, pasa de REVISAR-a-propósito a
> **OK**), ningún dato tocado (mismas 39/39/145/39/38/44 filas antes y
> después), `get_advisors` sin hallazgos nuevos. Código: `main`
> `f91be80..574636c`, un solo push. Detalle abajo.
>
> **2026-09-23 (antes)** — **D2 (mudanza del repo fuera de
> OneDrive) cerrada definitivamente.** La carpeta vieja de OneDrive ya fue
> eliminada (Javier, 2026-09-23) — el stash que ahí quedaba estaba vacío (ver
> abajo), y no hay ningún paso manual pendiente. Detalle en `DECISIONES.md`
> (D2) y `docs/MUDANZA_REPO.md`.
>
> **2026-09-23 (antes, antes)** — **Conversión de prueba y redención de
> bono: probadas por Javier, confirmadas ya en producción, sin pase pendiente.**
> Javier probó en dev (18/09) los dos flujos del motor de venta que no tenían
> hito propio en este documento: la **conversión de prueba → inscripción**
> (`pruebaConvertible`, `inscribir/acciones.ts` — acredita como descuento la
> parte del alumno de lo pagado por su prueba, si convierte el mismo plan
> dentro de plazo) y la **redención del bono de tolerancia al reinscribir**
> (`bono_redimido`, mismo archivo — suma al ciclo nuevo las faltas con
> licencia no redimidas de ciclos `completada` del mismo plan). Confirmó:
> *"ok las pruebas de redención del bono de prueba realizadas, puntos 1 y 2"*,
> y pidió pasar a producción si no estaba. **Medido antes de tocar nada**
> (regla de calidad 3): `git log origin/main..HEAD` y `HEAD..origin/main`
> vacíos (local = `origin/main` en `7bb05d5`), sin diffs locales sin commitear
> en `inscribir/acciones.ts` ni `lib/membresias.ts`, y las columnas que ambos
> flujos necesitan (`inscripciones.bono_redimido`/`es_prueba`/`acompanantes`/
> `membresia_anterior_id`, `planes.acepta_prueba`/`prueba_acredita`/
> `prueba_cursos_max`/`prueba_plazo_dias`) ya existen en producción
> (`pnvhpbxjbdmbktpwebtx`, verificado contra `information_schema.columns`).
> **No eran una feature nueva sin publicar**: el código de los dos flujos
> quedó tocado por última vez en los commits `11c37f9` (16/09) y `8d8a6cf`
> (12/09), ya documentados más abajo como pasados a producción en esos pases.
> **Conclusión: no hubo migración ni pase que hacer** — ambos flujos ya
> corrían en producción desde antes de esta verificación.
>
> **2026-09-18 (antes)** — **La cuenta del profesor: la deuda de
> una liquidación se refleja y se paga clasificada (migración 0045), en dev.**
> El pago de una liquidación se asentaba con un motivo inventado y no caía en
> ningún bucket de Caja: plata que salía sin clasificar. Javier amplió el
> alcance —*"una liquidación deja deuda, y una reliquidación también"*— y eso
> trajo el lado de pagar de Caja, que era R3. Sobre dos ejemplos comparados
> decidió que la unidad de la deuda es **la cuenta del profesor** (el saldo suma
> todos sus períodos, así un pagado de más se compensa solo) y que **además los
> períodos cierren al pagar**. Cierra R24, R25, R26 y el núcleo de R3 y R5.
> Detalle en el bloque **"La cuenta del profesor"**. Pendiente el OK para
> producción.
>
> **2026-09-18 (antes)** — **Las clases solo afectan contadores:
> el congelador deja de bloquear y aparece el ajuste (migración 0044).**
> Javier corrigió un error de modelo que venía de arrastre: se creía que una
> clase "tenía plata encima" y por eso el congelador prohibía tocarla si de ella
> dependía una comisión pagada. La premisa era falsa — la plata sale de las
> membresías completadas y cobradas al 100%, y el conteo de clases es apenas el
> insumo del prorrateo. Entonces prohibir era la respuesta equivocada: hay que
> dejar registrar, corregir y suspender, y **compensar la diferencia** con un
> `ajuste` firmado que entra como complemento del período original, sin
> reescribir lo pagado. Antes de tocar el motor se lo **certificó**: se extrajo
> el cálculo a `src/lib/liquidacion/motor.ts` (sin base de datos) y se fijó con
> **15 pruebas deterministas** (`npm test`, cero dependencias nuevas), más un
> script de reconciliación contra datos reales — que de paso explicó el
> descuadre de 18,08 que el control 18 marcaba hace días. **Producción nunca
> liquidó nada**: su primera liquidación corre en octubre, así que no hay deltas
> históricos que arrastrar. Detalle en el bloque **"El mensaje de 'clase
> congelada' no se notaba"**. **En producción desde el 2026-09-18** (`main`
> `75d33d5`); su primera liquidación corre en octubre.
>
> **2026-09-17** — **Visibilidad "propio/todo" por rol y
> módulo (migración 0043), pasada a producción.** Javier: un Profesor con acceso a un módulo
> veía TODO, no solo lo suyo (todos los cursos en Tomar Asistencia; si se le
> habilitara Liquidaciones, todas — y por URL directa, cualquiera con el módulo
> abierto podía ver el comprobante de otro profesor). Se descartó la primera
> idea (cablear "si el rol no es admin/gerente/asistente, filtrá") porque
> Javier señaló que eso pega más las claves de rol a la lógica — medido: la
> única clave cableada en todo el código es `'administrador'`; `gerente`/
> `asistente` no aparecen en ningún lado, y `eliminarRol` ya bloquea borrar un
> rol con usuarios o `es_sistema`. En su lugar, una dimensión **configurable**
> por (rol, módulo) en `rol_visibilidad`, sin cablear nada nuevo. Cubre
> Asistencia (el profesor ve solo sus cursos asignados), Liquidaciones (solo
> las propias, y cerrado el agujero de `/liquidaciones/<id>` por URL directa)
> y Caja (el asistente ve/suma solo lo que él registró). Verificado en dev
> con la cuenta real de Oscar Núñez. Gerente/Asistente quedan **configurables**
> (no se convirtieron en roles de sistema). Detalle en el bloque **"Visibilidad
> de datos propios (0043)"**. `main` `59356a3..4e1aebc`, controles en OK.
>
> **2026-09-17 (antes)** — **C2 pasado a producción**, con el OK
> explícito de Javier (*"avanza. ok"*, tras validar en dev y confirmar
> corregidos dos bugs que encontró probando). Disponibilidad de sala + bloqueos
> como pantalla operativa propia (`/sala`, grupo Gestión), separada de
> Administración → Sala y horarios. Migraciones **0040** (glosa/notas en
> `reservas_sala`) y **0041** (rol Profesor ve la disponibilidad) aplicadas en
> `pnvhpbxjbdmbktpwebtx`; `main` `65aa8d9..accaa70`; controles en OK (control 15
> REVISAR a propósito, deuda D1). Detalle en el bloque **"C2 — Disponibilidad +
> reserva mínima de sala"**. Sigue C3 (venta de particulares/alquiler), sin
> empezar todavía.
>
> **2026-09-16** — **pase completo a producción**, con
> el OK explícito de Javier (*"pasa todo"*), de la secuencia de bugs en su
> orden de prioridad (1, 5, 4 cerrados; 3 y 2 pendientes) más lo que ya
> estaba validado en dev desde el 12/09 esperando su turno: **Roles y
> Permisos** de Planes/Liquidaciones/Precios/Sala (migración 0038), **C5**
> (cierre de sala avisa y suspende con confirmación), **Cuenta del alumno**
> (multi-curso completo + fecha de fin real o estimada, aplicada también al
> recibo), dos correcciones de UI (menú retráctil en celular, botón
> "Guardar" que dejaba de invitar a repetir), y **Precios y paquetes** (D8) +
> **Sala y horarios** (C1) + la segunda sala (migraciones 0035–0037).
> Migraciones aplicadas una por una en `pnvhpbxjbdmbktpwebtx` (0035→0038,
> en orden, antes del código); controles de `scripts/control_migracion.sql`
> en **OK** (control 15 en REVISAR a propósito, deuda D1 conocida). `main`
> `11c37f9..7003295`. Detalle en los bloques finales correspondientes y en
> `docs/DECISIONES.md` §4.
>
> **2026-09-16 (antes)** — **bug de asistencia corregido y
> PASADO A PRODUCCIÓN**, con el OK explícito de Javier ("pasalo"). `main` en
> `11c37f9`, confirmado por el chip PROD de la app. **Pase acotado a
> propósito**: solo los dos archivos del fix, sin arrastrar las migraciones
> 0035–0037 ni sus pantallas, que siguen solo en dev esperando su propio OK.
> Detalle en el bloque final **"Un alumno duplicado en el padrón de
> asistencia"**.
>
> **2026-09-12 (noche)** — **C1 cerrado y validado**, y
> apareció una **segunda sala** en la sede, que se modeló el mismo día. Detalle
> en el bloque final **"La segunda sala, y las excepciones por rango"**. Antes,
> ese mismo día: **arrancó el Paso 2D y la base
> del Paso 5.** Se construyó *Precios y paquetes* (D8: el centro único de los
> precios base, cinco pestañas) y la **migración 0035**, que agrega los precios
> de particulares y la matriz de sala, las ventas con contador, y `reservas_sala`
> con no-choque garantizado por la base. **Validado en dev por Javier**
> (*"veo todo ok"*), **solo en dev**, pendiente del OK para producción. Ver el
> bloque final **"Precios y paquetes, y la base de la sala"**.
>
> **Dónde estamos, en una línea:** Paso 1 cerrado y en producción; **Paso 2 en
> curso** (empezó por los precios base, falta la venta); **Paso 5 con la base de
> datos hecha y la agenda visual pendiente**. La secuencia completa, en §0bis; lo
> que Natalia necesita y el encuadre de los dos ejes, en **§0duodecies**.
>
> **2026-09-10 — Consolidación de estado a pedido de
> Javier: ver **§0bis** (tabla de los 7 pasos) para la foto completa. **Motor
> de Planes y Membresías en PRODUCCIÓN.** 1B.2 y 1C-core cerrados (liquidación
> criterio 1 de punta a
> punta); correcciones de la revisión de Javier (asistencia/tolerancia/
> liquidación) aplicadas y validadas por Javier en dev. Migraciones `0012` a
> `0015` aplicadas en producción (vía conector Supabase MCP) y `main`
> actualizado (`ef6a517..1d59e42`, fast-forward) — Vercel desplegó solo
> (branch tracking activo en `main`), deployment `1d59e42` en estado
> **Ready**, error rate 0%. Ver el bloque **PRIORIDAD: LIQUIDACIÓN** más abajo
> para el detalle vigente.
>
> **2026-09-10 (tarde) — segundo pase a producción, con OK explícito de Javier.**
> Migraciones **`0016`** (reparación de las membresías migradas: `fecha_fin`,
> contadores, bono y restricción de fechas coherentes) y **`0017`** (cuota para
> toda venta, nada de plata colgada) aplicadas en producción y verificadas con
> `scripts/control_migracion.sql` (7/7 OK, antes 4 en rojo). `main` actualizado
> (`900f9ca..1687b47`, fast-forward). Tres decisiones de política registradas en
> §0ter. Después se sumó una cuarta decisión (el paquete por clase se cierra
> cuando está **consumido y pagado**) con su migración `0018`, aplicada en dev
> y **pendiente del OK para producción** junto con el código que la acompaña.
> **Rama de trabajo:** `claude/tropicana-app-context-d5zjt8` (mergeada a `main`; se sigue usando para nuevo desarrollo).
> **Pase a producción — vuelve a requerir OK explícito (revocado 2026-09-10).**
> La autorización permanente del 2026-09-09 (aplicar migraciones y mergear/
> pushear a `main` sin confirmar cada vez, una vez validado el checklist en
> dev) **queda sin efecto**: validar en dev **no** dispara producción sola.
> Se sigue: validar en dev → **esperar el OK explícito de Javier** → recién
> ahí aplicar migraciones a producción y mergear/pushear a `main`.
>
> **Chip de entorno/versión (2026-09-10).** Login y barra lateral muestran un
> chip **DEV** (rojo) / **PROD** (verde) + commit corto, para validar de un
> vistazo a qué base está conectada la instancia. `src/lib/version.ts`
> decide el entorno por `NEXT_PUBLIC_SUPABASE_URL` (contiene el ref de
> producción `pnvhpbxjbdmbktpwebtx` → PROD; cualquier otra cosa, incluido
> `tropicana-dev` o nada configurado → DEV) y toma el commit de
> `VERCEL_GIT_COMMIT_SHA` (vacío en local). `src/components/InfoRelease.tsx`
> es el chip compartido; `/login` pasó a ser server component (el form
> interactivo se movió a `LoginForm.tsx`). Probado localmente con ambas URLs
> (dev y prod) vía `next build && next start`: renderiza DEV/PROD y el sha
> correctamente. Validado tsc/eslint/build.
>
> **REENCUADRE VIGENTE (2026-09-05):** el sistema se replantea al **Motor de
> Planes y Membresías** (doc "Diseño del Motor de Planes y Membresías" v1.3). El
> plan de cierre de Etapa 1 bajo ese modelo está en
> `docs/PLAN_CIERRE_ETAPA1_v2_MOTOR.md` (**supersede** a `docs/PLAN_ETAPA1_CIERRE.md`),
> secuencia de **7 pasos (0 a 6)** — ver la tabla de estado consolidado justo
> abajo. **Paso 1 completo y en producción; el Paso 2 no arranca sin OK
> explícito de Javier** (regla de trabajo permanente, §7).

---

## 0bis. Estado consolidado — secuencia del Motor de Planes (7 pasos)

Referencia: `docs/PLAN_CIERRE_ETAPA1_v2_MOTOR.md` §2. Actualizado 2026-09-10.

| Paso | Qué es | Estado |
| --- | --- | --- |
| 0 | Reencuadre al Motor de Planes y Membresías | ✅ Hecho (2026-09-05) |
| **1** | **Liquidación a profesores** (motor base Plan Regular: planes N/ilimitado, multi-curso, asistencia con contador/completada/tolerancia/bono, liquidación criterio 1 + comprobante) | ✅ **v1 y v2 EN PRODUCCIÓN** (v1 el 2026-09-09/10; v2 el 2026-09-12): prorrata multi-curso real (reglas 10/16/17/18/19/20), quién dictó la clase, descuento del reemplazante, comprobante auditable. Migraciones 0023–0033 |
| 2 | Venta de particulares/alquiler + confirmar sesión (con horario) + renovación + estado de cuenta del alumno | 🟡 **Arrancó el 2026-09-12 por los precios base.** *Precios y paquetes* (D8) construida y **validada en dev por Javier**: las cinco pestañas, con los paquetes de particular (bloque D) y la matriz de sala (bloque E) que son las que faltaban para poder cotizar. Falta la venta en sí (*Vender servicio*) y la confirmación/reserva de sesión. Migración **0035**, solo en dev |
| 3 | App Shell (armazón + visual ya diseñado) + Dashboard operativo | ⏳ Pendiente — no iniciado |
| 4 | Costos fijos | ⏳ Pendiente — no iniciado |
| 5 | Agenda de sala (+ `duracion_min` en `cursos`) | 🟡 **Base de datos construida el 2026-09-12** (migración 0035, solo en dev): `salas` (D20), `reservas_sala` con una restricción `EXCLUDE` que impide en la **base** que dos reservas de la misma sala se pisen, y los motivos de bloqueo sin venta (D7). Falta **la agenda visual**, que Javier marcó como no negociable: *"es una herramienta fundamental para Natalia por su vista. Debe ir, ya es hoy un problema para ella."* Sin mockup todavía. Ver §0duodecies |
| 6 | Alineación a estándares del resto de pantallas (ver `docs/PLAN_UX_DANZE.md`) | 🟡 En curso, parcial — Toggle estándar adoptado y pantalla Planes ya alineada; Cursos/Profesores/Dashboard/navegación siguen en el backlog de `PLAN_UX_DANZE.md` |

**Dónde estamos (2026-09-12, tarde).** El **Paso 1 está cerrado y en
producción**, v1 y v2: el motor de planes multi-curso de punta a punta —prorrata
por curso y por profesor, las reglas de negocio 10 y 16 a 20, quién dictó cada
clase, el descuento del reemplazante— más la clase de prueba completa y la
vigencia del curso. Migraciones **0023 a 0033**, `main` en `2c29cf1`.

El Paso 2 está **a mitad**: 2A, 2A.1 y 2B en producción; 2D solo con la clase de
prueba. **2C, 2E, 2F, 2G y 2H no arrancaron**, y los pasos 3 a 5 tampoco.

**Infraestructura construida como prerrequisito del Paso 1 (no es un paso
numerado de la secuencia, pero fue condición para poder construirlo):**
- ✅ Ambiente **`tropicana-dev`** (proyecto Supabase separado, `hyhijzuomqpylcmrzdvw`) — operativo desde 2026-09-05, para probar sin tocar producción.
- ✅ Mecanismo de **refresh producción → dev** (`scripts/refresh-dev.mjs`, Node+`pg`) — copia datos de dominio de producción a dev (solo lectura sobre prod), anula referencias a usuarios, preserva ids/auto-referencias, reajusta secuencias, backfill post-refresh de `plan_cursos`/`inscripcion_cursos`/`planes.modalidad`. Documentado en `docs/SETUP_TROPICANA_DEV.md` §8.
- ✅ Acceso directo a ambas bases (dev y producción, `pnvhpbxjbdmbktpwebtx`) vía conector **Supabase MCP** — confirmado 2026-09-09; permite aplicar migraciones y verificar esquema sin pegar SQL a mano en el editor de Supabase.
- 🔁 **Autorización de pase a producción — histórico:** el 2026-09-09 Javier dio autorización permanente para aplicar migraciones y mergear/pushear a `main` sin confirmar cada vez, una vez validado el checklist en dev; **el 2026-09-10 la revocó**: vuelve a requerir su **OK explícito** antes de ese último paso (validar en dev no dispara producción sola). Sigue vigente la regla de "un hito a la vez, cerrado con `ESTADO.md` actualizado" (§7).
- ✅ Chip de entorno **DEV/PROD** + commit, visible en `/login` y en la barra lateral (`src/lib/version.ts`, `src/components/InfoRelease.tsx`) — 2026-09-10, para validar de un vistazo a qué base está conectada cualquier instancia corriendo.

## 0ter. Decisiones de política y reparación de la migración (2026-09-10)

**Tolerancia y bono — regla vigente (Javier, 2026-09-10).** El bono de
tolerancia premia al ciclo **sin faltas injustificadas**: se acredita solo si
hay una falta **con licencia** y **ninguna sin licencia** en el ciclo. Basta una
falta sin licencia para que el ciclo quede sin bono, aunque el plan tuviera
cupo. En Asistencia, el check "Con licencia" deja de ofrecerse en ese caso y se
explica el motivo en la fila ("Sin bono: ya tiene una falta sin licencia en el
ciclo"). Implementado en la lectura del padrón (`toleranciaRestante` = 0 y
`faltaSinLicenciaEnCiclo`) y en `recalcularMembresia` (`bono = 0` si hay faltas
sin licencia). *Sustituye a la regla anterior, que solo miraba el cupo del plan.*

**Toda venta tiene su cuota (Javier, 2026-09-10).** Lo que se vende se cobra, y
el mecanismo es la **cuota**: ninguna venta puede quedar con plata colgada fuera
de una cuota. Antes del motor, los paquetes por clase y el medio mes cobraban
sin crear cuota (`pagos.cuota_id` vacío): esa plata no aparecía en el estado de
cuenta ni entraba en la base de comisión (liquidaban Bs 0). La venta actual ya
crea siempre la cuota del ciclo; `0017` cerró el pasado. **Regla para el Paso 2
(particulares/alquiler): toda venta nueva crea su cuota.**

**Base de comisión (Javier, 2026-09-10, ratifica lo de 2026-09-07).** Siempre
sobre **lo efectivamente cobrado** (el descuento no suma), con el **criterio 1**
de liquidación. Sin cambios en el código: ya funcionaba así.

**Reparación de las membresías migradas — `0016`.** La `0011` convirtió las
inscripciones en membresías pero **no calculó `fecha_fin`**, y ningún proceso
posterior la completa (`recalcularMembresia` toca contadores y estado, nunca la
fecha). Medido en producción el 2026-09-10: **13 de 13** membresías de plan sin
`fecha_fin` — con lo cual **ninguna podía liquidarse jamás**, porque
`calcularPendientes` exige `fecha_fin` no nula y dentro del mes vencido — y
**13 de 13** con `clases_hechas = 0` pese a tener asistencia tomada. La `0016`
completa `fecha_fin` con la misma regla que la venta (fecha de la clase N por
calendario sobre los días de la membresía; ilimitados: inicio + `ciclo_dias`),
recalcula contadores/bono/estado desde las asistencias de sesiones dictadas, y
agrega la restricción `inscripciones_fechas_coherentes` que rechaza un ciclo que
termine antes de empezar. Idempotente (dos corridas, misma huella) y verificada
en dev y en producción.

**Control permanente:** `scripts/control_migracion.sql` — 7 controles de solo
lectura (fechas de fin, ciclos coherentes, contadores, bono contra faltas sin
licencia, plata sin cuota, membresías sin cuota, estado de cuota vs. cobrado).
Corre en cualquiera de las dos bases. Producción quedó 7/7 OK.

**Regla base del modelo — la membresía se cierra completada Y cobrada (Javier,
2026-09-10: "ha sido siempre la base, el punto de partida").** Vale para
**toda** membresía, no solo para los paquetes: `estado='completada'` exige las
**dos** condiciones, ciclo agotado **y** sin saldo. Agotada con deuda sigue
`activa`, porque la venta no terminó.

*Agotado* según cómo se vendió: un **plan con N** se agota cuando ocurrieron sus
N sesiones dictadas (la falta no lo alarga: la clase pasó); un **paquete por
clase** cuando consumió las clases compradas (solo la asistencia consume; una
falta no lo gasta, el alumno conserva su clase). Las **ilimitadas** no se
cierran por contador: terminan por `fecha_fin`.

**Separación importante que trajo esta regla:** *agotarse* y *cerrarse* dejaron
de ser lo mismo. Antes el `estado` hacía las dos cosas, y el padrón de
asistencia se apoyaba en él para dejar de listar a quien ya terminó su ciclo. Si
el estado ahora depende también del pago, una membresía terminada pero impaga
seguiría `activa` y el alumno seguiría tomando clases gratis, con el contador
pasándose de N. Por eso el padrón ya **no** mira `estado` para eso: usa
`cicloAgotado` (consumo real contra N o contra el paquete), y el estado queda
solo para decir si la venta se cerró. Quien ya tiene marca en la sesión abierta
igual se sigue mostrando, para poder corregirla.

*Efecto sobre los datos:* ninguno hoy. Verificado en dev y en producción — cero
membresías cuyo estado difiera de la regla —, así que no hizo falta migración:
el cambio es de código, protege hacia adelante. Queda como **control 8** de
`scripts/control_migracion.sql`.

*Origen:* el motor solo cerraba las membresías **de plan**;
`recalcularMembresia` se salteaba las que no tienen plan, así que los paquetes
por clase quedaban `activa` para siempre. Eso explica el hallazgo que estuvo
abierto unas horas: las membresías **17, 18 y 19** (Zumba, clases sueltas del
08/09) pasaron de `activa` a `completada` en producción el 2026-09-10 08:43 UTC
por una sola sentencia SQL manual —alguien las cerró a mano porque el sistema no
lo hacía—, y dev quedó desalineado (seguían `activa`). Resuelto: la lógica ahora
las cierra sola al guardar asistencia, y `0018_cerrar_paquetes_consumidos`
pone al día lo existente en las dos bases.

**Límite conocido de esta regla.** No hay pantalla para registrar un **cobro
posterior**: hoy solo se cobra en el momento de la venta (`/inscribir`), no
existe forma de saldar una deuda después (por eso los Bs 340 de Ayoroa, Carola
no se pueden cobrar desde la app). Mientras eso no exista, un paquete consumido
con saldo queda abierto sin manera de cerrarlo desde la interfaz. **Lo resuelve
el Paso 2** (estado de cuenta del alumno); cuando se construya esa pantalla,
tiene que llamar a `recalcularMembresia` al registrar el cobro, o el cierre no
se dispara.

## 0quater. Caja (2A) y notas para el Paso 2 (2026-09-10)

**Caja — primera rebanada construida.** Fiel al handoff `Caja y resumen.dc.html`
(§Screen 3 del README de diseño): registrar un movimiento inline, con el paso
`Cobro` compartido montado sobre el saldo real de una deuda. Se llega navegando
desde Caja (dirección → motivo → titular con su saldo) o con el contexto ya
resuelto desde la operación. Sin migración para lo base; **`0019`** sumó
`pagos.fecha_efectiva` para lo de abajo. Ronda de pruebas de Javier en dev,
2026-09-10, tres hallazgos — los tres corregidos en la misma ronda:
- La glosa que el usuario tipeaba en Caja **no se guardaba** cuando el cobro
  iba contra una cuota (`registrarCobro` no la recibía; solo se usaba la nota
  del medio de pago). Corregido: ahora se persiste siempre.
- La glosa se sugiere sola con el mismo texto explicativo que ya se mostraba
  arriba del botón Guardar (sujeto · detalle · saldo → queda), editable —
  antes había que escribirla a mano con el contexto ya resuelto en pantalla.
- Un cobro parcial en Caja no pedía la **fecha de compromiso de pago** del
  saldo, rompiendo la consistencia con `/inscribir` (que sí la pide). Ahora
  `registrarCobro` aplica la misma regla exacta (mismo tope por el parámetro
  `dias_compromiso_pago`, misma copy) y la persiste en `cuotas.fecha_compromiso`.
- **Fecha efectiva del movimiento** (`0019_pagos_fecha_efectiva`, `pagos.fecha_efectiva
  date null`): un cobro puede cargarse hoy pero haber ocurrido antes. Se
  registra siempre como transacción de **hoy** (`pagos.fecha`, para que el
  arqueo cuadre); la fecha efectiva es aparte, opcional, no futura, y es la
  que se muestra en "Últimos movimientos" cuando difiere (con nota de cuándo
  se registró). El saldo de caja sigue sumando por `fecha`, nunca por esta.

**Para el Paso 2 — anotado, no urgente:**

1. **Clases de prueba (inscripciones 17/18/19, Zumba, sin plan) no van a
   entrar nunca a la liquidación por el mecanismo actual**, aunque tengan
   `fecha_fin`. No es solo la fecha: `calcularPendientes` exige `plan_id` no
   nulo, y estas son ventas sueltas previas al motor (`plan_id` null). El
   profesor que dio esas clases de prueba no cobra comisión por ellas bajo
   criterio 1 tal como está hoy. Confirmado leyendo el código (`liquidaciones/acciones.ts`).
   A tratar como **complemento de la venta de membresías regulares** —
   probablemente necesitan su propio tipo de plan/venta (clase de prueba con
   comisión propia), no forzar el criterio 1 existente.
   **Estado exacto de las tres, levantado de producción: `docs/CASO_CLASES_DE_PRUEBA.md`.**
   Congelado por decisión de Javier (2026-09-11) hasta tener el modelo cerrado.
2. **Egresos de Caja** (pagar la comisión a un profesor, o a un proveedor)
   todavía no tienen su lado de "cuentas por pagar": `lineasPorCobrar` solo
   arma el bucket `cuotas`. Particulares, alquiler, pruebas, productos y
   pagos a profesores/proveedores quedan para cuando existan esas ventas y
   ese estado de cuenta.
3. Sin pantalla de arqueo/apertura-cierre de caja ni de responsable de caja
   (quién rinde cuentas de cuál caja) — mencionado por Javier como parte del
   customer journey completo de cobros/pagos, no diseñado todavía.
4. **"Por cobrar" de Caja, agrupado por vencida/vigente** (Javier, 2026-09-11):
   primero las líneas con fecha vencida (falta `vencimiento`/`fecha_compromiso`
   de la cuota comparado contra hoy), después las vigentes, con un título que
   distinga los dos grupos. Hoy `lineasPorCobrar` las devuelve todas juntas,
   ordenadas solo por nombre.
5. **Hipervínculo directo al cobro/pago desde cada línea** de "Por cobrar" (y
   el equivalente en pagos, cuando exista la lista de "Por pagar" del punto 2):
   click en la línea → abre `MovimientoCaja` con el `ContextoMovimiento` ya
   resuelto para esa deuda puntual (el mecanismo ya existe — `MovimientoCaja`
   acepta `contexto` desde 2A — falta el link que lo dispare desde la lista).
6. **Hipervínculo a "ver el recibo" desde "Últimos movimientos"**: hoy no
   existe ninguna vista de recibo/comprobante para un cobro de Caja (sí existe
   para liquidaciones, `/liquidaciones/[id]`, que puede servir de referencia de
   patrón). Es pantalla nueva sin mockup — pasa por Design, salvo que se decida
   reusar el patrón de comprobante existente adaptado.

### 2A.1 — ✅ EN PRODUCCIÓN (2026-09-10)

Validado por Javier en dev y pasado a producción con su OK explícito (`main`
en `5bcfa70`). Cierra los puntos 4, 5 y 6 de la lista de arriba. Migración
`0020` aplicada en dev y en producción.

1. **Toggle "Ocurrió en fecha pasada"** (`MovimientoCaja.tsx`): la fecha
   efectiva ya no es un campo suelto siempre visible. La gobierna un `Toggle`
   apagado por defecto, mismo criterio que la inscripción retroactiva de
   `/inscribir`. Apagado no viaja fecha; encendido sin fecha es error.
2. **"Por cobrar" agrupada y ordenada** (`lineasPorCobrar` + `ClienteCaja`):
   `LineaPendiente` suma `fechaLimite` (= `fecha_compromiso` pactada, o el
   `vencimiento` de la cuota). La lista se ordena por esa fecha ascendente —
   la deuda más vieja primero, las sin fecha al final — y la pantalla la parte
   en "Vencidas" (con días de atraso) y "En fecha", cada grupo con subtotal.
   La comparación es en fecha local, no UTC.
3. **Recibo del movimiento** (`/caja/recibo/[id]`): mismo camino que
   `/liquidaciones/[id]` — página propia + documento imprimible autónomo por
   `window.open`. Contenido: quién/por qué/cuánto/cuánto queda — titular y
   whatsapp, concepto (motivo · plan · curso) y período, deuda previa, monto,
   descuento con motivo, medio, saldo resultante y su fecha de compromiso,
   glosa, quién lo registró, y línea de "Recibí conforme". Cada ítem de
   "Últimos movimientos" es ahora el hipervínculo que lo abre (cierra el
   punto 6 de arriba). **Pantalla nueva sin mockup: Code v1, Design refina
   después** — acordado con Javier.
4. **Glosa cortada** (`ClienteCaja`): el detalle compartía renglón con el monto
   y `truncate` lo cortaba al ancho de la columna izquierda. Pasa a renglón
   propio, usando también el ancho debajo del monto. Igual en "Por cobrar".

5. **Motivos reclasificados por tipo de operación** (migración 0020): el
   catálogo mezclaba la operación con el momento del cobro. Queda Membresía,
   Clase particular, Clase de prueba, Alquiler, Taller, Venta de producto, más
   Ajuste y Otro (que no vienen de ninguna operación). Se remapearon los pagos
   ya asentados; las claves viejas se siguen entendiendo. Aplicada **solo en
   dev**.
6. **Desglose del recibo**: el número destacado es la plata que se movió de
   verdad ("Total cobrado"), igual que en la lista de movimientos — puede ser
   0 si la deuda se cubrió solo con descuento, y el recibo lo dice. El saldo
   pendiente baja a una línea menor debajo del total.

### Mejora pendiente en Caja — el camino del cobro (pedida por Javier, 2026-09-10)

Hoy el movimiento se navega dirección → motivo → titular. Javier observa que
el motivo casi no cambia el comportamiento, y que el camino lógico sería el
inverso: **elegir primero al deudor, ver sus deudas agrupadas por tipo de
operación, y seleccionar la (o las) que se saldan** — un cobro podría cubrir
varias líneas. Queda explícitamente fuera de 2A.1: "amerita más análisis del
customer journey en caja". Entra al Paso 2 junto con el estado de cuenta (2B).

### Cuenta de verificación en dev (`claude@tropicana.dev`)

Cuenta de administrador creada **solo en `tropicana-dev`** (2026-09-10) para que
Claude pueda entrar a la app y validar pantallas cuando eso sea posible. No
existe en producción y no debe crearse ahí. Javier decidió conservarla ("tenela
para cuando realmente sea necesario"). Se borra con
`delete from auth.users where email = 'claude@tropicana.dev';`.

Ojo: hoy no alcanza para verificar nada desde una sesión en la nube — ver el
límite de abajo. Sirve cuando la app corre en un entorno con salida a Supabase.

**Límite conocido de verificación:** la sesión en la nube no puede validar
visualmente estas pantallas. Tiene Chromium y puede levantar `next dev`, pero
la política de egreso del contenedor bloquea `*.supabase.co` con 403, así que
la app no llega a la base y no se puede pasar el login. La validación visual
la hace Javier en su dev.

### Pendientes de prueba de Javier en dev (consolidado, 2026-09-10)

Todo lo de abajo ya está construido, validado por Code (tsc/eslint/build) y
aplicado en `tropicana-dev` — falta la ronda de validación de Javier antes
de pasar a producción. Antes estaba disperso en varios párrafos de este
documento; queda junto acá de ahora en más.

**Asistencia / tolerancia / bono:**
- [ ] Marcar una falta **"Con licencia"** en un plan con N clases y tolerancia disponible → acredita bono; guardar y reabrir la sesión mantiene el estado.
- [ ] Un alumno que ya agotó la tolerancia, al marcarlo ausente de nuevo, ve **"Sin tolerancia"** (no el checkbox).
- [ ] Un alumno con una falta **sin licencia** en el ciclo, al marcarlo ausente de nuevo, ve **"Sin bono: ya tiene una falta sin licencia en el ciclo"** y no el checkbox (regla de §0ter). En dev: *Rubin, Jessica* en Contemporáneo.
- [ ] Una falta **ya guardada** se muestra como texto fijo ("Con licencia" / "Sin licencia"), no como checkbox: para corregirla hay que reabrir la asistencia.
- [ ] Las faltas se cuentan **por ciclo** (no por mes calendario) y el progreso **"X/N clases"**, la deuda y las faltas siguen visibles al pasar por presente → ausente → presente.
- [ ] Inscribir a alguien con **fecha retroactiva** sobre una clase ya tomada: esa fecha pasa de ✓ a **⚠** en el selector, avisa cuántos faltan marcar y queda editable directo.
- [ ] Un plan **ilimitado**: nunca ofrece el checkbox de licencia, y ninguna falta ahí muestra "(bono)" — ni en Asistencia ni en el comprobante de liquidación.
- [ ] Reinscribir a un alumno con un ciclo `completada` y bono no redimido, en el mismo plan → aparece el aviso "+X clases por bono de tolerancia" y el ciclo nuevo incluye esa clase extra; queda marcado como redimido (no se puede usar dos veces).
- [ ] Un plan **ilimitado vencido** (pasado su `fecha_fin`) ya no aparece en el padrón de asistencia de clases posteriores.

**Comprobante de liquidación:**
- [ ] El período liquidado es siempre el **mes vencido** (el anterior al actual), y solo entran membresías completadas hasta el último día de ese mes.
- [ ] Los montos muestran **2 decimales** (ej. 72,50) — la comisión no se redondea a boliviano entero.
- [ ] Cada línea muestra **tipo de servicio** (Curso regular/Particular/etc.) y **nombre del plan**, no solo el curso.
- [ ] Muestra **"Liquidado: fecha"** (cuándo se generó) junto a "Emitido" (cuándo se imprime/consulta).
- [ ] El link "Comprobante" navega en la misma pestaña; "Imprimir/Guardar PDF" abre una ventana aparte con el recibo limpio (sin app shell, sin página en blanco).

**Al terminar esta ronda:** avisar a Code con el resultado (OK o qué falló) — recién ahí se pide el OK explícito para pasar a producción (ver el punto revocado arriba).

---

## 0quinquies. Paso 2 — mapa completo y estados (2026-09-10)

El Paso 2 se definió como "venta de particulares/alquiler + confirmar sesión +
renovación + estado de cuenta del alumno". En el camino se le sumó Caja, porque
cobrar después de la venta era condición para que la operación migrada desde
producción no quedara colgada.

| # | Rebanada | Estado |
| --- | --- | --- |
| 2A | **Cobro posterior a la venta (Caja)** — movimiento inline, paso `Cobro` compartido sobre el saldo real, navegación dirección → motivo → titular, o contexto ya resuelto desde la operación | ✅ En producción |
| 2A.1 | **Ajustes de Caja** — toggle "Ocurrió en fecha pasada"; "Por cobrar" agrupada vencidas/en fecha y ordenada por antigüedad; recibo imprimible por movimiento; glosa a ancho completo; hipervínculos desde ambas listas; motivos reclasificados por operación (`0020`) | ✅ En producción |
| 2B | **Estado de cuenta del alumno** (`/alumnos/[id]/cuenta`) — deuda total, membresías con su consumo y faltas, cuotas con saldo, y pagos. Se llega con la acción **Cuenta** desde la lista de alumnos. Cada cuota con saldo enlaza a Caja ya apuntada a esa deuda (`/caja?linea=cuota:N`) y cada pago a su recibo. **Documento imprimible** del estado de cuenta, por el mismo camino que el comprobante de liquidación y el recibo | ✅ En producción (2026-09-10) |
| 2C | **Renovación de membresía** — qué pasa cuando un ciclo se cierra y el alumno sigue: renovar sin volver a vender desde cero | ⏳ No iniciado |
| 2D | **Venta de particulares, alquiler, talleres y clases de prueba** | 🟡 **Parcial.** La **clase de prueba** está completa en dev y sin pasar a producción: configuración por plan, venta individual y grupal, fecha por curso, padrón, prorrata y crédito al convertir (migraciones 0023/0024). **Particulares, alquiler y talleres: no iniciados** |
| 2E | **Confirmar sesión (con horario)** | ⏳ No iniciado |
| 2F | **Egresos de Caja / cuentas por pagar** — `lineasPorCobrar` solo arma el bucket `cuotas`; pagar una comisión o un proveedor no tiene su lista de "Por pagar" (punto 2 de arriba) | ⏳ No iniciado |
| 2G | **Arqueo, apertura/cierre y responsable de caja** — quién rinde cuentas de cuál caja (punto 3 de arriba) | ⏳ No iniciado, sin diseño |
| 2H | **Camino inverso del cobro en Caja** — elegir primero al deudor, ver sus deudas agrupadas por tipo de operación, y saldar una o varias de una vez. Javier: "amerita más análisis del customer journey en caja" | ⏳ Anotado, requiere análisis previo |

**Dependencias que conviene tener presentes:** 2F y 2G comparten el modelo de
caja con 2A, así que conviene hacerlos juntos o seguidos. 2D es prerrequisito
real de 2F para todos los buckets que no sean `cuotas` (no hay nada que cobrar
ni pagar hasta que esas ventas existan). 2B y 2H se tocan: las dos responden
"¿qué debe esta persona?" desde lados distintos.

## 0duodecies. Lo que Natalia necesita con urgencia (2026-09-12)

Javier trae un pedido operativo, y **no cae en una sola rebanada**: Natalia está
urgida por **la gestión de clases particulares** y por **validar y reservar la
disponibilidad de la sala**.

| Lo que pide | Dónde vive en el plan | Estado al 2026-09-12, tarde |
| --- | --- | --- |
| Vender y gestionar clases particulares | **2D** (la mitad que no es clase de prueba) | 🟡 **Precios base listos** (pantalla *Precios y paquetes*, validada en dev). Falta la venta en sí |
| Validar/reservar disponibilidad de la sala | **Paso 5** — Agenda de sala | 🟡 **Base de datos lista** (0035: `salas`, `reservas_sala` con no-choque garantizado). Falta la agenda visual |

**El punto que importa:** son dos lugares distintos del plan, y el segundo está
**tres pasos más adelante** que el primero. Pero operativamente van juntos: no se
puede vender una hora de particular sin saber si la sala está libre a esa hora.
Vender particulares sin validar la sala es vender doble la misma hora.

O sea que atender el pedido implica **adelantar el Paso 5**, entero o en una
versión mínima (solo la validación de choque, sin la agenda visual completa).
Eso es una decisión de Javier, no una lectura del plan.

**Las tres decisiones que se destrabaron acá** (D5, D6 y D7) quedaron
**respondidas el mismo día** — ver `docs/DECISIONES.md` §1.b:

- **D7 — la sala se puede bloquear sin venta.** Javier: *"aplica motivos de
  capacitaciones internas, preparación de coreografías de los profesores,
  mantenimiento, etc."* Eso convierte la agenda en un **calendario real**, no en
  el reflejo de lo vendido: un bloqueo existe **sin dueño comercial**, necesita
  motivo de catálogo, y ocupa la sala igual que una clase.
- **D6 — duración de la clase.** ✅ **Construida y en producción** (0034).
- **D5 — motivos del cobro.** Confirmada; se construye junto con particulares.

### Las tres respuestas — todas dadas el 2026-09-12

| | Qué | Respuesta |
| --- | --- | --- |
| ~~**D20**~~ | ¿una sala o varias? | ✅ *"por el momento una sola sala, posteriormente podrían haber varias"*. Se modela **para N y se muestra para 1**. **Ya construido** en la 0035 |
| ~~**Alcance**~~ | ¿Paso 5 completo o validación mínima? | ✅ **Validación mínima primero**, agenda visual después sobre la misma base |
| ~~**Diseño**~~ | ¿Design-first o código v1? | ✅ **Código v1, Design refina.** Y resultó una pregunta más chica: *Vender servicio* y *Confirmar sesión* **ya tenían diseño aprobado** desde el 30 ago |

### El encuadre que dio Javier, y que gobierna lo que sigue

Javier reformuló el problema en **dos ejes**, y es la lectura que manda:

1. **La venta de paquetes de horas** (particulares y alquileres) con sus
   contadores, que descuentan horas en cada sesión realizada.
2. **Un motor de calendario de sala**, *"muy visual, como un calendario del mes,
   semana, día"*, con la ocupación en intervalos de 30 min (parametrizable),
   donde se selecciona un rango libre para reservar y se lo asocia al tipo
   (interno/bloqueo, particular, alquiler) y a su motivo o paquete.

Lo que se ve en el calendario **tiene que decir por qué y para quién** está
tomada la sala. Reservas: particulares, alquileres, internas. Bloqueos: cursos
regulares, horario fuera de trabajo, feriados, otros. Y el motor tiene que
permitir, además de reservar, **reprogramar y cancelar**, y registrar asistencia
o suspender clases regulares desde el mismo calendario.

**La agenda visual no es opcional ni lejana.** Javier: *"es una herramienta
fundamental para Natalia por su vista. Debe ir, ya es hoy un problema para ella."*
Lo que se acordó es el **orden**: primero el eje de ventas y contadores *"para
que pueda ir registrando sus ventas"*, con algún mecanismo de confirmación de
sesiones, y después integrarlo al eje visual.

**Lo que el diseño de agosto NO cubre, y hay que construir igual:** reservar una
sesión **a futuro**. *Confirmar sesión* solo registra que una sesión **ya
ocurrió**; elegir fecha y hora al momento de vender es la pieza que une los dos
ejes, y no está en ningún mockup.

**Lo que ya está listo para apoyarse:** `src/lib/horarios.ts` con `seSolapan` y
el criterio de choque fijado —intervalo medio abierto, así que una clase que
termina 20:00 y otra que empieza 20:00 **no** chocan—, `cursos.duracion_min` en
las dos bases, y desde hoy `src/lib/sala.ts` + la migración **0035** (ver el
bloque final de este documento).

**Un dato medido que orienta el modelo** (producción, 2026-09-12): con 60
minutos **ningún par de cursos se pisa** — los que comparten hora no comparten
día. La grilla es **consistente con una sola sala**, pero eso no prueba que haya
una: lo tiene que decir Javier (D20).

## 0sexies. Mejora transversal — abrir la ficha de cualquier entidad (2026-09-10)

**Pedido de Javier.** Quiere poder abrir la vista de cualquier entidad sobre la
que se esté trabajando, desde cualquier lista, con un mecanismo **único y
consistente** en todo el producto — un hipervínculo, o un botón tipo "ojo".
"Ayuda mucho para contexto del usuario." De acá en adelante se va aplicando a
lo que se avance; unificar lo ya construido queda como pasada aparte.

**Estado:** ⏳ anotado, sin decidir la forma. Hoy conviven dos gramáticas:
- **Acción en texto dentro de una celda** — `Editar` / `Eliminar` / `Desactivar`
  en Alumnos, Profesores y Cursos. Es lo que el handoff aprobó (README de
  diseño, Screen 9), y es donde se sumó `Cuenta` en la lista de alumnos (2B).
- **Fila entera clickeable** — "Por cobrar" y "Últimos movimientos" en Caja, y
  los pagos del estado de cuenta. Nació en 2A.1, sin pasar por Design.

Las dos son defendibles; tenerlas mezcladas no. La decisión de cuál gana —y si
aparece un ícono de ojo— es de Design, no de Code.

**Cuándo involucrar a Design (recomendación).** No ahora: el patrón se decide
mejor con varios casos reales a la vista que con uno hipotético. Lo que más
urge es cerrar el Paso 2 hasta 2G, y cada rebanada que se construya va a
sumar otra lista y otra ficha (estado de cuenta, cuentas por pagar, arqueo).
El momento indicado es **al terminar 2G**: ahí existen todas las listas y
fichas del ciclo de caja, y Design decide una sola vez, sobre material real,
en vez de decidir dos veces. Mientras tanto, cada pantalla nueva sigue la
gramática del handoff (acción en texto) y se anota acá si se aparta.

Esto además calza con el Paso 6 de la secuencia (alineación a estándares del
resto de pantallas), que ya existe como hito y es donde naturalmente cae una
pasada de consistencia sobre lo ya construido.

## 0septies. Corregir una membresía ya vendida (2026-09-10)

**Qué pasó.** Natalia inscribió a Lucas Campero (alumno 29, inscripción 20)
dejando la fecha por defecto —la próxima clase, 14/09— cuando correspondía la
retroactiva, lunes 07/09. **No hay forma de corregirlo desde la aplicación**:
la venta escribe la membresía y no existe pantalla que la edite. Javier avisa
que "es algo que puede ocurrir con frecuencia".

Se reparó a mano en producción, replicando lo que habría calculado la venta
con inicio 07/09 (ver la migración/consulta en el historial de la sesión):

| Registro | Antes | Después |
| --- | --- | --- |
| `inscripciones.20.fecha_inicio` | 2026-09-14 | 2026-09-07 |
| `inscripciones.20.fecha_fin` | 2026-10-07 | 2026-09-30 |
| `cuotas.20.vencimiento` | 2026-10-14 | 2026-10-07 |

`periodo` no cambió (mismo mes) y la cuota sigue pagada. La membresía no tenía
ninguna asistencia registrada, que es lo que hizo la corrección segura.

**Pendiente de decidir (Javier):** con el inicio en 07/09, las sesiones ya
dictadas del 07/09 y del 09/09 caen dentro del ciclo de Lucas y él no está
marcado en ninguna. Van a aparecer como "incompleta" en Asistencia hasta que
se resuelva si asistió.

### Mejora — editar una membresía vendida

⏳ **No construido.** Hoy la única corrección posible es SQL a mano, y eso no
escala a la operación diaria. Lo que hace falta, en orden de urgencia:

1. **Corregir la fecha de inicio** de una membresía, recalculando `fecha_fin`,
   `periodo` y `vencimiento` con las mismas reglas que la venta — no a ojo.
   Debe bloquearse (o avisar fuerte) si el cambio deja fuera del ciclo
   asistencias ya registradas.
2. **Anular una venta** hecha por error, con su cuota y su cobro.
3. Registro de quién corrigió qué y cuándo: es plata y comisiones.

El punto 1 comparte motor con 2C (renovación): las dos necesitan recalcular
un ciclo con las reglas de la venta sin volver a venderlo. Conviene hacerlas
juntas.

## 0octies. `docs/REGLAS.md` — las reglas invariables, cargadas siempre (2026-09-10)

**Por qué existe.** Al revisar el caso de Yubinca (§0nonies) afirmé que el motor
no corría el fin de ciclo al suspender una clase. Era falso: el mecanismo existe
(`aplicarCorrimiento` + `corrimientos_ciclo`) y estaba documentado en este mismo
archivo, línea 493. Fallé porque busqué `fecha_fin` por grep, no encontré nada
que lo escribiera, y afirmé un negativo sin leer el flujo de suspensión — donde
la regla vive bajo **otro nombre** (`cuotas.vencimiento`).

Javier: *"es la política, no acepto que me digas que no tenés presente. Dime qué
debo hacer para que eso tan fundamental no vuelvas a perderlo de vista."*

**El diagnóstico honesto:** la política estaba escrita, pero `ESTADO.md` tiene
~600 líneas y **no se carga solo**; se lee por partes, cuando se lo busca. Lo
único que se carga en toda sesión es `CLAUDE.md` y lo que él importe. Empezar
una sesión nueva no ayuda: arranca con menos contexto, no más. Lo único que
sobrevive entre sesiones es lo que está en el repo **y se carga solo**.

**La solución:** `docs/REGLAS.md`, importado desde `CLAUDE.md` (junto a
`AGENTS.md`). Corto a propósito, para que se lea entero cada vez. Contiene:

1. Un **glosario** — un concepto, un nombre. Encabeza la lista la distinción
   que causó el bug: `inscripciones.fecha_fin` (fin de ciclo por consumo, lo
   calcula la venta) vs. `cuotas.vencimiento` (plazo, lo corre la suspensión).
2. Las **reglas de negocio** invariables (cierre de membresía, agotarse ≠
   cerrarse, qué agota cada venta, corrimiento por suspensión, bono de
   tolerancia, toda venta con su cuota, base de comisión, snapshot, sin
   hardcode, orden por apellido).
3. Las **reglas de proceso** (OK explícito para producción, dev hasta que se
   pida el pase, aviso antes de construir pantalla sin mockup, piezas
   reutilizables, respaldo antes de tocar datos de producción, nunca pegar
   credenciales).
4. Una instrucción explícita: **antes de afirmar que algo no está
   implementado, leer el flujo completo** — un grep por un nombre de campo no
   es prueba.

`ESTADO.md` sigue siendo el detalle, la historia y el estado de cada hito.
`REGLAS.md` es lo que no se puede perder de vista nunca.

**Capa que falta:** convertir en controles de `scripts/control_migracion.sql`
las reglas que se puedan chequear — una regla en prosa se pierde, una que rompe
un control no. Primer candidato: coherencia entre `fecha_fin` y los
corrimientos de la membresía.

## 0nonies. El fin de ciclo pasa a calcularse (2026-09-10) — HECHO EN DEV

**Los dos defectos, medidos.** Javier reporta que el ciclo de Yubinca (insc. 22)
termina el 03/09 cuando debería ser el 08/09, y que los tres Vivancos (25/26/27)
no recibieron el corrimiento de la clase suspendida del 09/09.

Crucé en producción las 13 membresías cuyo período contiene una clase
suspendida: **el corrimiento falta si y solo si la inscripción se creó después
de la suspensión** (3 de 3 sin traza fueron retroactivas; 10 de 10 con traza no
lo fueron). Correlación perfecta — la hipótesis de Javier, confirmada. Causa:
`suspenderClase` solo alcanza a las membresías que existen en ese momento, y
`venderPlan` nunca miraba las suspensiones.

Y un segundo defecto independiente: aun cuando el corrimiento sí corría,
`inscripciones.fecha_fin` **nunca se actualizaba**. El corrimiento movía
`cuotas.vencimiento`, herencia de la `0009` (etapa 1, cuando el ciclo era el mes
pago). Javier zanja la definición: **el corrimiento hace al fin de ciclo de la
membresía y a la renovación bonificada; la cuota queda afuera.**

**La solución: calcular, no guardar paso a paso.** `finDeCicloReal`
(`src/lib/membresias.ts`) cuenta las clases que realmente ocurren, salteando las
suspendidas. Al derivarse de los hechos, **deja de depender del orden**: da lo
mismo si la suspensión fue antes o después de la venta retroactiva, o si la
asistencia se tomó antes o después. `corrimientos_ciclo` pasa de fuente de
verdad a **traza que audita y explica**.

Cambios:
- `finDeCicloReal`, `renovacionBonificada`, `recalcularFinDeCiclo` y
  `registrarCorrimientosPendientes` en el motor compartido.
- `recalcularMembresia` mantiene la fecha al día junto con los contadores.
- `venderPlan` recalcula y deja la traza de las suspensiones que cubre — el
  agujero de la venta retroactiva.
- `aplicarCorrimiento` deja de tocar la cuota: recalcula y anota antes/después.
  `revertirCorrimientos` recalcula en vez de restaurar una fecha guardada.
- La cuenta del alumno muestra hasta cuándo puede renovar sin perder el bono.
- **`0021`** (aditiva): `fin_ciclo_anterior`/`fin_ciclo_nuevo`. Las columnas
  viejas se conservan con su dato — son el registro de lo que se hizo bajo la
  política anterior. No se revierte ningún `cuotas.vencimiento` ya corrido:
  esas fechas se le comunicaron a alumnos reales.
- **Controles 9 y 10** en `scripts/control_migracion.sql`: fin de ciclo
  coherente con las suspensiones, y suspensiones sin traza. Son los que habrían
  detectado esto antes que Javier.

**Reparación de datos en dev:** 9 membresías con el fin de ciclo corregido
(Yubinca 03/09→**08/09**; Vivancos 16/09→**21/09**; Delgadillo, Aguilar y Rubin
24/09→01/10; Escalante 15/09→17/09; Salek 10/09→17/09), 3 corrimientos
rellenados y 10 trazas viejas completadas. Controles 9 y 10 en OK. Ninguna de
las tocadas tenía comisión devengada — la guarda lo verifica igual.

**✅ EN PRODUCCIÓN (2026-09-10)**, con OK explícito de Javier. Orden del pase:
migración **primero** (el código nuevo escribe columnas que aún no existían),
después el código (`main` en `47640ea`), después los datos.

- `0021` (columnas) y **`0022`** (reparación de datos) aplicadas en producción.
- 9 membresías con el fin de ciclo corregido — las mismas que en dev, ninguna
  con comisión devengada: Yubinca 03/09→**08/09**, Vivancos 16/09→**21/09**,
  Delgadillo/Aguilar/Rubin 24/09→01/10, Escalante 15/09→17/09, Salek
  10/09→17/09. Valor anterior respaldado en `fin_ciclo_previo_0022` (regla 5),
  con la sentencia de reversión escrita en la migración.
- 3 corrimientos rellenados (los Vivancos) y 10 trazas viejas completadas.
- **Controles 9 y 10 en OK** en producción. Advisor sin errores nuevos: los dos
  INFO son las tablas de respaldo, con RLS y sin policies a propósito.
- `fin_ciclo_previo_0022` creada también en dev, para que las dos bases tengan
  el mismo esquema.

## 1. Estado por hito (validado con evidencia en el repo)

| Hito | Estado | Evidencia |
| --- | --- | --- |
| **Etapa 0** — usuarios, roles/permisos, parámetros, catálogos | ✅ **OK** | `supabase/migrations/0001…`, `0002…`; pantallas en `src/app/(privado)/administracion/`. Probado por Javier. |
| **Restyle Tropicana + temas por usuario** | ✅ **OK** | `src/app/globals.css` (tokens), `src/lib/temas.ts` (catálogo + fallback), `perfiles.tema`, `SelectorTema.tsx`. Migración `0003_temas.sql` **aplicada** (confirmado en sesión). Dos temas: estándar + alta accesibilidad. |
| **Gestión de contraseña y bloqueo** | ✅ **OK (código)** · ⚠️ ver nota | `0004_usuarios_seguridad.sql`, `src/lib/acceso.ts`, `src/app/login/acciones.ts`. Reset+cambio / desbloqueo / bloqueo manual / bloqueo automático (umbral param `login_umbral_bloqueo`=7, aviso `login_umbral_aviso`=3). `activo` y `bloqueado` independientes, precedencia computada. Contrato `iniciarSesion` tipado: `{ok}` / `{estado:"credenciales",avisar}` / `{estado:"bloqueada"}` / `{estado:"error",mensaje}`. |
| **PLAN_ETAPA1 v2** (commit `9293e5c`) | ✅ **OK** | Refleja las 12 decisiones + liquidación básica; esquema de comisiones/asignaciones congeladas alineado con el handoff de Profesores. |
| **Handoff de diseño v4** | ✅ **Incorporado** | `docs/design/` — 11 pantallas/componentes + README (fuente de verdad) + DECISIONES + design system con `.table-edit` y `.chips` + screenshots. |

**Migración 0004:** ✅ **aplicada en Supabase** (confirmado por Javier, 2026-08-31).

**Observación — permisos como catálogo (parcial):** hoy los permisos son la matriz `rol_permisos` (módulo × acción) **configurable por rol** ✅, pero el conjunto de módulos está **cableado en código** (`src/lib/tipos.ts` → `MODULOS`) y la navegación de la barra lateral se decide con flags hardcodeados (`puedeUsuarios`/`puedeConfig`), no puramente por permiso. El requisito nuevo (App Shell) pide: **cada pantalla/función/grupo de navegación gobernada por un permiso discreto, registrado en un catálogo que el admin asigna a los roles**. Eso implica migrar los módulos a un **catálogo de permisos en base** y derivar la nav de los permisos del usuario. Es un **workstream a planificar** (ver §5, decisión abierta A).

## 2. Archivos entregados por el handoff v4 (docs/design/)

Pantallas/componentes: **Login, App Shell, Inscribir y cobrar, Tomar asistencia, Caja y resumen, Cobro, Precios y paquetes, Vender servicio, Confirmar sesión, Profesores, Profesor**. Design system: `_ds/…/components/table-edit.html` y `chips.html`. Más `screenshots/`, `assets/tropicana-logo.png`, `DECISIONES.md`.

## 3. Decisiones de negocio vigentes (absorbidas de bitácora + prompts + README)

- **Diferenciación solo por rol/permiso, nunca por persona.** Roles = conjuntos de permisos. Glosario (ejemplos configurables): **Administrador/TI** = acceso total; **Gerente** = máximo operativo; **Profesor** = funciones docentes. Los nombres de los prototipos ("Natalia · admin") son relleno; en la app salen de la sesión.
- **Componente compartido por entidad** (alumno, profesor, curso, costo fijo, proveedor, producto…), reusado idéntico, contrato tipo `Cobro`/`Profesor` (datos por prop; avisa con `onSelect/onGuardar/onBaja/onCancelar`).
- **CRUD con eliminación guardada:** sin dependientes → borra de verdad; con historial → desactiva conservando histórico, con el **motivo al lado de la acción** nombrando los dependientes concretos; fila atenuada y acción → **Activar**.
- **Alumno (lo construye Code):** duplicado por WhatsApp; bloque tutor si es menor (umbral `mayoria_edad` configurable); **clave compuesta de menor = WhatsApp del tutor + nombre (sin apellido)**; el tutor puede ser un alumno existente → **vincular** en vez de duplicar.
- **Medio mes** = paquete de clases de tamaño fijo = **`medio_mes_factor` (default 2) × días semanales del curso**, independiente de cuántos días tilde el alumno; menos días = más semanas; **precio único por curso** (tabla A). Se consume **por asistencia**.
- **Inscripción parcial** (una clase / una semana / medio mes) con tarifa propia (tabla A); curso sin tarifa → mensual. "Una semana" = una repetición del patrón semanal (Lu-Mi-Vi → 3 clases).
- **Multi-mes adelantado:** N cuotas (una por mes) con el descuento (tabla B) distribuido. Cruce exacto de meses, sin interpolar.
- **Renovación mensual manual** (un clic genera la cuota del mes siguiente); nunca automática.
- **Comisiones:** tasa **por asignación profesor×curso**, **congelada al confirmar** (dos %: sobre ingresos del curso + por alumno referido). **Referido (definido 2026-09-04, RF-02.2/RF-07.2):** lo percibe el **profesor que REFIRIÓ** al alumno (no el titular), según el `pct_referido` de **su** asignación, sobre los cobros de ese alumno en el curso del otro profesor. *(Brecha a resolver antes de construir: hoy `referido_por_alumno_id` apunta a un alumno, no a un profesor; y falta definir cuál `pct_referido` aplica si el profesor tiene varias asignaciones.)* El **"bono por referido" sobre la inscripción** queda como **gancho** (pendiente validar). La liquidación lee el % de la **asignación que cubrió el período** (filas inmutables `desde/hasta`; reemplazar titular cierra la fila, no la edita). Devenga **sobre lo cobrado**, a **mes vencido**, con **prorrateo** en pagos adelantados. Base de ingresos incluye cuotas, parciales y clases de prueba.
- **Liquidación mensual básica dentro de Etapa 1** (devengado − pagos al profesor); esquema diseñado para ampliarla (relevos, bonos, particulares, costos de sala) en fase 2.
- **Costos fijos:** devengado mensual automático, prorrateado por frecuencia (mensual / trimestral ÷3 / anual ÷12 / único en su mes).
- **Snapshot de precios** en inscripción/cobro (editar el precio del curso no reescribe lo ya inscripto).
- **Clase particular:** individual / pareja / **grupo hasta 16** (máximo en parámetros), siempre con ≥1 alumno titular. Al vender, se crea automáticamente el paquete de uso de sala del profesor, tarifado desde la **tabla única de Tarifas de Sala** (Categoría × Tamaño × Horas). *(pantallas = fase 2; el backend deja los ganchos.)*
- **Clase de prueba:** precio por alumno por curso (tabla C); los asistentes entran a la lista de asistencia de la sesión; el cobro suma a la comisión del profesor.
- **Sala:** una sola por ahora, pero el modelo nace para varias (reserva fecha+hora+duración).
- **Profesor y Usuario:** entidades separadas, vinculables **uno a uno** (un externo normalmente sin cuenta).
- **Orden de listas de personas:** toda lista de personas usada para **localizar** a alguien (búsquedas, padrones, selects) se ordena **alfabéticamente por apellido** (luego nombre), en **cualquier** entidad. Helper: `compararPorApellido` en `src/lib/texto.ts`.
- **Sin hardcode:** tarifas, tolerancias, umbrales, motivos, categorías, temas, roles y permisos → catálogo o parámetro.

## 4. Migraciones

`0001` Etapa 0 · `0002` módulo usuarios · `0003` temas · `0004` seguridad de usuarios (todas **aplicadas**). `0005_etapa1_entidades` — **aplicada en Supabase** (confirmado por Javier). `0006_etapa1_inscripcion` — ✅ **aplicada en Supabase** (validada antes localmente en Postgres 16: cadena 0001→0006 limpia e idempotente; smoke test de inscripción + cuotas + pagos con estados pagada/parcial/pendiente y deuda por alumno): tablas `inscripciones` (modalidad mensual/clase/semana/medio_mes, snapshot `precio_aplicado`, `dias_elegidos`), `cuotas` (devengado mensual, `descuento_adelanto`, estado pendiente/parcial/pagada) y `pagos` (libro de cobros/pagos que persiste el paso Cobro; sujeto alumno/profesor/costo_fijo, referencia inscripción/cuota, medio, descuento+motivo, ajuste+motivo, glosa, registrado_por); parámetro `medios_pago`. `0007_etapa1_asistencia` (`sesiones`/`asistencias` + params `faltas_toleradas`, `mostrar_deuda`), `0008_asistencia_ventana_retro` (param `asistencia_semanas_retro`) y `0009_etapa1_suspension` (`sesiones.estado`/`motivo` + `corrimientos_ciclo`) — ✅ **aplicadas en Supabase** (confirmado por Javier, 2026-09-04). **0001→0011 aplicadas en Supabase (producción).** `0010_motor_planes_liquidacion` — ✅ **construida y validada en local** (Postgres 16: cadena 0001→0010 limpia; 0010 idempotente al re-correr; smoke test end-to-end plan→membresía→cuota con `fecha_compromiso`→comisión devengada→liquidación+item→pago al profesor; check de `estado` rechaza valores fuera de `activa/completada/baja`; RLS y FK verificadas; el nuevo check de `estado` es superconjunto del anterior (`activa/baja` → `activa/completada/baja`), sin riesgo sobre filas existentes). ✅ **aplicada en Supabase (producción) el 2026-09-05** (confirmado por Javier, sin errores). Validada antes en Postgres 16 en el sandbox de Code (no en una base local en la máquina de Javier: hoy dev y producción comparten el **mismo** Supabase). Contenido: tabla `planes` (config del Plan Regular), generalización de `inscripciones` como membresía (`plan_id`, `clases_plan`, `bono_arrastrado`, `tolerancia_faltas`, `ciclo_numero`, `membresia_anterior_id`, `fecha_fin`, estado `+completada`), `cuotas.fecha_compromiso`, `cursos.cupo`, `comisiones_devengadas`/`liquidaciones`/`liquidacion_items`, `pagos.liquidacion_id` y parámetro `periodicidad_liquidacion` (default `mes`). Diseño en `docs/PLAN_PASO1_MOTOR_REGULAR.md` (sub-hito 1A). `0011_datos_plan_regular` — ✅ **construida y validada en el sandbox de Code** (cadena 0001→0011 limpia; datos de ejemplo → planes por curso con N correcto, backfill de membresías, idempotente al re-correr). ✅ **aplicada en Supabase (producción) el 2026-09-05** (confirmado por Javier; N = días × 4 confirmado; chequeo posterior OK; 12 inscripciones mensuales convertidas a membresías). Migración de datos: crea un "Plan Regular - <curso>" por cada curso (`cantidad_clases = días_semana × 4`, `precio = precio_mensual`, `tolerancia_faltas = null` → usa el parámetro del sistema, `criterio_liquidacion = 1`) y convierte las inscripciones `modalidad='mensual'` en membresías de ese plan (`plan_id`, `clases_plan`, `ciclo_numero=1`). Cursos sin `días_semana` quedan con `cantidad_clases = NULL` (a fijar a mano). `fecha_fin` no se calcula aquí (la mantiene la lógica de asistencia en 1B). **Aclaración registrada:** el parámetro que vale 1 es `faltas_toleradas` (tolerancia), NO el N; el N deriva de los días del curso. `0012_motor_venta_asistencia` — ✅ **construida y validada en el sandbox de Code** (cadena 0001→0012 limpia; backfill de `planes.modalidad` OK; idempotente). Aditiva: `planes.modalidad` (etiqueta comercial, backfill Plan Regular→`mensual`, Plan Medio Mes→`medio_mes`), `inscripciones.clases_hechas` y `inscripciones.bono_generado` (contador y bono, se usan en 1B.2), `asistencias.con_licencia` (falta con licencia, 1B.2), y parámetro `dias_compromiso_pago` (default 30, tope de días para la fecha de compromiso). **`0012`, `0013` (`plan_cursos`/`inscripcion_cursos`), `0014` (`acceso_modo`/`clases_ilimitadas`/`ciclo_dias`) y `0015` (`bono_redimido`) — ✅ APLICADAS en producción el 2026-09-09**, vía el conector Supabase MCP (acceso directo confirmado a ambos proyectos: `tropicana-dev`=`hyhijzuomqpylcmrzdvw`, producción "Tropicana"=`pnvhpbxjbdmbktpwebtx`); esquema verificado columna por columna después de cada una, sin advisories de seguridad nuevos. `main` actualizado en el mismo paso (`ef6a517..1d59e42`, fast-forward sin conflictos) y desplegado solo por Vercel (branch tracking activo en `main`; deployment `1d59e42` en estado Ready, error rate 0%). **`0016_reparar_membresias_migradas` y `0017_cuotas_para_ventas_sin_cuota` — ✅ APLICADAS en dev y en producción el 2026-09-10**, con OK explícito de Javier para el pase. Ambas son de **datos** (la 0016 agrega además una restricción): `0016` completa `fecha_fin` de las membresías que la 0011 dejó vacía, recalcula `clases_hechas`/`bono_generado`/`estado` desde las asistencias de sesiones dictadas y agrega el check `inscripciones_fechas_coherentes`; `0017` crea la cuota faltante de cada membresía, engancha los cobros sueltos (`pagos.cuota_id` vacío) y recalcula el estado de la cuota según lo cobrado. Las dos son idempotentes (verificado por huella md5 antes/después de una segunda corrida) y quedaron con los 7 controles de `scripts/control_migracion.sql` en OK, en ambas bases. Detalle y motivo en **§0ter**.

## 5. Pendientes y decisiones abiertas

**Progreso Etapa 1:** `0005` ✅ aplicada · `0006` ✅ aplicada · **Profesores** ✅ construido y **probado local** · **Cursos** ✅ construido (componente compartido `EntidadCurso` + pantalla con listado y alta/edición/baja, días como casillas, precio mensual y **tarifas parciales tabla A**; borrado guardado; al existir cursos se activa la pestaña Asignación de Profesores y el filtro de titular por especialidad/estilo; build+lint OK; **pendiente prueba local**). **Alumnos** ✅ construido (componente compartido `EntidadAlumno`: dup por WhatsApp, bloque de tutor si es menor, clave compuesta de menor = WhatsApp tutor + nombre, y tutor que puede ser alumno existente → vincular; canal de captación del catálogo; borrado guardado; build+lint OK; **pendiente prueba local**). **Tomar asistencia** ✅ **construido (fiel al mockup)** — `0007` aplicada. Migración `0007_etapa1_asistencia` (`sesiones` única por curso+fecha; `asistencias` única por sesión+alumno; params `faltas_toleradas`=2 y `mostrar_deuda`=true) validada en Postgres 16 (cadena 0001→0007 limpia e idempotente — **re-correrla es seguro**). Pantalla `/asistencia` fiel al handoff: **selector de clase** (tarjeta + desplegable con conteo de alumnos), **fila** con marcador a la izquierda, faltas del mes, **pastilla de tolerancia** ("Sin tolerancia"/"Última tolerada" según `faltas_toleradas`) y **deuda** ("Debe Bs. …", si `mostrar_deuda`); un toque marca presente, otro ausente; "Todos presentes"; contador y pie con leyenda. **Fecha elegible** (control de carga retroactiva) gateado por permiso `asistencia.editar` (sin ese permiso, queda en hoy). El padrón, faltas del mes (de la fecha elegida), clases restantes y deuda los calcula la server action `cargarPadron`. Guardar hace upsert de sesión + marcas (re-editable). Cada **presente consume una clase** del paquete parcial (parcial con 0 restantes deja de aparecer). Titular de la sesión = asignación vigente. Diferido a fase posterior (anotado): reposiciones por falta, clases de prueba en la lista, comisión por clase (0008), rol Profesor/"Confirmar sesión". build+lint+tsc OK.

**Inscribir y cobrar** ✅ **construido** (pendiente prueba local): (1) migración `0006` + paso `Cobro` compartido; (2) pantalla `/inscribir` con los 3 pasos del handoff (alumno → curso e inicio → cobro). Reutiliza `EntidadAlumno` (buscar/crear alumno al vuelo, `crearAlumnoDesdeInscripcion` devuelve el alumno para seleccionarlo), lista de cursos activos, y `Cobro`. Modalidades mensual/clase/semana/medio_mes con tarifa propia (tabla A, cae al mensual si falta), meses adelantados con descuento (tabla B, cruce exacto, repartido entre cuotas), medio mes = factor×días con selección de días y reparto en semanas, fechas de inicio = próximas clases reales, snapshot de precio. Toda la plata se **recalcula en el servidor** (nunca se confía en el navegador). Persistencia (`inscribirYCobrar`): inserta inscripción, genera N cuotas (mensual) con vencimientos, asienta el cobro **por cuota** (efectivo = devengado − desc. adelanto; cobertura = plata + descuento manual) y marca cada cuota pagada/parcial/pendiente; parciales = un cobro contra la inscripción sin cuota. Nav "Gestión → Inscribir y cobrar" gateada por permiso `inscripciones`. **Validado:** helpers puros (precios, descuentos, reparto, medio mes 2/3/6 semanas, fechas) con tests; INSERTs y estados contra Postgres 16 real (cuotas pagada/parcial/pendiente + deuda por alumno correctos); build+lint+tsc OK. Después: Asistencia → Costos/Liquidación básica.

**Suspensión de clase + corrimiento de fin de ciclo** ✅ **construido** (migración `0009` aplicada 2026-09-04). Mecanismo ÚNICO compartido `aplicarCorrimiento`/`revertirCorrimientos`: mueve el `vencimiento` de la **cuota vigente** (mayor periodo) a la próxima fecha del patrón semanal y deja traza en `corrimientos_ciclo` (unique por inscripción+sesión → idempotente). Dos disparadores del mismo efecto: (1) **falta individual tolerada** — `guardarAsistencia` reconcilia: marca ausente a un mensual con tolerancia disponible (faltas del mes, excluyendo esta sesión, < `faltas_toleradas`) → corre; si se cambia a presente o no hay tolerancia → revierte; (2) **suspensión masiva** — `suspenderClase` marca la sesión `suspendida` (col `estado`+`motivo` en `sesiones`), borra asistencias, y corre el fin de ciclo de **todos** los mensuales del curso (tipo `suspension`; **no gasta** la tolerancia personal). `reabrirSesion` revierte todo. Parciales: no se marca asistencia → no consumen → se difieren solos. UI en `/asistencia`: botón "Marcar esta clase como suspendida" (con motivo) y panel de "Clase suspendida" con "Reabrir". Validado en Postgres 16 (corrimiento, unique, revert, check de estado). Nota: el efecto (vencimiento corrido) será plenamente visible con la pantalla de renovación/estado de cuenta. **Pendiente registrado:** catálogo de motivos de suspensión.

**Pedidos futuros (registrados, no urgentes):**
- **Alumnos: fecha de nacimiento y sexo.** Agregar ambos campos a `alumnos` (migración aditiva) y a la ficha `EntidadAlumno` (fecha opcional; sexo desde catálogo para no hardcodear). Surgió de la revisión de uso; se hará más adelante.

**Pendientes de Design (no me bloquean; registro):** #8 correcciones de Login (accent-100 solo informativo + estado "cuenta bloqueada"; el backend ya expone el contrato); #11 correcciones de Vender/Confirmar sesión incluido el selector de grupo.

**Despliegue (producción):** ✅ **en Vercel** — `https://tropicana-app.vercel.app` (proyecto `jgonzalezw1/tropicana-app`, publica desde **`main`**). Variables cargadas en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Usa la **misma base Supabase** que local (mismos usuarios/datos). Login probado OK en la nube. **Flujo de actualización:** el trabajo sigue en la rama `claude/tropicana-app-context-d5zjt8`; en cada avance estable se hace **fast-forward de esa rama a `main`** y Vercel redepliega producción solo. (Si algún día el login fallara en la nube: Supabase → Authentication → URL Configuration → Site URL + Redirect `https://tropicana-app.vercel.app`.)

**Pendientes tuyos (Javier):**
1. **Base de datos de prueba separada (`tropicana-dev`) — ✅ OPERATIVA (2026-09-05).** Se creó un segundo proyecto Supabase gratis `tropicana-dev`, se cargó el esquema con `scripts/setup_dev_full.sql` (0001→0011, 23 tablas), Javier creó su usuario admin (primer usuario = administrador por trigger) y apuntó su `next dev` ahí vía `.env.local` (guardó el de prod como `.env.local.prod`). Verificado: la app local abre vacía y muestra el módulo Usuarios. **1B/1C se prueban acá antes de producción.** Guía: `docs/SETUP_TROPICANA_DEV.md`.

   **1B.1 REENCUADRE a "plan-primero" + multi-curso (2026-09-05, en curso).** Al probar 1B.1, Javier definió el flujo correcto: elegir alumno -> **lista de planes** -> el plan muestra sus **cursos** + calendario para elegir días por curso -> la membresía termina al llegar a **N clases** (N del plan). Decisiones: (1) planes se administran en pantalla nueva "Planes"; (2) N es del **plan** (total del ciclo); (3) días elegidos por curso; multi-curso incluido ya; v1 funcional y luego Claude Design. El 1B.1 previo (selector de modalidad, un curso) queda superado por este rework. **Paso A — esquema `0013_planes_multicurso`** ✅ construido y validado en sandbox (`plan_cursos` plan<->cursos con backfill desde `planes.curso_id`; `inscripcion_cursos` con días por curso y backfill de membresías; RLS; idempotente). ✅ **Aplicada en dev y en producción** (ver §0bis). **Paso B — pantalla "Gestión → Planes"** ✅ construida (crear/editar/activar planes con N, precio, criterio y cursos asociados; multi-curso; ruta `/planes`, gateada con permiso `cursos`; el curso sigue auto-creando/actualizando su Plan Regular y su fila en `plan_cursos`). **Paso C — venta plan-primero** ✅ construida (`/inscribir` ahora: alumno -> lista de planes -> días por curso -> calendario y `fecha_fin` de la clase N combinando cursos -> cobro con `fecha_compromiso`). Server valida días contra los cursos del plan, crea la membresía + `inscripcion_cursos` + una cuota. Se quitó el flujo de modalidad/parciales de la venta (los parciales serán tipos de plan propios más adelante). Validado: `tsc`, `eslint`, `next build` limpios. ✅ **`0013` aplicada en dev y en producción** (ver §0bis). El refresh ahora repone `plan_cursos`/`inscripcion_cursos`/`planes.modalidad` en dev (post-backfill), ya que esas tablas aún no existen en prod. *(Nota: el cartel "curso no tiene Plan Regular" que vio Javier fue porque el refresh copió `planes` desde prod, donde 0012 aún no está aplicada, dejando `planes.modalidad` en NULL; se resuelve dentro del rework.)* **Probado en dev por Javier (2026-09-06): el flujo plan-primero anda (crear combo, elegir días por curso, `fecha_fin` calculada, cobro).**

**Rediseño UX (referencia Danze) — ver `docs/PLAN_UX_DANZE.md`.** Estándar: **componente `Toggle`** (`src/components/Toggle.tsx`) para activar datos opcionales, en toda la app. **Migración `0014_planes_acceso_ilimitado`** ✅ construida y validada en sandbox (idempotente): `planes.acceso_modo` (`solo`|`todas`|`excepto`), `planes.clases_ilimitadas`, `planes.ciclo_dias`. **Modelo de plan unificado:** límite por **N** (fin = última clase por calendario, se recorre por suspensión/tolerancia) **o ilimitado** (fin = inicio + `ciclo_dias`); **tolerancia_faltas** por plan (0 = sin tolerancia ni bono). **Pantalla Planes** rediseñada (toggle "clases ilimitadas", criterio de acceso, N/ciclo condicional, tolerancia, lista con días por curso). **Venta** respeta acceso (todas/excepto/solo) e ilimitado (fecha_fin por ciclo_dias). Validado tsc/eslint/build. ✅ **`0013` y `0014` aplicadas en dev y en producción** (ver §0bis). Próximo en el backlog UX: Cursos (duración, límite, reservar), Profesores (documento/email/género/código de área/precio por clase) + honorario en asignación, y dashboard/navegación.

**PRIORIDAD: LIQUIDACIÓN.** Reordenado (Javier 2026-09-06): congelar UX y enfilar a liquidar profesores. **1B.2 (asistencia bajo el motor) — cerrado (2026-09-08).** Modelo corregido con el feedback de Javier: el **ciclo se completa** cuando ocurren **N sesiones dictadas** de la membresía (la falta, con o sin licencia, no lo alarga — la clase ya pasó); `clases_hechas` = clases a las que **asistió** (se muestra "X/N"); **falta con licencia** (nuevo control "Con licencia" en Asistencia, por alumno ausente) acredita **bono de tolerancia** = `bono_generado`, tope `tolerancia_faltas` del plan; **falta sin licencia** no genera bono ni corre nada. Se eliminó el mecanismo viejo que corría el fin de ciclo (`cuotas.vencimiento`) por cualquier falta tolerada (`reconciliarFaltas`): eso quedaba solo para suspensiones (clase completa cancelada). **Redención del bono (`0015_bono_redimido.sql`, `inscripciones.bono_redimido`):** al vender/reinscribir un alumno en el mismo plan, si tiene ciclos `completada` con bono no redimido, `/inscribir` lo detecta, suma esas clases al N del nuevo ciclo (muestra el aviso "+X clases por bono de tolerancia") y marca el origen como redimido. Suspensión sigue corriendo `cuotas.vencimiento` (reencuadre a `fecha_fin` de la membresía queda para más adelante si hace falta). Después: **1C — liquidación criterio 1**. **1C-core ✅ construido** (`/liquidaciones`, gateado con permiso `comisiones`; admin siempre pasa): devengo criterio 1 (membresías **cobradas + completadas**; base = **plata cobrada**; monto = `pct_ingresos` del profesor × base; v1 de 1 curso), **pantalla Liquidaciones** (por liquidar por profesor → generar; lista de liquidaciones con devengado/pagado/neto), **pago al profesor** (`pagos.tipo='pago'`, `liquidacion_id`) y **comprobante** (`/liquidaciones/[id]`, misma pestaña como el resto de la app). Diseño y política de ausencia de profesor en `docs/PLAN_LIQUIDACION.md`. **1C-ausencias (fase 2):** reemplazo/suspensión/multa como ítems de ajuste. Validado tsc/eslint/build + migraciones 0001→0015 en sandbox Postgres 16 (idempotentes, dos corridas limpias). **Base de comisión = lo cobrado (plata), confirmado por Javier 2026-09-07.** Seed de prueba: `scripts/seed_demo_liquidacion.sql` (idempotente, solo dev). **Comprobante (2026-09-07/08):** período liquidado = **mes vencido** siempre; por línea **valor total · descuento (con motivo) · cobrado** antes de la comisión; texto de faltas resumido ("X faltas sin licencia" / "X faltas con licencia = X clases bono de tolerancia"), corrimientos por **suspensión** aparte; pagos previos con concepto/fecha/medio/monto; **"Imprimir/Guardar PDF"** abre una ventana nueva con un documento HTML autónomo (sin app shell, sin página en blanco) — el link "Comprobante" ya no abre pestaña nueva, navega en la misma vista como el resto de la app. **Pendiente de prueba de Javier en dev — ver lista consolidada en §0bis.**

   **Venta — fecha retroactiva (2026-09-07).** En `/inscribir`, toggle **"Fecha retroactiva"** (estándar `Toggle`) que reemplaza la lista de próximas clases por un selector de fecha (`max` = hoy) para registrar una inscripción **que se omitió**, con su fecha real pasada. `fecha_fin` se recalcula desde esa fecha (clase N por calendario, o ciclo_dias). El servidor ya aceptaba fechas pasadas (sin validación de "solo futuro"). Validado tsc/eslint/build.

   **Correcciones de la revisión (2026-09-09).** Errores del circuito reportados por Javier, resueltos: **(1)** en Asistencia, una membresía **ilimitada** (plan por fecha, `clases_plan` null) ya no aparece en el padrón después de su `fecha_fin` (el ciclo terminó); **(2)** el control **"Con licencia"** solo aparece si el plan tiene tolerancia disponible — si ya se agotó (`bono_generado` >= `tolerancia_faltas`) muestra **"Sin tolerancia"** en lugar del checkbox; la tolerancia restante se calcula por inscripción (`toleranciaRestante` en `FilaAsistencia`) y solo aplica a planes con N. **(3)** montos con **2 decimales** siempre (`gs()` en `src/lib/inscripcion.ts` con `minimumFractionDigits: 2`); comisión redondeada a **centavos**, no a boliviano entero. **(4)** liquidación **mensual** solo incluye membresías **completadas hasta el último día del mes vencido** (`finMesVencidoISO`, filtro `fecha_fin <= hastaISO` en `calcularPendientes`) — ya no entran ciclos que terminan en el mes en curso. **(5)** el comprobante ahora muestra, por línea, el **tipo de servicio** (Curso regular / Particular / Taller / …) y el **nombre del plan**, no solo el curso. Validado tsc/eslint/build. **Pendiente de prueba de Javier en dev — ver lista consolidada en §0bis.** Mejoras diferidas (backlog, por prioridad): reporte del alumno (planes vigentes/fechas/contadores/faltas/bonos/pagos/deuda), filtros de preselección de planes en `/inscribir` (cursos puros / N clases / combos / atributos), incluir días en la descripción del plan ilimitado, reporte de detalle de membresía, y en Asistencia mostrar "(3/4)" del contador por alumno (con cuidado en carga retroactiva fuera de orden).

   **Acceso directo a Supabase vía MCP (2026-09-09).** Se confirmó en esta sesión que hay un conector Supabase MCP con acceso a los dos proyectos: `tropicana-dev` (`hyhijzuomqpylcmrzdvw`) y producción "Tropicana" (`pnvhpbxjbdmbktpwebtx`). Verificado por esquema real (no por `list_migrations`, que da vacío porque las migraciones se aplicaron a mano): **producción** tiene `0001`-`0011` pero le faltan **completas** `0012`, `0013`, `0014` y `0015`; **dev** tenía `0012`-`0014` pero le faltaba `0015` (`inscripciones.bono_redimido`) — **se aplicó `0015` en dev en esta sesión** (verificado). **Javier dio autorización permanente** (2026-09-09) para que, una vez validado un cambio con el checklist de pruebas, se apliquen migraciones y se mergee/pushee `claude/tropicana-app-context-d5zjt8` → `main` sin pedir confirmación cada vez (`main` está detrás por 36 commits, merge limpio sin conflictos). Falta confirmar si Vercel despliega `main` automáticamente.

   **Correcciones sobre datos reales de Javier en dev (2026-09-09).** Probando con datos propios (no el seed demo), Javier encontró: **(1)** la inscripción de un plan **ilimitado** mostraba "genera bono" por una falta con licencia, pese a que los ilimitados nunca deben bonificar (el dato quedó de antes de ocultar el checkbox para ilimitados: `asistencias.con_licencia=true` en una membresía sin tolerancia). Corregido en dos puntos de **lectura**, no hace falta backfill: en `ClienteAsistencia.tsx` el texto "(bono)" ahora exige `toleranciaRestante != null` (nunca aplica a ilimitado); en el comprobante (`liquidaciones/[id]/page.tsx`) una falta con licencia de una membresía ilimitada (`clases_plan == null`) se cuenta como falta común, no como bono. **(2)** El comprobante ahora muestra también **"Liquidado: <fecha>"** (creación de la liquidación, `liquidaciones.creado_en`) junto a "Emitido" (fecha de impresión/consulta), en pantalla y en el HTML de impresión. Validado tsc/eslint/build. **Pendiente de prueba de Javier en dev — ver lista consolidada en §0bis.**

   **1B.1 previo (venta del Plan Regular, modalidad) — SUPERADO por el rework de arriba.** Decisiones de Javier (2026-09-05): (1) el camino "mensual" de `/inscribir` ahora vende el **Plan Regular** del curso; (2) `fecha_fin` = fecha de la clase N por calendario; (3) `fecha_compromiso` se carga si queda saldo, tope hoy + `dias_compromiso_pago`; (4) falta con licencia -> bono (1B.2); (5) la suspensión correrá `fecha_fin` (1B.2). Cambios: `planes.modalidad` + migración `0012`; `/inscribir` vende un ciclo (una cuota, N clases, `fecha_fin`, `fecha_compromiso`); parciales (clase/semana/medio_mes) sin cambios. **El adelanto de varios meses** (multi-ciclo) se difiere a la renovación (Paso 2). Además: **crear/editar un curso mantiene su Plan Regular** (N=días×4, precio=mensual) en `cursos/acciones.ts` (`sincronizarPlanRegular`), y el borrado de curso ahora contempla el plan (desactiva/borra en conjunto; `contarDependencias` cuenta también inscripciones). Validado: `tsc`, `eslint` y `next build` limpios; 0012 en sandbox. Falta: aplicar 0012 en dev + prueba de Javier. (Contexto: dev y producción compartían el **mismo** Supabase hasta ahora — ver *Despliegue*; por eso `0010`/`0011`, aditivas/idempotentes, se aplicaron directo a prod el 2026-09-05. `0001→0011` aplicadas en producción.)
2. Que la usuaria **use y pruebe** todo y anote lo que chirríe.
3. *(Opcional, seguridad)* activar 2FA en tu cuenta de Vercel cuando puedas.

**Decisión de modelo (2026-09-05) — modalidades = planes distintos (opción 2).**
Cada modalidad comercial (`mensual`, `medio_mes`, `clase`, `semana`) será un
**tipo de plan propio**, no un atributo dentro de un mismo plan. `0011` solo
convirtió las inscripciones `mensual` (Plan Regular). Los tipos medio_mes/clase/
semana se modelan en un paso posterior. **Pendiente puntual:** la inscripción
**id=7** (`medio_mes`, curso de 2 clases/semana) quedó **sin plan** tras 0011.
Confirmado que el **alumno está activo** → se le crea un **"Plan Medio Mes"**
puntual. Fix construido y validado en el sandbox: `scripts/fix_id7_plan_medio_mes.sql`
(auto-deriva N = `clases_total` o días×4, y precio = tarifa `medio_mes` del curso;
idempotente; guarda por `id=7 and modalidad='medio_mes'`). **PENDIENTE de aplicar
en producción** (Javier corre pre-check y aplica). Nota: ese curso quedará con
**dos planes** (Plan Regular + Plan Medio Mes), lo cual es correcto bajo la opción 2.

**Decisión tomada (2026-08-31) — App Shell + catálogo de permisos: DIFERIDO.**
Driver actual = rapidez / mínimo costo para una primera versión operativa con
usuarios de **confianza total** (gerente, etc.). Se construye Etapa 1 con el
gateo actual (matriz `rol_permisos` por rol, ya configurable) y una navegación
simple; el catálogo de permisos granular por pantalla/grupo y el App Shell
completo se afinan **después**, cuando dejen de ser usuarios de confianza total.
No es indispensable para empezar a registrar y operar.

## 6. Cómo trabajamos (protocolo acordado)

Plan corto y visto bueno antes de construir algo grande · un hito a la vez (probado + commiteado + este `ESTADO.md` actualizado) · cada respuesta cierra con próximos pasos y qué necesito de vos · anticipar conflictos con opciones + recomendación · validar con evidencia · lenguaje claro y pasos manuales numerados. Los prompts numerados del historial son **historial, no pendientes**: lo vigente es lo que Javier pida de acá en más.

**Regla de sincronización de migraciones (permanente, pedida por Javier 2026-09-04):** cada vez que Javier confirme que aplicó una migración en Supabase, actualizar **en el acto** el estado de esa migración en este `ESTADO.md` marcándola **aplicada con la fecha**, y commitear. Nunca dejar el estado de migraciones desincronizado entre lo que Javier informa y lo que figura acá.

## 7. Metodología de release y regla de trabajo (permanentes, pedidas por Javier 2026-09-05; **flujo de release actualizado 2026-09-09**)

**Ambientes vigentes hoy (evolucionaron desde el 2026-09-05 original de "solo
dos ambientes"):**
- **Sandbox de validación de Code (efímero):** Postgres 16 descartable, sin
  datos reales, donde se corre la cadena **completa** de migraciones
  (0001→N) antes de tocar cualquier base real — confirma idempotencia y
  corre smoke tests. No lo usa Javier, se descarta al terminar.
- **`tropicana-dev`** (proyecto Supabase real y separado, `hyhijzuomqpylcmrzdvw`)
  — donde **Javier prueba de verdad** (con datos propios o refrescados de
  producción). Operativo desde 2026-09-05.
- **Producción** (Vercel + Supabase "Tropicana", `pnvhpbxjbdmbktpwebtx`) — la
  usa Natalia.
No hay staging en la nube más allá de estos dos proyectos Supabase.

**Flujo de release (obligatorio):**
1. Todo cambio (código y/o migración) se valida primero en el **sandbox de
   Code**: migraciones por cadena completa e idempotencia; código con
   `tsc`/`eslint`/`build`.
2. Se aplica en **`tropicana-dev`** y **Javier lo prueba ahí** contra un
   checklist de pruebas del cambio. Nada pasa a producción sin ese visto bueno.
3. Con el checklist validado en dev, **y con el OK explícito de Javier para
   ese pase puntual**, pasa a **producción**: migraciones vía el conector
   **Supabase MCP** (acceso directo confirmado 2026-09-09 a los dos
   proyectos — ya no hace falta pegar SQL a mano en el SQL Editor) + merge/
   push de la rama de trabajo a `main` (Vercel despliega solo, branch
   tracking activo). **Vigente desde 2026-09-10:** validar en dev **no**
   dispara este paso solo — hubo una autorización permanente (2026-09-09)
   para saltear esa confirmación, que Javier **revocó al día siguiente**;
   se pide su OK explícito cada vez, otra vez.
4. Nunca una migración o código nuevo pasa a producción sin haber sido
   validado primero en `tropicana-dev` **y sin el OK explícito de Javier**.
(Sigue vigente la regla de sincronización de migraciones de §6.)

**Refresh de datos producción→dev:** ✅ **implementado** (2026-09-05) en
`scripts/refresh-dev.mjs` (Node + `pg`). Copia los datos de dominio de
producción a `tropicana-dev` (solo lectura sobre prod; borra/reescribe dev).
No copia usuarios/config (perfiles, parámetros) y **anula** las referencias a
usuarios (`usuario_id`, `registrado_por`); preserva ids y auto-referencias
(tutor/referido/renovación) y reajusta secuencias. Decisión PII = copiar tal
cual (D5=a). Validado en sandbox con dos bases. Pasos: `docs/SETUP_TROPICANA_DEV.md` §8.
Se corre **ad-hoc, cuando Javier lo pide** (no es parte obligatoria del flujo
de release en sí — sirve para poblar dev con datos realistas antes de probar).

**Regla de trabajo (permanente):** ante cualquier pedido, primero **proponer el
plan y esperar el OK** antes de construir; **un hito a la vez**, cerrado (probado
en local + versionado + `ESTADO.md` actualizado) antes del siguiente; cada
respuesta cierra con **próximos pasos y qué se necesita de Javier**; y si un
pedido **choca con el repo o una decisión previa, avisar antes de ejecutar**.

**Regla de Design (permanente, pedida por Javier 2026-09-05):** avisar **antes de
construir** cuando una pantalla/flujo **nuevo** (sin mockup aprobado) o un
rediseño visual/navegación requiera pasar por **Claude Design** para mantener
estándares y buen diseño. No requieren Design: backend/migraciones y pantallas
con mockup ya aprobado (se implementan fieles). Requieren aviso a Design (Javier
decide mandarla a Design primero o que Code haga una v1 y Design refine):
Liquidaciones, Estado de cuenta, Agenda de sala, App Shell visual, y toda
pantalla nueva del motor sin mockup.

**Reencuadre del mecanismo 0009 (confirmado 2026-09-05):** con el modelo de
membresías, el "fin de ciclo" pasa a `membresia.fecha_fin` (última clase por
calendario); la **suspensión de la academia corre `fecha_fin` + el contador de
clases** (no `cuotas.vencimiento`); la **falta con licencia** anota **bono** (no
corre el ciclo actual; salta a la renovación); `cuotas.vencimiento`/`fecha_compromiso`
pasa a ser la fecha de compromiso de pago del saldo. La traza `corrimientos_ciclo`
se conserva re-apuntada al nuevo efecto (se ajusta en el sub-hito 1B).

---

## Clase de prueba — Paso D (padrón de asistencia) · cerrado 2026-09-11

La prueba ya se vende (Pasos A-C) y ahora **aparece en el padrón**.

**Lo que se arregló de fondo, y no era de las pruebas.** El padrón resolvía las
membresías por `inscripciones.curso_id`, que guarda solo el **curso principal**
de la venta. Un plan multi-curso vive en `inscripcion_cursos`: medido en dev, la
inscripción 28 (activa, no es prueba) tiene 5 cursos y aparecía en el padrón de
uno solo — **invisible en los otros cuatro**. Ahora el padrón (y el contador de
las tarjetas de curso) se resuelve por `inscripcion_cursos`, con
`inscripciones.curso_id` como respaldo para filas viejas sin esa fila.

Con eso se empezó a respetar `inscripcion_cursos.dias`: si la membresía declaró
días para ese curso, solo figura esos días — el mismo criterio que usa el motor
para contar el ciclo. Medido antes de aplicarlo: en las 27 filas activas de dev
los días elegidos coinciden exactamente con los del curso, así que hoy no
cambia a nadie.

**Lo propio de la prueba.**
- Distintivo **"Prueba"** en la fila, y la línea de detalle dice "Clase de
  prueba" en vez de progreso de ciclo y faltas (una prueba es una sola clase:
  no tiene ciclo ni bono).
- El conteo de la clase va **por personas, no por filas**: una prueba grupal es
  un titular más N acompañantes sin nombre, con **una sola asistencia**
  (regla 11), pero entran todos. Vale para el contador de la tarjeta del curso
  y para "X de Y marcados".

**Un padrón que no se pudo leer ya no se ve como una clase sin alumnos.**
`cargarPadron` devuelve `error` y la pantalla lo muestra en rojo pidiendo no
tomar asistencia hasta resolverlo (regla de calidad 1). Antes un fallo de
lectura devolvía el padrón vacío en silencio.

**Pendiente de la clase de prueba:** E (liquidación a prorrata), F (crédito al
convertir), G (reparar inscripciones 17/18/19).

---

## Clase de prueba — una fecha por curso (0024) · cerrado 2026-09-11

Probando la prueba de 2 cursos, Javier: *"no me queda claro cómo registraría
pruebas pasadas si los cursos no tuvieran clases coincidentes en el mismo día
de la fecha"*. Tenía razón, y el problema era del modelo, no de la pantalla.

**Por qué fallaba.** Una membresía guarda **una** `fecha_inicio`, y el fin de
ciclo se calcula caminando el calendario desde ahí. Para una membresía regular
alcanza: el ciclo es un período continuo. Una prueba no: es **una clase suelta
en cada curso**, y esas clases caen en días distintos. Con una sola fecha, el
segundo curso quedaba donde el calendario lo dejara — y en una prueba pasada
podía quedar en el futuro.

**Qué se hizo.** `inscripcion_cursos.fecha` guarda la fecha exacta de la única
clase de ese curso. Se **guarda** en vez de derivarse porque un día de la
semana se repite: si el vendedor elige la clase del lunes 21 y no la del 14,
caminar el calendario aterrizaría en el 14. `dias` conserva los días reales del
curso, que es lo que permite correr la prueba a la clase siguiente si la
elegida se suspende (regla de negocio 4).

- **Venta**: un selector de fechas por curso; el toggle de fecha pasada pide
  una fecha por curso.
- **Motor**: `finDeCicloDePrueba` no camina — resuelve desde las fechas
  elegidas y solo corre las suspendidas.
- **Padrón**: una prueba figura **exactamente** el día de su clase, no todos
  los días del curso.
- **`fecha_inicio` de una prueba** pasa a ser su primera clase. Antes era la
  fecha de la venta, que para una prueba no significa nada. El backfill salta
  las ya devengadas (regla de negocio 5).

**Controles.** El 9 (fin de ciclo vs suspensiones) **excluye** las pruebas: iba
a gritar en falso en cuanto alguien eligiera una clase que no fuera la próxima.
Lo reemplazan el **13** (prueba sin la fecha de su clase — sin ella el alumno no
aparece en el padrón y nadie se entera) y el **14** (fechas de la prueba que no
son las de sus clases). Los cuatro (9, 11, 12, 13, 14) en OK en dev.

**Pendiente de la clase de prueba:** E (liquidación a prorrata), F (crédito al
convertir), G (reparar inscripciones 17/18/19).

---

## Liquidación a prorrata — cierre de E, y las reglas 16 a 19 · 2026-09-11/12

**Rama:** `claude/tropicana-app-context-d5zjt8` · commits `4e526c7`, `e98dc8e`,
`5a6900c`. Todo **solo en dev**: falta el OK explícito de Javier (regla de
proceso 1).

### Lo que se decidió, y por qué

**1. Las clases se cuentan por calendario menos suspendidas** (regla de negocio
10). Antes se contaban solo las sesiones con estado `dictada`, así que una clase
que ocurrió pero cuya asistencia nadie cargó pesaba cero: el profesor cobraba de
menos por un trámite pendiente, no por algo que pasó en la sala. Es lo que hacía
que un ilimitado multicurso de Bs. 800 con 40 clases de calendario liquidara
"1 clase".

**2. Su contrapeso, la regla 17**: una membresía **con prorrateo (2+ cursos)** no
se liquida mientras alguna clase de su ciclo no tenga ni asistencia ni
suspensión. Una **mono-curso se liquida igual** — con un solo curso el reparto
da `cobrado` siempre, el conteo no decide plata. El bloqueo es **de esa
membresía**, no del profesor ni del período.

**3. La regla 16 se angostó** (12/09, sobre la decisión original del 11/09).
Antes congelaba el mes entero para todos apenas alguien cobrara. Ahora congela
**una clase**, y solo si de ella depende una membresía con prorrateo **ya
pagada**. Dos motivos medidos en el código: *(a)* una mono-curso no depende del
conteo; *(b)* agregar una membresía no toca lo ya repartido. Por eso la **venta
retroactiva ya no se bloquea** y una liquidación pagada **acepta complemento**.
`src/lib/periodos.ts` pasó de `cierreLiquidado` (un tope de fecha global) a
`cargarCongelador` / `claseCongelada` (un mapa `curso|fecha`).

**4. Reglas 18 y 19, nuevas.** Una clase sin alumnos no existe para nadie: no
cuenta, no traba, no obliga. Y el motivo de una suspensión dice a quién se le
atribuye, pero la plata no cambia por eso — el profesor no cobra una clase que
no dictó.

### El bug que apareció en el camino (y el que más importa)

**El padrón filtraba por `estado === "activa"`**, contra la regla de negocio 2.
Una membresía `completada` —agotada y cobrada, o sea el final normal de toda
venta— desaparecía del padrón de sus propias clases pasadas. Al volver a una
fecha vieja la clase se veía **vacía**, y una clase que parece vacía se suspende
"sin alumnos": eso le borra al profesor el peso de esa clase. Pasó con Heels en
agosto — los cinco sábados tenían alumno y el padrón mostraba ninguno.

Segunda capa: `cicloAgotado` comparaba contra los totales de **hoy**. Ahora se
pregunta **al día que se mira** (`cicloAgotadoAl`), contando solo las clases
anteriores a esa fecha.

### Lo demás

- **Migración 0028**: `parametros.opciones` — un valor con alternativas se elige
  de una lista, nunca se escribe a mano (regla de calidad 6). Los parámetros del
  reparto y `periodicidad_liquidacion` volvieron al grupo "Liquidación" que ya
  existía.
- **Comprobante**: la tabla del reparto tenía cuatro columnas sin encabezado.
  Ahora dice la cuenta en palabras y nombra cada columna.
- **Pantalla de liquidaciones**: las clases sin registrar se muestran
  comprimidas por profesor, con el detalle **por curso** al expandir.
- **Controles**: 19 (prorrateo devengado con clases sin registrar) y 20 (D18).

### Cambio de datos en dev, con el antes/después

Se revirtieron los devengos de la **membresía 37** para poder recalcular con el
criterio nuevo. Las tres liquidaciones estaban `abierta`, sin un peso pagado —
que es lo que la regla 16 permite.

| | Antes | Después |
| --- | --- | --- |
| Comisiones de la membresía 37 | 3 (Zumba 120, Tropicoreográfico 100, Salsa 100) | 0 |
| Liq. 2 — Isabel Góngora | 120, 1 ítem | 0, sin ítems |
| Liq. 3 — Natalia Salek | 305, 4 ítems | 105, 2 ítems |

### Lo que sigue, en orden

1. **D18 — la comisión sigue a quién dictó, no a quién está asignado hoy.** Es
   un **bug**, no una mejora: el cálculo lee solo las asignaciones vigentes
   (`hasta is null`), así que si cambia el titular a mitad de mes toda la
   comisión va al nuevo. El **control 20 ya detecta 1 caso en dev**.
2. **Vigencia del curso** (§1.b de `DECISIONES.md`): decidida, sin construir.
3. Validaciones pendientes de Javier sobre lo de arriba, y **D10** (volver
   `asistencia_semanas_retro` a 2 en dev).

---

## D18 — la comisión es de quien dictó, no de quien está asignado hoy · 2026-09-12

**Migración 0029** + código. Solo en dev.

**El bug.** El reparto leía únicamente las asignaciones abiertas
(`asignaciones.hasta is null`) y se quedaba con la más reciente. Si a mitad de
ciclo se cambiaba el titular de un curso, **toda** la comisión del período se le
atribuía al nuevo y el anterior no cobraba las clases que sí dictó. La tabla ya
tenía `desde` / `hasta`: el modelo lo soportaba y el cálculo lo ignoraba. Lo
detectó Javier al revisar D16.

**Qué se hizo.** `clasesDelCiclo` ahora devuelve las **fechas** de las clases, no
un total, y cada fecha se atribuye a quien tenía el curso **ese día**
(`asignacionEn`, determinista ante asignaciones solapadas: gana la que empezó
después, luego la abierta, luego el id más alto). La parte del curso se divide
por las clases de cada uno. Un curso dictado por dos deja **dos líneas**.

- **Clases sin asignación ese día**: no se pagan. Su plata no se devenga —
  repartirla sería pagarle a alguien por una clase que no dio.
- **`%` que cambió dentro del ciclo**: manda el que rigió en más clases suyas.
  Es un solo número por (curso, profesor) y tiene que explicar la mayor parte.

**El tope que evita el sobrepago.** La liquidación se genera **de a un profesor
por vez**, así que la llave por profesor sola no alcanza: una comisión vieja
—cuando el curso se pagaba en una sola línea— tiene la parte **entera** del
curso, y la línea del segundo profesor se le habría sumado encima. Se suma lo ya
devengado por (membresía, curso) y eso **topea** lo que todavía se puede
devengar. Es la regla 12 llevada hasta el final: lo devengado no se reescribe, y
tampoco se le suma encima.

**Migración 0029.** El índice único era `(membresia_id, curso_id)` — hacía
imposible justamente dos profesores en un curso. Pasa a
`(membresia_id, curso_id, profesor_id)`. Verificado en dev: acepta dos
profesores del mismo curso y **sigue rechazando** el duplicado real (mismo
profesor, mismo curso).

**Comprobante.** Cuando un curso lo dictó más de uno, su línea del reparto se
abre en sub-líneas con las clases y la parte de cada profesor, y marca "usted"
en la del titular del comprobante. La glosa dice "N de las M clases del curso
(cambio de titular en el ciclo)". Sin eso, la base de la comisión parece no
coincidir con la parte del curso.

**Control 20** pasa a ser de verificación, no de deuda: lo devengado antes de
esta corrección puede seguir marcado (regla 12, no se reescribe); lo que importa
es que no aparezcan filas nuevas.

---

## D17a — quién dictó la clase deja de ser una suposición · 2026-09-12

**Migración 0030** + código. Solo en dev.

**El punto de partida.** `sesiones.profesor_id` ya existía y se llenaba **por
inferencia**: al guardar la asistencia se estampaba el profesor de la asignación
**abierta**, sin mirar la fecha de la clase, y nadie lo leía. El campo donde
debía estar el hecho se completaba con una conjetura — y encima con la
equivocada: si el titular había cambiado, quedaba el de hoy en una clase de hace
dos meses.

**Qué se registra ahora**, al tomar asistencia:

| Campo | Qué es |
| --- | --- |
| `sesiones.profesor_id` | **Quién dictó**. Elegido, no inferido. |
| `sesiones.titular_id` | El titular vigente **ese día**, como snapshot (regla 12): de él depende a quién se le descuenta un reemplazo. |
| `sesiones.reemplazo_motivo` | Catálogo `motivo_reemplazo`. NULL = la dictó el titular. |
| `sesiones.reemplazo_costo` | Lo que se le paga al reemplazante por esa clase. |
| `profesores.tarifa_reemplazo` | La **referencia** por clase. El monto real se confirma al registrar. |

**La pantalla.** Arriba del padrón, siempre visible: *"Profesor titular esta
fecha: …"*. Si el curso estaba **desasignado** ese día, lo dice en rojo y el
bloque de reemplazo se abre solo — y el servidor **no deja guardar** sin él
(regla 20). Al elegir el motivo, la pantalla dice qué hace con la plata, porque
es la decisión que se está tomando en ese momento.

**El criterio del titular vive en un solo lugar**, `src/lib/asignaciones.ts`: lo
usan la pantalla de asistencia y el reparto de la liquidación. Si cada una lo
resolviera por su cuenta, la pantalla podría mostrar un nombre y pagarle a otro.
Incluye el desempate ante asignaciones solapadas —gana la que empezó después,
después la abierta, después el id más alto— porque de ahí sale a quién se le paga.

**El prorrateo honra el motivo** (regla 20): `administrativo` deja la parte de
esa clase en Tropicana; `titular` se la cuenta a él y la cobra normal — el
descuento de lo pagado al reemplazante es **D17b**, sin construir.

**Una clase suspendida** deja de llevar profesor: `profesor_id` null y los
campos de reemplazo limpios. No la dictó nadie.

---

## Pase a producción de las migraciones 0023–0030 · 2026-09-12

**OK explícito de Javier** (regla de proceso 1). Se siguió el orden de
`DECISIONES.md` §3: migraciones primero, código después.

**Verificación previa, antes de tocar nada** (solo lectura sobre producción):

| Chequeo | Resultado |
| --- | --- |
| Producción estaba en | `0022` |
| Comisiones devengadas / liquidaciones | **0 y 0** — la reescritura del motor de comisiones no toca nada existente |
| `curso_tarifas` con modalidad fuera de la lista nueva | 0 — la restricción ampliada no rechaza ninguna fila |
| `inscripciones.membresia_anterior_id`, `inscripcion_cursos.dias` | existen (0023 y 0024 los necesitan) |
| Choques de nombre (catálogo `motivo_reemplazo`, parámetro `prueba_plazo_dias`) | ninguno |

**Las ocho aplicadas sin error**: 0023 clase de prueba · 0024 fecha por curso ·
0025 comisión por curso · 0026 reparto guardado · 0027 un profesor dos cursos ·
0028 parámetros con opciones · 0029 comisión por curso y profesor · 0030 quién
dictó la clase.

**Ningún dato de dominio se modificó.** Los dos `update` de la 0024 tocaron
**0 filas**: `es_prueba` nace en `false`, así que ninguna membresía de
producción califica. Verificado después de aplicar — 0 membresías `es_prueba`,
0 `inscripcion_cursos.fecha` cargadas, 0 filas con `actualizado_en` de hoy.

**Controles posteriores.** Todos OK salvo el **3 (contadores de clases
desactualizados), que da 2** — y **no lo causó este pase**:

| Membresía | Alumno | Contador guardado | Presencias reales | Última modificación |
| --- | --- | ---: | ---: | --- |
| 23 | Escalante, Vania (Zumba) | 6 | 5 | **2026-09-10** |
| 24 | Salek, Charo (Zumba) | 7 | 5 | **2026-09-10** |

Las dos se modificaron por última vez el 10/09, dos días antes del pase. **Dev
tiene el mismo control en 1**, así que es un desvío preexistente y no una
consecuencia de las migraciones. Queda **pendiente de decisión de Javier**: el
motor recalcula el contador al guardar asistencia, así que se corrige solo
volviendo a tocar esas dos clases, pero es un cambio de datos en producción y
no se hace sin su OK (regla de proceso 5).

**Deploy del código**: `main` actualizado `31da6ae..ed44fbd` (fast-forward, 47
commits) con el OK explícito de Javier. Vercel publica solo al mergear.
Verificado antes de pushear: typecheck, lint y build limpios.

---

## D17b — el descuento del reemplazante en la liquidación · 2026-09-12 (dev)

Cierra la regla de negocio **20a**: cuando la clase la dictó un suplente porque
el **titular** faltó, la liquidación del titular va **normal** —esa clase le
cuenta y la cobra— y al **total** se le descuenta lo que se le pagó al
reemplazante. Javier, textual: *"El descuento es un concepto aparte en la
liquidación: no es una comisión."*

**Migración 0032** (aplicada **solo en dev**, aditiva):

- `descuentos_liquidacion` — un descuento por clase, idempotente por
  `sesion_id` (índice único parcial). `sesion_id` es nullable a propósito, para
  que una multa cargada a mano entre en la misma tabla el día que se defina
  cómo se carga. `monto` siempre positivo: el signo lo pone la cuenta, no el
  dato.
- `liquidaciones.total_descuentos` — separa las dos platas. Lo devengado sigue
  siendo lo devengado y el neto pasa a ser
  `total_devengado - total_descuentos - total_pagado`. Si el descuento se
  restara del devengado, el comprobante ya no podría mostrar la comisión
  completa, que es justo lo que el profesor tiene derecho a discutir.
- Catálogo `motivo_descuento` (`reemplazo`, `multa`) — regla de negocio 13, y
  nace en la migración (regla de calidad 7).

**No vive en `comisiones_devengadas`** y el motivo no es estético: esa tabla es
de devengos —membresía, base, criterio— y su `tipo` está restringido a
`comision` / `referido`. Un descuento cuelga de una **sesión**, no de una venta.
Meterlo ahí con monto negativo sería repetir la confusión que el glosario existe
para evitar.

**Código**:

- `calcularDescuentos()` lee las sesiones con `reemplazo_motivo = 'titular'` y
  `reemplazo_costo > 0`, excluye las que ya tienen descuento, y los inserta
  **dentro de `generarLiquidacion`** — en la misma corrida, para que no exista
  una liquidación pagable antes de que el descuento entre.
- `registrarPagoLiquidacion` topea el pago con los descuentos ya restados: no
  se puede pagar de más.
- El comprobante (pantalla e impreso) muestra cada descuento con su motivo y
  una línea **Total descuentos**; la lista de liquidaciones gana su columna.
- `cargarCongelador` suma un paso 0: una clase **cuyo descuento ya se pagó**
  queda congelada. Es directo —el descuento apunta a la sesión— y no pasa por
  el prorrateo: si se pudiera editar el costo del reemplazo después de pagarlo,
  el número que salió de la caja dejaría de coincidir con el dato.

**Lo que D17b NO hace, y quedó anotado como D19**: le descuenta al titular pero
**no genera la contrapartida**. Lo que hay que pagarle al suplente no aparece en
ninguna lista — se puede pagar a mano con el motivo `otro_pago_profesor`, pero
hay que acordarse. `lineasPorCobrar` arma solo el bucket `cuotas`; la lista
"Por pagar" es el paso 2F y no arrancó.

---

## Vigencia del curso · 2026-09-12 (dev)

Construye la decisión que Javier había dado por tomada el mismo día: *"Un curso
tiene fecha de activación y de baja… No lo veo como backlog. Es así como se debe
trabajar."*

**El agujero que cierra.** Desde que las clases se cuentan por **calendario
menos suspendidas** (regla de negocio 10), el calendario de un curso no tenía
principio: `dias_semana` dice "martes y jueves" y el conteo los genera hacia
atrás hasta donde llegue el ciclo, existiera el curso o no. Esas clases
inventadas pesan en el prorrateo y traban liquidaciones por sesiones "sin
registrar" (regla 17) que nunca ocurrieron.

**Migración 0033** (aplicada **solo en dev**): `cursos.vigente_desde` (not null,
default `current_date`) y `cursos.vigente_hasta` (null = sigue corriendo), más
un check de coherencia.

**El backfill es deliberadamente conservador, y esto importa.** `vigente_desde`
se llenó con la **evidencia más vieja** de que el curso corría: la primera
sesión, la primera asignación de profesor, la primera membresía que lo toca; y
si no hay nada, su fecha de creación. El motivo es la **regla de negocio 5**:
una membresía ya devengada no cambia sus números en silencio. Una fecha más
tardía le habría cambiado el conteo a membresías viejas y movido plata ya
repartida.

**Verificado, no supuesto**: después de aplicar, **0** membresías quedan fuera
de la vigencia de su curso — ni por el ciclo ni por la fecha de una prueba, ni
las que solo tienen el `curso_id` legado. O sea **ningún conteo existente
cambió**. Queda como **control 21** del script.

`vigente_hasta` **no** se backfilleó, ni siquiera en cursos ya inactivos:
inventarle una fecha de baja sería el cambio silencioso que la regla 5 prohíbe.

**La fecha de baja la pone la persona, nunca el sistema.** La primera versión de
esto estampaba `vigente_hasta = hoy` al desactivar. Javier lo frenó el mismo
día: *"la fecha de validez hasta de un curso es delicada como para que la
asignes sin intervención… es importante que el usuario intervenga y pueda
establecerla o confirmarla antes de grabar la inactivación, porque puede ser
otra fecha la que refleja la inactivación, ya sea adelantada o atrasada."* Tenía
razón: de esa fecha depende cuántas clases pone el curso en el prorrateo, así
que ponerla por default es decidir plata por omisión. Ahora:

- El panel de baja **pide la fecha**, propuesta en hoy y confirmable o
  editable. Desde la lista, "Dar de baja…" abre la ficha en vez de ejecutar.
- Una fecha **futura** es una **baja programada**: el curso sigue activo y
  vendible hasta entonces (el Plan Regular lo acompaña).
- Una baja **hacia atrás por encima de historial se rechaza**, con el dato:
  *"tiene clases o membresías en curso hasta el X; la fecha de baja no puede ser
  anterior al X"*. Lo mismo al revés: `vigente_desde` no puede saltar por encima
  de la primera clase o membresía ya registrada. El guard corre también al
  **editar la ficha**, no solo al dar de baja — si no, sería salteable.
- Reactivar borra la fecha de baja: un curso "activo" con baja vencida no
  generaría ninguna clase y las dos señales se contradirían sin decirlo (regla
  de calidad 5). Solo puede ampliar la vigencia, nunca recortarla.

De paso se corrigió `contarDependencias`, que solo miraba `asignaciones` e
`inscripciones.curso_id`: no veía `inscripcion_cursos` ni `sesiones`, así que un
curso de un plan multi-curso se daba por "sin historial" y el borrado chocaba
contra la FK (`on delete restrict`) en vez de ofrecer la baja.

Medido en dev con el mismo criterio del guard: en los 9 cursos `vigente_desde`
**ya es igual** a su primera evidencia (o sea, ninguno puede activarse más
tarde), y la baja más temprana posible va del **19/09** (Ladies) al **01/10**
(Contemporáneo), según hasta cuándo corren sus membresías.

**Dónde muerde la regla**, todo a través de un helper único (`src/lib/vigencia.ts`):

| Lugar | Qué cambia |
| --- | --- |
| `clasesDelCiclo` (liquidaciones) | Un día fuera de vigencia no es una clase: no cuenta para el reparto **ni** se exige registrarlo |
| `cargarCongelador` (`periodos.ts`) | No congela días que nunca entraron en ningún conteo |
| Asistencia | El desplegable no ofrece esas fechas, y `validarFecha` las rechaza en el servidor con el motivo |
| Venta y clase de prueba | No se vende un curso que no corría en la fecha del ciclo o de la clase |
| Cursos | Los dos campos en la ficha, y la vigencia en la lista |

**Lo que la migración NO hace**: no limpia sola ningún ruido de calendario. Crea
el campo donde Javier corrige la fecha real de cada curso. Mientras
`vigente_desde` sea la evidencia más vieja, el comportamiento es idéntico al de
antes.

**Un dato que estaba mal en la documentación y se corrigió**: `DECISIONES.md`
afirmaba que "Salsa y Bachata Inicial tiene su primera sesión el 31/08 y el
conteo le atribuye 8 clases de agosto". Medido contra dev: el 31/08 es su fecha
de **creación**; su primera sesión y su primera asignación son del **03/08**. El
curso sí corría en agosto. El agujero era real, el ejemplo no.

---

## Pase a producción de las migraciones 0032 y 0033 · 2026-09-12

**OK explícito de Javier**: *"Avanza con las migraciones"*. Se saltó el paso 2
de `DECISIONES.md` §3 (validación en dev) por decisión suya; el resto del orden
se respetó.

**Verificación previa, solo lectura sobre producción:**

| Chequeo | Resultado |
| --- | --- |
| Migraciones aplicadas / última | 21 / `20260912040731` |
| `descuentos_liquidacion`, `cursos.vigente_desde` | no existían |
| Choques (catálogo `motivo_descuento`, constraint `cursos_vigencia_coherente`) | ninguno |
| Liquidaciones / comisiones devengadas | **0 y 0** — la 0032 no puede perturbar nada |
| Cursos sin `creado_en` (el fallback del backfill) | 0 |
| Control 21 **simulado** antes de aplicar | 0 / 0 / 0 |

**Las dos aplicadas sin error.** Ningún dato de dominio se modificó: 0
descuentos, 0 liquidaciones con descuento, 0 cursos con fecha de baja, 0 cursos
con `actualizado_en` de hoy. Las 5 membresías con `actualizado_en` de hoy son de
las 04:10 UTC — del pase anterior (0023–0030, aplicado 04:07), no de estas.

**El backfill de la vigencia en producción** (distinto al de dev, porque los
datos son otros):

| Curso | Corre desde |
| --- | --- |
| Bachata Conexión | 2026-08-11 |
| Zumba | 2026-08-18 |
| Heels, Ladies | 2026-08-28 |
| Domingo Salsa y Bachata | 2026-08-30 |
| Danza Comercial, Salsa y Bachata Inicial, Tropicoreográfico | 2026-08-31 |
| Contemporáneo | 2026-09-01 |

**Controles posteriores: los 21 en OK**, salvo el **15** (nombres distintos para
la llave a `inscripciones`: `inscripcion_id` / `membresia_id` /
`membresia_anterior_id`), que da REVISAR **a propósito** — es la deuda D1 y el
control existe para que no se olvide.

**El control 3 se resolvió solo en producción**: daba 2 antes del pase
(membresías 23 y 24 de Zumba, contadores desactualizados desde el 10/09) y ahora
da **0**, porque esas asistencias se volvieron a guardar y el motor recalculó.
Dev sigue en 1, que es un desvío propio de dev.

**El código todavía NO está desplegado.** `main` sigue en `5f547f0`. Producción
quedó con **esquema nuevo y código viejo**, que es el estado seguro del orden de
§3: las columnas nuevas simplemente no se leen. El merge a `main` —que es lo que
dispara Vercel— espera su propio OK.

---

## D6 — la duración de la clase, y con ella la hora de fin · 2026-09-12 (dev)

Decisión de Javier: *"Debes implementar la duración de las sesiones de cursos en
el maestro de cursos, con eso se obtiene la hora de fin."*

**Por qué ahora.** Natalia necesita validar la disponibilidad de la sala, y sin
duración no hay nada que validar: una clase "a las 19:00" no choca con ninguna
otra si no se sabe cuánto ocupa. `cursos.hora` existía desde la 0005 y dice
cuándo **empieza**; faltaba la otra mitad.

**Migración 0034** (aplicada **solo en dev**): `cursos.duracion_min` (not null,
default 60, check entre 1 y 600) y el parámetro `duracion_clase_min` con su
lista de opciones — el default que la pantalla propone para un curso nuevo sale
del **dato**, no del código (regla de negocio 13), y nace en la migración (regla
de calidad 7).

**La hora de fin se calcula, no se guarda.** Guardar inicio y fin sería tener el
mismo hecho en dos campos que pueden contradecirse — que es exactamente la
confusión más cara de este proyecto: dos campos llamados "fin de ciclo". El
cálculo vive en `src/lib/horarios.ts`, en un solo lugar: `horaFin`,
`rangoHorario`, `etiquetaDuracion` y `seSolapan`.

**`seSolapan` ya está escrito, y con su criterio definido**: intervalo medio
abierto `[inicio, fin)`, así que una clase que termina 20:00 y otra que empieza
20:00 **no** chocan — es el cambio de turno normal de una sala, no un conflicto.
Está acá y no en la pantalla para que haya un solo criterio cuando llegue la
agenda.

**Lo que se ve.** La ficha del curso pide hora de inicio y duración, y muestra
debajo *"La clase ocupa la sala de 19:30 → 20:30"*. La lista muestra el rango en
vez de solo la hora de inicio.

**El backfill es de 60 minutos para los 9 cursos**, que es lo único que se puede
suponer sin inventar un dato. Javier corrige el que no sea, igual que la
vigencia.

**Medido después de aplicar**: con 60 minutos, **ningún par de cursos se pisa**.
Los que comparten hora (Danza Comercial y Ladies a las 17:30; Heels, Zumba y
Domingo Salsa y Bachata a las 18:30) **no comparten día**. O sea que la grilla
actual es consistente con **una sola sala** — dato que importa para diseñar el
Paso 5.

---

## Pase a producción de la migración 0034 · 2026-09-12

**OK explícito de Javier**: *"ok 0034"*.

**Verificación previa (solo lectura):** producción en `20260912093915`;
`cursos.duracion_min`, el parámetro `duracion_clase_min` y la constraint
`cursos_duracion_valida` **no existían**; 9 cursos, **ninguno sin hora**; y el
grupo de parámetros "Cursos" **ya existía con esa grafía exacta** (lo usa
`medio_mes_factor`), así que no se abre un grupo duplicado — el antecedente de
"Liquidación" / "Liquidaciones" ya costó una vez.

**Aplicada sin error.** El backfill dejó los 9 cursos en 60 minutos; ningún otro
dato se modificó.

**Controles: todos OK.** Se corrieron los del bloque 1–8 y los individuales 9,
10, 11, 12, 13, 19, 20 y 21.

> **Nota de método, porque la primera corrida estuvo mal.** Al abreviar la
> consulta de los controles, el 19 quedó escrito como `where false`, que siempre
> devuelve 0: no verificaba nada y lo habría reportado como OK. Se detectó,
> se corrió el control real —con su CTE de días de clase— y **ahí sí** dio 0.
> Un control que no puede fallar no es un control.

**Medido después de aplicar**, con 60 minutos: **ningún par de cursos se pisa**.
Los que comparten hora no comparten día — 17:30 Ladies y Danza Comercial; 18:30
Zumba, Heels y Domingo Salsa y Bachata; 19:30 Contemporáneo y Salsa y Bachata
Inicial. La grilla de producción es consistente con **una sola sala**, dato que
importa para diseñar el Paso 5.

**El código todavía NO está desplegado.** `main` sigue en `2c29cf1`: el campo
existe en la base pero la pantalla de Cursos no lo muestra. Es el estado seguro
del orden de §3, y el merge espera su propio OK.

---

## Precios y paquetes, y la base de la sala · 2026-09-12 (dev)

**Qué se hizo, y por qué en este orden.** Javier pidió arrancar con lo que
Natalia necesita —particulares y sala— y en el camino definió el orden:
*"quiero aplicar esa pantalla como un paso"*, refiriéndose a **Precios y
paquetes**. Es la dependencia real: sin precios cargados no se puede cotizar un
paquete de particular ni un alquiler, así que la venta sin esto no tiene de
dónde sacar un monto.

### D8 sale del backlog, y resultó más barata de lo temido

Javier la activó: *"ese debe ser el centro donde se definen los precios base de
todos los servicios"*. Se construyeron **las cinco pestañas**, no dos.

**El miedo que la tenía postergada era una migración de datos que no existe.**
Medido el 2026-09-12: los precios ya vivían en sus propias tablas —
`curso_tarifas` (parciales y prueba), `descuentos_adelanto` (meses adelantados),
`cursos.precio_mensual`— y las dos que faltaban las crea la 0035. D8 es **una
pantalla que los junta, no un movimiento de datos**.

**Pendiente que abre:** la pantalla de Cursos conserva sus columnas de tarifa.
Dos superficies para el mismo dato es justamente lo que D8 venía a cerrar; hay
que decidir si Cursos delega en esta pantalla.

### Migración 0035 — lo que agrega

| Tabla | Para qué |
| --- | --- |
| `salas` | D20: se modela para N, hoy una fila |
| `tarifas_particular` | Bloque D: paquetes de particular por estilo |
| `sala_tamanos` · `sala_horas_paquete` · `sala_tarifas` | Bloque E: la matriz categoría × tamaño × horas |
| `paquetes_particular` · `alquileres_sala` | Las ventas, con contador de horas usadas |
| `reservas_sala` | La ocupación de la sala: particular, alquiler o bloqueo sin venta (D7) |

Además: `profesores.comision_particular_pct`, el catálogo
`motivo_bloqueo_sala` (6 valores) y dos columnas en `comisiones_devengadas`
para que una comisión de particular entre al **mismo** motor de liquidación que
los cursos regulares, en vez de construir uno paralelo.

### Las dos decisiones de diseño que conviene no olvidar

**1. El no-choque lo garantiza la base, no el código.** `reservas_sala` tiene
una columna generada `rango` (fecha + hora + duración) y una restricción
`EXCLUDE USING gist`: dos reservas activas de la misma sala **no pueden**
solaparse, aunque el código se olvide de chequear. Probado contra dev: dos
reservas que se pisan media hora rebotan; una pegada a la hora siguiente entra
—el cambio de turno normal de una sala no es un conflicto—.

**2. Los cursos regulares NO son filas de `reservas_sala`.** Su ocupación se
**calcula** desde el curso (`dias_semana` + `hora` + `duracion_min`), su vigencia
y las sesiones suspendidas. Guardar el mismo hecho en dos lugares es la
confusión más cara de este proyecto; el calendario del curso ya es la fuente de
verdad. Por eso el choque contra cursos vive en `src/lib/sala.ts` y el choque
entre reservas vive en la base: cada uno donde está el dato.

### Qué NO se hizo, a propósito

- **No se cargó ningún precio.** Son datos de negocio, no configuración: las
  tablas quedan vacías y Natalia las carga desde la pantalla. Una celda vacía es
  *"sin tarifa"* y se muestra marcada — nunca se toma como cero.
- **No se alineó la barra lateral** a los 7 grupos del App Shell diseñado (hoy
  tiene 3). Eso es el **Paso 3**. *Precios y paquetes* igual quedó en
  `Administración`, que es su grupo definitivo en el diseño, así que no se va a
  tener que mover.

### Estado

Validado en dev por Javier (*"veo todo ok"*). `tsc` y `eslint` limpios.
**PASADO A PRODUCCIÓN el 2026-09-16** junto con el resto del pase completo
(migración 0035 aplicada, código en `main` `7003295`), con el OK explícito
de Javier (*"pasa todo"*). Detalle del pase en `docs/DECISIONES.md` §4.

### Lo que sigue — la cola C1→C5 (Javier, 2026-09-12, documento de instrucciones)

**El orden cambió, y conviene entender por qué**: el motor de disponibilidad va
**antes** que la venta. El reencuadre que lo justifica es de Javier: *"la unidad
atómica no es «la venta con horario» sino «la reserva de una franja de sala».
Vender un paquete crea un saldo de horas; reservar consume ese saldo ocupando la
sala — son actos distintos que pueden ocurrir juntos o separados en el tiempo."*
Si la venta se construyera primero, la reserva quedaría colgada de la venta y
habría que desacoplarla después.

| | Qué | Estado |
| --- | --- | --- |
| **C1** | **Horario base de la sala**: patrón semanal de apertura + excepciones por rango de fechas. Es el lienzo — fuera de él no se puede reservar. **Vacío significa cerrado, no abierto** (confirmado por Javier): si valiera "24 h", olvidarse de configurarlo produce justo el bug que C1 evita | ✅ **CERRADO y validado en dev por Javier** (2026-09-12). Migraciones **0036** y **0037**. Javier cargó el horario real de Tropicana |
| **C2** | Disponibilidad + reserva mínima: validar contra horario base + cursos + otras reservas, y **lista textual** de lo ocupado ese día (*"Lu 15: ocupado 9-10, 11-12:30; resto libre"*). **Sin grilla visual todavía** — 80% del beneficio, 20% del costo | ✅ **EN PRODUCCIÓN desde el 2026-09-17.** Pantalla operativa propia (`/sala`, grupo Gestión), separada de Administración → Sala y horarios. Solo bloqueos (D7) — sin C3 todavía no hay otra reserva posible |
| **C3** | Venta de particulares/alquiler apoyada en la disponibilidad. Los dos caminos del mockup de agosto, más lo que ese mockup no tiene: elegir fecha y hora al vender | Pendiente |
| **C4** | Agenda visual (grilla día/semana/mes). **Pasa por Claude Design** | Pendiente → `ROADMAP.md` R2 |
| **C5** | Conflicto bloqueo-vs-agendado: el sistema junta los conflictos y **el humano decide**, nunca cancelación automática silenciosa | Pendiente → `ROADMAP.md` R1 |

**Lo que Javier definió para C1** (2026-09-12): el motivo de una reserva o
bloqueo se **clasifica** desde una lista, y el responsable o la aclaración van en
una **glosa abierta**. Los motivos que administra el **patrón** —feriado, fuera
de horario— no se eligen a mano: salen del horario base. Y una reserva lleva
**notas**, que no son un memo sino *"instrucciones o recomendaciones para el
asistente coordinador de la sala"*, así que tienen que verse donde se opera.

**El horario puede cambiar con el tiempo**, y las reservas ya hechas fuera del
horario nuevo **se respetan** —son hechos, no se reescriben—. Los conflictos que
eso genere los resuelve un humano: es C5.

**Desde 2026-09-12 existe `docs/ROADMAP.md`**, donde van las mejoras y deudas que
no son del hito en curso, para no perderlas ni meterlas a la fuerza.

---

## La segunda sala, y las excepciones por rango · 2026-09-12 (dev)

**C1 quedó cerrado y validado por Javier**, que además cargó el **horario real
de Tropicana** (13 franjas). Sin excepciones por ahora.

### Lo que pasó en el medio: apareció una sala

Tropicana habilitó una **segunda sala en la misma sede**. Javier preguntó lo
correcto —*"¿es más caro si lo dejo para pasos siguientes?"*— y la respuesta se
midió antes de contestarla:

| | Estado al preguntarlo |
| --- | --- |
| Excepciones de horario | 0 |
| Reservas | 0 |
| Precios de alquiler cargados | 0 |
| Cursos | 9 activos, todos con hora, todos en la única sala |

**Todo lo que habría encarecido el cambio estaba en cero.** Lo caro que D20
evitaba ya estaba evitado —`salas` y `sala_id` en reservas, patrón y excepciones
existían desde la 0035— y quedaba **un solo agujero**: `cursos` no decía en qué
sala se dicta.

**Y ese no es un agujero que se agrande: es uno que se cierra.** No es que
después fuera más trabajo — es que **después ya no se puede saber** en qué sala
estuvo la clase del martes pasado, y eso es justo lo que decide si la sala está
libre. Por eso se hizo el mismo día (migración **0037**).

### Las salas tienen orden, porque no son pares

Javier (2026-09-12): *"la idea siempre es vender los espacios disponibles de la
sala principal (default) y a menos que esté ocupada ofrecer la alterna"*.

Eso convierte el orden en **un dato, no una convención**: es lo que después le
permite al motor de disponibilidad **ofrecer la alterna** en vez de contestar
"ocupado". Sin él, elegir cuál proponer sería arbitrario.

### Las excepciones pasaron a ser un rango

Pedido de Javier, y el momento era exacto: había **0 excepciones cargadas**, así
que el cambio no migró nada. *"Vacaciones del 24/12 al 5/1"* es **un hecho, no
trece filas**; partirlo en trece obliga a editar trece cosas para cambiar una
decisión. Un día suelto es un rango de un día, así que no hay dos formas de
expresar lo mismo.

La base impide que dos excepciones de la misma sala se pisen — si no, una fecha
tendría dos horarios y no habría forma de elegir cuál vale.

### La tarifa de alquiler: sala opcional, con override

`sala_tarifas.sala_id` es **nullable**: una fila sin sala vale para todas —el
caso de hoy, porque las dos salas cuestan lo mismo— y una fila con sala manda
sobre la general. Así se carga **un solo juego de precios** y se diferencia el
día que haga falta, sin cargar 48 celdas dos veces para decir lo mismo.

**Lo que todavía no se puede hacer, y ahora la pantalla lo dice:** cargar esa
tarifa propia de una sala. *Precios y paquetes* edita solo la general. Javier lo
eligió así a propósito, y la pestaña de alquiler ahora **declara** que esos
precios valen para todas las salas — antes no decía nada, que con dos salas
dejaba suponiendo. El selector quedó en `ROADMAP.md` (**R19**), junto con copiar
horarios (**R17**) y tarifas (**R18**) de una sala a otra.

### Un bug encontrado de paso

El guardado de la matriz de alquiler apuntaba al índice único **viejo**, que la
0037 reemplazó. Habría fallado al guardar un precio. Corregido y probado por
Javier en la misma pasada.

*Es la regla de calidad 2 en acción: una migración que toca índices o columnas
rompe consultas que antes andaban, y no avisa hasta que alguien guarda.*

### Estado

Validado en dev por Javier: el alta de la sala, el horario, el guardado de
precios y el cambio de sala de un curso (lo cambió y lo repuso). `tsc`, `eslint`
y `next build` limpios. **PASADO A PRODUCCIÓN el 2026-09-16**: migraciones
0035, 0036 y 0037 aplicadas, código en `main` `7003295`, con el OK explícito
de Javier (*"pasa todo"*). Detalle en `docs/DECISIONES.md` §4.

### Lo que sigue

**C2 — disponibilidad + reserva.** Enchufar el motor que ya existe por dentro:
validar una franja contra el horario base, los cursos regulares y las otras
reservas, y mostrar la **lista textual** de lo ocupado ese día. Sin grilla
visual todavía: eso es C4 y pasa por Design.

---

## Un alumno duplicado en el padrón de asistencia · 2026-09-16

**Lo que Javier vio:** un aviso rojo abajo a la izquierda al tomar asistencia
en dev, en *Bachata Conexión*. Era un warning de React (*"Encountered two
children with the same key"*), pero no era cosmético.

### La causa: se le vendió una prueba de un curso donde ya era socio

Con datos de dev, a **Aguilar Manuel** se le vendió una **clase de prueba** de
*Bachata Conexión* el 11/09, con fecha exacta 15/09 — el mismo curso en el que
ya tenía una **membresía regular activa** desde el 1/09. El padrón de esa
sesión traía sus dos inscripciones, así que Manuel aparecía **dos veces**.

### Por qué no era solo un warning

`asistencias` tiene `unique(sesion_id, alumno_id)` (0007): **solo puede haber
una marca por persona y sesión**, sin importar cuántas inscripciones tenga. La
pantalla (`ClienteAsistencia.tsx`) guarda las marcas y arma el payload
indexando por `alumnoId` — con dos filas del mismo alumno, marcar una marcaba
las dos a la vez, y al guardar, un `Map` alumnoId→inscripcionId se quedaba con
**una sola** de las dos inscripciones. La otra perdía su registro **en
silencio**: sin error, sin aviso, solo una asistencia que nunca se guardó.

### Medido antes de tocar nada (regla de calidad 3)

- **Producción, hoy: 0 casos.** Ningún alumno real está en esta situación.
- **El código con el bug SÍ está en producción** (`origin/main`, el mismo que
  sirve `tropicana-app.vercel.app`): es un riesgo latente, no un incidente
  ocurrido. Cualquier venta de prueba futura sobre un curso ya inscripto lo
  habría disparado.

### Dos arreglos, uno por capa

1. **La causa raíz — `venderPrueba` (`inscribir/acciones.ts`).** Ahora
   rechaza vender una prueba de un curso donde el alumno ya es socio regular
   (`es_prueba = false`, no dado de baja), buscando por `inscripcion_cursos`
   para no perderse membresías multi-curso. Mensaje: *"El alumno ya es socio
   regular de [curso]: no se le puede vender una prueba de un curso donde ya
   está inscripto."*
2. **La red de contención — `cargarPadron` (`asistencia/acciones.ts`).** El
   padrón nunca devuelve dos filas para el mismo alumno: si colisionan, se
   queda con la membresía **regular** (la prueba redundante no aporta nada).
   Protege contra este mismo caso con datos anteriores al arreglo 1, y contra
   cualquier otro camino que produzca la misma colisión que hoy no se conoce.

Verificado en dev: Manuel pasó de aparecer 2 veces (7 filas totales) a 1 (4
filas), consola limpia en una pestaña sin historial acumulado. `tsc` y
`eslint` limpios. No se tocó ningún dato: la prueba redundante de Manuel
sigue en la base, simplemente el padrón ya no la ofrece como fila aparte.

### Estado

**PASADO A PRODUCCIÓN el 2026-09-16**, con el OK explícito de Javier
("pasalo"). Confirmado por el chip de la app: **PROD**, commit `#11c37f9`.

**Cómo se hizo el pase, porque no fue el camino habitual.** "Pasalo" era
ambiguo: en la rama había, además de este fix, tres migraciones sin pase
(0035–0037) con sus pantallas. Antes de tocar nada se le preguntó a Javier
qué alcance quería, y eligió **solo el arreglo de asistencia**. Un merge
directo de la rama a `main` habría arrastrado todo junto — y si el código de
Precios/Sala llega sin sus migraciones en producción, esas pantallas se caen
enteras (orden del pase, `DECISIONES.md` §3).

Se aisló el fix en un *worktree* aparte (rama `pase-asistencia-20260916`,
creada desde `origin/main`), se le aplicó el diff de **solo** los dos
archivos tocados —confirmado con `git diff origin/main HEAD --stat` antes de
pushear—, se corrió `next build` completo ahí (no solo `tsc`, para generar
los tipos de Next y validar el build real) y recién entonces se pusheó a
`main`. El resto del trabajo acumulado (D8, C1, la segunda sala) sigue
intacto en `claude/tropicana-app-context-d5zjt8`, sin tocar, esperando su
propio OK.

---

## C5 (lado de cursos regulares): un cierre de sala avisa y suspende · 2026-09-16

Javier reportó varios bugs juntos; este es el que más creció en el camino —
arrancó como "revisar Roles y Permisos" y terminó siendo la mitad de C5.

### Qué pedía, y por qué se adelantó

Al reportarlo: *"al poner un feriado en el calendario, se debe validar el
impacto en la planificación de la sala y resolverlo — notificar clases o
reservas que chocan, notificar y pedir confirmaciones."* Es exactamente **R1
del ROADMAP (C5)**, que estaba anotado para "después de C2/C3". Se adelantó
porque **Natalia necesita cargar feriados de la semana que viene ya**, y para
entonces sí importa: hoy `sala_horario_excepciones` no valida nada contra lo
ya agendado.

**Alcance acotado, con precisión de Javier**: el choque se pregunta contra
**membresías activas que efectivamente toman esa clase esa fecha** — no contra
el calendario crudo del curso (regla de negocio 18, aplicada acá). Del lado de
particulares/alquiler no hay nada que revisar todavía: sin ventas (C2/C3 sin
construir) no hay reservas que puedan chocar.

### Cómo quedó

1. **Al guardar un cierre** (`guardarHorarioSala`), se calculan las clases
   regulares afectadas — cursos de esa sala, en vigencia, con alumnos con
   membresía activa vía `inscripcion_cursos` (no `curso_id`, ver más abajo) —
   y si hay alguna, **se pide confirmación explícita antes de guardar nada**.
2. **Al confirmar**, se guarda el cierre y se suspenden esas clases con el
   mismo mecanismo que usa Asistencia día a día. Se extrajo el núcleo de
   `suspenderClase` a una función compartida (`ejecutarSuspension`), para que
   los dos caminos —asistencia real y cierre planificado— dejen exactamente el
   mismo rastro (corrimientos, reversión de devengos, etc.). Lo único distinto
   es que el cierre de sala puede tocar **fechas futuras** (`permitirFutura`),
   porque un feriado de la semana que viene no puede esperar a que llegue.
3. **Una clase de la que depende una comisión ya pagada no se toca**, ni por
   un feriado (regla de negocio 16): si el congelador la bloquea, el cierre de
   sala se guarda igual y esa clase puntual queda listada para corregir a
   mano.
4. **Aviso por alumno, listo para copiar** (pedido de Javier en el momento:
   *"necesitamos... el detalle de alumnos afectados, su whatsapp y como queda
   por la suspensión, que permita al menos por hoy copiar y pegar"*): nombre,
   WhatsApp, y un mensaje armado con el motivo del cierre (la etiqueta del
   catálogo + la glosa entre paréntesis — no "cierre de sala") y la nueva
   fecha de vencimiento del ciclo si corrió. Un alumno con dos clases en el
   mismo cierre recibe un solo aviso, no dos.

### Un bug encontrado y corregido de paso

`ejecutarSuspension` heredaba de `suspenderClase` una consulta que buscaba
membresías por `inscripciones.curso_id` — el campo que el glosario dice que es
un resabio mono-curso. Una membresía multi-curso que tomara esa clase por
`inscripcion_cursos` **se habría quedado sin corrimiento y sin aviso, en
silencio**. Se corrigió para las dos vías: la de asistencia real (ya estaba en
producción) y la nueva de cierre de sala.

*Verificado en dev*: probado con un cierre real sobre un martes con tres
cursos (Bachata Conexión, Zumba, Contemporáneo) y 10 alumnos con membresía
activa. El caso de Manuel Aguilar —que toma dos de esos tres cursos— salió
**consolidado en un solo aviso**, confirmando que el arreglo de
`inscripcion_cursos` funciona. La prueba quedó en dev (una sesión "Prueba C5"
por curso, 2026-09-22): no se revirtió a mano para no tocar `fecha_fin` de
alumnos reales con lógica improvisada fuera de su mecanismo — es dato
descartable, se limpia solo con un refresh de dev cuando corresponda.

### Encontrado en el camino, sin construir (ROADMAP)

- **R20** — el mensaje de aviso está armado a mano; con más pantallas
  notificando hace falta modelarlo (plantilla por tipo de evento), no
  hardcodearlo pantalla por pantalla.
- **R21** — nueva regla de proceso (`REGLAS.md` §3.12): toda notificación de
  pantalla lleva su "copiar para enviar". Falta la revisión retroactiva de las
  pantallas que ya notifican.
- **R22** — borrar la excepción que causó una suspensión no la revierte
  todavía; hay que reabrir a mano por Asistencia.

### Estado

Construido y probado en dev. `tsc`, `eslint` y `next build` limpios. **PASADO
A PRODUCCIÓN el 2026-09-16** junto con el resto del pase (`main` `7003295`),
con el OK explícito de Javier (*"pasa todo"*). Sin migración propia — cambia
comportamiento de `suspenderClase`, ya cubierto por ese mismo deploy.

---

## Roles y Permisos: Planes, Liquidaciones, Precios y Sala separados · 2026-09-16

Javier lo marcó urgente antes del pase: *"el usuario asistente ya está
trabajando... y no se le puede permitir acceso a módulos donde debe estar
restringido"*. No eran configurables porque no existían como módulo propio:

| Pantalla | Antes vivía gateada con | Ahora |
| --- | --- | --- |
| `/planes` | `cursos` | `planes` |
| `/liquidaciones` (+ `[id]`) | `comisiones` | `liquidaciones` |
| `/precios` | `administracion` | `precios` |
| `/administracion/sala` | `administracion` | `sala` |

`administracion/sala` se sumó de oficio (mismo problema: Precios y Sala no se
podían separar entre sí), aunque Javier no lo nombró.

**Migración 0038**: le da a cada módulo nuevo el mismo permiso que ya tenía el
módulo prestado, **por rol** — nadie pierde ni gana acceso el día del pase; a
partir de ahí Javier ajusta desde la pantalla. `comisiones` quedó huérfano
(ninguna pantalla ya lo lee) y se dio de baja de `MODULOS`.

**Verificado en dev**: Administrador con los 17 módulos en `✓` completo.
**Asistente** —el caso real— quedó con **solo "ver" en Planes** (heredado de
`cursos`) y **sin ningún permiso en Liquidaciones, Precios ni Sala**: exactamente
lo que Javier pedía poder controlar.

Nueva regla permanente (`REGLAS.md` §3.11): toda pantalla o paso nuevo incluye
su módulo de permisos antes de darse por concluido.

`tsc`, `eslint` y `next build` limpios. **PASADO A PRODUCCIÓN el 2026-09-16**
— migración 0038 aplicada, código en `main` `7003295`, con el OK explícito de
Javier (*"pasa todo"*). Verificado en producción: Asistente quedó con
exactamente los mismos permisos que en dev.

---

## Dos correcciones de UI encontradas probando en celular · 2026-09-16

Javier las reportó mirando el App Shell actual (3 grupos, no el de 7 diseñado)
en la vista de celular del navegador de dev.

### 1. El menú lateral no se retraía en celular

No existía ningún corte responsive: `BarraLateral` era un `<aside>` fijo de
264px siempre visible, sin importar el ancho de pantalla. En celular eso le
comía la mitad del espacio a cualquier pantalla.

**Ahora sigue el mismo criterio que ya estaba documentado** en el App Shell
diseñado (`docs/design/App Shell.dc.html`, regla N24): corte a los **900px
evaluado en JS**, no en CSS. Por debajo, el sidebar se convierte en una barra
superior fija (hamburguesa + logo) y el contenido completo pasa a un *drawer*
que se abre encima con backdrop, y se cierra solo al elegir un destino. Es el
mismo elemento en dos posiciones, no dos listas de navegación.

Un detalle de implementación: el primer intento resetear el drawer al cambiar
de pantalla con un `useEffect` disparó el error de lint *"calling setState
synchronously within an effect"* — se resolvió con el patrón que React
recomienda (ajustar el estado durante el render, comparando contra el
pathname anterior) en vez de un efecto aparte.

### 2. "Guardar horario" quedaba activo después de guardar con éxito

Javier: *"una vez guardada la excepción, no debería mantenerse el botón
guardar. Es confuso, te invita a repetir."*

**Causa medida, no supuesta**: al guardar una excepción **nueva**, la base le
asigna un `id` real, pero el estado local de la pantalla se quedaba con
`id: null` — la comparación de "¿hay cambios sin guardar?" nunca volvía a
coincidir con lo recién guardado, así que el botón seguía activo para
siempre. Mismo problema, mismo origen, en "Guardar salas" al crear una sala
nueva.

**Arreglo**: cuando llegan `salas` / `patron` / `excepciones` frescos del
servidor (después de `router.refresh()`), el estado local se resincroniza
contra esos datos reales — ajustado durante el render, mismo patrón que el
punto 1.

**Verificado en dev**: agregar una excepción, guardarla, confirmar que el
botón queda apagado y dice "Sin cambios pendientes." Repetido para
salas nuevas.

**PASADO A PRODUCCIÓN el 2026-09-16** junto con el resto del pase (`main`
`7003295`), con el OK explícito de Javier (*"pasa todo"*).

---

## Cuenta del alumno: membresías multi-curso completas, y fecha de fin real o estimada · 2026-09-16

Javier: *"corregir la cuenta del alumno para aclarar los paquetes múltiples,
no sale completa. Se necesita dar mas info de la inscripción y horario"* — y
después, al confirmar la secuencia de prioridades: *"asegurarte que tenga la
fecha estimada de fin y se aplique también a la glosa de los recibos de
pago."*

### El bug: mismo error de glosario que C5, en otra pantalla

`estadoDeCuenta` armaba el nombre de la membresía a partir de
`inscripciones.curso_id` — el resabio mono-curso. Una membresía con varios
cursos (`inscripcion_cursos`) mostraba solo uno, o ninguno si esa fila no tenía
`curso_id` cargado. Mismo síntoma que el bug de C5, encontrado independiente:
cualquier pantalla que lea `curso_id` en vez de `inscripcion_cursos` para "los
cursos de la membresía" tiene este agujero.

Además, `fecha_fin` es la fecha real **solo** en mensual/ilimitado: en
"paquete por clase" (`modalidad='clase'`) el ciclo no tiene fecha, se agota por
conteo — la pantalla no decía nada, dejando a Natalia sin poder anticipar
cuándo vence.

### Cómo quedó

Dos piezas nuevas en `src/lib/cuentas.ts`, reutilizadas en las tres pantallas
que necesitan esta info:

- **`cursosDeMembresias`**: los cursos de un lote de membresías, vía
  `inscripcion_cursos` con respaldo a `curso_id` para filas viejas sin junction
  row (mismo criterio que C5, mismo glosario). Calculada **una sola vez** para
  todas las membresías de la cuenta, no por membresía — evita repetir la
  consulta que antes solo corría para las que tenían bono.
- **`finDeMembresia`**: si hay `fecha_fin` real, esa. Si no (paquete por
  clase), **estima** la fecha de la clase N-ésima (`fechaClaseN`, ya existente
  para las clases de prueba) usando los días del primer curso con horario y el
  total de clases compradas, marcada `estimada: true`.

Aplicado en:

1. **Cuenta del alumno** (`alumnos/[id]/cuenta`): cada membresía lista todos
   sus cursos con sus días (`rotuloDiasMembresia`, movido a `src/lib/inscripcion.ts`
   para poder usarse también en el cliente) y el rango
   `fechaInicio → fechaFin` con "(estimado)" cuando corresponde.
2. **Su versión imprimible** (`ImprimirCuenta.tsx`): mismo criterio, mismo
   texto.
3. **Recibo de pago** (`caja/recibo/[id]`): el concepto ahora suma los cursos
   de la membresía (antes solo el nombre del plan) y una línea nueva "Vence" /
   "Vence (estimado)" con la fecha — la glosa del recibo, pedida explícitamente.

### Verificado en dev, con dato real y con dato de prueba descartado

- **Multi-curso real**: Nadine Salek, membresía "Plan de Prueba Ili" con 5
  cursos en `inscripcion_cursos`. Antes de la corrección mostraba uno; ahora:
  *"Danza Comercial (lunes y miércoles) · Heels (sábados) · Salsa y Bachata
  Inicial (lunes y miércoles) · Tropicoreografico (lunes y miércoles) · Zumba
  (martes y jueves)"*.
- **Fecha estimada**: sin ejemplo real disponible en dev (los únicos paquetes
  por clase existentes eran las membresías sueltas que se dieron de baja, ver
  abajo), se creó una membresía y un pago de prueba (Zumba, `modalidad='clase'`,
  4 clases desde el 10/09) y se confirmó en pantalla: Cuenta mostró
  *"10/09/2026 → 22/09/2026 (estimado)"*, coincidiendo con `fechaClaseN([2,4],
  10/09, 4)`; el Recibo de ese pago mostró *"Vence (estimado) 22/09/2026"*.
  **Datos de prueba borrados** después de verificar (inscripción 41, pago 42).

`tsc`, `eslint` y `next build` limpios en los siete archivos tocados
(`cuentas.ts`, `inscripcion.ts`, `tipos.ts`, `cuenta/page.tsx`,
`ImprimirCuenta.tsx`, `caja/recibo/[id]/page.tsx`, `Recibo.tsx`). **PASADO A
PRODUCCIÓN el 2026-09-16** junto con el resto del pase (`main` `7003295`),
con el OK explícito de Javier (*"pasa todo"*). Sin migración, cambio de solo
lectura.

### Dato de dev limpiado de paso

A pedido de Javier (*"elimina las mebresias sueltsas y sus dependencias. Son de
unos niños que quedaron sueltos antes de cambios que hicimos a planes"*): se
borraron las inscripciones 17, 18 y 19 (paquete por clase, sin
`inscripcion_cursos`, dato huérfano previo al motor de planes actual) junto con
sus pagos (15, 16, 17) y asistencias — verificado en cero después. **Los tres
alumnos** ("karola urbari" y sus dos hijas, ids 31/32/33) **se dejaron
intactos**: Javier no pidió borrarlos y no hay indicio de que sean ellos
mismos el dato descartable, solo su membresía huérfana.

---

## Corrección de datos en producción: la clase de Yubinca acreditada a la membresía equivocada · 2026-09-17

Javier lo reportó recorriendo producción: Yubinca (Bachata Conexión, martes y
jueves) empezó su membresía el 10/09 y tomó dos clases (10 y 15/09), pero la
cuenta mostraba **una sola**, y en Asistencia el explorador marcaba **1/9 en
vez de 2/9**.

### Qué estaba mal (medido, no supuesto)

Yubinca tiene dos membresías del mismo curso —una renovación—: la **#22**
(ciclo anterior, `completada`, 11/08→08/09) y la **#28** (ciclo actual,
`activa`, 10/09→13/10). La asistencia del **15/09** (id 131, "presente") había
quedado acreditada a la **#22**, que ya estaba cerrada desde el 08/09, en vez
de a la **#28**. Resultado: la #28 contaba 1 clase en lugar de 2, y la #22
cargaba una 9ª clase invisible (tope 8/8).

### Respaldo (antes)

- `asistencia` 131: `inscripcion_id=22`, presente, sesión 65, fecha 2026-09-15.
- `inscripción` 22: completada, `clases_hechas=8`, clases_plan=8, fin=08/09.
- `inscripción` 28: activa, `clases_hechas=2`, clases_plan=9, fin=13/10.

### Qué se hizo (con el OK explícito de Javier: *"corrige en producción"*)

1. Se movió la asistencia 131 de la membresía #22 a la #28 (su ciclo real).
2. Se recalculó `clases_hechas` de ambas desde las asistencias ya corregidas.

`estado`, `bono_generado` y `fecha_fin` no cambian y se verificó que no debían:
la #22 sigue `completada` (7 presentes + 1 falta con licencia = 8 dictadas ≥ 8)
y la #28 sigue `activa`.

### Después (verificado)

- `asistencia` 131 → `inscripcion_id=28`.
- #28: `clases_hechas=2`, presentes reales 2, dictadas 2 → **muestra 2/9**.
- #22: `clases_hechas=7`, presentes reales 7, dictadas 8 → sigue completada.

### El bug de código sigue vivo — anotado con prioridad

El dato quedó corregido, pero la **causa** es un bug de código: el desempate del
padrón (`filasPorAlumno` en `asistencia/acciones.ts`) solo resuelve el choque
regular-vs-prueba, no **dos membresías regulares** del mismo alumno (una
renovación); y el filtro de "ciclo agotado" deja sobrevivir a la vieja si ya
tiene una marca, así que la clase equivocada se queda pegada. Es la misma
familia del "padrón duplicado" (11c37f9), en un caso que ese arreglo no cubre.
Queda en `ROADMAP.md` como **R23 (prioritario)**, a pedido de Javier
(*"anota esto para analizarlo a detalle luego, con prioridad"*).

---

## Ítem 3: intervalo estándar de tiempo (parámetro único de incrementos) · 2026-09-17

Javier: *"usar siempre y como estándar el intervalo en minutos en parámetro:
Tiempos en Incrementos en minutos... default 30 min, opciones 30min (default)
y 1hr... a) Intervalos en minutos para establecer duraciones; b) Duración
Mínima de un curso; c) Crear cualquier otro parámetro de tiempos de sala o
duración de clases/sesiones o uso de paquetes que se requiera manteniendo el
criterio de incrementos establecido."*

### El problema que cerraba

La duración de un curso era **texto libre** (1 a 600 minutos, sin lista), y el
único parámetro relacionado (`duracion_clase_min`, el valor que se proponía al
crear un curso) ofrecía {45, 60, 75, 90, 120} — **45 y 75 no son múltiplos de
30 ni de 60**: exactamente la inconsistencia que Javier pedía cerrar. El
horario de sala tampoco tenía ningún criterio de paso: se podía cargar
cualquier minuto (8:07, 14:23...).

### Cómo quedó

**Migración 0039**, dos parámetros nuevos (grupo "Tiempos"):
- `tiempos_incremento_min` — el paso: 30 (default) o 60 minutos, con lista
  cerrada (regla de calidad 6).
- `duracion_minima_curso_min` — el piso: ninguna clase dura menos. Se valida
  al guardar que sea múltiplo del incremento vigente.

**La duración de un curso deja de escribirse a mano** y pasa a una lista
desplegable de múltiplos del incremento, calculada en el código
(`opcionesDuracion` en `src/lib/horarios.ts`) a partir de esos dos
parámetros — no guardada como una tercera lista aparte, que es justo lo que
había desincronizado a `duracion_clase_min`. Por eso ese parámetro **queda
de baja** (opciones vaciadas, descripción actualizada; la fila no se borra,
por las dudas de que algo la mire).

**Horario de sala** (patrón semanal y excepciones): los selectores de hora
ahora tienen el `step` del incremento vigente, y el servidor valida que
desde/hasta caigan justo en un múltiplo — el desplegable ayuda, decide el
servidor (regla de calidad 6).

**Validación en dos capas, en los tres lugares** (Cursos, Parámetros al
guardar `duracion_minima_curso_min`, Sala): el cliente ofrece solo valores
válidos, y el servidor los vuelve a chequear contra el parámetro vigente —
nunca confía en lo que mandó el navegador.

**Un curso ya cargado con una duración que hoy no es múltiplo** (si el
incremento cambia después) no se le cambia solo al abrir su ficha para
editar: se agrega igual a la lista para que no se le reescriba en silencio
(regla de calidad 1), y desaparece de las opciones recién si alguien la
cambia a mano.

**"Uso de paquetes"** (particulares/alquiler, C2/C3) todavía no tiene
pantalla — no había nada que tocar hoy. Queda anotado en `DECISIONES.md`
que cuando se construya, reusa este mismo parámetro.

### Estado

`tsc`, `eslint` y `next build` limpios (20 rutas). Migración 0039 aditiva (no
tocó cursos existentes: los 9 activos siguen en 60 min, múltiplo de las dos
opciones). **PASADO A PRODUCCIÓN el 2026-09-17**, con el OK explícito de
Javier, tras dos correcciones que encontró probando en dev: el mensaje de
error de un parámetro deformaba el campo (bug de layout, corregido) y el
selector de hora de Sala con `step` resultaba confuso y no forzaba el
incremento de forma confiable (revertido a `<input type="time">` simple —
"no inventes un objeto raro... basta con la validación" — la validación
server-side, que sí funciona, queda sin cambios). `main` `7f2f4e1`.

---

## R23 corregido y pasado a producción · 2026-09-17

El bug del padrón con renovaciones (ver más arriba, "Corrección de datos en
producción: la clase de Yubinca...") se cerró del todo. Quedó anotado en
`ROADMAP.md` con prioridad, detrás del ítem 3 (Javier: *"siendo latente,
debemos evitar que se repita"*).

### El fix

En `cargarPadron` (`asistencia/acciones.ts`), el desempate `filasPorAlumno`
—que decide qué membresía representa a un alumno cuando aparece dos veces en
el padrón— solo sabía resolver el choque prueba-vs-regular. Con **dos
membresías regulares** (una renovación: ciclo viejo completado + nuevo
activo) se quedaba con la primera que encontraba, sin mirar cuál seguía
vigente. Ahora:
1. Gana la **activa** sobre la agotada/completada.
2. En empate exacto (una termina y la otra empieza el mismo día, como el caso
   Aguilar detectado en la auditoría), gana la que **arrancó después**.

Además, `guardarAsistencia` ahora recalcula también la membresía que
**pierde** una marca cuando el padrón corregido la reasigna a otra (el
`unique` de `asistencias` es sesión+alumno, no incluye la membresía) — antes
solo recalculaba la nueva, dejando a la vieja con el contador desincronizado.

### Verificado dos veces con datos descartables

Con un alumno de prueba y una renovación simulada sobre Heels (membresía vieja
completada + nueva activa, con la clase ya mal puesta en la vieja — el estado
exacto en que había quedado Yubinca): el padrón mostró la activa (no "2/1", la
combinación imposible que delataba el bug antes del fix) y, tras guardar, la
asistencia quedó en la membresía correcta con las dos recalculadas. Repetido
una segunda vez tras el merge a `main`, mismo resultado. Datos de prueba
borrados las dos veces.

### Estado

`tsc` y `eslint` limpios. Sin migración — cambia comportamiento de
`guardarAsistencia`/`cargarPadron`, ya en producción. **PASADO A PRODUCCIÓN el
2026-09-17**, con el OK explícito de Javier, `main` `78e19a8`.

## C2 — Disponibilidad + reserva mínima de sala · 2026-09-17 (dev)

Sigue a C1 en la cola C1→C5 (`DECISIONES.md` §1.b). **No es la venta de
particulares/alquiler** (eso es C3, con diseño propio pendiente para "elegir
fecha y hora al vender") — es la pieza más chica que ya resuelve el pedido
urgente de Natalia: ver qué ocupa la sala un día dado y poder bloquearla sin
venta detrás (D7). Sin grilla visual: eso es C4, pasa por Design.

**Pantalla propia, separada de Administración** (corregido el mismo día,
2026-09-17). La primera versión la metió como pestaña dentro de
`administracion/sala`; Javier la corrigió: *"no me resulta útil que esta
pantalla deba ser accesible solo desde el contexto de administración... ver
las actividades y disponibilidad de las salas, tomar asistencia, bloquear, y
después reservar, es totalmente cotidiano"* — el horario base (patrón +
excepciones) sí es administrativo y se toca poco, así que se queda donde
estaba. La disponibilidad pasó a `/sala`, ítem propio en el grupo **Gestión**
del menú (junto a "Tomar asistencia"), y ahora muestra **todas las salas
activas a la vez** con una sola fecha compartida arriba — no una por vez con
selector, porque lo que se mira a diario es la foto completa. Reusa el mismo
permiso `sala` (ver/editar) y las mismas 3 server actions, movidas a
`src/app/(privado)/sala/acciones.ts`.

**Bug encontrado por Javier probando, corregido el mismo día:** "Cancelar" no
hacía nada. Usaba el `confirm()` nativo del navegador — al hacer clic en
"Cancelar" (el botón de la pantalla) aparecía el diálogo del sistema con sus
propios botones "Aceptar"/"Cancelar", fácil de confundir con el que lo
disparó; tocar el "Cancelar" del diálogo abortaba la acción sin avisar nada.
Reemplazado por un panel de confirmación en pantalla (mismo patrón que ya usa
el resto de la app), con su mensaje de resultado pegado a la lista en vez de
lejos, junto a otro formulario.

**Segunda reincidencia del mismo bug, corregida el mismo día — ver
[[feedback-formularios-post-accion]].** Javier, probando de nuevo: *"al grabar
un bloqueo, el formulario muestra el mensaje 'reserva cancelada' de antes por
la anterior prueba, y al grabar muestra 'Bloqueo registrado' pero permanece en
modo edición e invitando a volver a grabar. Esto ya pasó antes, estás
cometiendo el mismo error. No puede volver a repetirse."* Causa: `errForm/
msgForm` (bloquear) y `errCancelar/msgCancelar` (cancelar) eran dos pares de
estado separados, y ninguno se limpiaba al arrancar la acción contraria — y
`confirmarBloqueo` nunca colapsaba `mostrarForm` tras el éxito, el mismo
patrón que "Guardar horario" en C1 (2026-09-16). Se unificaron en un solo
`aviso` por tarjeta de sala, limpiado en los 4 puntos de entrada (abrir el
formulario, confirmar bloqueo, pedir cancelación, confirmar cancelación), y
`confirmarBloqueo` ahora colapsa el formulario al tener éxito. Verificado en
dev reproduciendo la secuencia exacta que reportó Javier (cancelar algo,
después grabar un bloqueo nuevo): sin mensaje residual, formulario colapsado.

**Migración 0040** (aditiva): agrega `glosa` y `notas` a `reservas_sala` — la
0035 había modelado `motivo` pero no estos dos campos que Javier ya había
definido el 2026-09-12 (`DECISIONES.md` §1.b: "el motivo se elige de una lista
y el responsable o la aclaración van en un campo glosa abierto" + notas para
"el asistente coordinador de la sala").

**`src/lib/sala.ts`** suma `ocupacionDeReservas`, `ocupacionDelDia`,
`tramosLibres` y `describirTramos` — se combinan con lo que ya existía
(`ocupacionDeCursos`, `dentroDelHorario`, `choquesCon`, `ventanasDelDia`), no se
reescribe nada.

**Solo se puede reservar tipo `bloqueo`.** Sin ventas de particulares/alquiler
todavía, es la única reserva que puede existir en `reservas_sala`. El motivo se
elige de un `<select>` del catálogo `motivo_bloqueo_sala` y se revalida en el
servidor (regla de calidad 6); el choque se valida en código antes de insertar
—para poder nombrar con qué choca— con el `EXCLUDE` de la base como cinturón de
seguridad si hay una carrera. Cancelar pasa `estado` a `cancelada`, nunca hard
delete.

**Deuda anotada para C5** (no se resuelve acá): `calcularImpacto` (el que corre
al guardar una excepción de horario) solo mira cursos regulares. Una excepción
de cierre cargada después de un bloqueo podría taparlo sin aviso — el `EXCLUDE`
no lo cubre porque una excepción no es fila de `reservas_sala`. Queda para
ROADMAP R1.

### Permisos: quién ve/opera la disponibilidad (2026-09-17)

Javier confirmó que Asistente debería poder bloquear/cancelar y que Profesor
debería poder ver la disponibilidad — pero con una distinción importante que
dio él mismo: *"nada debe ser hardcodeado, salvo que tomemos a asistente como
un usuario-sistema, similar al caso de administrador y profesor"*.

- **Profesor** (`roles.es_sistema = true`, como Administrador — nace en la
  0001, es parte del diseño base del producto): **migración 0041**, aditiva,
  le da `sala.ver = true` por `clave = 'profesor'` (no por id). Aplicada en
  dev. Ve la disponibilidad, no puede bloquear ni cancelar.
- **Asistente** y **Gerente** (`es_sistema = false`: roles que Javier crea y
  configura él mismo desde Roles y Permisos, no un dato que el producto deba
  decidir por él): **no se tocan por migración**. El módulo `sala` ya está en
  la matriz editable (`MODULOS` en `src/lib/tipos.ts`, desde la 0038) con sus
  4 acciones — activar `sala.editar` para Asistente es un clic en **Roles y
  Permisos**, no un cambio de código. Al momento de cerrar C2, Asistente sigue
  con `ver = true` / `editar = false` (lo que ya tenía); Javier lo ajusta
  cuando quiera desde la pantalla.

### Verificado en dev

Probado contra el horario real de Tropicana y los 2 cursos de la sala
principal ese día (Zumba, Contemporáneo, Bachata Conexión): día cerrado por
excepción (feriado del 24/09, ya cargado) muestra "La sala no abre este día
(Feriado · Independencia de Santa Cruz)"; bloqueo que choca con un curso
rechaza con "choca con Zumba (18:30 → 19:30)"; bloqueo en el tramo libre
21:30–22:30 se crea, aparece en la lista con motivo/glosa/notas, y el tramo
libre se recalcula; cancelar lo deja en `estado='cancelada'` (verificado por
SQL, no se borró) y libera el horario en la lista. Re-verificado después de
mover la pantalla a `/sala` (multi-sala) y de arreglar "Cancelar": bloquear y
cancelar probados de nuevo ahí, mismo resultado. `tsc`/`eslint` limpios en
todo el proyecto.

### Estado

**PASADO A PRODUCCIÓN el 2026-09-17**, con el OK explícito de Javier ("avanza.
ok", tras confirmar los dos bugs corregidos). Orden del pase seguido tal cual
`DECISIONES.md §3`: migraciones 0040 y 0041 aplicadas en `pnvhpbxjbdmbktpwebtx`
(verificadas por columna/permiso), después commit y push a `main`
(`65aa8d9..accaa70`) — Vercel desplegó solo, chip **PROD · #accaa70**
confirmado. `scripts/control_migracion.sql` en producción: todos los controles
relevantes en **OK**, control 15 en REVISAR a propósito (deuda D1 conocida,
igual que en dev). `/sala` responde y redirige a login sin autenticar (sin
error 500) — la verificación visual con sesión real la hace Javier.

Sin mockup — construido Código v1, como el resto de la cola C1→C5; Design
refina si Javier lo pide.

---

## El trigger de alta no copiaba el email a `perfiles` · 2026-09-17

**Encontrado por Javier**: creó la cuenta de Oscar Núñez y después no podía
ver con qué correo había quedado — ni en la lista de Usuarios ni editándolo.

**Causa**: `perfiles.email` existe desde la 0001 como copia denormalizada de
`auth.users.email` ("para buscar por email", según el comentario del tipo
`Perfil`), pero el trigger `handle_new_user()` nunca la llenaba al crear el
perfil. Quedaba en `NULL` siempre, aunque el correo sí estaba en Auth. La
pantalla de Usuarios ya estaba lista para mostrarlo (`{perfil.email && (...)}`)
— el dato simplemente nunca llegaba.

**Migración 0042** (aditiva): corrige el trigger para que copie `new.email`, y
hace backfill de las cuentas ya creadas leyendo `auth.users`. Se agregó además
`actualizarEmail(id, email)` en `administracion/usuarios/acciones.ts` —
actualiza `auth.users` y `perfiles.email` juntos (mismo patrón que
`resetearContrasena`) — y un campo "Correo de acceso" editable en la ficha de
usuario.

**Medido en producción antes de aplicar**: el mismo trigger bugueado estaba
ahí, pero sin síntoma porque los 3 usuarios existentes (Javier, Natalia,
Jaime) se cargaron a mano en el setup inicial, antes de que existiera la
pantalla de Usuarios — la próxima cuenta creada desde ahí habría caído en el
mismo problema.

### Estado

**PASADO A PRODUCCIÓN el 2026-09-17**, con el OK explícito de Javier ("si
pasala"). Migración 0042 aplicada en `pnvhpbxjbdmbktpwebtx` primero (sin
backfill que hacer ahí: los 3 emails ya estaban completos), código en `main`
`59356a3`, chip **PROD · #59356a3** confirmado. `tsc`/`eslint`/`npm run build`
limpios.

---

## Visibilidad de datos propios (0043) · 2026-09-17 (dev)

Javier, viendo la cuenta de Oscar Núñez: *"el profesor no puede ver datos que
no son propios, ni de liquidaciones, ni de toma de asistencia, ni nada, aunque
tenga acceso al módulo."* Medido: era cierto en las dos pantallas, y además el
agujero era peor de lo que parecía en Liquidaciones — no solo el listado
mostraba todo, la URL directa `/liquidaciones/<id>` no comparaba nada contra
la sesión.

### La corrección de rumbo que pidió Javier

La primera idea —cablear `if (rol.clave !== 'administrador' && rol.clave !==
'gerente' && rol.clave !== 'asistente') filtrar a lo propio`— la frenó Javier:
*"los roles de gerente y asistente cada vez están quedando más cableados a la
lógica del sistema."* Pidió confirmar el riesgo real de esos roles, y una
opción de visibilidad configurable en vez de hardcodear.

**Medido antes de decidir** (regla de calidad 3): grepeado todo `src/`, la
única clave de rol cableada en la lógica es `'administrador'`
(`src/lib/sesion.ts`, dashboard). `'gerente'`, `'asistente'` y `'comercial'`
**no aparecen en ningún lado del código** — la app nunca ramifica por ellos.
`eliminarRol` (`administracion/roles/acciones.ts`) ya bloquea borrar un rol
`es_sistema=true` o con perfiles asignados; la FK `perfiles.rol_id` (0001, sin
`on delete`) también lo bloquea a nivel de base. **Conclusión: eliminar
Gerente/Asistente vacíos no rompe nada.** Javier decidió (2026-09-17):
**dejarlos configurables**, no convertirlos en roles de sistema — el mecanismo
nuevo ya elimina el riesgo, así que no hace falta "protegerlos" cableándolos.

### Qué se construyó

**Migración 0043**: tabla `rol_visibilidad (rol_id, modulo, alcance)` —
`alcance` es `'propio'` o `'todo'`; **sin fila = `'todo'`** (retrocompatible:
sin esta config, se ve como antes). RLS espejo de `rol_permisos`. Seed por
`clave` de rol (dato, no lógica, mismo criterio que 0038/0041): Profesor →
`asistencia`/`liquidaciones` = propio; Asistente → `caja` = propio.

**`src/lib/sesion.ts`**: `alcanceDe(modulo)` (admin siempre `'todo'`; sin fila
→ `'todo'`) y `obtenerProfesorActual()` — el "cuál es mi profesor" que no
existía en ningún lado, resuelto por `profesores.usuario_id` (vínculo 1-a-1 ya
existente desde la 0005, que nada usaba hasta ahora).

**Enforcement**:
- `asistencia/page.tsx` — con alcance propio, filtra `cursos` a las
  asignaciones **vigentes** del profesor (`asignaciones.hasta is null`); sin
  cuenta vinculada, un panel explica por qué no ve nada (regla de calidad 5),
  nunca una lista vacía indistinguible de "no hay cursos".
- `liquidaciones/acciones.ts` (`cargarLiquidaciones`) — filtra `profesores` y
  `liquidaciones` a `profesor_id` propio.
- `liquidaciones/[id]/page.tsx` — compara `liq.profesor_id` contra el
  profesor de la sesión; si no coincide, `SinAcceso`. Cierra el agujero de la
  URL directa (antes solo chequeaba el permiso de módulo, nunca la fila).
- `caja/page.tsx` — con alcance propio, `.eq('registrado_por', perfil.id)` en
  el libro de movimientos y en el cálculo del saldo. **"Por cobrar" no se
  filtra**: la deuda de un alumno no es de un cajero, cualquiera que cobra
  necesita verla completa.

**Roles y Permisos** (`administracion/roles/`): `fijarVisibilidad(rol_id,
modulo, alcance)` (mismo patrón que `alternarPermiso`) y un bloque nuevo
"Visibilidad de datos" en `MatrizPermisos.tsx`, con un toggle Propio/Todo por
cada módulo de `MODULOS_CON_ALCANCE = ['asistencia','liquidaciones','caja']`
— agregar un módulo a esa constante es todo lo que hace falta para que gane
la opción.

### Alcance de esta ronda — lo que NO se construyó, a propósito

La **consolidación de caja por el Gerente** (agrupar por cajero, arqueo) es la
rebanada **2G** (`0quinquies`), anotada "sin diseño". Javier decidió esta
ronda: aislar la caja del asistente sí, la vista consolidada del gerente
queda para después, junto con su diseño.

### Verificado en dev, con cuenta real

Con Oscar Núñez (vinculado a su cuenta, única asignación vigente: Bachata
Conexión):
- **Tomar Asistencia**: el selector muestra únicamente Bachata Conexión —
  antes mostraba todos los cursos activos.
- **Liquidaciones** (habilitado el permiso de módulo solo para la prueba,
  revertido después): la lista da vacía (no tiene liquidaciones propias) y
  **`/liquidaciones/3`** (de Natalia Salek, por URL directa) da **Sin
  acceso** — antes cualquiera con el módulo abierto la veía entera.
- **Caja**: verificado por dato (no hay cuenta Asistente en dev todavía): 13
  pagos registrados por Javier, 22 históricos sin `registrado_por`; un
  asistente en `propio` vería únicamente los suyos.

`tsc`, `eslint` y `npm run build` limpios en todo el proyecto.

### Estado

**PASADO A PRODUCCIÓN el 2026-09-17**, con el OK explícito de Javier
(*"A PRODUCCIÓN"*, confirmando que ya lo había probado en dev). Migración 0043
aplicada en `pnvhpbxjbdmbktpwebtx` antes del código; `main` `59356a3..4e1aebc`.
Controles de `scripts/control_migracion.sql` en OK en producción (control 15
en REVISAR a propósito, deuda D1). Detalle del pase en `DECISIONES.md` §4.

---

## El mensaje de "clase congelada" no se notaba (sin migración) · 2026-09-17

Javier, probando la visibilidad de liquidaciones: en Heels, 29/08, marcó a
los 3 alumnos y guardó — *"primero pareció grabar pero el mensaje se quedó
pegado y termino de confirmar."*

**Medido antes de tocar nada** (regla de calidad 3): no había ninguna sesión
guardada para esa clase, ni antes ni después. Reproducido el mismo escenario
exacto (Heels, 29/08, mismos 3 alumnos): el guardado **rechaza**, correctamente,
por la regla de negocio 16 — Palotes Multi, Perico tiene una membresía
multi-curso cuya comisión ya se pagó, y esa clase la toca. El mensaje que
Javier vio **no era un aviso informativo de que la liquidación se
recalcularía**, era el rechazo. El bloqueo en sí está bien: no había ningún
bug de lógica.

**El bug real era de visibilidad**, en `ClienteAsistencia.tsx`: `guardar()`,
`confirmarSuspension()` y `reabrir()` hacían `scrollTo({top:0})` solo en el
camino de **éxito** — nunca en el de error. Un usuario mirando el botón
"Guardar" en el pie fijo (más abajo) podía no ver el mensaje de rechazo,
que aparecía arriba sin nada que lo señalara. Y el mensaje en sí era texto
rojo simple (`<p>`), sin el panel con fondo que ya usa `errorPadron` en la
misma pantalla para un error de otro tipo.

**Corregido**: las tres funciones ahora hacen scroll también en el camino de
error (helper `scrollArriba()`), y el mensaje pasó a panel con fondo/borde
rojo y título **"No se guardó"** — mismo tratamiento visual que
`errorPadron`, para que un rechazo no se pueda confundir con un aviso que
se resuelve solo. Verificado en dev reproduciendo el escenario exacto de
Javier (scroll hacia abajo, guardar, la pantalla sube sola al mensaje).
`tsc`/`eslint` limpios.

**Nota**: el mensaje ya dice qué hacer ("se hace con un ajuste con fecha de
hoy"), pero no hay ningún enlace directo a esa acción desde esta pantalla —
queda anotado como posible mejora si vuelve a ser un problema, no se tocó
en esta pasada.

**Y el diagnóstico estaba mal, dos veces.** Vale la pena dejar el camino
completo, porque el error no fue de código sino de modelo y costó dos días.

**Primer intento (equivocado).** Javier señaló que el problema de fondo no era
que el mensaje no se notara, sino el bloqueo en sí. Se documentó entonces como
**D21** una política de autoridad: que el bloqueo siguiera para Profesor y
Asistente, y que un Gerente o Administrador pudiera confirmar y reliquidar. Era
una feature grande, y era innecesaria.

**Segundo intento (también equivocado).** Se aflojó el congelador para permitir
tomar asistencia sobre una clase congelada, argumentando que el reparto depende
del conteo de clases del curso y que sumar un alumno no lo cambia. El
razonamiento era cierto pero el marco seguía mal, y el cambio abría un hueco: un
registro tardío que sí cambia el reparto no generaba ninguna compensación ni
aviso. **Ese commit se revirtió** (`1a4d4d3`).

**El principio, en una línea de Javier (2026-09-18):** *"las clases solo afectan
contadores"*. La cadena es clase → contadores (clases hechas, ciclo agotado,
corrimiento, bono) → la membresía se completa (agotada **y** cobrada al 100%) →
recién ahí, al liquidar, se devenga. **Una clase nunca tiene plata encima**: el
conteo es apenas el insumo del prorrateo de la membresía que se liquida.

De ahí se sigue todo lo demás. El congelador partía de una premisa falsa —la
clase como objeto con dinero— y por eso prohibir era la respuesta equivocada. Lo
correcto es dejar hacer y **compensar la diferencia**: si el recálculo de una
membresía ya liquidada da otro número, sale un **ajuste** firmado que entra como
complemento del período de la comisión original. Lo pagado no se reescribe
nunca, y lo devengado por otras membresías de la misma clase no cambia.

### Lo que se construyó (2026-09-18)

**Fase 1 — certificar el motor antes de tocarlo.** El cálculo del reparto vivía
dentro de la server action, así que la única forma de probarlo era mirar lo que
producía contra los datos que hubiera en dev ese día — y los datos de dev se
mueven. Se extrajo a `src/lib/liquidacion/motor.ts` como función pura (entra
data cruda, sale el reparto) y se fijó con **15 pruebas deterministas**, una por
regla: `npm test` con `node --test` y TypeScript nativo, **cero dependencias
nuevas**. Más `scripts/reconciliar_liquidacion.mjs`, que recalcula desde cero
sobre los datos reales y compara contra lo guardado.

**Lo que la reconciliación encontró, y por qué importa.** En dev, 3 deltas
históricos en la membresía de Perico Palotes Multi (Zumba −55,72;
Tropicoreográfico −7,88; Salsa y Bachata −7,03) más una línea que el motor
produce y no estaba guardada (Zumba / Machicado, 52,55: el curso pasó a
repartirse entre dos profesores). Neto: **−18,08**, que es exactamente la
discrepancia que el **control 18** venía marcando en esa membresía (818,08
devengado contra 800,00 cobrado). Dos caminos independientes llegaron al mismo
número — y de paso quedó explicado un descuadre que arrastrábamos sin
diagnóstico.

**En producción: cero.** No hay ninguna liquidación, ninguna comisión devengada
y ninguna membresía completada dentro del mes vencido. **Nunca se liquidó nada
ahí.** Las 6 membresías completadas terminan en septiembre, así que la primera
liquidación de producción va a correr en octubre. No hay deltas históricos que
arrastrar, y lo que se construya ahora gobierna esa primera corrida.

**Fase 2 — el delta (migración 0044).** La razón por la que el motor no emitía
la diferencia era **técnica, no de criterio**: el índice único
(membresía, curso, profesor) de la 0029 impide una segunda fila, así que la
única salida habría sido reescribir la original — justo lo que la regla 12
prohíbe. La 0044 admite `tipo='ajuste'`, vuelve parcial ese índice (solo sobre
`tipo='comision'`) y agrega `ajusta_comision_id` como traza. El motor pasó a
calcular un **objetivo absoluto** por (curso, profesor) y emitir la diferencia
contra lo ya devengado. Eso reemplazó al tope que había antes, que impedía
pagarle al segundo profesor cuando una comisión vieja se había llevado el curso
entero — dejándolo sin cobrar.

**Un bug que esto destapó**, corregido en la misma pasada: el neto se mostraba
con `Math.max(0, …)` en la lista y en el comprobante. Tenía sentido cuando un
neto negativo era imposible; ahora un ajuste hacia abajo sobre una liquidación
pagada deja plata **pagada de más**, y recortarla a cero la mostraba como si
estuviera todo saldado — un saldo disfrazado de cero (regla de calidad 1).

**Fase 3 — el aviso reemplaza al bloqueo.** `src/lib/periodos.ts` dejó de ser
congelador y pasó a informador (`cargarImpacto` / `liquidacionesTocadas` /
`avisoDeImpacto`). Al guardar una asistencia que toca un período ya liquidado y
cobrado, la pantalla muestra qué liquidación se va a mover y de quién, con
**Guardar igual / Cancelar / Copiar aviso** — el copiar es obligatorio porque el
aviso nombra a un profesor (regla de proceso 12). La consulta solo corre para
fechas del mes vencido hacia atrás: una clase de este mes no puede estar en una
membresía ya liquidada, y sin ese corte el día a día pagaba el costo.

### Verificado en dev, de punta a punta

Isabel Góngora, liquidación 5, período agosto, estado **pagada**: la comisión
original (108,27 base / 54,14 monto) quedó **intacta** y se creó el ajuste
(−55,72 / −27,86) apuntando a ella. La liquidación pasó a 26,28 devengado contra
54,14 pagado, y la pantalla ahora dice **"− Bs. 27,86 · pagado de más"** en vez
de "Bs. 0,00". En Heels 29/08, guardar muestra el aviso nombrando esa
liquidación, y con "Guardar igual" la asistencia se graba.

15 pruebas en verde, `tsc`, `eslint` y `build` limpios.

### Estado

**PASADO A PRODUCCIÓN el 2026-09-18**, con el OK explícito de Javier
(*"adelante con producción"*). Migración **0044** aplicada en
`pnvhpbxjbdmbktpwebtx` antes del código: puramente estructural, con
`comisiones_devengadas` en **0 filas** antes y después. `main`
`f6f446a..75d33d5` (9 commits). Controles de `scripts/control_migracion.sql`:
**todos OK** en producción. `get_advisors` sin hallazgos nuevos.

**Por qué el riesgo era bajo, medido y no supuesto**: producción nunca había
liquidado nada, así que no había ningún delta histórico que el cambio pudiera
disparar de golpe. Su **primera liquidación corre en octubre**, por septiembre,
y este código es el que la va a gobernar — llegamos antes de la primera vez, no
después.
---

## La cuenta del profesor: deuda, pago clasificado y cierre de períodos · 2026-09-18 (dev)

Al mapear el modelo de liquidación para el pase anterior aparecieron tres
deudas chicas (R24, R25, R26). Javier pidió no dejarlas — y **amplió R24**:
*"una liquidación deja deuda, y una reliquidación también; todos los pagos (o
aplicación del negativo en caso que sea deducción) contra estas deudas deben
reflejarse correctamente en los pagos que se hagan en cualquier momento,
correctamente clasificados."*

Eso dejó de ser "arreglar un motivo" y pasó a ser el **lado de pagar de Caja**,
que estaba anotado aparte como R3.

### El bug de origen

`registrarPagoLiquidacion` asentaba el egreso con `motivo: "liquidacion"`, una
clave **inventada**: no estaba en el catálogo `motivo_pago` ni en
`BUCKET_POR_MOTIVO`. No era cosmético — `bucketDeMotivo()` devolvía `null`, así
que lo que se le paga a un profesor no saldaba ninguna deuda y no caía en ningún
bucket. Plata que sale sin clasificar. El motivo correcto, `comision_profesor`,
existía desde la 0020: la **migración 0045** remapea y guarda el valor anterior.

### La decisión de modelo, tomada sobre dos ejemplos

Se le presentaron a Javier los dos modelos con los números reales de Góngora
(agosto: devengó 26,28 y se le pagaron 54,14; septiembre: devenga 100 → se le
deben 72,14):

- **La cuenta del profesor**: el saldo suma todos sus períodos y el negativo se
  compensa solo.
- **Cada liquidación cierra**: el negativo se arrastra al período siguiente como
  descuento.

**Ganó la cuenta**, por un argumento que no era obvio de entrada: si el recupero
dependiera de generar la liquidación siguiente, un profesor que deja de devengar
se llevaría el saldo **sin que apareciera en ningún lado**. Con la cuenta se ve
desde el momento cero y no se va hasta saldarse (regla de calidad 1).

Javier agregó una condición al confirmar: **que además los períodos cierren al
pagar**. Así que la imputación (`src/lib/liquidacion/cuenta.ts`, función pura con
9 pruebas) primero cancela los períodos con pagado de más —devolviéndoles lo que
sobró— y después reparte el efectivo entre los que deben, del más viejo al más
nuevo. **La suma de las filas es el efectivo que sale**, así que la caja cuadra
sin que nadie compense nada a mano.

### La frontera, que Javier fijó explícitamente

El saldo es el de las **liquidaciones**: comisiones de cursos regulares y
pruebas, más el pago al reemplazante y el descuento al reemplazado. Los
conceptos ad-hoc —multas, bonificaciones, débitos y créditos de administración—
**se resuelven enteros en Caja y no entran al saldo**.

Por eso la línea dice *"Saldo de liquidaciones"* con todas las letras y no "lo
que se le debe": `otro_pago_profesor` cae en el **mismo bucket** `profesores`, y
una bonificación pagada por Caja parecería saldar una comisión.

Con **C3** se suman las comisiones por clases particulares y talleres y los
cargos por alquiler de sala, así que el saldo se escribió como *la suma de los
conceptos liquidables*: agregar una fuente tiene que ser sumar un sumando.

### Tres bugs que aparecieron recién al probarlo en el navegador

Ninguno lo habrían encontrado `tsc`, `eslint` ni las pruebas:

1. El panel abría en **"Ingreso"** al tocar *Pagar* en una línea de profesor. La
   dirección ahora sale de la línea (`direccionDeBucket`).
2. El motivo inicial se calculaba **siempre contra `motivosIngreso`**, aun con
   contexto de egreso. No se notaba porque no había líneas de egreso; con "Por
   pagar" habría sido el primer uso.
3. `registrarMovimiento` redondeaba el monto **a entero**. Sirve para el resto de
   la caja, pero un saldo de liquidación sale de un prorrateo y casi nunca es
   redondo: pagar 11,68 exacto daba *"el pago supera el saldo"* porque subía a 12.

### R26: el control que gritaba en falso

El control 17 daba **21** en dev, casi todo falso positivo — desde la 0044 una
venta retroactiva a un período pagado es legítima. Al acotarlo apareció un
**segundo** falso positivo que no estaba previsto: membresías `activa` o con
ciclo que termina después del cierre, que no habían devengado simplemente porque
no les tocaba. Con las dos correcciones pasó de 21 a **0**, que es la verdad: en
dev no hay nada reescrito sin compensar.

### Verificado en dev

La sección "Por pagar" lista a los cinco profesores con su saldo; Góngora aparece
en **−27,86 con "se le pagó de más" y sin botón de pagar**; y pagar los 11,68 de
Tini dejó su liquidación en `pagada` con neto 0,00, con el pago asentado como
`comision_profesor` e imputado a esa liquidación. El pago viejo que remapeó la
0045 ya se lee como "Comisión a profesor" en el libro de caja.

24 pruebas en verde (15 del motor + 9 de la cuenta). `tsc`, `eslint` y `build`
limpios.

### Estado

**Solo en dev.** Migración **0045** aplicada ahí; el pase espera el OK de Javier.

## D1 + D3 — un solo nombre para la membresía · 2026-09-24 (dev)

### Por qué ahora, y por qué junto con el plan de C3-0

Al armar el informe de impacto de "Contactos y captación" (C3-0), Javier pidió
medir si convenía adelantar **D1** (unificar `inscripcion_id`→`membresia_id` y
`inscripciones`→`membresias`, la deuda que el glosario de `REGLAS.md` viene
señalando desde el 2026-09-12) antes de escribir el código nuevo de contactos.

Medido contra producción: la base son 5 columnas y 2 tablas, sin ninguna
función, vista, trigger ni política RLS que las nombre por string — solo
restricciones, índices y secuencias derivadas. El código son 260 menciones en
23 archivos, de los cuales **11 los iba a tocar C3-0a.1 de todos modos**
(inscribir, asistencia, caja, recibo, liquidaciones, cuentas, periodos,
alumnos, tipos, `EntidadAlumno`, sala). Hacerlo antes significa escribir ese
código una sola vez, con el nombre correcto. Javier aprobó: **D1 + D3, pase
propio en dev, antes de C3-0a.1** — y, apenas terminado, pidió pausar
(*"pausa al terminar d1 y d3 en dev"*) sin commit ni push hasta nueva orden.

### Qué hizo la migración 0047

Solo renombra, no toca ninguna fila:

1. `inscripciones` → `membresias`, `inscripcion_cursos` → `membresia_cursos`.
2. `inscripcion_id` → `membresia_id` en `asistencias`, `cuotas`, `pagos`,
   `corrimientos_ciclo` y `membresia_cursos`.
3. Restricciones, índices, secuencias y políticas RLS con el nombre viejo,
   renombradas por bloque `do $$ ... $$` (re-ejecutable: solo actúa si el
   nombre viejo existe todavía).

**Lo que deja afuera, a propósito**: `membresia_anterior_id` (otro concepto —
de qué membresía viene esta, no la llave de pertenencia) y los respaldos
históricos `*_previo_*` (conservan el nombre que tenían cuando se tomaron).

### Un bug encontrado al verificar, y su corrección

Las secuencias de las columnas identity **no figuran en
`information_schema.sequences`** — solo son visibles en `pg_class` con
`relkind='S'`. La primera versión del bloque de renombre las buscaba en
`information_schema` y no las tocaba; `pg_get_serial_sequence` seguía
devolviendo `inscripciones_id_seq` después de aplicar la migración. Corregido
—en el archivo y ejecutado directo contra dev para las dos secuencias que ya
habían quedado sin renombrar— antes de dar el pase por terminado.

### `control_migracion.sql`: control 15 pasa de REVISAR-a-propósito a OK

El control 15 ("un concepto, un nombre: llaves a `membresias` con nombres
distintos") daba REVISAR **por diseño**, documentando la deuda D1. Con la
0047 aplicada, un primer re-chequeo seguía dando 3 grafías porque el control
todavía no excluía `membresia_anterior_id` ni los respaldos `*_previo_*` —no
era un bug de la migración, era que el control no reflejaba la exclusión que
el glosario siempre tuvo. Se corrigió el SQL y su comentario, y quedó en
**OK** (n=1, solo `membresia_id`). El resto del script (67 referencias en los
demás controles) se renombró en bloque.

### Verificado en dev

- **21 controles de `control_migracion.sql` en OK**, incluido el 15. El
  control 10 sigue en 1 — desvío de datos preexistente, no relacionado.
- `npx tsc --noEmit` limpio. `npm test`: **33/33** en verde.
- Recorrido en el navegador: Alumnos, Cursos, Planes, Inscribir/Venta
  (`MostradorVenta.tsx`, ya con su nombre nuevo), Liquidaciones y Asistencia.
  En Asistencia se hizo una prueba de escritura real —marcar y guardar una
  clase— confirmada a nivel de fila: `asistencias.membresia_id` quedó
  poblado correctamente.
- `scripts/refresh-dev.mjs` y `scripts/reconciliar_liquidacion.mjs`
  actualizados a los nombres nuevos (orden de inserción, backfill de
  `membresia_cursos`, endpoints REST y filtros).

### D3, en el mismo pase

`ClienteVentas.tsx` → `MostradorVenta.tsx` (`git mv` + referencias), porque su
disparador en `DECISIONES.md` era "junto con D1, que es el mismo tipo de
trabajo".

### El script de rollback, probado antes del pase

Antes de tocar producción, Javier pidió preparar y probar un camino de vuelta.
Se armó `scripts/rollback_0047_d1_membresias.sql` (no vive en
`supabase/migrations/`: es un script de guardia, no una migración más) que
deshace la 0047 en el orden inverso exacto. Se verificó de punta a punta en
dev: se aplicó la 0047 (ya estaba), se corrió el rollback, y se tomó el hash
MD5 de los 18 restricciones + 9 índices sueltos + 2 secuencias + 4 políticas
de las 6 tablas — comparado contra el mismo hash tomado en producción (que
todavía tenía el esquema pre-D1 intacto). **Los dos hashes dieron idénticos**
(`16f59f494766254151e63085520f593d`), confirmando que el rollback reproduce el
esquema original objeto por objeto, no solo aproximadamente. Los 6 conteos de
filas no cambiaron. Después se volvió a aplicar la 0047 para dejar dev en su
estado normal: control 15 en OK, `tsc` y `npm test` (33/33) limpios.

### El pase a producción

Con el rollback listo, Javier dio el OK (*"pasamos a PROD los cambios
pendientes"*). Orden seguido (regla de proceso, §3 de `DECISIONES.md`):

1. Migración **0047** aplicada en `pnvhpbxjbdmbktpwebtx` primero. Verificado
   de inmediato: las 6 tablas con sus mismas 39/39/145/39/38/44 filas, sin
   ningún dato tocado.
2. **Un solo push** con los tres commits pendientes (D1+D3, el fix de
   búsqueda de profesores por nombre, y el script de rollback): `main`
   `f91be80..574636c`.
3. Los **21 controles de `control_migracion.sql` en OK** en producción,
   incluido el 15 (la deuda de D1, resuelta).
4. `get_advisors` (seguridad): sin hallazgos nuevos atribuibles a la 0047 —
   los 5 lints que aparecen son preexistentes (RLS sin política en tablas de
   respaldo histórico, la extensión `btree_gist` en `public`, dos funciones
   `SECURITY DEFINER`, protección de contraseñas filtradas deshabilitada).

### Estado

**En producción.** Migración `0047_d1_membresias.sql` aplicada en las dos
bases. Código en `main`, commit `574636c`. Control 15 pasa a **OK** en las dos
bases — D1 y D3 quedan cerradas en `DECISIONES.md`.
