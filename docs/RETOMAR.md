## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **Carril cerrado: I-009** (número de clase en Asistencia: «Clase N de M · quedan K», pastilla «Última clase»). Rama `fix/i-009` (sale de `fix/i-001`), último commit `[I-009] cierre`. Validado por Javier en dev el 2026-10-07. **Solo dev, sin migración.** Falta su OK para el pase a `main`/producción (PR sin abrir; I-001 e I-009 van juntos).
- **Siguiente carril: I-005** (liquidar al profesor + pre-liquidación por profesor + D29 activada, S2). Primer paso: plan en *plan mode*, abriendo con el backlog que toca (D29). **Espera de Javier:** el OK al plan. I-003 (bono por curso) exige antes una decisión D.
- **Cola registrada (`docs/INCIDENTES.md`):** I-003 bono por curso (S2) · I-002 corregir inscripciones (S3, D28) · I-004/I-006/I-007/I-008 reportes y pantalla de membresías (S3, pasan por Design).
- **Carril abierto aparte: H6 extensión de membresía.** Rama `h6-extension-membresia`, sin código; plan en `docs/relevamientos/2026-10-04-plan-h6-extension-membresia.md`, espera el OK de Javier.
- **Producción:** migraciones **0001–0062**, en `main` `bd83736`. Nada de esta tanda está en producción.
- **Todo se hace en dev y se prueba primero (lo prueba Claude, con Playwright si el Chrome no conecta); el pase a producción lo aprueba Javier por avance** (pedido 2026-10-07).
- **Antes, sin urgencia:** Hito A (pruebas pendientes de alquiler/particulares), Hito B hecho, Hito C postergado (D31), H8 talleres y H9 horario hábil después. Detalle en `docs/relevamientos/2026-10-02-plan-alquileres-reservas.md`.
- **Clases de septiembre sin registrar** (5, de un solo curso: no traban la liquidación, conviene registrarlas) y **tablas `*_previo_*` de producción**: borrables cuando se confirme la liquidación de septiembre.
- **Para arrancar la sesión siguiente** (local; la rama queda en `fix/i-009`, ya en GitHub):
  ```
  git checkout fix/i-009 && git pull origin fix/i-009
  npm run dev:limpio
  ```
