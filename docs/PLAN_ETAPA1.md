# Plan — Etapa 1 (Núcleo)

> Documento de planificación para revisión. **No se escribe código hasta que
> este plan esté aprobado.** Fuentes: `Tropicana_Vision_Alcance_Requerimientos_v5.3`
> (RF-01–07), handoff de diseño en `docs/design/` (Inscribir y cobrar, Tomar
> asistencia, Caja, paso `Cobro`, tokens) y las reglas del pedido de Etapa 1.
> Creado: **2026-08-30**. Estado: **borrador para aprobar**.

---

## 1. Alcance

**Dentro (RF-01–07, núcleo):**
- **Alumnos** — alta/búsqueda/edición como componente compartido (duplicados por
  WhatsApp, tutor para menores, identificador compuesto, tutor que puede ser un
  alumno existente).
- **Cursos** — alta/edición con precio mensual, patrón de días/horario, profesor,
  **tarifas parciales (tabla A)**.
- **Precios/paquetes** — tabla A (tarifas parciales por curso) y tabla B
  (descuento por meses adelantados) como datos configurables.
- **Inscribir y cobrar** — pantalla del handoff, con el paso `Cobro` compartido.
- **Asistencia** — tomar asistencia por clase, con reposiciones por tolerancia.
- **Costos fijos** — alta/edición y **devengado** mensual.
- **Devengado de comisiones** — acumulación (no liquidación).

**Fuera (etapas posteriores; sólo dejar ganchos en el esquema):**
- Liquidación mensual completa (Sección 7), clases particulares, alquiler de
  sala, clases de prueba, inventario/productos, y el **dashboard de Caja**
  (aunque los **cobros/pagos sí se persisten** desde ya — la pantalla de Caja
  los leerá después).

**Coordinación con Claude Design:**
- **Profesores** lo diseña Design (handoff aparte). No se construye la pantalla
  ahora. Pero **cursos necesita un profesor** como FK → se define la **tabla**
  `profesores` desde ya y un **CRUD mínimo provisorio** (ver Decisión D11).
- **Precios y Paquetes**: el pedido dice que ya está diseñado por Design, pero
  **no hay un handoff dedicado en el repo** todavía. El esquema contempla A y B
  desde ya; si llega un handoff propio, se ajusta la UI sobre el mismo esquema.

---

## 2. Principios que rige todo lo que se construya

1. **Componentes de entidad compartidos.** Para cada entidad (alumno, profesor,
   curso, costo fijo…) la creación/búsqueda/edición vive en **un único
   componente** reusado idéntico en toda pantalla donde participe — mismo patrón
   que `Cobro`. Una mejora se hace en ese único lugar.
2. **CRUD con eliminación guardada.** Crear, editar y eliminar. Sin dependientes
   → se elimina de verdad; con historial (pagos, inscripciones, asistencias,
   liquidaciones, movimientos, ventas) → **no se elimina, se desactiva**
   conservando el histórico, y la UI explica por qué.
3. **Diferenciación sólo por rol/permiso**, nunca por persona. Sin nombres
   cableados. El rol es un conjunto de permisos.
4. **Sin valores fijos (no hardcode).** Tarifas, tolerancias, umbrales,
   categorías, factores → parámetro o catálogo configurable.

---

## 3. Arquitectura

### 3.1 Componentes de entidad compartidos
Ubicación propuesta: `src/components/entidades/`. Cada uno expone un
**buscador + alta + edición** autocontenido, parametrizable por props, y con las
**server actions** de esa entidad. Pantallas que lo usan lo montan; no
reimplementan nada.

| Componente | Reusado en |
| --- | --- |
| `EntidadAlumno` (buscar/alta/editar, dup por WhatsApp, tutor/menor) | Alumnos, Inscribir y cobrar |
| `EntidadCurso` (buscar/alta/editar, tarifas A) | Cursos, Inscribir y cobrar |
| `EntidadProfesor` (mínimo provisorio) | Cursos, (Profesores cuando llegue Design) |
| `EntidadCostoFijo` | Costos fijos |
| `Cobro` (paso compartido del handoff) | Inscribir y cobrar, (Caja después) |

