# Tropicana — Backlog de UX / navegación (referencia: app Danze)

> Objetivo (Javier, 2026-09-05): **estandarizar las pantallas** y mejorar la
> **navegación**, tomando ideas de la app **Danze**. **NO** se rehace el look &
> feel desde cero — solo disposición, navegación y consistencia. Método de trabajo
> por pantalla: **v1 funcional** y luego pulido en **Claude Design** (salvo que se
> pida mockup primero). Empezar por **crear Planes**, luego **Inscribir**.

## Estándares transversales (aplican a TODA la app)
1. **Toggle para datos opcionales.** Cuando un dato aparece solo si se activa una
   condición, usar **un interruptor (toggle)**, no un texto/enlace de otro color.
   Mismo método siempre en casos equivalentes. Ejemplos: alumno con **tutor**,
   **aplicar descuento**, **límite de alumnos**, **permitir reservar**, **clases
   ilimitadas**.
2. **Teléfonos con código de área/país** (selector de país + número). Aplica a
   **alumnos, profesores** y proveedores (cuando existan).
3. **Listas sintéticas pero muy informativas.** Cada tarjeta/fila muestra los
   datos clave de un vistazo (ej. Danze: "Bs 250 · 8 clases · 31 días").

## Por pantalla

### Cursos (nuestra "Clase")
Nuestro modelo (un curso con **calendario de varios días**) se mantiene (es mejor
que el de Danze, que hace un curso por día). Agregar:
- **Duración** de la clase (minutos).
- **Límite de alumnos** opcional: **toggle** + capacidad máxima (campo `cupo`, ya
  existe en la base).
- **Permitir reservar** (toggle).

### Planes (crear/editar)
- Primero el **criterio de acceso**, y según eso aparece la lista de cursos:
  - **Toggle "¿clases ilimitadas?"** (N sin tope).
  - **"¿A qué clases accede el plan?"**: **Todas** · **Todas excepto las
    seleccionadas** · **Solo las seleccionadas**.
- **Listas informativas:** en la descripción del plan mostrar la **duración del
  ciclo** (días/semanas) y, por cada curso, **sus días de la semana**, compacto.
- **A definir:** la duración del ciclo en nuestro motor **se deriva** de N clases
  sobre el calendario (no es fija como el "31 días" de Danze). Decidir: mostrar
  **duración estimada** (calculada) o agregar **campo de duración** fijo.

### Profesores
- **Lista** con datos útiles (documento, email, WhatsApp) — como Danze.
- Campos nuevos: **tipo de documento** (lista) + **número**, **email**, **género**,
  **teléfono con código de área**, y **precio por clase** (honorario base del profe).

### Asignación profesor ↔ curso (paso 3)
- Agregar **Honorario por Clase**, que consumirá el **motor de comisiones** según
  la política del plan (criterio). Se concilia con el diseño de liquidación (1C).

### Dashboard / navegación (lo más grande; va al final)
- **KPIs** arriba (Estudiantes, Membresías activas, Ingresos del mes, Cobros
  pendientes).
- **Widgets de pendientes** (por vencer, cobros próximos, cumpleaños…) con
  **filtro** y **"Ver todo"**.
- **Botón + flotante** para acciones frecuentes.
- **Barra inferior** de navegación en celular; responsive PC + móvil.

## Esquema estimado (una migración 0014, a confirmar al construir cada parte)
- `cursos`: `duracion_min`, `permitir_reservar` (y usar `cupo` existente).
- `planes`: `acceso_modo` (todas | excepto | solo), `clases_ilimitadas`.
- `profesores`: `tipo_documento`, `numero_documento`, `email`, `genero`, `precio_clase`.
- `asignaciones`: `honorario_clase`.
- Teléfonos: `codigo_area`/país en `alumnos` y `profesores`.

## Secuencia propuesta
1. **Crear Planes** (acceso: ilimitadas + todas/excepto/solo; listas informativas).
2. **Inscribir** (membresías) con los estándares nuevos.
3. **Cursos** (duración, límite, reservar).
4. **Profesores** + honorario en asignación.
5. **Dashboard / navegación** (KPIs, widgets, + flotante, barra inferior).

Cada paso: mini-migración si hace falta, construcción, prueba en dev, y luego
pulido visual en Claude Design.
