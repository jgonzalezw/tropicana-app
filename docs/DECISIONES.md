# Tropicana — decisiones tomadas y decisiones postergadas

Este archivo se carga en **toda** sesión (vía `CLAUDE.md`, junto con
`REGLAS.md`). Existe por un motivo concreto: Javier no tiene cómo acordarse de
todo lo que se decidió y quedó para después, y sin registro esas decisiones se
pierden y se vuelven a discutir, o peor, se contradicen sin que nadie lo note.

**Cómo se usa, y no es opcional:**

1. Una decisión **vigente** se respeta siempre. Solo cambia con **otra decisión
   explícita** de Javier, y entonces se edita acá con la fecha y el porqué.
   Nunca se cambia "sobre la marcha" ni porque en el momento parezca mejor.
2. Toda decisión **postergada** vive en la tabla de abajo con su **disparador**:
   cuándo conviene hacerla y qué la vuelve urgente.
3. **Todo plan que se le proponga a Javier abre mostrando el backlog** de
   decisiones postergadas que ese plan toca o vuelve más caras. Si ninguna
   aplica, se dice "ninguna" — pero se dice.
4. Cuando se cumple el disparador de una decisión postergada, **se avisa**, aun
   si nadie preguntó.

---

## 1. Decisiones postergadas (backlog)

| # | Decisión | Estado | Por qué se postergó | Disparador: cuándo hacerla |
| --- | --- | --- | --- | --- |
| D1 | **Un solo nombre para la membresía.** Hoy conviven `membresia_id` (`comisiones_devengadas`, `liquidacion_items`, `inscripciones.membresia_anterior_id`) e `inscripcion_id` (`asistencias`, `cuotas`, `pagos`, `corrimientos_ciclo`, `inscripcion_cursos`) para la **misma** llave a `inscripciones.id`. Falta que Javier elija dirección: **(a)** todo a `membresia` (tabla incluida) o **(b)** todo a `inscripcion_id`. | **Pendiente de decisión** (2026-09-11) | Estamos a mitad del Paso 2 con la clase de prueba sin validar; el renombre toca 9 tablas, RLS, todo el código y el script de refresh. Mezclarlo ahora junta dos riesgos que conviene tener separados. | Apenas cierre la clase de prueba (Pasos E, F, G), y **antes** de que el próximo pase a producción se haga grande. Controlado por el **control 15**. |
| D2 | **Sacar el repo de OneDrive** (`C:\Users\Javier\onedrive\natalia\tropicana-app` → p. ej. `C:\dev\tropicana-app`). | Pendiente | No urge y corta el trabajo en curso. | Ya costó dos veces (`2a26010`, `8fb648c`). A la tercera vez que un cambio "no aparezca", hacerlo antes de seguir diagnosticando. |
| D3 | **Renombrar `ClienteVentas.tsx`** a algo que diga lo que hace (`PestanasVenta` / `MostradorVenta`). El nombre indujo a Javier a creer que había otra pantalla de ventas. | Pendiente | Cosmético; se hizo en medio de un diagnóstico. | Junto con D1, que es el mismo tipo de trabajo (renombres). |
| D4 | **Generalizar el acceso al detalle**: hipervínculo o botón tipo "ojo", igual en toda lista de entidades. Hoy está suelto en Caja y en Alumnos. | Pendiente (pedido de Javier, 2026-09-08) | Es una decisión de diseño transversal: conviene que pase por Design. | Cuando se defina con Design, o cuando la tercera pantalla necesite el mismo gesto. |
| D5 | **Clasificar mejor el motivo del cobro** en el recibo: Membresía, Clase Particular, Clase de Prueba, Alquiler, Taller, Venta Producto, Ajuste. | Pendiente (Javier: *"Dejemos eso para una mejora posterior"*) | Se resolvió lo urgente (que el motivo elegido no se descarte). | Cuando entren los otros tipos de servicio — Paso 2D (particulares, alquiler, talleres). Ahí el catálogo actual se queda corto solo. |
| D6 | **Duración de la clase (`cursos.duracion_min`)** — no existe, y la agenda de sala la necesita para dibujar bloques. | Pendiente | Apareció al planificar 2D. | Al arrancar la agenda de sala (2D). |
| D7 | **¿Puede existir una reserva de sala sin paquete vendido?** Sin responder. | Pendiente de decisión | Idem D6. | Al arrancar la agenda de sala (2D). |

## 2. Decisiones vigentes que ya se violaron una vez

Las que ya costaron. Se listan aparte porque el antecedente es el que evita la
recaída.

| Decisión | Vigente desde | Cómo se violó | Qué la protege ahora |
| --- | --- | --- | --- |
| **El fin de ciclo lo corre la suspensión** (regla de negocio 4) | siempre | Se afirmó que el motor no tocaba `fecha_fin`, tras un `grep` que no encontró el campo. | Glosario de `REGLAS.md` + controles 9 y 10. |
| **El corrimiento no toca el plazo de pago de la cuota** | 2026-09-10 | Se arrastró la definición de la etapa 1. | Glosario de `REGLAS.md`. |
| **Un fallo no se disfraza de ausencia** (calidad 1) | 2026-09-11 | Dos veces: el recibo 404 y la venta sin planes. | `exigir()` + `error.tsx` + regla de calidad 1. |
| **Un concepto, un nombre** | siempre (glosario) | Se agregó `membresia_anterior_id` en la 0023, con el resto del esquema en `inscripcion_id`. | **Control 15** + D1. |

## 3. Pendiente de pase a producción

Lo que está **solo en dev** y espera el OK explícito de Javier (regla de
proceso 1). No es un backlog de decisiones: es el estado del release.

- Migraciones **0023** (clase de prueba) y **0024** (fecha por curso).
- Padrón resuelto por `inscripcion_cursos` — **bloqueante** antes de que se
  cree el primer plan multi-curso en producción.
- `exigir()` + `error.tsx`, precio de referencia por tramos, configuración y
  venta de la clase de prueba, Paso D del padrón.
- Script de refresh corregido (copia `plan_cursos` / `inscripcion_cursos` y
  sincroniza catálogos y parámetros).