### 3.2 Borrado guardado — patrón único
Un helper de servidor `eliminarODesactivar(entidad, id)` que:
1. Chequea dependencias (consultas a las tablas de historial de esa entidad).
2. Sin dependencias → `delete` real.
3. Con dependencias → `update activo=false` y devuelve el motivo para que la UI
   lo explique ("No se puede eliminar: tiene inscripciones/pagos; se desactivó").

### 3.3 Snapshot de precios
Los precios de curso pueden cambiar en el tiempo. Para no reescribir la
historia, **la inscripción y el cobro guardan el precio aplicado** (monto
devengado, tarifa usada, % de descuento) como snapshot. Editar el precio de un
curso **no** altera inscripciones pasadas. (Ver Decisión D9.)

---

## 4. Modelo de datos (propuesto)

> Ilustrativo, no es la migración final. Migraciones **aditivas** desde `0005`.
> Todas las tablas: `id`, `creado_en`, `actualizado_en`, `activo` donde aplique,
> RLS (lectura autenticados; escritura por permiso vía server actions con la
> política que corresponda), e índices por FK.

### 4.1 Profesores  *(tabla ahora; pantalla vía Design después)*
```
profesores(id, nombre, apellido, whatsapp, activo,
           comision_tasa numeric null)   -- gancho comisiones (ver D3)
```

### 4.2 Alumnos
```
alumnos(id, nombre, apellido,
        whatsapp text,                 -- identificador de adultos (único)
        es_menor boolean default false,
        tutor_alumno_id  → alumnos.id null,   -- tutor que ES un alumno existente
        tutor_nombre text null,               -- o tutor externo (si no es alumno)
        tutor_whatsapp text null,
        canal_captacion → catalogo_valores,   -- catálogo existente
        activo boolean default true)
```
- **Adulto:** único por `whatsapp` (índice único parcial `where es_menor=false`).
- **Menor:** identificador compuesto = `tutor_whatsapp` + `nombre` (sin
  apellido). Índice único parcial `where es_menor=true` sobre
  `(tutor_whatsapp, lower(nombre))`. (Ver Decisión D6.)
- **Tutor = alumno existente:** al detectar el WhatsApp del tutor entre los
  alumnos, se ofrece **vincular** (`tutor_alumno_id`) en vez de duplicar.

### 4.3 Cursos + tarifas (tabla A)
```
cursos(id, nombre, linea text, nivel text,
       profesor_id → profesores.id,
       dias_semana int[],        -- patrón 1=lun … 7=dom, ej. {1,3}
       hora time,
       precio_mensual numeric,
       activo boolean default true)

curso_tarifas(id, curso_id → cursos.id,
              modalidad text,    -- 'clase' | 'semana' | 'medio_mes'
              precio numeric,
              unique(curso_id, modalidad))
```
- Curso **sin** fila de tarifa para una modalidad → esa modalidad **cae al
  mensual completo** (regla del pedido).

### 4.4 Descuento por meses adelantados (tabla B)
```
descuentos_adelanto(meses int primary key, porcentaje numeric)
-- ej: (2, 5), (3, 10), (6, 15). Editable como dato (no hardcode).
```
- Cruce por **cantidad exacta** de meses; sin interpolar (N8 del handoff).

