# Plan — Etapa 1 (Núcleo)

> Documento de planificación versionado. Fuentes: `Vision_Alcance_Requerimientos_v5.3`
> (RF-01–07), handoff de diseño en `docs/design/`, y las decisiones acordadas.
> Creado 2026-08-30 · v2 (D1–D12 + liquidación básica) · **v3 2026-08-31: handoff
> v4 incorporado (ya no hay bloqueante); se suma el workstream App Shell + catálogo
> de permisos y los ganchos de particulares/alquiler/pruebas.** Estado: **aprobado
> en dirección; próximo paso migración 0005.**

---

## 1. Alcance

**Dentro (núcleo RF-01–07 + liquidación básica):**
- **Alumnos** — componente compartido (dup por WhatsApp, tutor/menor, vínculo).
- **Cursos** — precio mensual, patrón de días/horario, **tarifas parciales (A)**,
  **asignación de profesor** con sus tasas de comisión y referido.
- **Precios/paquetes** — tabla A (tarifas parciales por curso) y B (descuento por
  meses adelantados), como datos configurables.
- **Inscribir y cobrar** — pantalla del handoff + paso `Cobro`.
- **Asistencia** — por clase, con reposiciones por tolerancia.
- **Costos fijos** — alta/edición + **devengado mensual prorrateado por frecuencia**.
- **Comisiones devengadas** — por profesor, **sobre lo efectivamente cobrado**, a
  **mes vencido**, con prorrateo de adelantos. Incluye **referido**.
- **Liquidación mensual básica** — devengado por profesor a mes vencido **menos
  pagos hechos**. El **esquema** se diseña para el modelo completo (relevos,
  bonos, particulares, costos de sala) desde ya; la **vista** de esta etapa
  muestra solo lo básico.

**Fuera (etapas posteriores; sólo ganchos de esquema):**
- Liquidación fusionada ampliada (Sección 7), clases particulares, alquiler de
  sala, clases de prueba, inventario/productos, y el **dashboard de Caja**
  (los cobros/pagos **sí se persisten** desde ya).

---

## 2. Principios (rigen todo)

1. **Componentes de entidad compartidos** (patrón `Cobro`): alta/búsqueda/edición
   de cada entidad en un único componente reusado idéntico.
2. **CRUD con eliminación guardada**: sin dependientes → borra; con historial →
   desactiva y la UI explica por qué.
3. **Diferenciación sólo por rol/permiso**, nunca por persona.
4. **Sin valores fijos (no hardcode)**: tarifas, tolerancias, umbrales, factores,
   categorías → parámetro o catálogo.

---

## 3. Arquitectura

- **Componentes de entidad** en `src/components/entidades/`: `EntidadAlumno`,
  `EntidadCurso`, `EntidadProfesor`, `EntidadCostoFijo`, + `Cobro` (ya diseñado).
- **Borrado guardado**: helper `eliminarODesactivar(entidad, id)` que chequea
  dependencias y decide borrar vs. desactivar, devolviendo el motivo para la UI.
- **Snapshot de precios (D9)**: inscripción y cobro guardan el precio/tarifa/%
  aplicado; editar el precio del curso no altera lo ya inscripto.
- **Design system**: la última versión trae `.table-edit` y `.chips` (según
  Design); se usarán al construir las pantallas, desde el handoff.

---

## 4. Modelo de datos (propuesto)

> Migraciones **aditivas** desde `0005`. Todas: `id`, timestamps, `activo` donde
> aplique, RLS, índices por FK.

### 4.1 Profesores  *(pantalla vía handoff de Design)*
```
profesores(id, nombre, apellido, whatsapp, activo)
```

### 4.2 Alumnos
```
alumnos(id, nombre, apellido,
        whatsapp text,                 -- id de adultos (único, es_menor=false)
        es_menor boolean default false,
        tutor_alumno_id → alumnos.id null,    -- tutor que ES un alumno existente
        tutor_nombre text null, tutor_whatsapp text null,
        referido_por_alumno_id → alumnos.id null,  -- gancho referido (D3)
        canal_captacion → catalogo_valores,
        activo boolean default true)
```
- **Adulto**: único por `whatsapp` (índice único parcial `where es_menor=false`).
- **Menor (D6)**: único por `(tutor_whatsapp, lower(nombre))` (índice parcial
  `where es_menor=true`). Identificador compuesto = WhatsApp del tutor + nombre
  del menor (sin apellido).
