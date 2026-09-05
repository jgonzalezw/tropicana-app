# Tropicana — ESTADO (fuente única de verdad del avance)

> Este documento es la memoria del proyecto entre sesiones. Se versiona en cada
> hito. Ante contradicción entre este doc y el repo, **gana el repo** (y se
> corrige acá). Documentos hermanos: `docs/PLAN_ETAPA1.md` (plan técnico),
> `docs/design/README.md` (fuente de verdad del **diseño**), `docs/CONTEXTO_AVANCE.md`
> (bitácora larga de Etapa 0), `docs/DESIGN_SYNC.md` (cómo entran los handoffs).
>
> **Última actualización:** 2026-09-05 — Reencuadre a **Motor de Planes y Membresías** (paso 0) + metodología de release.
> **Rama de trabajo:** `claude/tropicana-app-context-d5zjt8` (lista para PR/merge a `main`).
>
> **REENCUADRE VIGENTE (2026-09-05):** el sistema se replantea al **Motor de
> Planes y Membresías** (doc "Diseño del Motor de Planes y Membresías" v1.3). El
> plan de cierre de Etapa 1 bajo ese modelo está en
> `docs/PLAN_CIERRE_ETAPA1_v2_MOTOR.md` (**supersede** a `docs/PLAN_ETAPA1_CIERRE.md`).
> Secuencia: (1) liquidación con criterio configurable por plan · (2)
> particulares/alquiler + confirmar sesión + renovación/estado de cuenta · (3)
> App Shell + dashboard operativo · (4) costos fijos · (5) agenda de sala · (6)
> alineación a estándares. **En espera del OK de Javier para construir el Paso 1.**

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

`0001` Etapa 0 · `0002` módulo usuarios · `0003` temas · `0004` seguridad de usuarios (todas **aplicadas**). `0005_etapa1_entidades` — **aplicada en Supabase** (confirmado por Javier). `0006_etapa1_inscripcion` — ✅ **aplicada en Supabase** (validada antes localmente en Postgres 16: cadena 0001→0006 limpia e idempotente; smoke test de inscripción + cuotas + pagos con estados pagada/parcial/pendiente y deuda por alumno): tablas `inscripciones` (modalidad mensual/clase/semana/medio_mes, snapshot `precio_aplicado`, `dias_elegidos`), `cuotas` (devengado mensual, `descuento_adelanto`, estado pendiente/parcial/pagada) y `pagos` (libro de cobros/pagos que persiste el paso Cobro; sujeto alumno/profesor/costo_fijo, referencia inscripción/cuota, medio, descuento+motivo, ajuste+motivo, glosa, registrado_por); parámetro `medios_pago`. `0007_etapa1_asistencia` (`sesiones`/`asistencias` + params `faltas_toleradas`, `mostrar_deuda`), `0008_asistencia_ventana_retro` (param `asistencia_semanas_retro`) y `0009_etapa1_suspension` (`sesiones.estado`/`motivo` + `corrimientos_ciclo`) — ✅ **aplicadas en Supabase** (confirmado por Javier, 2026-09-04). **0001→0010 aplicadas en Supabase.** `0010_motor_planes_liquidacion` — ✅ **construida y validada en local** (Postgres 16: cadena 0001→0010 limpia; 0010 idempotente al re-correr; smoke test end-to-end plan→membresía→cuota con `fecha_compromiso`→comisión devengada→liquidación+item→pago al profesor; check de `estado` rechaza valores fuera de `activa/completada/baja`; RLS y FK verificadas; el nuevo check de `estado` es superconjunto del anterior (`activa/baja` → `activa/completada/baja`), sin riesgo sobre filas existentes). ✅ **aplicada en Supabase (producción) el 2026-09-05** (confirmado por Javier, sin errores). Validada antes en Postgres 16 en el sandbox de Code (no en una base local en la máquina de Javier: hoy dev y producción comparten el **mismo** Supabase). Contenido: tabla `planes` (config del Plan Regular), generalización de `inscripciones` como membresía (`plan_id`, `clases_plan`, `bono_arrastrado`, `tolerancia_faltas`, `ciclo_numero`, `membresia_anterior_id`, `fecha_fin`, estado `+completada`), `cuotas.fecha_compromiso`, `cursos.cupo`, `comisiones_devengadas`/`liquidaciones`/`liquidacion_items`, `pagos.liquidacion_id` y parámetro `periodicidad_liquidacion` (default `mes`). Diseño en `docs/PLAN_PASO1_MOTOR_REGULAR.md` (sub-hito 1A).

