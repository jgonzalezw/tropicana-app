# Tropicana — ESTADO (fuente única de verdad del avance)

> Este documento es la memoria del proyecto entre sesiones. Se versiona en cada
> hito. Ante contradicción entre este doc y el repo, **gana el repo** (y se
> corrige acá). Documentos hermanos: `docs/archivo/PLAN_ETAPA1.md` (plan técnico),
> `docs/design/README.md` (fuente de verdad del **diseño**), `docs/archivo/CONTEXTO_AVANCE.md`
> (bitácora larga de Etapa 0), `docs/DESIGN_SYNC.md` (cómo entran los handoffs).
>
> **Cómo leer este documento.** Los bloques con fecha son **bitácora**: cuentan
> cómo estaban las cosas **ese día** y no se reescriben. Cuando una frase vieja
> ("solo en dev", "sin construir", "pendiente") dejó de ser cierta, lleva al
> lado una marca *(➜ hoy: …)* con la fecha del cambio. El estado **vigente**
> vive en las tablas (§0bis, la cola C1→C5), en `DECISIONES.md` (decisiones y
> registro de pases) y en `ROADMAP.md` (trabajo pendiente).
>

## Índice de lo archivado (recorte 2026-10-04)

Este documento conserva las **tablas vigentes**. La **bitácora fechada** (lo que pasó cada día, sin reescribir) se movió, sin cambios y en el mismo orden, a `docs/archivo/`. Mapa de rutas en `docs/archivo/README.md`.

Dentro de lo archivado hay dos datos de referencia que no viven en otro lado: la **cuenta de verificación en dev** (`claude@tropicana.dev`, subsección de «0quater. Caja») y la **URL de producción en Vercel** (`tropicana-app.vercel.app`, en «5. Pendientes»). Ambos están en `docs/archivo/ESTADO-2026-08-09.md`.

**En `docs/archivo/ESTADO-2026-08-09.md`** (agosto y septiembre, hasta el 2026-09-30): la serie de «Última actualización» del encabezado y estas secciones:

- 0ter. Decisiones de política y reparación de la migración (2026-09-10)
- 0quater. Caja (2A) y notas para el Paso 2 (2026-09-10)
- 0sexies. Mejora transversal — abrir la ficha de cualquier entidad (2026-
- 0septies. Corregir una membresía ya vendida (2026-09-10)
- 0octies. `docs/REGLAS.md` — las reglas invariables, cargadas siempre (20
- 0nonies. El fin de ciclo pasa a calcularse (2026-09-10) — HECHO EN DEV
- 5. Pendientes y decisiones abiertas
- Clase de prueba — Paso D (padrón de asistencia) · cerrado 2026-09-11
- Clase de prueba — una fecha por curso (0024) · cerrado 2026-09-11
- Liquidación a prorrata — cierre de E, y las reglas 16 a 19 · 2026-09-11/
- D18 — la comisión es de quien dictó, no de quien está asignado hoy · 202
- D17a — quién dictó la clase deja de ser una suposición · 2026-09-12
- Pase a producción de las migraciones 0023–0030 · 2026-09-12
- D17b — el descuento del reemplazante en la liquidación · 2026-09-12 (dev
- Vigencia del curso · 2026-09-12 (dev)
- Pase a producción de las migraciones 0032 y 0033 · 2026-09-12
- D6 — la duración de la clase, y con ella la hora de fin · 2026-09-12 (de
- Pase a producción de la migración 0034 · 2026-09-12
- Precios y paquetes, y la base de la sala · 2026-09-12 (dev)
- La segunda sala, y las excepciones por rango · 2026-09-12 (dev)
- Un alumno duplicado en el padrón de asistencia · 2026-09-16
- C5 (lado de cursos regulares): un cierre de sala avisa y suspende · 2026
- Roles y Permisos: Planes, Liquidaciones, Precios y Sala separados · 2026
- Dos correcciones de UI encontradas probando en celular · 2026-09-16
- Cuenta del alumno: membresías multi-curso completas, y fecha de fin real
- Corrección de datos en producción: la clase de Yubinca acreditada a la m
- Ítem 3: intervalo estándar de tiempo (parámetro único de incrementos) · 
- R23 corregido y pasado a producción · 2026-09-17
- C2 — Disponibilidad + reserva mínima de sala · 2026-09-17 (dev)
- El trigger de alta no copiaba el email a `perfiles` · 2026-09-17
- Visibilidad de datos propios (0043) · 2026-09-17 (dev)
- El mensaje de "clase congelada" no se notaba (sin migración) · 2026-09-1
- La cuenta del profesor: deuda, pago clasificado y cierre de períodos · 2
- D1 + D3 — un solo nombre para la membresía · 2026-09-24 (dev)
- C3 — H1: plantillas de plan de particulares · 2026-09-25 (dev)
- C3 — H2: vender un plan de particulares · 2026-09-26 (dev)
- C3 — H3: reservas con los 7 estados · 2026-09-26 (dev)
- C3 — H4: cierres de sala sobre reservas · 2026-09-26 (dev)
- Ajustes tras cargar datos reales: contacto_id, sala externa por plan, du
- Agendamientos externos de hoy, en /sala · 2026-09-27 (dev)
- C3 — H5: liquidación de particulares · 2026-09-27 → 2026-09-30 (dev, sin

**En `docs/archivo/ESTADO-2026-10.md`** (desde el 2026-10-01):

- C3 — H5, Paso 4: criterios 2 y 3 en cursos regulares · 2026-10-01 (dev, 
- Informe de pre-liquidación · 2026-10-01 (en producción, chip `#9a9ff64`)
- Desasignar a un profesor de un curso · 2026-10-01 (dev, sin pase) — URGE
- Cierre de cuentas al desasignar · 2026-10-01 (dev, sin pase) — caso Isab
- C3 — H7: alquiler de sala, tanda 1 (base) · 2026-10-01 (dev, sin pase)
- C3 — H7: alquiler de sala, tanda 2 (la venta) · 2026-10-01 (dev, sin pas
- Ventas y contactos con el mismo comportamiento — E1 (piezas comunes + al
- E2 — Clase particular con las piezas comunes (2026-10-01, dev)
- E3 — Inscripción regular y clase de prueba con las piezas comunes (2026-
- E4 — Agregar un rol a un contacto existente desde Alumnos y Profesores (
- Cierre de la tanda de ventas — vigencia, cobro y avisos (2026-10-02, dev
- Pase a producción de H7 + ventas unificadas · 2026-10-02 (en producción)
- Hito B — rendimiento de /sala (2026-10-02, dev; sin push)
- Hito B — estandarización de /sala y panel Gestionar (2026-10-02, dev; si
- /sala: gestionar sin salir de la pantalla (2026-10-02, dev; sin push)

---

## 0bis. Estado consolidado — secuencia del Motor de Planes (7 pasos)

Referencia: `docs/PLAN_CIERRE_ETAPA1_v2_MOTOR.md` §2. Tabla revisada el 2026-09-24 (pasos 2 y 5).

| Paso | Qué es | Estado |
| --- | --- | --- |
| 0 | Reencuadre al Motor de Planes y Membresías | ✅ Hecho (2026-09-05) |
| **1** | **Liquidación a profesores** (motor base Plan Regular: planes N/ilimitado, multi-curso, asistencia con contador/completada/tolerancia/bono, liquidación criterio 1 + comprobante) | ✅ **v1 y v2 EN PRODUCCIÓN** (v1 el 2026-09-09/10; v2 el 2026-09-12): prorrata multi-curso real (reglas 10/16/17/18/19/20), quién dictó la clase, descuento del reemplazante, comprobante auditable. Migraciones 0023–0033 |
| 2 | Venta de particulares/alquiler + confirmar sesión (con horario) + renovación + estado de cuenta del alumno | 🟡 **Arrancó el 2026-09-12 por los precios base.** *Precios y paquetes* (D8) construida, con las cinco pestañas, los paquetes de particular (bloque D) y la matriz de sala (bloque E). **En producción desde el 2026-09-16** (0035). Falta la venta en sí (*Vender servicio*) y la confirmación/reserva de sesión: es **C3** |
| 3 | App Shell (armazón + visual ya diseñado) + Dashboard operativo | ⏳ Pendiente — no iniciado |
| 4 | Costos fijos | ⏳ Pendiente — no iniciado |
| 5 | Agenda de sala (+ `duracion_min` en `cursos`) | 🟡 **En curso por la cola C1→C5** (ver "Lo que sigue — la cola C1→C5"). En producción: la base (0035), la duración de la clase (0034), C1 horario base (0036/0037), C2 disponibilidad + bloqueos (`/sala`, 0040/0041) y el lado cursos de C5. **Falta:** C3 (venta con reserva), el lado reservas de C5 y **la agenda visual** (C4), que Javier marcó como no negociable: *"es una herramienta fundamental para Natalia por su vista. Debe ir, ya es hoy un problema para ella."* Sin mockup todavía |
| 6 | Alineación a estándares del resto de pantallas (ver `docs/PLAN_UX_DANZE.md`) | 🟡 En curso, parcial — Toggle estándar adoptado y pantalla Planes ya alineada; Cursos/Profesores/Dashboard/navegación siguen en el backlog de `PLAN_UX_DANZE.md` |

**Dónde estamos (foto del 2026-09-12, tarde — lo de después está en la tabla de arriba y en el encabezado de este documento).** El **Paso 1 está cerrado y en
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

| Lo que pide | Dónde vive en el plan | Estado al 2026-09-12, tarde | Hoy (2026-09-24) |
| --- | --- | --- | --- |
| Vender y gestionar clases particulares | **2D** (la mitad que no es clase de prueba) | 🟡 **Precios base listos** (pantalla *Precios y paquetes*, validada en dev). Falta la venta en sí | Precios en producción (2026-09-16). La venta es **C3**, lo siguiente |
| Validar/reservar disponibilidad de la sala | **Paso 5** — Agenda de sala | 🟡 **Base de datos lista** (0035: `salas`, `reservas_sala` con no-choque garantizado). Falta la agenda visual | C1 y C2 en producción (horario base, disponibilidad y bloqueos en `/sala`). Falta reservar al vender (C3) y la agenda visual (C4) |

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
- **Comisiones:** tasa **por asignación profesor×curso**, **congelada al confirmar** (dos %: sobre ingresos del curso + por alumno referido). **Referido (definido 2026-09-04, RF-02.2/RF-07.2):** lo percibe el **profesor que REFIRIÓ** al alumno (no el titular), según el `pct_referido` de **su** asignación, sobre los cobros de ese alumno en el curso del otro profesor. *(➜ hoy: **sin construir** —la liquidación no lee `pct_referido`—; el estado y lo que falta decidir viven en `DECISIONES.md` **D22**.)* *(Brecha a resolver antes de construir: hoy `referido_por_alumno_id` apunta a un alumno, no a un profesor; y falta definir cuál `pct_referido` aplica si el profesor tiene varias asignaciones.)* El **"bono por referido" sobre la inscripción** queda como **gancho** (pendiente validar). La liquidación lee el % de la **asignación que cubrió el período** (filas inmutables `desde/hasta`; reemplazar titular cierra la fila, no la edita). Devenga **sobre lo cobrado**, a **mes vencido**, con **prorrateo** en pagos adelantados. Base de ingresos incluye cuotas, parciales y clases de prueba.
- **Liquidación mensual básica dentro de Etapa 1** (devengado − pagos al profesor); esquema diseñado para ampliarla (relevos, bonos, particulares, costos de sala) en fase 2.
- **Costos fijos:** devengado mensual automático, prorrateado por frecuencia (mensual / trimestral ÷3 / anual ÷12 / único en su mes).
- **Snapshot de precios** en inscripción/cobro (editar el precio del curso no reescribe lo ya inscripto).
- **Clase particular:** individual / pareja / **grupo hasta 16** (máximo en parámetros), siempre con ≥1 alumno titular. Al vender, se crea automáticamente el paquete de uso de sala del profesor, tarifado desde la **tabla única de Tarifas de Sala** (Categoría × Tamaño × Horas). *(pantallas = fase 2; el backend deja los ganchos.)*
- **Clase de prueba:** precio por alumno por curso (tabla C); los asistentes entran a la lista de asistencia de la sesión; el cobro suma a la comisión del profesor.
- **Sala:** el modelo nace para varias (reserva fecha+hora+duración). *(➜ hoy: dos salas desde la 0037, 2026-09-12; ver `DECISIONES.md` §1.b.)*
- **Profesor y Usuario:** entidades separadas, vinculables **uno a uno** (un externo normalmente sin cuenta).
- **Orden de listas de personas:** toda lista de personas usada para **localizar** a alguien (búsquedas, padrones, selects) se ordena **alfabéticamente por apellido** (luego nombre), en **cualquier** entidad. Helper: `compararPorApellido` en `src/lib/texto.ts`.
- **Sin hardcode:** tarifas, tolerancias, umbrales, motivos, categorías, temas, roles y permisos → catálogo o parámetro.

## 4. Migraciones

`0001` Etapa 0 · `0002` módulo usuarios · `0003` temas · `0004` seguridad de usuarios (todas **aplicadas**). `0005_etapa1_entidades` — **aplicada en Supabase** (confirmado por Javier). `0006_etapa1_inscripcion` — ✅ **aplicada en Supabase** (validada antes localmente en Postgres 16: cadena 0001→0006 limpia e idempotente; smoke test de inscripción + cuotas + pagos con estados pagada/parcial/pendiente y deuda por alumno): tablas `inscripciones` (modalidad mensual/clase/semana/medio_mes, snapshot `precio_aplicado`, `dias_elegidos`), `cuotas` (devengado mensual, `descuento_adelanto`, estado pendiente/parcial/pagada) y `pagos` (libro de cobros/pagos que persiste el paso Cobro; sujeto alumno/profesor/costo_fijo, referencia inscripción/cuota, medio, descuento+motivo, ajuste+motivo, glosa, registrado_por); parámetro `medios_pago`. `0007_etapa1_asistencia` (`sesiones`/`asistencias` + params `faltas_toleradas`, `mostrar_deuda`), `0008_asistencia_ventana_retro` (param `asistencia_semanas_retro`) y `0009_etapa1_suspension` (`sesiones.estado`/`motivo` + `corrimientos_ciclo`) — ✅ **aplicadas en Supabase** (confirmado por Javier, 2026-09-04). **0001→0011 aplicadas en Supabase (producción).** `0010_motor_planes_liquidacion` — ✅ **construida y validada en local** (Postgres 16: cadena 0001→0010 limpia; 0010 idempotente al re-correr; smoke test end-to-end plan→membresía→cuota con `fecha_compromiso`→comisión devengada→liquidación+item→pago al profesor; check de `estado` rechaza valores fuera de `activa/completada/baja`; RLS y FK verificadas; el nuevo check de `estado` es superconjunto del anterior (`activa/baja` → `activa/completada/baja`), sin riesgo sobre filas existentes). ✅ **aplicada en Supabase (producción) el 2026-09-05** (confirmado por Javier, sin errores). Validada antes en Postgres 16 en el sandbox de Code (no en una base local en la máquina de Javier: hoy dev y producción comparten el **mismo** Supabase). Contenido: tabla `planes` (config del Plan Regular), generalización de `inscripciones` como membresía (`plan_id`, `clases_plan`, `bono_arrastrado`, `tolerancia_faltas`, `ciclo_numero`, `membresia_anterior_id`, `fecha_fin`, estado `+completada`), `cuotas.fecha_compromiso`, `cursos.cupo`, `comisiones_devengadas`/`liquidaciones`/`liquidacion_items`, `pagos.liquidacion_id` y parámetro `periodicidad_liquidacion` (default `mes`). Diseño en `docs/archivo/PLAN_PASO1_MOTOR_REGULAR.md` (sub-hito 1A). `0011_datos_plan_regular` — ✅ **construida y validada en el sandbox de Code** (cadena 0001→0011 limpia; datos de ejemplo → planes por curso con N correcto, backfill de membresías, idempotente al re-correr). ✅ **aplicada en Supabase (producción) el 2026-09-05** (confirmado por Javier; N = días × 4 confirmado; chequeo posterior OK; 12 inscripciones mensuales convertidas a membresías). Migración de datos: crea un "Plan Regular - <curso>" por cada curso (`cantidad_clases = días_semana × 4`, `precio = precio_mensual`, `tolerancia_faltas = null` → usa el parámetro del sistema, `criterio_liquidacion = 1`) y convierte las inscripciones `modalidad='mensual'` en membresías de ese plan (`plan_id`, `clases_plan`, `ciclo_numero=1`). Cursos sin `días_semana` quedan con `cantidad_clases = NULL` (a fijar a mano). `fecha_fin` no se calcula aquí (la mantiene la lógica de asistencia en 1B). **Aclaración registrada:** el parámetro que vale 1 es `faltas_toleradas` (tolerancia), NO el N; el N deriva de los días del curso. `0012_motor_venta_asistencia` — ✅ **construida y validada en el sandbox de Code** (cadena 0001→0012 limpia; backfill de `planes.modalidad` OK; idempotente). Aditiva: `planes.modalidad` (etiqueta comercial, backfill Plan Regular→`mensual`, Plan Medio Mes→`medio_mes`), `inscripciones.clases_hechas` y `inscripciones.bono_generado` (contador y bono, se usan en 1B.2), `asistencias.con_licencia` (falta con licencia, 1B.2), y parámetro `dias_compromiso_pago` (default 30, tope de días para la fecha de compromiso). **`0012`, `0013` (`plan_cursos`/`inscripcion_cursos`), `0014` (`acceso_modo`/`clases_ilimitadas`/`ciclo_dias`) y `0015` (`bono_redimido`) — ✅ APLICADAS en producción el 2026-09-09**, vía el conector Supabase MCP (acceso directo confirmado a ambos proyectos: `tropicana-dev`=`hyhijzuomqpylcmrzdvw`, producción "Tropicana"=`pnvhpbxjbdmbktpwebtx`); esquema verificado columna por columna después de cada una, sin advisories de seguridad nuevos. `main` actualizado en el mismo paso (`ef6a517..1d59e42`, fast-forward sin conflictos) y desplegado solo por Vercel (branch tracking activo en `main`; deployment `1d59e42` en estado Ready, error rate 0%). **`0016_reparar_membresias_migradas` y `0017_cuotas_para_ventas_sin_cuota` — ✅ APLICADAS en dev y en producción el 2026-09-10**, con OK explícito de Javier para el pase. Ambas son de **datos** (la 0016 agrega además una restricción): `0016` completa `fecha_fin` de las membresías que la 0011 dejó vacía, recalcula `clases_hechas`/`bono_generado`/`estado` desde las asistencias de sesiones dictadas y agrega el check `inscripciones_fechas_coherentes`; `0017` crea la cuota faltante de cada membresía, engancha los cobros sueltos (`pagos.cuota_id` vacío) y recalcula el estado de la cuota según lo cobrado. Las dos son idempotentes (verificado por huella md5 antes/después de una segunda corrida) y quedaron con los 7 controles de `scripts/control_migracion.sql` en OK, en ambas bases. Detalle y motivo en **§0ter**.

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

---

## I-001 — Confirmación de inscripción (2026-10-07)

Registro de nueve pedidos (I-001 a I-009, `INCIDENTES.md`) y activación de D29 junto con I-005. Cierra I-001; **solo dev, sin migración**.

- El texto de WhatsApp de una inscripción regular ahora trae cada curso con días y horario, clases (con bono) o ilimitado, inicio y fin de ciclo, tolerancia de faltas, precio, pagado y saldo con su fecha. Va al tutor si el alumno es menor.
- Con cobro, la tarjeta suma un aviso «recibo de pago» por WhatsApp (copiable) y «Ver recibo», que abre el recibo imprimible en otra pestaña.
- Código: `src/lib/venta/mensajeInscripcion.ts` (puro, 6 pruebas), `inscribirYCobrar` y `ConfirmacionVenta`.
- **Verificado:** `tsc`, `lint`, `npm test` (280/280) y prueba en pantalla de Javier en dev.
- Prueba, particular y alquiler conservan su texto anterior: reusar la función es seguimiento.

---

## I-009 — Número de clase en Asistencia (2026-10-07)

Cierra I-009; **solo dev, sin migración**. Rama `fix/i-009` (sale de `fix/i-001`).

- Cada alumno del padrón muestra «Clase 5 de 12 · quedan 7 · 4/12 tomadas · 1 falta en el ciclo». En un paquete por clase: «Una clase · clase 3 de 8 · quedan 5». En la última: «Última clase (8 de 8)» y la pastilla «Última clase» en color de advertencia, también con la clase ya marcada; pesa más que las de tolerancia.
- Las tomadas y las faltas del ciclo cuentan hasta la fecha que se mira: una fecha pasada ya no muestra los totales de hoy. No cambió nada de lo que decide el padrón, la tolerancia ni el bono.
- Código: `src/lib/ordinalClase.ts` (puro, 6 pruebas), `cargarPadron`, `FilaAsistencia.ordinal` y `ClienteAsistencia`.
- Límite: un alumno con dos cursos el mismo día ve el mismo número en los dos.
- **Verificado:** `tsc`, `lint`, `npm test` (286/286) y prueba en pantalla de Javier en dev.

---

## I-005 — Retiro del profesor y pre-liquidación simulada (2026-10-07)

D34 (`docs/decisiones/vigentes.md`) y D29 activada. **Migración 0063 aplicada en dev (2026-10-07) y en producción (2026-10-08).**

- **Pre-liquidación simulada (D29):** botón «Simular cierre del período» en Liquidaciones → `/liquidaciones/pre-liquidacion?modo=simulacion`. El período en curso sale de `periodicidad_liquidacion` (`rangoEnCurso`: mes o semana). Capa pura `simulacion.ts`: las activas con fin dentro del período y saldo 0 pasan a completadas, las clases y reservas futuras cuentan como dadas; el motor no se tocó. Rótulo «Simulación al <fecha>» y los 3 límites, también en el impreso.
- **Cierre de particulares:** `calcularDevengosParticulares` acepta `cierre` (avance de horas al corte, solo positivo, tipo `cierre`).
- **Retiro:** `/profesores/retirar/[id]` (botón «Retirar…» en el listado). Vista simulada (`retiro.ts`, puro) con acciones, liquidación final (regulares + particulares + saldo previo) y trabas; las membresías que la regla 17 deja afuera no traban, se explican. `vistaRetiro` solo lee; `retirarProfesor` recalcula y llama a la función SQL `retirar_profesor` (0063): asignaciones, sustitutos, cierre, ítems, totales e inactivación en una transacción.
- **Se puede retirar a un profesor ya inactivo con asignaciones abiertas** (dev tenía uno: Caceres).
- **Control 48** nuevo: profesor inactivo con asignación abierta.
- **Verificado en dev:** `tsc`, `lint`, `npm test` (312). Simulación mostrada en pantalla sin escribir nada. Función: camino feliz y falla a mitad revertidos en SQL (nada queda escrito). Retiro real de Caceres: coincide con la simulación (Bs. 150, 3 líneas, liquidación 2026-10-01 abierta), control 43 y 48 en 0.
- **No hecho:** la cifra de liquidez con el saldo adeudado en la simulación; el valor `semana` no está en el catálogo del parámetro (la liquidación real solo sabe `mes`); el botón del retiro está en el listado, no en la ficha. **→ Resuelto en I-005b (2026-10-08):** cifra de liquidez en la simulación y el impreso (por profesor y con piso 0: devengo + saldo previo + suplentes); `semana` no se agrega, queda como D36; botón «Retirar…» también en la ficha del profesor. Sin migración.
- **Ajuste tras la prueba de Javier (2026-10-07):** la impresión del retiro ya no es la pantalla: `imprimirRetiro.ts` arma un HTML aparte, sobre fondo blanco (con pruebas). El informe suma **«Membresías que quedan inconclusas»**, una línea por membresía (alumno, cursos/plan, inicio, fin, avance con faltantes, estado y saldo; regulares y particulares). Al confirmar, el mismo informe pasa a ser la **liquidación por finalización**, con los datos que el servidor calculó al escribir (N.º de liquidación y fecha de confirmación); se imprime desde la pantalla de retiro confirmado.

---

## I-003 — Bono de tolerancia por curso (2026-10-08)

D35 (`docs/decisiones/vigentes.md`). **Migración 0064 aplicada en dev (2026-10-08) y en producción (2026-10-08).**

- **Modelo:** tabla `membresia_bonos` (un bono por membresía de origen y curso, con `vence` y su destino); `membresias.bono_generado` queda como resumen; `bono_redimido` deja de leerse. Respaldo `bono_previo_0064`.
- **Reglas:** se evalúa y se topa por curso; vence en la renovación bonificada de su curso; se aplica en cualquier plan que incluya el curso (en ilimitado se consume sin efecto); la prueba no genera ni consume bono. Funciones puras en `src/lib/bono.ts` y `calendarioCiclo.ts`.
- **Pantallas:** venta (vista previa de bonos que aplican, vencidos y que no entran), padrón por curso, cuenta del alumno y mensaje de inscripción.
- **Control 49** nuevo (bono por curso inconsistente): 0 en dev y en producción.
- **Corrección de producción:** `scripts/corregir_bonos_i003.sql` para Manuel Aguilar, Jorge Vilca (inicio retroactivo al 1/10 y su asistencia) y Lucas Campero; rollback en `scripts/rollback_corregir_bonos_i003.sql`, probado en dev.
- **Verificado:** `tsc`, `lint`, `npm test` (333), venta real en dev, rollback de la 0064 y de la corrección fila por fila.
- **Cierre (2026-10-08):** PR #19, `main` `5b3093d`, deploy Producción `success`; Javier confirmó el chip PROD y los bonos de los 3 alumnos. Tablas de respaldo `bono_previo_0064` y `bono_correccion_i003_previo` borradas de producción con su OK (sin respaldo de rollback en producción).

### I-006 · Baja de profesor por Retirar (control 48) — 2026-10-08

- **Causa:** «Desactivar» solo apagaba `activo`: dejaba un titular inactivo con la asignación abierta (en producción, Caceres, Angel desde el 14/09, curso Danza Comercial). **Migración 0065 aplicada en dev (2026-10-08); producción pendiente.**
- **Prevención:** triggers en `profesores` (no se inactiva con asignaciones abiertas) y `asignaciones` (no se abre una a un inactivo); `eliminarODesactivarProfesor` y `crearAsignacion` lo validan antes; con cursos a cargo la ficha y el listado ofrecen solo «Retirar…». Regla 25 de negocio.
- **Verificado:** triggers probados en dev en una transacción deshecha (baja con cursos y alta a inactivo se rechazan; tras cerrar la asignación, inactivar pasa). **Pendiente:** corregir a Caceres en producción con la pantalla Retirar (espera: qué pasa con Danza Comercial) y el pase de la 0065.