- **Tutor = alumno**: si el WhatsApp del tutor coincide con un alumno, se ofrece
  vincular (`tutor_alumno_id`) en vez de duplicar.

### 4.3 Cursos + tarifas (A) + asignación de profesor
```
cursos(id, nombre, linea text, nivel text,
       dias_semana int[],        -- 1=lun … 7=dom
       hora time, precio_mensual numeric, activo)

curso_tarifas(curso_id, modalidad, precio, unique(curso_id, modalidad))
       -- modalidad ∈ {'clase','semana','medio_mes'}; sin fila → cae a mensual

asignaciones(id, curso_id → cursos.id, profesor_id → profesores.id,
             comision_tasa numeric,     -- congelada al asignar (D3)
             referido_tasa numeric,     -- congelada al asignar (D3)
             vigencia_desde date, vigencia_hasta date null,  -- soporta relevos
             activo boolean)
```
- El **profesor vigente** de un curso = asignación activa. `asignaciones` es la
  **fuente** de las tasas de comisión/referido, **congeladas** al asignar (los
  cambios futuros no reescriben lo ya devengado). Soporta **relevos** (varias
  asignaciones en el tiempo).

### 4.4 Descuento por meses adelantados (B)
```
descuentos_adelanto(meses int primary key, porcentaje numeric)  -- ej: 2:5,3:10,6:15
```
Cruce por cantidad **exacta**; sin interpolar; redondeo a bolivianos enteros.

### 4.5 Inscripciones
```
inscripciones(id, alumno_id, curso_id,
              modalidad text,          -- 'mensual'|'clase'|'semana'|'medio_mes'
              fecha_inicio date, estado text,   -- 'activa'|'baja'
              -- parcial = paquete de clases (D1/D2):
              clases_total int null,   -- clase=1; semana=#dias; medio_mes=factor×#dias
              dias_elegidos int[] null,-- subconjunto de dias_semana
              precio_aplicado numeric, -- snapshot (D9)
              creado_en, actualizado_en)
```
- **Paquetes parciales se consumen por asistencia (D1)**. `clases_consumidas` se
  **deriva** de las asistencias `presente` de esa inscripción (no columna que se
  pueda desincronizar).
- **Una semana (D2)** = una repetición del patrón semanal = `#dias_semana` clases
  (Lu-Mi-Vi → 3). **Medio mes** = `medio_mes_factor × #dias_semana` (default 2).
  Ambos con **precio único por curso** (tabla A). Menos días tildados ⇒ más
  semanas para consumir el paquete.
- **Renovación mensual manual (D4)**, nunca automática.

### 4.6 Cuotas (devengado mensual)
```
cuotas(id, inscripcion_id, periodo date, monto_devengado numeric,
       descuento_adelanto numeric default 0,   -- parte de tabla B que le toca
       vencimiento date, estado text)          -- 'pendiente'|'parcial'|'pagada'
```
- Mensual: 1 cuota/período. **Multi-mes adelantado (D5)**: **N cuotas** (una por
  mes calendario) con el **descuento de tabla B distribuido** entre ellas, para
  que cada mes cargue su parte (y el prorrateo de comisión funcione).
- Modalidades parciales: **no** generan cuota (cobro único).
- **Renovación (D4)**: un clic genera la cuota del mes siguiente con su nuevo
  vencimiento.

### 4.7 Clases, asistencia, reposiciones (D10)
```
clases(id, curso_id, fecha date, hora time, estado text)
asistencias(id, clase_id, alumno_id, estado text,        -- 'presente'|'ausente'
            inscripcion_id → inscripciones.id null,       -- consumo de paquete
            genera_reposicion boolean default false)
reposiciones(id, alumno_id, curso_id, origen_asistencia_id, estado text)
```
- **Enfoque (D10):** las `clases` se **persisten al tomar asistencia** de una
  fecha (se crea la sesión si no existe), y el patrón del curso alimenta la lista
  de próximas fechas en la UI. Así se **cuentan las clases consumidas** de un
  paquete hoy (asistencias `presente` por inscripción) y queda lugar para
  **suspensión/reposición** más adelante sin pre-generar un calendario infinito.
- Tolerancia configurable (`tolerancia_faltas`); reposición por cada ausente con
  tolerancia restante.

