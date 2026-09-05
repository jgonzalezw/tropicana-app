# Tropicana — Cierre de Etapa 1 v2, bajo el Motor de Planes y Membresías

> Creado 2026-09-05 (paso 0, reencuadre). Fuente: "Diseño del Motor de Planes y
> Membresías" v1.3 (complementa Requerimientos v5.3). **Supersede** a
> `docs/PLAN_ETAPA1_CIERRE.md` (v1, modelo viejo de inscripción-a-curso).
> **Estado: plan para validar. NO construir hasta OK explícito de Javier.**

## 0. Confirmación de entendimiento (paso 0)
Entendí el modelo:
- **Plan** = unidad de configuración (acceso, contador, vigencia, renovación,
  tolerancia, **criterio de liquidación**, cupo, uso de sala, tarifa, duración).
- **Membresía** = lo vendido (instancia de un plan) con inicio, vigencia y
  **contadores** que se consumen; **única entidad que genera movimientos**.
- **Calendario de la membresía** = las clases que el alumno arma eligiendo días
  de las grillas de los cursos/estilos a los que el plan da acceso; base de
  tolerancia, consumo y corrimientos.
- **Sesión** = un uso concreto (fecha/hora/duración) que ocupa sala y descuenta
  contador. En curso/taller la franja se deriva del calendario; en
  **particular/alquiler** la franja se define **al confirmar la sesión**.
- Los **5 tipos** (curso regular, taller, particular, alquiler, prueba) son la
  **misma estructura** con distintos valores (sección 2.2), sin código nuevo por
  tipo.
- **3.6 — Ocupación de sala:** por **calendario** (curso/taller, horario conocido
  al vender) vs. por **sesión con horario** (particular/alquiler, horario al
  confirmar). **CONFIRMAR** sesión realizada (registrar + liquidar) es Etapa 1;
  **RESERVAR** con disponibilidad/choques es Etapa 2. Con una sala y control
  manual, se opera sin reserva preventiva.
- **6 — Notificaciones:** esquema desacoplado de 3 piezas (eventos / reglas
  configurables / plantillas), con escalonamiento: ahora **documentos + envío
  manual asistido**; automático por WhatsApp API, después.
- **Liquidación configurable por plan** (3.5): 4 criterios — (1) % sobre
  membresía cobrada y completada, (2) proporcional a clases entregadas, (3)
  tarifa por clase realizada, (4) pago inmediato por sesión neto de sala
  (externo).

## 1. Mapa de impacto — contrastado con el repo (evidencia)
Tablas existentes hoy (migraciones 0001–0009): `perfiles, roles, rol_permisos,
parametros, catalogos, catalogo_valores, temas` (Etapa 0) · `profesores,
alumnos, cursos, curso_tarifas, asignaciones, descuentos_adelanto` (0005) ·
`inscripciones, cuotas, pagos` (0006) · `sesiones, asistencias` (0007) ·
`corrimientos_ciclo` (0009). Pantallas: `alumnos, cursos, profesores, inscribir,
asistencia, administracion`. Componentes: `EntidadAlumno/Curso/Profesor`,
`Cobro`.

