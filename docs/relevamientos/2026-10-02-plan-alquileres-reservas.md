# Alquileres: pruebas pendientes, gestión de reservas y profesor con sus reservas

## Contexto
H7 está en producción (0060/0061, 2026-10-02) y los alquileres se van a empezar a vender, pero
`/alquileres` es **solo lectura**: no se puede confirmar, reprogramar, cancelar ni marcar
realizada una reserva de alquiler. Javier pide (2026-10-02): **(1)** cerrar primero las pruebas
pendientes; **(2)** completar la gestión de reservas de alquiler; **(3)** que el profesor gestione
sus reservas (de alquiler, cuando él es el titular, y de sus particulares) bajo permisos.
El plan de alquiler en prod lo crea Natalia cuando decida: sale de pendientes.

**Backlog de decisiones postergadas que toca:** D5 (lado alquiler: se cierra al tener cobro
+ gestión), D4 ("Ver ficha ↗", se prueba en el Hito A). Ninguna otra.

### Lo medido (lectura)
- La gestión H3 vive en `src/app/(privado)/particulares/acciones.ts`: `crearReserva`,
  `cambiarEstadoReserva`, `reprogramarReserva`, `cancelarAPedido`, `obtenerMembresiaParticular`,
  `obtenerReservaParaGestion`. Todas filtran `categoria_aplicada is null` o `tipo='particular'`,
  usan el permiso `particulares` y el dueño `profesor_id`.
- **Bug ya en prod:** `/sala` (`sala/acciones.ts:222` y `:386`) marca como *gestionable* una
  reserva de **alquiler** con `particulares.editar`, pero `obtenerReservaParaGestion` rechaza
  todo lo que no sea `tipo='particular'` → al abrirla dice "Esa reserva no existe".
- Las reservas de alquiler nacen con `profesor_id = null` (`inscribir/accionesAlquiler.ts:491`);
  el titular es `membresias.contacto_id`.
- **Profesor en dev:** `particulares` ver/crear/editar con alcance `propio` (desde 0056) → ya
  gestiona sus particulares; falta probarlo de punta a punta. `alquileres`: sin permiso.
- `MODULOS_CON_ALCANCE` (`src/lib/tipos.ts:818`) no incluye `alquileres`; `alcancePropioDe`
  (`src/lib/sesion.ts:108`) devuelve `profesorId`, no el contacto.

---