## 5. Pendientes y decisiones abiertas

**Progreso Etapa 1:** `0005` ✅ aplicada · `0006` ✅ aplicada · **Profesores** ✅ construido y **probado local** · **Cursos** ✅ construido (componente compartido `EntidadCurso` + pantalla con listado y alta/edición/baja, días como casillas, precio mensual y **tarifas parciales tabla A**; borrado guardado; al existir cursos se activa la pestaña Asignación de Profesores y el filtro de titular por especialidad/estilo; build+lint OK; **pendiente prueba local**). **Alumnos** ✅ construido (componente compartido `EntidadAlumno`: dup por WhatsApp, bloque de tutor si es menor, clave compuesta de menor = WhatsApp tutor + nombre, y tutor que puede ser alumno existente → vincular; canal de captación del catálogo; borrado guardado; build+lint OK; **pendiente prueba local**). **Tomar asistencia** ✅ **construido (fiel al mockup)** — `0007` aplicada. Migración `0007_etapa1_asistencia` (`sesiones` única por curso+fecha; `asistencias` única por sesión+alumno; params `faltas_toleradas`=2 y `mostrar_deuda`=true) validada en Postgres 16 (cadena 0001→0007 limpia e idempotente — **re-correrla es seguro**). Pantalla `/asistencia` fiel al handoff: **selector de clase** (tarjeta + desplegable con conteo de alumnos), **fila** con marcador a la izquierda, faltas del mes, **pastilla de tolerancia** ("Sin tolerancia"/"Última tolerada" según `faltas_toleradas`) y **deuda** ("Debe Bs. …", si `mostrar_deuda`); un toque marca presente, otro ausente; "Todos presentes"; contador y pie con leyenda. **Fecha elegible** (control de carga retroactiva) gateado por permiso `asistencia.editar` (sin ese permiso, queda en hoy). El padrón, faltas del mes (de la fecha elegida), clases restantes y deuda los calcula la server action `cargarPadron`. Guardar hace upsert de sesión + marcas (re-editable). Cada **presente consume una clase** del paquete parcial (parcial con 0 restantes deja de aparecer). Titular de la sesión = asignación vigente. Diferido a fase posterior (anotado): reposiciones por falta, clases de prueba en la lista, comisión por clase (0008), rol Profesor/"Confirmar sesión". build+lint+tsc OK.

**Inscribir y cobrar** ✅ **construido** (pendiente prueba local): (1) migración `0006` + paso `Cobro` compartido; (2) pantalla `/inscribir` con los 3 pasos del handoff (alumno → curso e inicio → cobro). Reutiliza `EntidadAlumno` (buscar/crear alumno al vuelo, `crearAlumnoDesdeInscripcion` devuelve el alumno para seleccionarlo), lista de cursos activos, y `Cobro`. Modalidades mensual/clase/semana/medio_mes con tarifa propia (tabla A, cae al mensual si falta), meses adelantados con descuento (tabla B, cruce exacto, repartido entre cuotas), medio mes = factor×días con selección de días y reparto en semanas, fechas de inicio = próximas clases reales, snapshot de precio. Toda la plata se **recalcula en el servidor** (nunca se confía en el navegador). Persistencia (`inscribirYCobrar`): inserta inscripción, genera N cuotas (mensual) con vencimientos, asienta el cobro **por cuota** (efectivo = devengado − desc. adelanto; cobertura = plata + descuento manual) y marca cada cuota pagada/parcial/pendiente; parciales = un cobro contra la inscripción sin cuota. Nav "Gestión → Inscribir y cobrar" gateada por permiso `inscripciones`. **Validado:** helpers puros (precios, descuentos, reparto, medio mes 2/3/6 semanas, fechas) con tests; INSERTs y estados contra Postgres 16 real (cuotas pagada/parcial/pendiente + deuda por alumno correctos); build+lint+tsc OK. Después: Asistencia → Costos/Liquidación básica.

