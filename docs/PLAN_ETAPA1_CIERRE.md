# Tropicana — Plan del cierre de Etapa 1 (bloque financiero)

> Creado 2026-09-04. Cierra Etapa 1: **Renovación + Estado de cuenta**, **Costos
> fijos**, **Comisiones devengadas** y **Liquidación mensual básica**. Base de
> datos en `0010` (o partida en 0010/0011/0012 según se construya por hito).
> Fuente: decisiones ya tomadas en `docs/ESTADO.md` y esquema de
> `docs/PLAN_ETAPA1.md` §4.9–4.10. **No construir hasta el visto bueno.**

## 0. Por qué este bloque
- Da **efecto visible al fin de ciclo** (hoy el corrimiento por falta/suspensión
  se registra pero no se ve): lo muestra el **estado de cuenta** del alumno.
- Cierra los dos límites que dejamos en asistencia: **`fecha_baja`** (vigencia
  histórica) y el **tope por fin de ciclo** (renovación).
- Entrega lo prometido de Etapa 1: **comisiones + liquidación básica**.

## 1. Hitos — ORDEN POR PRIORIDAD (2026-09-04): liquidar al profesor primero

> Prioridad de Javier: **poder liquidar al profesor ya**. La liquidación NO
> depende de renovación ni de estado de cuenta: se calcula desde `pagos`
> cobrados + `asignaciones` (% congelados). Costos fijos quedan al final.

**Hito 1 (PRIORIDAD) — Comisiones devengadas + Liquidación básica + pago al profesor**
- Migración con `comisiones_devengadas`, `liquidaciones`, `liquidacion_items`.
- **Devengo sobre lo COBRADO**, a **mes vencido** (`rezago_liquidacion_meses`=1),
  con **prorrateo** cuando un cobro cubre varios meses, y **tasa congelada** por
  la asignación que cubrió el período (`pct_ingresos`/`pct_referido` de la fila
  `desde/hasta`). Base: cuotas + parciales + clases de prueba.
- Recalcular/generar el devengado de un período (un clic por profesor o global).
- **Liquidación por profesor/período:** `neto = Σ devengado − Σ pagos al profesor`
  (los pagos ya existen como `pagos.tipo='pago'`). Estados abierta/cerrada/pagada.
- Pantalla de liquidación + **registrar pago al profesor** (reusa el paso `Cobro`
  en dirección pago). Nav "Profesores → Liquidaciones", permiso `comisiones`.
- Depende solo de tablas existentes (pagos, cuotas, asignaciones, profesores).

**Hito 2 — Renovación mensual + Estado de cuenta del alumno**
- **Renovación (D4, manual):** un clic genera la cuota del mes siguiente para una
  inscripción mensual, con **precio actual** (snapshot) y su vencimiento; nunca
  automática.
- **Estado de cuenta:** por alumno — cuotas (período, devengado, descuento,
  pagado, saldo, estado), **fin de ciclo** (vencimiento vigente) y traza de
  corrimientos (falta/suspensión), historial de pagos, deuda total.
- **`fecha_baja` en inscripciones:** al dar de baja se guarda la fecha; la
  vigencia pasa a ser `fecha_inicio ≤ fecha < fecha_baja`. Con esto asistencia
  puede reconstruir la vigencia a fechas pasadas (cierra el límite pendiente).
- Sin tablas nuevas mayores (solo `inscripciones.fecha_baja`). Reusa `cuotas`,
  `pagos`.

**Hito 3 (ÚLTIMO) — Costos fijos + devengado**
- `costos_fijos(id, nombre, monto, frecuencia, activo, …)` y
  `costo_fijo_devengos(id, costo_fijo_id, periodo, monto)`.
- Alta/edición con `EntidadCostoFijo` (mismo patrón compartido).
- **Devengado mensual prorrateado por frecuencia:** mensual = monto; trimestral =
  monto÷3; anual = monto÷12; único = en su mes. Generación por período (un clic /
  al cerrar el mes).

*(El detalle de datos de comisiones/liquidación está en el Hito 1, arriba, y en
`docs/PLAN_ETAPA1.md` §4.10.)*

## 2. Reglas de negocio (a confirmar)
1. **Prorrateo de comisión:** un pago que cubre N meses devenga la comisión
   **prorrateada por mes**, cada mes a su vencimiento. (Plan: sí.)
2. **Base "lo cobrado"** incluye cuotas mensuales, parciales y clases de prueba.
   (Plan: sí.)
3. **Mes vencido:** la liquidación de un mes se calcula con rezago
   `rezago_liquidacion_meses` (default 1). (Plan: sí.)
4. **Costos fijos — frecuencias:** mensual / trimestral (÷3) / anual (÷12) /
   único (en su mes). (Plan: sí.)
5. **Renovación:** genera la cuota del mes siguiente con el **precio vigente del
   curso** al momento de renovar (no reescribe cuotas anteriores). (Plan: sí.)

## 3. Decisión ABIERTA (necesito tu definición — no la resuelvo solo)
- **Comisión por "referido" (`pct_referido`): ¿a quién y sobre qué?** Hoy la
  asignación guarda dos %: `pct_ingresos` (sobre ingresos del curso) y
  `pct_referido`. Necesito precisar la semántica del referido para calcularla:
  - (a) ¿El `pct_referido` lo gana el **profesor titular** por cada alumno que
    fue **referido por otro alumno** (`alumnos.referido_por_alumno_id`), sobre lo
    cobrado a ese alumno en el curso? o
  - (b) ¿Es una comisión para el **alumno/persona que refirió** (crédito/
    descuento), no para el profesor? o
  - (c) otra definición.
  De esto depende el modelo de `comisiones_devengadas` tipo `referido`. **Sin tu
  definición, construyo A y B, y en C dejo el `pct_ingresos` funcionando y el
  `referido` como gancho hasta que lo definas.**

## 4. Qué necesitaré de vos
- Aplicar la migración del hito que toque (te paso link + inline, en ASCII).
- Confirmar las 5 reglas del §2 y **definir el §3 (referido)**.
- Probar cada hito antes del siguiente.

## 5. Fuera de alcance (fase 2, ya acordado)
Liquidación ampliada (relevos, bonos, particulares, costos de sala), clases
particulares y alquiler de sala (pantallas), inventario, reportes, App Shell
completo, catálogo de permisos granular, catálogo de motivos de suspensión,
fecha de nacimiento/sexo de alumnos.