### 4.8 Cobros / pagos (ledger del paso `Cobro`)
```
pagos(id, tipo text,              -- 'cobro'|'pago'
      motivo text,                -- bucket extensible ('inscripcion','cuota',…)
      alumno_id null, profesor_id null, costo_fijo_id null,   -- sujeto
      inscripcion_id null, cuota_id null,                     -- referencia
      monto numeric, medio text,
      descuento numeric default 0, descuento_motivo text null,
      ajuste numeric default 0, ajuste_motivo text null,
      glosa text, fecha timestamptz, registrado_por → perfiles.id)
```
- Libro de movimientos que persiste `Cobro`. Un `pago` con `profesor_id` y
  `tipo='pago'` es un **pago a profesor** que descuenta su liquidación.

### 4.9 Costos fijos + devengado (D7)
```
costos_fijos(id, nombre, monto numeric,
             frecuencia text,     -- 'mensual'|'trimestral'|'anual'|'unico'
             mes_imputacion date null,   -- para 'unico'
             activo)
costo_fijo_devengos(id, costo_fijo_id, periodo date, monto numeric)
```
- **Devengado mensual automático, prorrateado por frecuencia**: mensual = monto;
  trimestral = monto÷3; anual = monto÷12; **único** = monto completo sólo en su
  mes de imputación.

### 4.10 Comisiones devengadas + liquidación (esquema completo, vista básica)
```
comisiones_devengadas(id, profesor_id, asignacion_id,
                      pago_id → pagos.id,        -- se devenga sobre lo COBRADO (D3)
                      cuota_id null, periodo date,   -- mes vencido imputado
                      tipo text,                 -- 'comision'|'referido'
                      base numeric, tasa numeric, monto numeric)

liquidaciones(id, profesor_id, periodo date, estado text,   -- 'abierta'|'cerrada'|'pagada'
              total_devengado numeric, total_pagado numeric, neto numeric)

liquidacion_items(id, liquidacion_id, tipo text,   -- 'comision'|'referido'|'relevo'|
                  -- 'bono'|'particular'|'costo_sala'|'ajuste'|'pago'  (completo)
                  referencia_id null, signo int, monto numeric)
```
- **Devengado (D3):** sobre lo **efectivamente cobrado** (a partir de `pagos` que
  liquidan cuotas), a **mes vencido**, con **prorrateo** cuando un cobro cubrió
  varios meses adelantados (cada cuota lleva su parte → cada mes su comisión).
  Tasa **congelada** desde la `asignacion`. Se agrega **referido** con su tasa.
- **Liquidación básica (Etapa 1):** `neto = Σ devengado del período − Σ pagos al
  profesor`. La vista muestra sólo comisión + referido − pagos. El **esquema**
  (`liquidacion_items.tipo`) ya contempla relevos, bonos, particulares y costos
  de sala para la liquidación ampliada posterior.
- Rezago a mes vencido: parámetro existente `rezago_liquidacion_meses` (default 1).

---

## 5. Reglas de negocio (Etapa 1)

- **Medio mes** = paquete fijo `factor × #dias_semana`, precio único; se consume
  por asistencia; menos días ⇒ más semanas. **Una semana** = `#dias_semana`.
- **Parcial** con tarifa propia (A); curso sin tarifa → mensual.
- **Multi-mes adelantado**: N cuotas con descuento (B) distribuido.
- **Renovación mensual manual**; un clic genera la cuota siguiente.
- **Cobro** = paso compartido; descuentos automático (B) y manual (con motivo)
  independientes.
- **Comisión** sobre lo cobrado, a mes vencido, prorrateada, tasa congelada por
  asignación; **referido** análogo. **Liquidación básica** = devengado − pagos.
- **Costos fijos** devengados y prorrateados por frecuencia.

---

## 6. Parámetros y catálogos

| Clave / tabla | Tipo | Default | Uso |
| --- | --- | --- | --- |
| `medio_mes_factor` | numero | 2 | Multiplicador del paquete medio mes (D8). |
| `descuentos_adelanto` | tabla | 2:5,3:10,6:15 | Tabla B. |
| `rezago_liquidacion_meses` | numero (existe) | 1 | Mes vencido de la liquidación. |
| `mayoria_edad` (existe) | numero | 18 | Detección de menor. |
| `tolerancia_faltas` (existe) | numero | 1 | Reposiciones. |

