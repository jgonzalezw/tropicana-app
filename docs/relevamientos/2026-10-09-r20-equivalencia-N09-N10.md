# R20 · E2 · H2 — Informe de equivalencia N09–N10 (reserva confirmada)

Fecha: 2026-10-09. Rama `r20-notificaciones`. Evidencia: `npm test` (56/56 en `src/lib/comunicaciones`).

Se comparan, con igualdad estricta (`strictEqual`, sin normalizar espacios ni formatos), tres salidas por variante:
1. **Referencia:** capturada del código anterior a la extracción (commit `ee77526`, `__referencias__/N09-N10.json`).
2. **Función movida:** `src/lib/comunicaciones/legado/reserva.ts`.
3. **Plantilla:** predeterminada de `predeterminados/reserva.ts`, renderizada por `plantillas.ts` con el adaptador.

| Variante | N09 función | N09 plantilla | N10 función | N10 plantilla |
|---|---|---|---|---|
| `particular.base` | = | = | = | = |
| `particular.lugar_externo` | = | = | = | = |
| `particular.lugar_tropicana_sin_sala` | = | = | = | = |
| `particular.hora_sin_segundos` | = | = | = | = |
| `particular.domingo` | = | = | = | = |
| `particular.fin_de_anio` | = | = | = | = |
| `particular.cambio_de_mes` | = | = | = | = |
| `particular.cruza_medianoche` | = | = | = | = |
| `particular.sin_duracion` | = | = | = | = |
| `particular.saldo_decimal_cuarto` | = | = | = | = |
| `particular.saldo_decimal_medio` | = | = | = | = |
| `particular.saldo_cero` | = | = | = | = |
| `particular.saldo_completo` | = | = | = | = |
| `particular.saldo_vacio` | = | = | = | = |
| `particular.sin_plan` | = | = | = | = |
| `particular.sin_nombre_alumno` | = | = | = | = |
| `particular.caracteres_especiales` | = | = | = | = |
| `alquiler.base` | = | = | no aplica | no aplica |
| `alquiler.lugar_externo` | = | = | no aplica | no aplica |
| `alquiler.sin_plan` | = | = | no aplica | no aplica |
| `alquiler.sin_nombre_titular` | = | = | no aplica | no aplica |
| `alquiler.saldo_decimal` | = | = | no aplica | no aplica |
| `alquiler.fin_de_anio` | = | = | no aplica | no aplica |

**23 variantes, 0 diferencias.** "=" significa idéntico carácter por carácter. En alquiler no se arma el aviso N10 (el alquiler no tiene profesor).

## Particularidades heredadas que se conservan
- Sin duración, el horario termina en «a ?» (`particular.sin_duracion`).
- «Hola!» sin coma ni nombre.
- Sin nombre de alumno, el aviso al profesor dice «con el alumno» (`particular.sin_nombre_alumno`).
- Sin plan, «clases particulares» / «alquiler de sala» (variantes `sin_plan`).
- Saldo en horas sin ceros sobrantes (`7.5`, `10`, `0.25`).

## Qué no cubre esta evidencia
- La resolución de `lugar` (lugar externo, sala o «Tropicana») y la lectura del saldo siguen dentro de `contextoAviso`; entran como datos de entrada.
- El destinatario (dA / dT / profesor) no es parte del texto y no se tocó.
- Prueba de humo e2e («Confirmar directo» en la ficha): verde, sin cambios visibles.
