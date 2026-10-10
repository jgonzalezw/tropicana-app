# R20 · E2 · H3 (grupo reservas) — Informe de equivalencia N07–N18

Fecha: 2026-10-10. Rama `r20-notificaciones`. Alcance: generación de texto y condiciones en que un aviso no corresponde. **No** cubre la resolución real del destinatario, del lugar ni del saldo en producción (siguen en `contextoAviso`), ni conecta ningún caso.

## Método
1. **Referencias** capturadas del código anterior a la extracción (commit `5f7414f`, `__referencias__/reservas.json`, 157 variantes + la tabla de estados). El script `scripts/capturar-referencias-reservas.mjs` copia sin tocarlas las líneas de `particulares/acciones.ts` y la función `avisos()`, las evalúa con datos ficticios y aborta si una línea no es la esperada.
2. **Funciones movidas** a `src/lib/comunicaciones/legado/reserva.ts` (`mensaje…`, `avisosDeReserva`, `avisaCambioDeEstado`). `acciones.ts` solo las llama.
3. **Plantillas** predeterminadas y adaptador en `src/lib/comunicaciones/predeterminados/reserva.ts`, renderizadas con `plantillas.ts`.
4. `strictEqual` / `deepStrictEqual` entre las tres salidas, sin normalizar espacios ni formatos.

## Resultado
`npm test`: **681 de 681** (en `comunicaciones`: 183 pruebas de equivalencia y de motor). **0 diferencias.**
Prueba de que la comparación detecta diferencias: cambiar a propósito un punto en una plantilla hizo fallar 18 pruebas; cambiar los dos puntos por un punto en la función movida hizo fallar 62. Ambas mutaciones se revirtieron.

| Caso | Disparador (origen) | Variantes de texto | Plantillas |
|---|---|---|---|
| N07/N08 solicitada | `crearReserva` «solicitar» | 21 c/u | N07, N08 |
| N09/N10 confirmada | `crearReserva` «confirmar» y `cambiarEstadoReserva` → confirmada | 23 (H2) | N09, N10 |
| N11/N12 suspendida, por estado | `cambiarEstadoReserva` → suspendida | 24 | N11, N12 |
| N11/N12 suspendida, operativa (C5, bloqueo) | `suspenderReservaOperativa` | 24 | N11, N12 (mismo texto, otro origen del motivo) |
| N13/N14 restablecida | `revertirSuspension` | 21 | N13, N14 |
| N15/N16 reprogramada | `reprogramarReserva` / `moverReserva` | 21 | N15, N16 |
| N17/N18 cancelada a pedido, fuera de plazo | `cancelarAPedido` | 23 | N17/N18 `.fuera_de_plazo` |
| N17/N18 cancelada a pedido, en plazo | `cancelarAPedido` | 23 | N17/N18 `.en_plazo` |

Cada caso cubre particular y alquiler, lugar externo, sala o «Tropicana», saldo con decimales y en cero, sin duración, fin de año, cambio de mes, sin plan, sin nombre de alumno o titular, destinatario propio o tutor, caracteres especiales (ñ, tildes, «¡», «»), y según el caso: tres formas de motivo (lista, «etiqueta (glosa)», bloqueo) y plazos de 1, 8 y 24 h.

## Condiciones en que un aviso NO corresponde (también con referencia)
| Condición | Resultado |
|---|---|
| Sin contexto de aviso (`contextoAviso` devuelve `null`) | ningún aviso |
| Sin destinatario del alumno/titular | solo el aviso al profesor |
| Membresía sin profesor (alquiler) o profesor sin nombre | solo el aviso al alumno/titular |
| Sin contexto en cualquiera de los 7 casos | `{}` |
| Cambio de estado de una reserva a solicitada, reprogramada, reagendar, ausente o realizada | no avisa (solo confirmada y suspendida avisan) |

## Particularidades heredadas que se conservan
- «Hola!» sin coma ni nombre; «a ?» cuando no hay duración.
- «Tu alquiler de sala (…) del … quedó suspendida» (concordancia de género tal como estaba).
- «Te quedan …» con mayúscula después de los dos puntos.
- Con plan o nombre faltante: «clases particulares» / «alquiler de sala» / «el alumno» / «el titular».
- Con motivo `null`, el original imprimía «null»; el adaptador conserva `String(motivo)`.

## Diferencias de condición (no de texto) que se declaran
- Un **motivo de suspensión vacío**, que el original imprimía como «()», detiene el mensaje con la plantilla (variable obligatoria vacía). Ninguna fuente real produce un motivo vacío (lista, C5 o bloqueo siempre aportan texto); queda anotado para la ficha de N11/N12 antes de conectar el caso.

## Pendiente para la conexión (fuera de este informe)
- Verificar en vivo que el destinatario registrado coincide con el del botón (dA, dT, profesor).
- Obtención real de `lugar` y saldo (`contextoAviso`).
- Comportamiento ante fallos de catálogo o resolución de cada caso (definirlo antes de conectar).

## Evidencia complementaria
`tsc` limpio. e2e de humo en verde: «reprogramar», «cancelar» y «reagendar» (4 de 4).
