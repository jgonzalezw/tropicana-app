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

> Los bloques 0bis, 0quinquies y 0duodecies (septiembre 2026) se archivaron el 2026-10-08 en `docs/archivo/ESTADO-2026-09.md`.

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

### I-005b · Pendientes chicos de I-005 — 2026-10-08

- **Cifra de liquidez** en la simulación (D29) y en el impreso: por profesor y con piso 0, devengo + saldo previo de liquidaciones anteriores + suplentes. Saldo previo cruzado contra SQL en dev. Sin migración.
- **«Retirar…» en la ficha** del profesor (misma condición de permiso que el listado). **`semana`** no se agrega al catálogo: D36 postergada.
- PR #21 en producción; `tsc`, `lint`, `npm test` (338).

### I-006 · Baja de profesor por Retirar (control 48) — 2026-10-08

- **Causa:** «Desactivar» solo apagaba `activo`: dejaba un titular inactivo con la asignación abierta (en producción, Caceres, Angel desde el 14/09, curso Danza Comercial). **Migración 0065 aplicada en dev y en producción (2026-10-08).**
- **Prevención:** triggers en `profesores` (no se inactiva con asignaciones abiertas) y `asignaciones` (no se abre una a un inactivo); `eliminarODesactivarProfesor` y `crearAsignacion` lo validan antes; con cursos a cargo la ficha y el listado ofrecen solo «Retirar…». Regla 25 de negocio.
- **Verificado:** triggers probados en dev en una transacción deshecha (baja con cursos y alta a inactivo se rechazan; tras cerrar la asignación, inactivar pasa). **Producción (2026-10-08):** Caceres, Angel retirado con la pantalla Retirar (corte 14/09, sin sustituto: Danza Comercial espera nuevo profesor). Antes/después contra respaldo: asignación 3 abierta → cerrada 14/09; membresías 25–27 sin cambios; cierre de 3 × Bs. 25 en la liquidación N° 4 (Bs. 75, abierta, por pagar en Caja); control 48: 1 → 0; triggers 0065 activos. Las tablas de respaldo `resp_i006_*` se borraron de producción con OK de Javier (2026-10-08): el rollback ya no tiene respaldo.

### I-007 · Fecha efectiva del retiro en la liquidación — 2026-10-08

- **Pedido de Javier:** la liquidación de retiro no decía hasta cuándo se calculó; esa fecha es la efectiva del retiro. **Migración 0066 aplicada en dev y en producción (2026-10-08).**
- **Cambio:** columna `liquidaciones.retiro_hasta` (null = liquidación normal). `retirar_profesor` la escribe con el mismo corte con que cierra las asignaciones; lo ya retirado se rellena desde el «corte dd/mm» del cierre. Se ve en el comprobante (pantalla e impreso: «Retiro efectivo: hasta el dd/mm/aaaa (último día a cargo)»), en el listado y en el campo de la pantalla Retirar. Control 50 nuevo.
- **Producción (2026-10-08, OK de Javier):** antes, 4 liquidaciones sin la columna; después, N° 1 (Gongora) → 10/09/2026 y N° 4 (Caceres) → 14/09/2026, N° 2 y N° 3 sin fecha; el resto de cada fila idéntico al respaldo; control 50 en 0; `retirar_profesor` ya escribe la fecha. Los respaldos `resp_i007_*` se borraron de producción con OK de Javier (2026-10-08): el rollback ya no tiene respaldo.
- **Verificado en dev:** `tsc`, `lint`, `npm test` (339), relleno de las liquidaciones de retiro, control 50 en 0 y el comprobante N° 5 en pantalla (hasta el 07/10/2026).


### I-010 · Bono de Raquel López (asistencia mal tipeada) — 2026-10-08

- **Causa:** la asistencia de Raquel (membresía 21) se tipeó mal: 14/09 ausente (Lucas, presente) y 16/09 ausente sin licencia (Lucas, con licencia). Con una falta sin licencia el curso no genera bono. Era el último caso de este tipo.
- **Arreglo:** `scripts/corregir_bono_i010.sql` (sin migración, con respaldo `resp_i010_previo` y rollback `scripts/rollback_corregir_bono_i010.sql`): asistencias 121 y 143 igualadas a las de Lucas, bono de 1 clase de la 21 aplicado a la 62 (clases 4 → 5, fin 19/10 → 21/10, igual que la 63) y recuento de la 21 (7 hechas).
- **Producción (2026-10-08, OK de Javier):** antes/después verificado; control 49 en 0 para las membresías 20, 21, 62 y 63; sin comisiones ni liquidaciones afectadas. Probado antes en dev: corrida doble idempotente y rollback sin diferencias. El respaldo `resp_i010_previo` se borró de producción con OK de Javier (2026-10-08). En dev el refresh no copia `membresia_bonos`: el control 49 da 9 allí (membresías ajenas), no en producción.