| Pieza en el repo | Clasificación | Detalle bajo el motor |
| --- | --- | --- |
| `inscripciones` (modalidad, `precio_aplicado`, `dias_elegidos`) | **Se generaliza** | Es la **membresía de tipo curso regular** (versión mínima: 1 curso, calendario = clases del curso). Las modalidades (mensual/clase/semana/medio_mes) pasan a ser **planes**. No hace falta renombrar la tabla ahora; se generaliza por capas. |
| `cuotas` + `pagos` (paso `Cobro`) | **Se conserva** | Ya es la capa financiera única. No se rehace. |
| `asistencias` + `corrimientos_ciclo` | **Se conserva** | Ya es "registrar sesión que descuenta contador y corre fechas". Pasará a operar sobre el **calendario de la membresía** (hoy opera sobre el curso, que es el caso mínimo). |
| Suspensión de clase (`suspenderClase`/`aplicarCorrimiento`) | **Se conserva** | Disparador masivo del corrimiento; se reutiliza. |
| `asignaciones` (`pct_ingresos`/`pct_referido` congelados, `desde/hasta`) | **Se conserva/extiende** | Sirve para el **criterio (1)**. Falta agregar el **criterio de liquidación por plan** y soporte de criterios 2/3/4. |
| `cursos` (`dias_semana`, `hora`) | **Se amplía** | Ya tiene `hora` (inicio). Falta **`duracion_min`** (prerrequisito de la agenda, paso 5). |
| `profesores`, `alumnos` (+ componentes) | **Se conserva** | Sin cambios de fondo (sí alineación a estándares, paso 6). |
| `sesiones` (curso+fecha, estado dictada/suspendida) | **Se conserva/extiende** | Hoy es la sesión de curso por calendario. Para particular/alquiler se agrega **sesión con horario** (hora inicio + duración, saldo). |
| **Sala** | **Nuevo** | Entidad de primera clase (previendo varias salas/sedes) + agenda. |
| **Plan** | **Nuevo** | Entidad de configuración (atributos sección 2). |
| **Calendario de membresía** | **Nuevo** | Clases elegidas por el alumno (multi-curso). El caso 1-curso ya está implícito en `inscripciones.dias_elegidos`. |
| **Cupo por clase** | **Nuevo (atributo)** | Se modela desde ya; la reserva contra disponibilidad es Etapa 2. |
| **Notificaciones/documentos** | **Nuevo** | Capa desacoplada (sección 6). |

**Conclusión:** el reencuadre es sobre todo **conceptual**; la capa financiera,
asistencia y suspensión se conservan; lo nuevo real es plan, calendario de
membresía, sesión con horario, sala/agenda, cupo y notificaciones.

## 2. Secuencia priorizada del cierre (sección 9 del documento)
- **Paso 0 — Reencuadre (este documento).** No se construye.
- **Paso 1 — Liquidación a profesores** bajo el modelo nuevo, con **criterio de
  liquidación configurable** (ver §3). *Urgencia real.*
- **Paso 2 — Venta de particulares/alquiler + confirmar sesión con horario (sin
  reserva) + renovación + estado de cuenta del alumno.**
- **Paso 3 — App Shell (armazón + visual ya diseñado) + Dashboard operativo como
  inicio. Sin permisos granulares.**
- **Paso 4 — Costos fijos** (cierra lo financiero).
- **Paso 5 — Agenda de sala** (+ `duracion_min` en cursos).
- **Paso 6 — Pasada de alineación a estándares** (sección 5) del resto.
- *Etapa 2 (después):* reserva/disponibilidad de sala, permisos granulares,
  notificación automática, clases ilimitadas, inventario.

Se construye **un paso a la vez**, cada uno cerrado (probado en local +
versionado + `ESTADO.md`) antes del siguiente.

## 3. Qué cambia en el bloque de liquidación (Paso 1) por el modelo nuevo
El Hito 1 v1 calculaba la comisión con **un solo criterio** (% sobre lo cobrado,
leído de `asignaciones`). Bajo el motor, la liquidación es **por criterio, y el
criterio lo define el plan**. Cambios concretos para construir ya:

1. **El cálculo se vuelve "criterio-driven":** el liquidador resuelve el monto
   según el `criterio_liquidacion` que aplica a cada membresía/plan, no un único
   camino. Criterios de Etapa 1: (1) % sobre membresía cobrada y completada; (2)
   proporcional a clases entregadas; (3) tarifa por clase realizada; (4) pago
   inmediato por sesión neto de sala (externo). Comisión por **referido**
   (RF-02.2/RF-07.2, ya definida) y **costo de sala** entran como items.
2. **De dónde sale el criterio hoy:** como el motor de planes completo aún no
   existe, hay que decidir **dónde vive el criterio en el Paso 1** (ver decisión
   D1). Lo ya vendido (`inscripciones` de curso regular) corresponde al **criterio
   (1)**; el externo/particular necesita (3)/(4) cuando exista su venta (Paso 2).
