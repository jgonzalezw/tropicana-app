# Tropicana — Paso 1: Motor base del Plan Regular + Liquidación (diseño técnico)

> Creado 2026-09-05. Concreta el Paso 1 del `PLAN_CIERRE_ETAPA1_v2_MOTOR.md` con
> las decisiones: **P1 cobro por ciclo · P2 migrar datos actuales (probado en
> local) · P3 opción 1 (motor base + liquidación juntos)**. **No construir hasta
> el OK de Javier a este diseño.** Se construye por **sub-hitos**, cada uno
> probado en local antes del siguiente; nada a producción sin visto bueno.

## 1. Modelo de datos (motor base, alcance Plan Regular)
**`planes`** (configuración; sección 2 del motor). Campos usados en Paso 1:
`id, nombre, tipo_servicio='curso_regular', curso_id (acceso a 1 curso),
cantidad_clases (N, fija), precio (tarifa por ciclo, snapshot al vender),
criterio_liquidacion (1..4, default 1), renovable bool, activo`. (Multi-curso y
otros tipos = pasos posteriores.)

**Membresía = se generaliza `inscripciones` en su lugar** (sin renombrar la tabla
todavía; el rename cosmético va en la pasada de alineación, paso 6). Se agregan:
`plan_id, clases_plan (N del ciclo, = plan.cantidad_clases + bono arrastrado),
bono_arrastrado int default 0, ciclo_numero int default 1,
membresia_anterior_id (continuidad, nullable), estado
('activa'|'completada'|'baja')`. Ya tiene `dias_elegidos` (el calendario del
alumno) y `precio_aplicado` (snapshot).

**Cobro por ciclo:** `cuotas` pasa a ser **una por ciclo** (no por mes): al
vender/renovar se genera **una cuota** de la membresía con `monto = precio del
ciclo`. Se conserva la estructura de `cuotas`/`pagos` (paso Cobro).

**Contador y "completada":** el contador = **clases realizadas del calendario**
de la membresía. Una clase se cuenta cuando su **sesión fue dictada** (las
suspendidas por la academia se corren y no cuentan hasta re-dictarse; ya existe
`sesiones`/`corrimientos_ciclo`). Cuando el contador llega a `clases_plan`, la
membresía pasa a **`completada`**.

**Bono de tolerancia:** una **falta con licencia** anota un bono (no acumulable).
Al **renovar con continuidad**, el bono se suma como **+1 clase** de la nueva
membresía (`clases_plan = N + 1`) y se consume como su primera clase. (Registrar
el bono entra en Paso 1; **consumirlo en la renovación** es Paso 2, donde vive la
renovación.)

**Liquidación:**
- `comisiones_devengadas (id, profesor_id, plan_id, membresia_id, criterio,
  periodo, base, tipo['comision'|'referido'], monto, origen, creado_en)`.
- `liquidaciones (id, profesor_id, periodo, periodicidad, estado
  'abierta'|'cerrada'|'pagada', total_devengado, total_pagado, neto)` +
  `liquidacion_items`.
- **Parámetro** `periodicidad_liquidacion` (`semana`|`mes`|`membresia`, default
  `mes`); se conserva `rezago_liquidacion_meses`.
- **Criterio (1):** cuando la membresía está **cobrada (cuota saldo 0) Y
  completada (contador = clases_plan)** → devenga `comision = pct_ingresos
  congelado × base`, con **base = lo cobrado de la membresía** (precio del ciclo).
  El `referido` queda como **item gancho** (D3).

## 2. Migración de datos actuales (P2 = migrar, probado en local)
Las `inscripciones` mensuales actuales se convierten a **membresías de Plan
Regular** sin borrar datos:
1. Crear un **plan por cada curso** con `cantidad_clases = N` derivada del curso
   (propuesta: N = clases del mes según días del curso; **a confirmar el N por
   curso con Javier** en la validación local, porque el mensual viejo no tenía N).
2. `inscripciones += plan_id` (backfill) y setear `clases_plan`, `ciclo_numero=1`.
3. Las `cuotas` mensuales existentes se mantienen como el/los cobros del ciclo en
   curso (se concilian contra el precio del ciclo).
4. Todo esto **se corre y valida primero en la base local**; solo con tu OK se
   aplica en Supabase.
*(Si al ver los datos resultara trivial, se puede optar por recrear a mano; se
decide en la validación local.)*

## 3. Sub-hitos (construir uno a la vez, probados en local)
- **1A — Esquema del motor + migración (SQL, en local).** `planes`, columnas de
  membresía en `inscripciones`, cobro por ciclo (cuota por ciclo),
  `comisiones_devengadas`, `liquidaciones`/`liquidacion_items`, params. Script de
  migración de datos actuales. Validado contra Postgres local. → Javier prueba en
  su base local.
- **1B — Venta + asistencia bajo el motor.** Ajustar la pantalla de venta
  (elegir Plan Regular sobre un curso, armar calendario de N clases, **cobro por
  ciclo**), y ajustar asistencia para **contar clases realizadas**, detectar
  **completada**, y registrar el **bono** en falta con licencia. Reusa `Cobro`,
  `EntidadAlumno`, el selector de días y la pantalla de asistencia existentes.
- **1C — Liquidación.** Cálculo criterio (1) sobre membresías **cobradas +
  completadas**, pantalla "Profesores → Liquidaciones" (devengado, pagos, neto),
  **pago al profesor** (reusa `Cobro` en dirección pago), y `periodicidad_liquidacion`.
- *(Renovación con continuidad — consumo del bono — va en el Paso 2, junto con
  estado de cuenta.)*

## 4. Decisiones finas (con mi recomendación; confirmás en la validación de 1A)
- **N por curso para la migración:** lo definimos mirando los datos reales en
  local (no lo adivino ahora).
- **"Clase realizada" para el contador:** = **sesión dictada** en un día del
  calendario del alumno (no depende de presente/ausente; la falta con licencia
  genera bono, la falta sin licencia pierde la clase pero igual cuenta como
  dictada). *(Recomendado; confirmás al probar 1B.)*
- **Criterio (2)/(3)/(4):** se dejan **configurables en `planes`** pero el
  cálculo activo del Paso 1 es el **(1)**; los demás se activan cuando haya planes
  que los usen (particular/alquiler, Paso 2).

## 5. Qué necesito de vos
1. **OK a este diseño** (o ajustes).
2. Con el OK, construyo **1A** (esquema + migración) y lo valido contra Postgres;
   te aviso para que lo pruebes en tu **base local**. Nada a producción sin tu
   visto bueno.
