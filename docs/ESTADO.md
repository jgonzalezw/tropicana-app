# Tropicana — ESTADO (fuente única de verdad del avance)

> Este documento es la memoria del proyecto entre sesiones. Se versiona en cada
> hito. Ante contradicción entre este doc y el repo, **gana el repo** (y se
> corrige acá). Documentos hermanos: `docs/PLAN_ETAPA1.md` (plan técnico),
> `docs/design/README.md` (fuente de verdad del **diseño**), `docs/CONTEXTO_AVANCE.md`
> (bitácora larga de Etapa 0), `docs/DESIGN_SYNC.md` (cómo entran los handoffs).
>
> **Última actualización:** 2026-09-10 — Consolidación de estado a pedido de
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
| **1** | **Liquidación a profesores** (motor base Plan Regular: planes N/ilimitado, multi-curso, asistencia con contador/completada/tolerancia/bono, liquidación criterio 1 + comprobante) | ✅ **Hecho — EN PRODUCCIÓN** (desplegado y verificado 2026-09-09/10) |
| 2 | Venta de particulares/alquiler + confirmar sesión (con horario) + renovación + estado de cuenta del alumno | ⏳ Pendiente — no iniciado |
| 3 | App Shell (armazón + visual ya diseñado) + Dashboard operativo | ⏳ Pendiente — no iniciado |
| 4 | Costos fijos | ⏳ Pendiente — no iniciado |
| 5 | Agenda de sala (+ `duracion_min` en `cursos`) | ⏳ Pendiente — no iniciado |
| 6 | Alineación a estándares del resto de pantallas (ver `docs/PLAN_UX_DANZE.md`) | 🟡 En curso, parcial — Toggle estándar adoptado y pantalla Planes ya alineada; Cursos/Profesores/Dashboard/navegación siguen en el backlog de `PLAN_UX_DANZE.md` |

**Estamos parados al cierre del Paso 1**, ya desplegado y validado en vivo en
producción (deployment `41942b9`, Ready, 0% error). El siguiente a construir
es el **Paso 2**, y no arranca sin tu OK explícito.

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

### 2A.1 — resuelto en dev (2026-09-10), pendiente de validación de Javier

Todo en la rama `claude/tropicana-app-context-d5zjt8`, **sin pasar a
producción** (Javier: "desde acá volvemos a trabajar solo en dev hasta que te
solicite el pase"). No requirió ninguna migración nueva.

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