3. **Tablas de liquidación diseñadas membership-aware:** `comisiones_devengadas`,
   `liquidaciones`, `liquidacion_items` referencian la **membresía** (hoy =
   `inscripciones`) y el **criterio** aplicado, para no rehacerlas cuando llegue
   la venta de particular/alquiler (Paso 2).
4. **Base "lo cobrado"** sigue leyéndose de `pagos`/`cuotas` (se conserva).
5. **Mes vencido / prorrateo / tasa congelada:** se mantienen como reglas del
   criterio (1)/(2).

## 3bis. Dónde queda la toma de asistencia (aclaración 2026-09-05)
"Tomar asistencia" = **registrar la sesión que descuenta contador y corre
fechas** sobre el calendario de la membresía. Aplica a lo que ocupa sala **por
calendario**: **cursos regulares y talleres**. En **particular/alquiler** la
asistencia va **implícita en "confirmar sesión"** (Paso 2). La **clase de
prueba** se marca dentro de la lista de asistencia de la sesión del curso. →
La pantalla de asistencia actual **se conserva** para cursos regulares y se
reutiliza para talleres; no se duplica para el resto.

## 4. Decisiones — RESUELTAS (2026-09-05)
- **D1 = (a):** introducir ya una tabla mínima `planes` con sus atributos clave
  (incluido `criterio_liquidacion`) y **mapear las modalidades actuales a
  planes**. `inscripciones` gana `plan_id` (= membresía de tipo curso regular).
- **D2 (criterio 1, cursos regulares):** la comisión se paga **al cerrar el
  período en que se completan el pago Y las clases** (membresía cobrada +
  completada), no simplemente a mes vencido sobre lo cobrado.
- **D3 (referido):** se deja como **item gancho** en el Paso 1 (no se calcula
  todavía; persiste la brecha de modelo referido_por-alumno vs. profesor).
- **D4 (periodicidad de liquidación):** **parámetro general** `periodicidad_liquidacion`
  con valores **`semana` (semana vencida) · `mes` (mes vencido) · `membresia`
  (al completarse)**. Define cada cuánto se corre/cierra la liquidación en la
  academia; aplica a todos los criterios.
- **D5 (refresh PII) = (a):** copiar los datos **tal cual** (incluye WhatsApp,
  nombres, emails) a la base local. *Nota: la copia local contendrá datos
  personales; mantenerla solo en la máquina local, no compartirla.* El esquema
  `auth` de Supabase (credenciales/hashes) no se copia.

### "Completada" — DEFINIDO (2026-09-05, refina D2)
- **Terminología: "Plan Regular"** (no "Plan Mensual").
- El contador cuenta **clases del plan sobre el calendario del curso, en los días
  elegidos por el alumno al inscribirse**. Ej.: plan de **8 clases, 2/semana**.
- Una membresía está **completada cuando se realiza su última clase** dentro del
  calendario, **incluyendo el traslado de clases suspendidas por la academia**
  (una suspensión corre la clase; la membresía completa cuando se dictó la N-ésima
  clase efectiva). Es **por conteo de clases realizadas = N del plan**, no por
  fecha de fin de ciclo.
- **Bono de tolerancia:** si hubo falta con licencia, se **anota** para usarse
  como **primera clase de la siguiente membresía** si se **renueva con
  continuidad**. Entonces la nueva membresía tendría **1 (bono) + N (plan)**
  clases (ej.: 1 + 8 = 9).
- **Criterio (1) de liquidación:** la comisión se devenga/paga cuando la
  membresía está **cobrada (saldo 0) Y completada (N clases realizadas, con
  corrimientos)**.

