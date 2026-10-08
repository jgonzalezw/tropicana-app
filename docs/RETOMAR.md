## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **Carril cerrado: I-009** (y I-001), **en producción** desde el 2026-10-07: PR #15, merge `29fb879`, deploy Producción `success`. Sin migraciones. Falta que Javier confirme el chip PROD en `29fb879`.
- **Carril abierto: I-005** (rama `i-005-liquidar-profesor`, hecho en **dev**, 5 commits, sin PR): simulación de la pre-liquidación (D29) y «Retirar» al profesor con la migración **0063** (solo dev). **Espera de Javier:** probarlo y su OK al pase (la 0063 va a producción con él). Pendientes chicos: cifra de liquidez en la simulación, valor `semana` del parámetro, botón en la ficha. I-003 exige antes una decisión D.
- **Cola registrada (`docs/INCIDENTES.md`):** I-003 bono por curso (S2) · I-002 corregir inscripciones (S3, D28) · I-004/I-006/I-007/I-008 reportes y pantalla de membresías (S3, pasan por Design).
- **Carril abierto aparte: H6 extensión de membresía.** Rama `h6-extension-membresia`, sin código; plan en `docs/relevamientos/2026-10-04-plan-h6-extension-membresia.md`, espera el OK de Javier.
- **Producción:** migraciones **0001–0062**, en `main` `29fb879` (incluye I-001 e I-009).
- **Todo se hace en dev y se prueba primero (lo prueba Claude, con Playwright si el Chrome no conecta); el pase a producción lo aprueba Javier por avance** (pedido 2026-10-07).
- **Antes, sin urgencia:** Hito A (pruebas pendientes de alquiler/particulares), Hito B hecho, Hito C postergado (D31), H8 talleres y H9 horario hábil después. Detalle en `docs/relevamientos/2026-10-02-plan-alquileres-reservas.md`.
- **Clases de septiembre sin registrar** (5, de un solo curso: no traban la liquidación, conviene registrarlas) y **tablas `*_previo_*` de producción**: borrables cuando se confirme la liquidación de septiembre.
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout i-005-liquidar-profesor && git pull origin i-005-liquidar-profesor
  npm run dev:limpio
  ```