**Suspensión de clase + corrimiento de fin de ciclo** ✅ **construido** (migración `0009` aplicada 2026-09-04). Mecanismo ÚNICO compartido `aplicarCorrimiento`/`revertirCorrimientos`: mueve el `vencimiento` de la **cuota vigente** (mayor periodo) a la próxima fecha del patrón semanal y deja traza en `corrimientos_ciclo` (unique por inscripción+sesión → idempotente). Dos disparadores del mismo efecto: (1) **falta individual tolerada** — `guardarAsistencia` reconcilia: marca ausente a un mensual con tolerancia disponible (faltas del mes, excluyendo esta sesión, < `faltas_toleradas`) → corre; si se cambia a presente o no hay tolerancia → revierte; (2) **suspensión masiva** — `suspenderClase` marca la sesión `suspendida` (col `estado`+`motivo` en `sesiones`), borra asistencias, y corre el fin de ciclo de **todos** los mensuales del curso (tipo `suspension`; **no gasta** la tolerancia personal). `reabrirSesion` revierte todo. Parciales: no se marca asistencia → no consumen → se difieren solos. UI en `/asistencia`: botón "Marcar esta clase como suspendida" (con motivo) y panel de "Clase suspendida" con "Reabrir". Validado en Postgres 16 (corrimiento, unique, revert, check de estado). Nota: el efecto (vencimiento corrido) será plenamente visible con la pantalla de renovación/estado de cuenta. **Pendiente registrado:** catálogo de motivos de suspensión.

**Pedidos futuros (registrados, no urgentes):**
- **Alumnos: fecha de nacimiento y sexo.** Agregar ambos campos a `alumnos` (migración aditiva) y a la ficha `EntidadAlumno` (fecha opcional; sexo desde catálogo para no hardcodear). Surgió de la revisión de uso; se hará más adelante.

**Pendientes de Design (no me bloquean; registro):** #8 correcciones de Login (accent-100 solo informativo + estado "cuenta bloqueada"; el backend ya expone el contrato); #11 correcciones de Vender/Confirmar sesión incluido el selector de grupo.

**Despliegue (producción):** ✅ **en Vercel** — `https://tropicana-app.vercel.app` (proyecto `jgonzalezw1/tropicana-app`, publica desde **`main`**). Variables cargadas en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Usa la **misma base Supabase** que local (mismos usuarios/datos). Login probado OK en la nube. **Flujo de actualización:** el trabajo sigue en la rama `claude/tropicana-app-context-d5zjt8`; en cada avance estable se hace **fast-forward de esa rama a `main`** y Vercel redepliega producción solo. (Si algún día el login fallara en la nube: Supabase → Authentication → URL Configuration → Site URL + Redirect `https://tropicana-app.vercel.app`.)

**Pendientes tuyos (Javier):**
1. **Base de datos de prueba separada (`tropicana-dev`) — pendiente antes de 1B/1C.** Hoy el dev local y la producción usan el **mismo** Supabase (ver *Despliegue*), así que "probar en local" escribe sobre datos de producción. `0010` (sub-hito 1A) es solo esquema, aditiva e idempotente, y ya está **aplicada en producción (2026-09-05)**; pero 1B/1C tienen pantallas y lógica que **escriben datos** y necesitan una base aislada antes de construirse. Propuesta: crear un segundo proyecto Supabase gratis `tropicana-dev`, apuntar `next dev` ahí y correr 0001→0010. `0001→0010` ya aplicadas en producción.
2. Que la usuaria **use y pruebe** todo y anote lo que chirríe.
3. *(Opcional, seguridad)* activar 2FA en tu cuenta de Vercel cuando puedas.

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

## 7. Metodología de release y regla de trabajo (permanentes, pedidas por Javier 2026-09-05)

**Ambientes:** solo dos — **desarrollo local** (donde Code construye y Javier
prueba) y **producción** (Vercel + Supabase, lo usa Natalia). No hay staging en
la nube.

**Flujo de release (obligatorio):**
1. Todo cambio se prueba primero en **local**; pasa a producción **solo con OK
   explícito de Javier**. Nada va directo a producción sin su visto bueno.
2. **Migraciones:** se aplican y prueban primero en la **base local**; solo
   cuando funcionaron, Javier las aplica en **Supabase** (paso manual suyo,
   separado). Nunca una migración en producción sin haberla probado en local.
   (Sigue vigente la regla de sincronización de migraciones de §6.)
3. **Refresh de datos prod→local:** ad-hoc, cuando Javier lo pida (no automático).
   Mecanismo propuesto en `docs/PLAN_CIERRE_ETAPA1_v2_MOTOR.md` §6 (pendiente de
   decisión sobre PII antes de implementar).

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