### IMPLICACIÓN / CONFLICTO CON EL REPO (a resolver antes de construir el Paso 1)
Hoy el "curso regular" está modelado como **mensual continuo con cuotas por mes**
(`inscripciones.modalidad='mensual'` → `cuotas` una por mes). La definición nueva
lo modela como **plan de N clases con calendario personal y contador de clases
realizadas**. Son dos cosas distintas:
- El **período** deja de ser "un mes" y pasa a ser "N clases" (un ciclo del plan).
- **"Completada"** exige contar clases realizadas con corrimientos → requiere el
  **calendario de la membresía + contador** (esto es el "Motor base" de la sección
  8, que el doc ubica en Etapa 1) — **más grande que una liquidación de solo
  lectura** sobre `pagos`.
- Afecta datos ya cargados en producción (las inscripciones mensuales de prueba
  de Natalia): habría que **recrearlas como planes de N clases** o migrarlas.

Por eso el **Paso 1 real** ya no es "leer pagos + %"; para liquidar el criterio (1)
tal como quedó definido, el Paso 1 debe incluir el **motor base del Plan Regular**
(plan con N clases, calendario del alumno, contador de clases realizadas con
corrimientos, detección de "completada", y el bono que salta a la renovación).

### Preguntas de alcance para dimensionar el Paso 1 (necesito tu decisión)
- **P1 — Cobro del Plan Regular:** ¿el plan de N clases se **cobra por ciclo**
  (un cobro por las N clases, como paquete renovable) o se sigue **cobrando por
  mes**? Esto define si `cuotas` pasa a ser "una por ciclo" o sigue mensual.
- **P2 — Datos de producción actuales:** las inscripciones mensuales que ya
  existen, ¿son **de prueba y se pueden recrear** como planes de N clases (camino
  limpio), o hay que **migrar** datos reales que Natalia ya usa?
- **P3 — Alcance del Paso 1:** ¿construimos el **motor base del Plan Regular +
  liquidación criterio (1)** juntos (fiel, más grande) — **recomendado** —, o
  querés una **liquidación puente** más simple para pagar ya, y el motor base
  después (riesgo: liquidar con un criterio distinto al definido)?

## 4bis. (Decisiones originales, para trazabilidad)
- **D1 — ¿Dónde vive el `criterio_liquidacion` en el Paso 1?** Opciones:
  (a) introducir ya una tabla mínima `planes` con sus atributos clave (incluido
  el criterio) y **mapear las modalidades actuales a planes** (más fiel al motor,
  algo más de trabajo ahora); o (b) poner el criterio como atributo en un lugar
  intermedio (p. ej. por `asignacion`/`curso`) y migrar a `planes` en el Paso 2.
  **Recomiendo (a)**: alinea desde el inicio y evita retrabajo, sin construir aún
  la venta multi-curso.
- **D2 — Reglas del criterio (1)/(2):** prorrateo mes a mes, base = cuotas +
  parciales + prueba, mes vencido (`rezago_liquidacion_meses`=1). ¿Confirmás?
- **D3 — Referido:** ya definido (lo cobra el profesor que refirió). Persiste la
  **brecha de modelo** (`referido_por` apunta a alumno, no a profesor; y cuál
  `pct_referido` aplica). Hay que resolverla para calcular el referido, o dejar
  ese **item** como gancho en el Paso 1 y activarlo cuando se resuelva.
- **D4 — "Membresía cobrada y completada" (criterio 1):** ¿la comisión se
  devenga al **completar** la membresía, o a mes vencido sobre lo cobrado del
  período (como venía)? El texto del criterio (1) dice "cobrada y completada".
  Necesito tu precisión (impacta cuándo se paga).

## 5. Metodología de release (adoptada — ver `ESTADO.md` §7)
Dos ambientes: **local** (build + pruebas de Javier) y **producción** (Vercel +
Supabase, lo usa Natalia). Todo se prueba en local; pasa a producción solo con
OK explícito. Migraciones: primero en local, y solo tras el OK, Javier las aplica
en Supabase (paso manual suyo). Refresh de datos prod→local: ad-hoc, cuando
Javier lo pida.

## 6. Mecanismo de refresh prod→local (PROPUESTA — no implementado aún)
Objetivo: traer una copia de datos de producción (Supabase) al Postgres local,
**sin afectar producción** (solo lectura sobre prod). Corre en la máquina de
Javier (yo no tengo acceso ni a su Supabase ni a su disco).