Las **tasas de comisión/referido no son parámetro global**: viven por
**asignación** (congeladas). Catálogo reutilizado: `canal_captacion`.

---

## 7. Pantallas y orden de construcción

1. **Profesores** (desde handoff `Profesores.dc.html` / `Profesor.dc.html`).
2. **Cursos** (+ tarifas A + asignación de profesor con sus tasas + config B).
3. **Alumnos** (componente compartido).
4. **Inscribir y cobrar** (monta Alumno + Curso + `Cobro`).
5. **Asistencia** (clases + marcas + reposiciones).
6. **Costos fijos** + **Comisiones/Liquidación básica**.

Gateo por permisos existentes (`alumnos`, `profesores`, `cursos`,
`inscripciones`, `asistencia`, `costos`, `comisiones`, `pagos`).

---

## 8. Decisiones resueltas (D1–D12)

- **D1** Paquetes parciales se consumen **por asistencia**.
- **D2** "Una semana" = `#dias_semana` clases (repetición del patrón), no 7 días.
- **D3** Comisión **por asignación (profesor×curso)**, congelada; sobre lo
  **cobrado**, a **mes vencido**, prorrateada por adelantos; **referido** en la
  misma asignación.
- **D4** Renovación manual: un clic genera la cuota del mes siguiente.
- **D5** Adelanto = **N cuotas** (una por mes) con descuento (B) distribuido.
- **D6** Menor único = `(tutor_whatsapp, nombre)`.
- **D7** Costos fijos: devengado mensual automático prorrateado por frecuencia
  (mensual / trimestral ÷3 / anual ÷12 / único en su mes).
- **D8** `medio_mes_factor` configurable, default 2.
- **D9** Snapshot de precios confirmado.
- **D10** Clases persistidas al tomar asistencia; consumo de paquete por
  asistencias `presente`; deja lugar a suspensión/reposición.
- **D11** Profesores se construye **desde el handoff** (no CRUD provisorio).
- **D12** Precios y Paquetes: para el esquema alcanzan A y B; handoff de
  referencia.

---

## 9. Plan de migraciones (aditivo, desde 0005)

- **0005** — `profesores`, `alumnos`, `cursos`, `curso_tarifas`, `asignaciones`,
  `descuentos_adelanto` + parámetros nuevos + permisos base.
- **0006** — `inscripciones`, `cuotas`, `clases`, `asistencias`, `reposiciones`.
- **0007** — `pagos`, `costos_fijos`, `costo_fijo_devengos`,
  `comisiones_devengadas`, `liquidaciones`, `liquidacion_items`.

---

## 10. Riesgos / dependencias

- **Login (Design):** contrato `iniciarSesion` listo; enchufar cuando llegue.
- **Migraciones en producción:** aditivas y revisadas antes de aplicar.

---

## 11. Handoff incorporado (v3) + ajustes al plan

El handoff v4 ya está en `docs/design/` (11 pantallas/componentes + design system
con `.table-edit`/`.chips`). Se levantó el bloqueante anterior. Ajustes que trae:

- **App Shell + catálogo de permisos (workstream nuevo).** La nav se arma por
  permisos discretos (grupo/pantalla), registrados en un catálogo asignable a
  roles — no por rol cableado. Hoy Etapa 0 tiene la matriz `rol_permisos`
  (módulo×acción) configurable, pero los módulos están hardcodeados en
  `src/lib/tipos.ts` y la barra lateral usa flags fijos. Propuesta: hito propio
  **App Shell + catálogo de permisos** justo después de `0005` (toda pantalla
  nueva se monta en el shell). Es una **decisión de negocio abierta** (alcance) —
  ver `docs/ESTADO.md` §5.A.
- **Ganchos de fase 2 en el esquema** (no se construyen pantallas ahora):
  Tarifas de Sala (Categoría × Tamaño × Horas) como fuente única del costo de
  sala; paquetes de clases particulares (individual/pareja/grupo ≤16) que al
  venderse crean el paquete de uso de sala del profesor; clases de prueba
  (precio por alumno por curso) que entran a asistencia y suman comisión. El
  modelo de **sala** nace para varias (reserva fecha+hora+duración).
- **Liquidación:** los ítems leen el % de la **asignación que cubrió el período**
  (filas inmutables `desde/hasta`), nunca la asignación actual.
