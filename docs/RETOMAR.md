## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **Carril cerrado: I-005** (retiro del profesor + pre-liquidación simulada, D29/D34), **en producción** desde el 2026-10-08: migración **0063** aplicada en `pnvhpbxjbdmbktpwebtx` (solo crea la función `retirar_profesor`, permisos solo `service_role`; el control 48 da 1 antes y después: es el caso que originó el incidente, un profesor inactivo con una asignación abierta, y se resuelve con la pantalla «Retirar»). Un solo push con PR; falta que Javier confirme el chip PROD.
- **Qué incluye:** botón «Simular cierre del período» (Liquidaciones); «Retirar…» en Profesores (`/profesores/retirar/[id]`) con vista simulada, impresión sobre papel blanco, membresías inconclusas y liquidación por finalización al confirmar.
- **Siguiente: pase de I-003** (bono de tolerancia por curso, D35), rama `i-003-bono-por-curso` (commit `59c08df`, local, hay que rebasarla sobre `main`). Listo en dev; falta el OK explícito de Javier para: migración **0064** en producción, `scripts/corregir_bonos_i003.sql` (aplica el bono a Manuel Aguilar 4→59, Jorge Vilca 16→56 con inicio retroactivo al 2026-10-01 y su asistencia del 1/10, y Lucas Campero 20→63) y el push del código. Orden de `DECISIONES.md` §3: migración → corrección con antes/después → control 49 → un solo push → chip PROD.
- **Pendientes chicos de I-005 (sin disparador urgente):** cifra de liquidez en la simulación; valor `semana` en el catálogo de `periodicidad_liquidacion` (la liquidación real solo sabe `mes`); botón «Retirar» también en la ficha.
- **Datos de dev tocados por las pruebas:** Caceres, Angel y Nuñez, Oscar fueron retirados (cierres devengados); la membresía 35 (Leidy Ortiz) quedó `completada` y existe la venta 65. La skill `refrescar-dev` lo repone si molesta.
- **Cola registrada (`docs/INCIDENTES.md`):** I-002 corregir inscripciones (S3, D28) · I-004/I-006/I-007/I-008 reportes y pantalla de membresías (S3, pasan por Design).
- **Producción:** migraciones **0001–0063** (la 0064 es de I-003, todavía no).
- **Otros carriles abiertos:** H6 extensión de membresía (rama `h6-extension-membresia`, plan sin OK). Antes, sin urgencia: Hito A (pruebas de alquiler/particulares), H8 talleres, H9 horario hábil.
- **Regla vigente:** todo se hace en dev y lo prueba Claude; el pase a producción lo aprueba Javier por avance.
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout i-003-bono-por-curso
  npm run dev:limpio
  ```
