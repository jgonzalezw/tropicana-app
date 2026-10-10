# R20 · E2 · H3 (grupo ventas) — Informe de equivalencia N01–N06

Fecha: 2026-10-10. Rama `r20-notificaciones`. Alcance: generación de texto y condición en que el recibo no se manda. **No** cubre la resolución real del destinatario (`destinatarioAviso` para el titular o su tutor, `destinatarioDeTitular` para el alquiler), ni los importes o fechas que calculan las acciones, ni conecta ningún caso.

## Método
1. **Referencias** capturadas del código anterior a la extracción (commit `b525d28`, `__referencias__/ventas.json`, 62 variantes más la tabla del recibo). `scripts/capturar-referencias-ventas.mjs` copia sin tocarlas el archivo `lib/venta/mensajeInscripcion.ts` (N01, N02) y las líneas que arman N03–N06 en `inscribir/acciones.ts` y `accionesAlquiler.ts`; aborta si una línea no es la esperada.
2. **Funciones**: N01 y N02 ya eran puras y **siguen en `lib/venta/mensajeInscripcion.ts`**. N03–N06 se movieron a `src/lib/comunicaciones/legado/venta.ts` (`mensajePrueba`, `mensajesParticular`, `mensajeAlquiler`, `avisaRecibo` y sus ayudantes). Las acciones solo las llaman.
3. **Plantillas** y adaptadores en `src/lib/comunicaciones/predeterminados/venta.ts`. N01 expresa también como plantilla las frases de clases, asistencia y pago, que antes eran tres funciones de ramas. El alquiler tiene dos textos (a su titular / a la persona de contacto), como dos plantillas.
4. `strictEqual` / `deepStrictEqual` entre referencia, función y plantilla, sin normalizar.

## Resultado
Las 62 variantes y la tabla del recibo dan **0 diferencias** (65 pruebas en el archivo). Mutaciones de control: cambiar «Todavía» por «Todavia» en la plantilla hizo fallar 1 prueba (la única variante sin pago); «¡Los esperamos!» en la función, 2; «después» en la plantilla, 2. Se revirtieron.

| Caso | Disparador | Variantes |
|---|---|---|
| N01 confirmación de inscripción | `inscribirYCobrar` | 24 |
| N02 recibo de pago | `inscribirYCobrar` **solo si se cobró algo** | 7 + tabla de montos |
| N03 clase de prueba | `venderPrueba` | 11 |
| N04 paquete particular → alumno | `venderParticular` | 12 |
| N05 paquete particular → profesor | `venderParticular` | 12 (las mismas entradas que N04) |
| N06 alquiler de sala | `venderAlquiler` | 8 |

Cubre: menor con tutor, uno o varios cursos, curso sin días ni horario, sin cursos, plan de una clase, ilimitado con y sin ciclo, bono sin curso / de un curso / de dos, fin de ciclo ausente, tolerancia 0, 1 y 2, crédito de la prueba, sin pago, saldo con y sin compromiso, pago sin medio, importes con miles y decimales, ñ/tildes/«¡»/«»; en la prueba, 1, 2 y 3 personas, menor con y sin espacio final, clases ordenadas por fecha, sin clases, curso desconocido; en el particular, agenda fija (una o varias) y flexible, con y sin resto por coordinar, lugar externo, horas con decimales, alumno o profesor sin nombre, agenda vacía; en el alquiler, titular propio o persona de contacto, con y sin resto.

## Cuándo un aviso NO corresponde (con referencia)
| Condición | Resultado |
|---|---|
| Venta sin cobro (`porPlata` ≤ 0) | no hay recibo (N02); sí la confirmación (N01) |
| Prueba sin clases con fecha | el aviso sale igual, sin la lista (queda «):.») |

La ausencia de destinatario o de WhatsApp no cambia el texto: el botón queda deshabilitado, como hoy.

## Particularidades heredadas que se conservan
- «Hola!» sin coma; «Cursos:» sin cursos; «clases ilimitadas durante ? días» sin ciclo.
- «Hola! Confirmamos tu clase de prueba (Plan, 1 persona):. ¡Te esperamos!» sin clases con fecha.
- Las horas del paquete y del alquiler se imprimen sin formatear (`1.5`, `2.25`).
- Dos textos de «resto»: «El resto se coordina después.» (particular) y «El resto de las horas se coordina después.» (alquiler).
- Nombres, plan, lugar y agenda permiten vacío («con  en»): el original los imprimía así. La plantilla lo conserva con `permiteVacia`; validar es un cambio posterior.
- En N05, un alumno sin nombre se dice «un alumno» (lo resuelve el adaptador, igual que el original).

## Pendiente para la conexión (fuera de este informe)
- Verificar en vivo que el destinatario registrado coincide con el del botón (titular, tutor, persona de contacto, profesor).
- Los importes (`gs`) y las fechas (`fechaLarga`, `formatearAgenda`) los siguen formateando las acciones; son entradas de la plantilla.
- Comportamiento ante fallos de resolución (definirlo antes de conectar).

## Conteo de variantes: únicas y compartidas
- **62 variantes únicas** (entradas de `ventas.json`; la tabla del recibo no es una variante). Casos: N01 24, N02 7, N03 11, N04-N05 12, N06 8.
- **Compartidas:** las 12 de «N04-N05» son las **mismas entradas** para N04 (alumno) y N05 (profesor): una entrada produce los dos textos. Contadas por caso son 74 filas (el inventario las muestra así), pero hay 62 variantes distintas. No hay otras compartidas.