## Paso 0 — Commit del fix de Edge + cierre de docs (lo pedido ya)
- Commit en `h7-alquiler` de `src/app/globals.css` (`color-scheme: dark`).
- `docs/ESTADO.md`: cierre del pase H7 (0060/0061 en prod 2026-10-02, PR #8, `aa47824`) y el fix.
- `docs/DECISIONES.md`, "Dónde retomar": rama activa `main`, prod 0001–0062, H7 en prod, sacar
  "cargar precios/crear plan en prod" de pendientes (lo hace Natalia), y **qué sigue = este plan**
  (Hitos A–C). 
- Memorias: actualizar `project_h7_alquiler_estado.md` y `project_cierre_cuentas_prod.md`.
- Un commit con todo; **aviso a Javier** y espero su OK para el pase a prod (un solo push,
  PR a `main`, chip PROD). Sin migración: es solo código + docs.

## Hito A — Pruebas pendientes (primero, en dev, en el navegador)
Cada falla se corrige en el mismo hito; al cerrar, lista de resultados a Javier.
1. **Alquiler con sala externa**: plan de alquiler con `permite_sala_externa`, vender con lugar
   externo, ver que no valida ocupación y aparece en "Agendamientos externos" de `/sala`.
2. **Categoría `editable`**: poner `alquiler_categoria_modo='editable'`, vender cambiando la
   categoría → exige glosa, guarda propuesta + aplicada; volver a `automatica` al terminar.
3. **Particulares: cortesía** (reserva puntual y membresía entera, con `permite_cortesia`) y
   **agenda fija** (varias reservas de una vez).
4. **Pruebas automáticas** de `buscarDuplicado` y `asegurarRol` (`npm test`), y **control nuevo
   en `scripts/control_migracion.sql`**: contactos duplicados (mismo WhatsApp o documento en dos
   contactos distintos), que es lo que `buscarDuplicado`/`asegurarRol` deben impedir.
5. **"Ver ficha ↗"** en las tarjetas de contacto de las ventas.
6. **375 px** en la venta de alquiler y en `/alquileres`.

## Hito B — Gestión de reservas de alquiler (sin migración)
Reusar H3 entero, no copiarlo (regla de proceso 4):
- **Generalizar las acciones de reserva** de `particulares/acciones.ts` con un resolvedor
  `contextoReservaMembresia(membresiaId)` que devuelve el tipo (`particular`|`alquiler`), el
  **módulo de permiso** (`particulares`|`alquileres`), el **chequeo de dueño** (profesor de la
  membresía vs. titular del alquiler, ver Hito C), las personas (acompañantes vs.
  `alquiler_personas`) y el texto de los avisos. Las acciones existentes pasan a usarlo:
  `crearReserva` inserta `tipo` según la membresía y `profesor_id` null en alquiler (la
  validación de franja ya acepta profesor null); `cambiarEstadoReserva`, `reprogramarReserva`,
  `cancelarAPedido`, `obtenerReservaParaGestion` aceptan `tipo='alquiler'`.
- **Avisos WhatsApp** de alquiler: solo al titular (o su persona de contacto si es
  organización), con `destinatarioAviso` ya existente.
- **Pantalla `/alquileres/[id]`**: monta el mismo componente de reservas de
  `particulares/[id]/ClienteMembresiaParticular.tsx` (renombrado a algo neutro, p. ej.
  `ReservasDeMembresia`, con props para título/etiquetas), con saldo de horas de alquiler, los
  7 estados, reprogramar, cancelar a pedido, suspender y `+ Nueva reserva`. Cada fila de
  `/alquileres` enlaza a su detalle. Sin cortesía en alquiler (no está en el plan de alquiler).
- **`/sala`**: la reserva de alquiler es gestionable con `alquileres.editar` (no
  `particulares.editar`) → corrige el bug medido arriba.
- `recalcularMembresia` al cambiar estado: el alquiler se agota por horas y se cierra si está
  cobrado (regla 1 y 3).

## Hito C — El profesor gestiona sus reservas, bajo permisos
- `alquileres` entra a `MODULOS_CON_ALCANCE`; **dueño del alquiler = el titular**: con alcance
  `propio`, el profesor ve y gestiona solo los alquileres cuyo `contacto_id` es el contacto de
  su ficha de profesor (helper nuevo en `sesion.ts`: `obtenerContactoProfesorActual`, junto a
  `obtenerProfesorActual`). Aplica a `listarAlquileres`, `/alquileres/[id]`, las acciones del
  Hito B y `/sala`.
- **Migración 0063** (Profesor es rol de sistema, como la 0041): `alquileres` ver + editar
  (crear reserva dentro de su alquiler incluido; **vender** sigue sin permiso, se gobierna en
  Inscribir) con alcance `propio`. Idempotente. Configurable después en Roles y Permisos.
- **Particulares**: ya tiene ver/crear/editar `propio` desde 0056; se prueba con la cuenta de
  Oscar Núñez (lista, detalle, nueva reserva, confirmar/reprogramar/cancelar, `/sala`) y se
  corrige lo que aparezca.
- Control nuevo en `control_migracion.sql`: reserva de alquiler con `profesor_id` no nulo o
  sin membresía de alquiler.

## Pase a producción (al final de B+C, con OK explícito de Javier)
Ensayo en seco de 0063 → 0063 en prod → controles + `get_advisors` → un solo push → chip PROD.
Docs: `ESTADO.md` por hito, "Dónde retomar" en cada cierre.

## Verificación
- `npx tsc --noEmit`, `npm run lint`, `npm test` (con las pruebas nuevas del Hito A).
- Navegador en dev, `npm run dev:limpio`:
  - Admin: vender alquiler → `/alquileres/[id]` → solicitar, confirmar, reprogramar, cancelar
    en plazo y fuera de plazo (Ausente), realizada; saldo correcto; aviso WhatsApp al titular.
  - `/sala`: abrir una reserva de alquiler y gestionarla (antes daba "no existe").
  - Cuenta de Profesor (Oscar): ve solo sus particulares y solo los alquileres donde él es
    titular; por URL directa a otro alquiler → mensaje de "otro titular", no datos.
- Controles nuevos en 0 en dev antes del pase.
