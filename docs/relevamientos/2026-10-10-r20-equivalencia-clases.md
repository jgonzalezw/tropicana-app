# R20 · E2 · H3 (grupo clases) — Informe de equivalencia N19–N21

Fecha: 2026-10-10. Rama `r20-notificaciones`. Alcance: generación de texto y condiciones en que un aviso no corresponde. **No** cubre la lectura real de contactos, tutor ni profesor en la base (siguen en `contactosDeAlumnos` y `avisoProfesorTitular`), ni conecta ningún caso.

## Método
1. **Referencias** capturadas del código anterior a la extracción (commit `2f82c73`, `__referencias__/clases.json`, 38 variantes). `scripts/capturar-referencias-clases.mjs` copia sin tocarlas las funciones de `src/lib/avisosClase.ts` y los bloques de armado de `avisosClase.ts` y de `reabrirSesion` (`asistencia/acciones.ts`), y aborta si una línea no es la esperada.
2. **Funciones movidas** a `src/lib/comunicaciones/legado/clase.ts` (mensajes + `armarAvisosSuspension`, `armarAvisoProfesor`, `avisaReapertura`, `armarAvisosReapertura`). `avisosClase.ts` las reexporta y `asistencia/acciones.ts` las llama.
3. **Plantillas** y adaptador en `src/lib/comunicaciones/predeterminados/clase.ts`, con condiciones y lista del motor.
4. `deepStrictEqual` entre referencia, función movida y plantilla (inyectada en el mismo `armar…`), sin normalizar.

## Resultado
Las 38 variantes dan **0 diferencias** (40 pruebas en el archivo). Mutación de control: cambiar un signo en la plantilla hizo fallar 9 pruebas; en la función movida, 7. Ambas se revirtieron.

| Caso | Disparador | Variantes |
|---|---|---|
| N19 clase suspendida → alumno | `suspenderClase` (manual) y `guardarHorarioSala` (C5) vía `avisosSuspensionAlumnos` | 17 |
| N20 clase suspendida → profesor | `suspenderClase` (`avisoProfesorTitular`); C5 **no** lo emite | 10 |
| N21 clase restablecida → alumno | `reabrirSesion` | 11 |

Cubre: una, dos y tres clases (plural, motivo de la primera, ciclo tomado de la primera clase que lo tenga), con y sin ciclo corrido, motivo con glosa, por defecto manual («una decisión de la escuela») y de C5 («un cierre de sala»), fin de año, cambio de mes, ñ/tildes/«¡», alumno sin WhatsApp, menor con el WhatsApp del tutor, contacto sin resolver («Alumno #7»), orden por apellido-nombre de varios alumnos, profesor sin apellido, sin nombre o sin ambos («Profesor #3»), curso no encontrado («tu curso»).

## Condiciones en que un aviso NO corresponde (también con referencia)
| Condición | Resultado |
|---|---|
| Suspensión sin alumnos afectados | ningún aviso |
| Sin profesor titular en esa fecha (`profesorId` nulo) | sin aviso N20 |
| Profesor sin contacto, o no encontrado | sin aviso N20 |
| Reapertura de una clase que no estaba suspendida | ningún aviso |
| Reapertura donde a nadie se le había corrido el ciclo | ningún aviso |

## Particularidades heredadas que se conservan
- «Hola Alumno #7!» si no se resuelve el contacto; «Hola Profesor #3!» sin nombre.
- Motivo vacío: «por .» (la plantilla permite vacío en `clase.motivo`, igual que en reservas). Una validación mejor es un cambio posterior.
- El motivo de varias clases es el de la primera; el fin de ciclo, el de la primera que lo tenga.
- Los textos por defecto del motivo («una decisión de la escuela», «un cierre de sala») y la composición de C5 («etiqueta (glosa)») se arman en las acciones: son argumentos del aviso, no de la plantilla.

## Pendiente para la conexión (fuera de este informe)
- Verificar en vivo que el destinatario registrado coincide con el del botón (alumno, tutor, profesor).
- Comportamiento ante fallos de resolución de contactos (definirlo antes de conectar).
- C5 no avisa al profesor titular: decisión de negocio a confirmar antes de unificar.