### I-011 · Retiro con fecha pasada: datos completos y avance al corte — 2026-10-08

- **Pedido de Javier:** al simular el retiro de Oscar Nuñez al 06/10/2026 faltaba información y dos cifras parecían mal (S2). La simulación a fecha futura queda para otro incidente.
- **Causa:** el avance de las membresías inconclusas leía `clases_hechas` (solo presentes): Luz Marina Araujo daba 1 de 8 aunque la clase del 06/10 (falta) era su segunda. El cierre de Yubinca (Bs. 250 a la fecha) ya tenía Bs. 150 en la liquidación N° 3; la línea mostraba solo la diferencia (100).
- **Cambio (sin migración, sin tocar montos):** `avanceAlCorte` (`src/lib/ordinalClase.ts`) comparte regla con `ordinalDeClase` y con Asistencia; `lecturaRetiro` lee cuenta (`cobroPorMembresia` ahora devuelve precio y descuento), bonos de `membresia_bonos` y lo ya devengado con su `liquidacion_id`. La vista y el impreso muestran A la fecha / Ya liquidado / Este cierre, cuenta del alumno, bono aplicado y para renovar, y sigla del criterio. Interruptor para esconder solo la liquidación del que se retira.
- **Un solo catálogo de criterios:** `src/lib/liquidacion/criterios.ts` reemplaza los de Planes, Comprobante y pre-liquidación.
- **Verificado en dev:** `tsc`, `lint`, `npm test` (353), y en pantalla Nuñez al 06/10 (Luz Marina 2 de 8; Yubinca 250 / 150 N° 3 / 100) y Salek (bono +1). Falta la reconfirmación de Javier y el pase.
- **Anotado:** unificar los flujos de cálculo (decisión de Javier sobre D34 pendiente) y `desasignar` con `clases_hechas`.
- **Ajuste de pantalla (2026-10-08):** inconclusas con ciclo en dos líneas, avance en dos líneas, sin Estado y con «con saldo»; el ciclo junto al curso en las líneas de liquidación; columna Bono también en particulares. El bono de ventas anteriores a la 0064 (`aplicado='historico'`, sin `redimido_en_membresia_id`) se lee como el excedente de `clases_plan` sobre el plan (Yubinca: 7/9, +1).

### L-01 · Un solo proceso de liquidación y una sola exposición — 2026-10-08

- **Pedido de Javier:** un solo proceso para todo cálculo de liquidación (el flujo solo cambia el objetivo) y una exposición consistente en formato y contenido en todo flujo. El cierre por retiro sigue como política (D34 punto 4): es un *modo*.
- **Cálculo:** `liquidar(datos, modo)` (`liquidar.ts`) con modos vencido, simulación, retiro y curso; `calcularLiquidacion` reemplaza `calcularPendientes*`; `lecturaAvance.ts` es el avance único (también en desasignar). Comparador antes/después: 0 diferencias en liquidaciones, pre-liquidación, simulación, retiros y cierres. Multicurso: pruebas de unidad (prorrateo, regla 17) y semilla permanente en dev (`scripts/seed_multicurso_dev.sql`).
- **Exposición:** `lineas.ts` (línea estándar), `lecturaContexto.ts` (cuenta, bonos, criterio y ciclo), `formatoLiquidacion.ts`, `TablasLineas.tsx` e `imprimirLineas.ts`. Las usan el retiro, la pre-liquidación y la simulación (pantalla e impreso, ahora apaisado) y el paso previo de Liquidaciones, que abre «Ver qué compone el monto» por profesor. El comprobante mide el avance con la regla de Asistencia, al cierre del período.
- **Retiro:** muestra en la misma tabla las membresías ya liquidadas sin pagar (Ortiz y Fernandez, N° 3) con «Este cierre —»; lo que el cierre dejaría afuera (regla 17, falta de foto de pago) es una traba en «Hay que resolver antes de confirmar», con curso y fechas. Pre-liquidación y Liquidaciones también ponen arriba lo que hay que resolver.
- **Verificado:** `tsc`, `lint`, `npm test` (366), y en pantalla en dev. Semilla de dev: `scripts/seed_liquidacion_pendiente_dev.sql`. Sin migración.
- **Anotado:** escritura única (TS vs RPC `retirar_profesor`) pide migración; el retiro a fecha futura no proyecta clases (incidente de la simulación a fecha futura).
