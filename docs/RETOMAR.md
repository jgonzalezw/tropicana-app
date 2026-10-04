## Dónde retomar

Para que una sesión nueva no tenga que buscar en qué rama quedó el último
hito ni gastar tokens reconstruyéndolo (pedido de Javier, 2026-09-26): esto
se actualiza en el mismo commit que cierra cada hito, y una sesión nueva lo
lee **antes** de mirar ramas.

- **Método adoptado (kit de skills): EN `main` desde el 2026-10-04** (PR #11, `1dd2abf`; sin migraciones ni cambio de código de la app). Equivalencias en `CLAUDE.md`; incidentes en `docs/INCIDENTES.md`. "Dónde retomar" es este archivo, `docs/RETOMAR.md`.
- **Cierre de cuentas: EN PRODUCCIÓN desde el 2026-10-01** (PR #6, `main` `95a0edb`, migración 0062; ver §4). Isabel Góngora desasignada con corte 10/09, avance liquidado y pagado en Caja, verificado por Javier.
- **H7 alquiler + ventas y contactos unificados: EN PRODUCCIÓN desde el 2026-10-02** (0060 y 0061, PR #8, `main` `aa47824`; ver §4). Producción en migraciones **0001–0062**.
- **Hito B + gestión sin salir de `/sala`: EN PRODUCCIÓN desde el 2026-10-02** (PR #10, `main` `86a812b`, sin migraciones; ver §4). La rama `hito-b-reservas-alquiler` quedó mergeada: se trabaja desde `main`.
- **Rama activa (histórico, ya mergeada):** `hito-b-reservas-alquiler` (sale de `main`; Hito B + rendimiento de `/sala` + estandarización S1–S4 + «gestionar sin salir de `/sala`» (pasos 1–5, 2026-10-02), **sin push ni pase a producción**; último commit en `git log`). **Para adelantarla en otra máquina:** `git fetch origin hito-b-reservas-alquiler && git pull origin hito-b-reservas-alquiler`, luego `npm run dev:limpio` (hoy solo existe en el local; el servidor de desarrollo corre en el **puerto 3000**, el habilitado en el firewall para probar desde el celular en `http://192.168.0.2:3000`). Si dos sesiones trabajan a la vez, la segunda usa un `git worktree` aparte: comparten carpeta, rama y el servidor del puerto 3001.
- **Último hito cerrado:** H7 + ventas unificadas (E1–E4), más el arreglo del icono del selector de fecha en Edge (`color-scheme: dark`, ver `docs/ESTADO.md`, "Pase a producción de H7").
- **Qué sigue (plan aprobado por Javier el 2026-10-02; los alquileres ya se empiezan a vender y hoy no se pueden gestionar sus reservas):**
  0. **Hito B (gestión de reservas de alquiler) + rendimiento de `/sala` + estandarización S1–S4: construidos en dev el 2026-10-02, commiteados, sin push.** S1 alcance de cursos en el servidor (`errorAccesoCurso`), S2 reabrir exige horario libre (`reabrirSesion`) y `/asistencia?curso=&fecha=`, S3 slot estándar (`src/lib/slotSala.ts`, `SlotFila`, resumen por responder/por cerrar), S4 panel Gestionar único (`PanelGestionar.tsx`). **Probado en el navegador el 2026-10-02 (dev):** suspender y reabrir un curso con avisos, asistencia embebida, cancelar un alquiler fuera de plazo (queda Ausente, descuenta la hora, aviso al titular), Atrás, barra fija y 375 px (agenda y barra). **Falta probar:** el rol Profesor sin alcance sobre un curso ajeno (necesita su cuenta), reprogramar y suspender en alquiler, y el aviso a una organización. Decisiones y diferidos en la fila «Estandarización de /sala y Gestionar» (§1.b), D33 y `ROADMAP.md`.
  1. **Hito A — pruebas pendientes** (primero, en dev y en el navegador): alquiler con sala externa, categoría `editable` (glosa obligatoria; volver a `automatica`), cortesía y agenda fija de particulares, pruebas automáticas de `buscarDuplicado`/`asegurarRol`, control de contactos duplicados en `control_migracion.sql`, "Ver ficha ↗". (375 px ya se recorrió.)
  2. **Hito B — gestión de reservas de alquiler, sin migración:** generalizar las acciones de H3 de `particulares/acciones.ts` con un resolvedor por tipo de membresía (módulo de permiso, dueño, personas, avisos); pantalla `/alquileres/[id]` con el componente de reservas de `/particulares/[id]` hecho neutro; aviso al titular o a su persona de contacto. **Corrige un bug que ya está en producción:** `/sala` marca gestionable una reserva de alquiler pero `obtenerReservaParaGestion` solo acepta `tipo='particular'` ("Esa reserva no existe").
  3. **Hito C — el profesor gestiona sus reservas: POSTERGADO** (D31, §1).
  4. Después: H6 extensión de membresía, H8 talleres (pasa por Design) y H9 horario hábil.
  5. **Sin urgencia:** filtros por profesor y período en Liquidaciones (pantalla existente: se avisa antes de construir). **Postergada:** D29.
  - Plan completo (archivos, pasos y verificación) en `docs/relevamientos/2026-10-02-plan-alquileres-reservas.md`. Crear el plan de alquiler en producción lo hace Natalia cuando decida (la tabla de precios ya está cargada).
  - La **proyección de liquidez se quitó** de los pendientes (Javier, 2026-10-01).
- **Sin registrar al 2026-10-01 (medido en dev, copia de producción):** cinco
  clases de septiembre con alumnos (28/09 Tropicoreografico; 29/09 Contemporaneo
  y Zumba; 30/09 Danza Comercial y Tropicoreografico). Ninguna traba la
  liquidación de septiembre (todas de membresías de un solo curso, regla 17);
  conviene registrarlas igual.
- ~~Activar "Permite sala externa" en los planes de boda de producción~~: **hecho**
  por Javier (verificado el 2026-10-01: el único plan de boda, "WEDING DANCE
  ESCENCIA", lo tiene activo).
- **Respaldos en producción:** las tablas `*_previo_*` (`asignaciones/membresias/
  membresia_cursos_previo_datos_inicio`, `asignaciones_previo_zumba`) se pueden
  borrar cuando se confirme la primera liquidación (septiembre).
- **Para arrancar la sesión siguiente** (local; la rama es `main`, ya en GitHub):
  ```
  git checkout main && git pull origin main
  npm run dev:limpio
  ```