### 4.5 Inscripciones
```
inscripciones(id, alumno_id, curso_id,
              modalidad text,          -- 'mensual' | 'clase' | 'semana' | 'medio_mes'
              fecha_inicio date,
              estado text,             -- 'activa' | 'baja'
              -- mensual:
              -- (las cuotas se generan en la tabla cuotas)
              -- parcial (paquete de clases de tamaño fijo):
              clases_total int null,   -- p.ej. medio_mes = factor × #dias_semana
              clases_consumidas int default 0,
              dias_elegidos int[] null,-- subconjunto de dias_semana del curso
              -- snapshot de precio aplicado:
              precio_aplicado numeric,
              creado_en, actualizado_en)
```
- **Medio mes (regla corregida):** paquete de tamaño fijo
  `clases_total = medio_mes_factor × (#dias_semana del curso)`, **independiente**
  de cuántos días tilde el alumno. Menos días tildados ⇒ se completa en más
  semanas. **Precio único por curso** (tabla A). *Reemplaza* la versión anterior
  de "un solo día → 2 clases". (Ver Decisiones D1/D2 para "una clase"/"una
  semana" y el factor.)
- **Renovación mensual manual:** no automática. Cada período se reconfirma
  (genera la cuota siguiente) o se da de baja. (Ver D4.)

### 4.6 Cuotas (devengado mensual)
```
cuotas(id, inscripcion_id → inscripciones.id,
       periodo date,             -- mes devengado (1er día del período)
       monto_devengado numeric,
       vencimiento date,
       estado text)              -- 'pendiente' | 'pagada' | 'parcial'
```
- Mensual completo: 1 cuota por período; **multi-mes adelantado** genera **N**
  cuotas desde `fecha_inicio` con el descuento de tabla B aplicado (ver D5).
- Modalidades parciales: **no** generan cuota mensual (cobro único).

### 4.7 Clases y asistencia
```
clases(id, curso_id, fecha date, hora time, estado text)   -- sesiones
asistencias(id, clase_id, alumno_id, estado text,           -- 'presente'|'ausente'
            genera_reposicion boolean default false)
reposiciones(id, alumno_id, curso_id, origen_asistencia_id,
             estado text)                                    -- 'pendiente'|'usada'
```
- Tolerancia configurable (`tolerancia_faltas`, ya existe). Reposición para cada
  ausente que aún tenía tolerancia (N13 del handoff).
- Generación de `clases` a partir del patrón del curso: **ver Decisión D10**.

### 4.8 Cobros / pagos (ledger del paso `Cobro`)
```
pagos(id, tipo text,              -- 'cobro' | 'pago'
      motivo text,                -- bucket: 'inscripcion','cuota',... (extensible)
      alumno_id null, profesor_id null, costo_fijo_id null,  -- sujeto
      inscripcion_id null, cuota_id null,                    -- referencia liquidada
      monto numeric, medio text,
      descuento numeric default 0, descuento_motivo text null,
      ajuste numeric default 0, ajuste_motivo text null,
      glosa text, fecha timestamptz, registrado_por → perfiles.id)
```
- Es el **libro de movimientos** que persiste el paso `Cobro`. Etapa 1 lo usa
  para el cobro de inscripción; el dashboard de Caja (etapa siguiente) lo lee.
- Los `motivo`/sujeto se dejan **extensibles** para particulares, alquiler,
  pruebas, productos (ganchos, sin construir).

### 4.9 Costos fijos + comisiones devengadas
```
costos_fijos(id, nombre, monto_mensual numeric, activo)
costo_fijo_devengos(id, costo_fijo_id, periodo date, monto numeric)   -- ver D7

comisiones_devengadas(id, profesor_id, inscripcion_id null, cuota_id null,
                      pago_id null, periodo date,
                      base numeric, tasa numeric, monto numeric,
                      estado text)   -- 'devengada' (liquidación = etapa posterior)
```

---

## 5. Reglas de negocio (Etapa 1)

- **Medio mes = paquete fijo** = `factor × #dias_semana` clases, precio único por
  curso; menos días ⇒ más semanas. (Corrige versión previa.)
- **Inscripción parcial** (clase / semana / medio mes) con tarifa propia (tabla
  A); curso sin tarifa → mensual completo.
- **Multi-mes adelantado** con descuento por tabla B (cruce exacto, sin
  interpolar; redondeo a bolivianos enteros).
- **Renovación mensual manual**, no automática.
- **Cobro** usa el paso compartido ya diseñado; ambos descuentos (automático de
  tabla B y manual con motivo) son independientes.
- **Devengado de comisiones**: se acumula por profesor; **no** se liquida en esta
  etapa.

---

## 6. Parámetros y catálogos nuevos

| Clave | Tipo | Default | Uso |
| --- | --- | --- | --- |
| `medio_mes_factor` | numero | 2 | Multiplicador de clases del paquete medio mes (D8). |
| `comision_tasa_default` | numero | (a definir) | Tasa de comisión por defecto (D3). |
| Tabla `descuentos_adelanto` | datos | 2:5, 3:10, 6:15 | Tabla B (D5). |

Ya existentes y reutilizados: `mayoria_edad` (menores), `tolerancia_faltas`
(reposiciones), `moneda_simbolo`. Catálogo existente reutilizado:
`canal_captacion`.

---

## 7. Pantallas y orden de construcción

1. **Cursos** (+ tarifas A + config de tabla B). Prerrequisito de inscripción.
2. **Alumnos** (componente compartido: dup por WhatsApp, tutor/menor, vínculo).
3. **Inscribir y cobrar** (monta `EntidadAlumno` + `EntidadCurso` + `Cobro`).
4. **Asistencia** (clases + marcas + reposiciones).
5. **Costos fijos** + **devengado de comisiones** (altas + acumulación).

Gateo por permisos ya existentes (`alumnos`, `cursos`, `inscripciones`,
`asistencia`, `costos`, `comisiones`, `pagos`). Profesores: CRUD mínimo hasta que
llegue el handoff de Design.

---

## 8. Decisiones abiertas (para aprobar antes de codear)

- **D1 — Consumo de paquetes parciales.** Propuesta: se consumen **por
  asistencia** (cada clase asistida descuenta una del paquete), coherente con
  "menos días ⇒ más semanas". ¿Correcto?
- **D2 — "Una clase" y "una semana".** Propuesta: `una clase` = 1 clase;
  `una semana` = `#dias_semana` clases; `medio mes` = `factor × #dias_semana`.
  ¿La semana es un paquete de N clases o una ventana de 7 días de calendario?
- **D3 — Comisiones.** ¿La tasa es **por profesor**, por curso o un parámetro
  global? ¿Se devenga sobre lo **cobrado** o sobre lo **devengado** (cuota)? ¿Con
  qué base para parciales? (Necesito la fuente de la tasa y el disparador.)
- **D4 — Renovación mensual.** ¿La reconfirmación genera la cuota del período
  siguiente con un clic por inscripción? ¿Hay una vista "renovaciones del mes"?
- **D5 — Multi-mes adelantado.** ¿Genera **N cuotas** devengadas desde
  `fecha_inicio`, con el descuento aplicado al total (y prorrateado por cuota)?
- **D6 — Identificador de menores.** ¿Clave única = `(tutor_whatsapp, nombre del
  menor)`? ¿Cómo resolvemos dos menores con el mismo nombre y mismo tutor (raro)?
- **D7 — Costos fijos.** ¿Devengado mensual **automático** (una fila por período)
  o carga/generación manual? Alcance Etapa 1: alta/edición + devengado, sin
  liquidación.
- **D8 — Factor de medio mes.** ¿Lo dejamos como parámetro `medio_mes_factor`
  (default 2) o fijo en 2? (Propongo parámetro, por el principio no-hardcode.)
- **D9 — Snapshot de precios.** Confirmar que inscripción/cobro guardan el precio
  aplicado y que cambiar el precio del curso no afecta lo ya inscripto.
- **D10 — Generación de clases (sesiones).** ¿Se generan por adelantado desde el
  patrón del curso (p.ej. al crear el curso o por mes) o se crean al vuelo al
  tomar asistencia de una fecha? Afecta reposiciones y el histórico.
- **D11 — Profesores provisorio.** ¿OK construir un **CRUD mínimo** de profesores
  ahora (para poder asignar cursos), a reemplazar por la pantalla de Design
  cuando llegue? Sin esto, no se pueden crear cursos.
- **D12 — Handoff Precios y Paquetes.** No está en el repo. ¿Existe uno dedicado
  para traer (como Profesores), o las tablas A/B del README actual alcanzan?

---

## 9. Plan de migraciones (aditivo, desde 0005)

- **0005** — Entidades base: `profesores`, `alumnos`, `cursos`, `curso_tarifas`,
  `descuentos_adelanto` + parámetros nuevos + permisos base de módulos.
- **0006** — Inscripción y clases: `inscripciones`, `cuotas`, `clases`,
  `asistencias`, `reposiciones`.
- **0007** — Dinero y costos: `pagos`, `costos_fijos`, `costo_fijo_devengos`,
  `comisiones_devengadas`.

Cada una idempotente y aplicable en el SQL Editor, como las anteriores.

---

## 10. Riesgos / dependencias

- **Profesores (Design):** hasta que llegue el handoff, CRUD mínimo provisorio
  (D11). No rehacer la pantalla desde cero.
- **Precios y Paquetes (Design):** no está en el repo (D12); el esquema no lo
  bloquea.
- **Login (Design):** contrato `iniciarSesion` ya listo (prompt #9); cuando
  llegue la pantalla, se enchufa.
- **Migraciones en producción:** aditivas y revisadas antes de aplicar en el SQL
  Editor.