**Propuesta técnica:** un script `scripts/refresh-local.sh` que:
1. Lee la cadena de conexión de producción desde una variable de entorno local
   (`SUPABASE_DB_URL`), **nunca** escrita en el repo ni pegada en el chat.
2. `pg_dump` **solo del esquema `public`**, en dos partes: estructura (para
   validar contra migraciones) y datos, excluyendo tablas/entornos que no
   correspondan.
3. Restaura en la base local (la que ya uso para validar migraciones).
4. Es **solo lectura** sobre producción (pg_dump no modifica origen).

**Decisión que necesito antes de implementarlo (datos sensibles / PII):** las
tablas traen datos personales — `alumnos`/`profesores` (WhatsApp, nombres),
`perfiles` (email). ¿Cómo copiamos?
- (a) **Tal cual** (incluye PII): más fiel para depurar, pero PII en local.
- (b) **Anonimizado** (enmascarar WhatsApp/email/nombres al restaurar): más
  seguro; recomendado.
- (c) **Solo tablas operativas no sensibles** (cursos, planes, pagos con sujeto
  anonimizado): mínimo PII.
Además: el esquema `auth` de Supabase (hashes/credenciales) **no se copia**.
**Recomiendo (b).** Decime (a/b/c) y qué campos considerás sensibles, y lo
implemento (con instrucciones en lenguaje claro).

## 7. Paso 1 concreto — Liquidación (para construir tras el OK final)
**Migración `0010_motor_planes_liquidacion` (local primero):**
- `planes` (motor, atributos clave sección 2): `id, nombre, tipo_servicio
  ('curso_regular'|'taller'|'particular'|'alquiler'|'prueba'), criterio_liquidacion
  (1|2|3|4), activo, …` (los atributos de acceso/contador/vigencia se completan
  en pasos siguientes; en el Paso 1 se usa lo mínimo para liquidar curso regular).
- **Seed:** un plan por cada modalidad actual de curso regular, y
  `inscripciones += plan_id` (backfill de las existentes al plan que corresponde).
- `comisiones_devengadas (id, profesor_id, plan_id, membresia_id[=inscripcion_id],
  periodo, criterio, base, tipo['comision'|'referido'], monto, origen, creado_en)`.
- `liquidaciones (id, profesor_id, periodo, periodicidad, estado
  'abierta'|'cerrada'|'pagada', total_devengado, total_pagado, neto)` +
  `liquidacion_items`.
- **Parámetros:** `periodicidad_liquidacion` (`semana`|`mes`|`membresia`, default
  `mes`) y se conserva `rezago_liquidacion_meses`.
- RLS igual al resto (lectura autenticados; escritura service_role tras permiso).

**Cálculo (criterio-driven; Paso 1 implementa criterio 1 para curso regular):**
- Criterio (1): base = lo cobrado del período de la membresía; % = `pct_ingresos`
  congelado de la asignación vigente; **devenga cuando el período está cobrado
  (saldo 0) y completado (fin de ciclo pasó)** — según definición a confirmar en §4.
- `referido`: item gancho (no calcula aún).
- La liquidación se corre/cierra según `periodicidad_liquidacion`.

**Pantalla:** "Profesores → Liquidaciones": elegir profesor + período; ver
devengado (items), pagos ya hechos y **neto**; registrar pago al profesor
(reusa `Cobro` en dirección pago). Permiso `comisiones`.

**Flujo de release del Paso 1:** construyo en la rama; **vos lo probás en local**
(incluida la migración en tu Postgres local); con tu OK, aplicás `0010` en
Supabase y pasa a producción.

## 8. Próximos pasos
1. Confirmás el **punto abierto menor** de §4 (definición de "completada").
2. Con ese OK, construyo el **Paso 1** en la rama de trabajo y te aviso para que
   lo pruebes en local (migración + pantalla). Nada a producción sin tu visto bueno.
3. Cuando quieras el **refresh**, lo implemento con la opción **(a)** ya elegida.
