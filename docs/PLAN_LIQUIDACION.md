# Tropicana — Liquidación a profesores (1C) — diseño

> Objetivo urgente. Criterio activo del Paso 1 = **criterio 1**. Confirmado por
> Javier 2026-09-06.

## 1. Devengo base — criterio 1 (alumno)
- Una membresía **devenga comisión** cuando está **cobrada (saldo 0) + completada
  (contador = N)**.
- **Monto = `pct_ingresos` del profesor (de `asignaciones`) × lo cobrado** de la
  membresía (base = precio del ciclo efectivamente cobrado).
- Las **faltas del alumno no cambian el monto** (solo afectan cuándo se completa).
- v1: membresías de **1 curso (1 profesor)**. Multi-curso/multi-profesor = después.
- **Periodicidad:** agrupar devengados por el parámetro `periodicidad_liquidacion`
  (hoy "mes").

## 2. Política de ausencia del PROFESOR (cursos regulares) — confirmada 2026-09-06
La ausencia del profesor a una clase puede ser **con** o **sin** licencia:

### 2.1 Con licencia (preaviso >= 4 h antes del inicio)
Al registrar la ausencia se elige uno de dos caminos:
- **Reemplazo (relevo):** la clase se mantiene con un **profesor sustituto** (de la
  lista; si no está, la administración lo da de alta antes). El **monto al
  reemplazante** se define al asignar el relevo y **queda habilitado para pago de
  inmediato**. **Ese mismo monto se descuenta de la liquidación del titular** (el
  titular financia su reemplazo).
- **Suspensión de la clase:** se suspende y se avisa a los alumnos. El **titular no
  devenga** por esa clase, y los **alumnos corren su fin de ciclo** según la
  política de suspensión (mismo mecanismo de tolerancia por alumno ya definido).

### 2.2 Sin licencia (sin preaviso)
- Se aplica una **multa de monto fijo** al profesor (**parámetro del sistema**),
  que se **descuenta de su liquidación**.
- Se habilitan los **mismos dos caminos** (reemplazo o suspensión). En el caso de
  reemplazo, el monto a pagar al sustituto queda **implícito/cubierto por la multa**
  cobrada al titular.

### 2.3 Parámetro del sistema
- `multa_ausencia_sin_licencia` (numero) — monto fijo de la multa.
- (posible) `preaviso_licencia_horas` = 4 (informativo/validación al registrar).

## 3. Cómo se refleja en la liquidación (propuesta de modelo)
La liquidación de un profesor en un período = **devengos** (sección 1) **+/- ítems
de ajuste** - **pagos** ya hechos. Los ajustes por ausencia son **`liquidacion_items`**
(o `comisiones_devengadas` con `tipo`), con signo:
- **Descuento al titular** por reemplazo (monto del sustituto) — negativo.
- **Multa** por ausencia sin licencia — negativo.
- **Pago al reemplazante** — es una comisión/haber **a favor del sustituto** (su
  propia liquidación) + habilitado para pago inmediato.
- **Suspensión sin reemplazo** — el titular simplemente no suma esa clase; con
  criterio 1 (por membresía completada) el efecto es que la clase se **repone** y
  la comisión se paga al completarse la membresía (no hay ítem de ajuste).

**Punto a resolver juntos (tensión de modelo):** el criterio 1 devenga **por
membresía completada** (no por clase), mientras que las ausencias son **por clase**.
Para "el titular no devenga por esa clase" hay que decidir: (a) los efectos de
ausencia se manejan como **ajustes** (descuento/multa/pago al sustituto) sobre el
total del período, dejando el devengo por membresía intacto — simple y additivo; o
(b) llevar el devengo a **granularidad por clase**. Recomendación: (a).

## 4. Fases de construcción
- **1C-core (ahora):** devengo criterio 1 (membresías cobradas + completadas),
  **pantalla "Profesores → Liquidaciones"** (devengado / pagos / neto por profesor
  y período) y **pago al profesor**. Estructurado para admitir ítems de ajuste.
- **1C-ausencias (después):** registrar ausencia del profesor (con/sin licencia),
  asignar reemplazo (alta rápida de profesor si falta) con su pago + descuento al
  titular, multa por sin-licencia (parámetro), y su reflejo como ítems de ajuste
  en la liquidación. Requiere también el reencuadre de suspensión→`fecha_fin` (1B.2b).

## 5. Prerrequisitos
- **1B.2** contador/completada ✅ (hecho). Pendiente 1B.2b: licencia→bono (alumno),
  suspensión corre `fecha_fin`.
- `asignaciones.pct_ingresos` (existe) para el monto del devengo.
