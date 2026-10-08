## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **Carril cerrado: I-003** (bono de tolerancia por curso, D35), **en producción** desde el 2026-10-08: migración **0064** aplicada en `pnvhpbxjbdmbktpwebtx`, corrección de datos de Manuel Aguilar (4→59), Jorge Vilca (16→56, inicio 1/10 con su asistencia) y Lucas Campero (20→63) con respaldo `bono_correccion_i003_previo`, control 49 en 0. Un solo push con PR; falta que Javier confirme el chip PROD.
- **Carril anterior cerrado: I-005** (retiro del profesor + pre-liquidación simulada), en producción desde el 2026-10-08 (migración 0063, PR #18).
- **Siguiente:** a elegir con Javier entre la cola. Primer paso: plan en *plan mode*, abriendo con el backlog que toca.
- **Pendientes chicos de I-005 (sin disparador urgente):** cifra de liquidez en la simulación; valor `semana` en el catálogo de `periodicidad_liquidacion`; botón «Retirar» también en la ficha.
- **Cola registrada (`docs/INCIDENTES.md`):** I-002 corregir inscripciones (S3, D28) · I-004/I-006/I-007/I-008 reportes y pantalla de membresías (S3, pasan por Design).
- **Datos de dev tocados por las pruebas:** Caceres, Angel y Nuñez, Oscar fueron retirados; la membresía 35 (Leidy Ortiz) quedó `completada` y existe la venta 65. La skill `refrescar-dev` lo repone si molesta.
- **Producción:** migraciones **0001–0064**. El control 48 da 1 (profesor inactivo con asignación abierta; se resuelve con la pantalla «Retirar»). Tablas de respaldo `bono_previo_0064` y `bono_correccion_i003_previo`: borrables cuando Javier confirme la corrección.
- **Otros carriles abiertos:** H6 extensión de membresía (rama `h6-extension-membresia`, plan sin OK). Antes, sin urgencia: Hito A (pruebas de alquiler/particulares), H8 talleres, H9 horario hábil.
- **Regla vigente:** todo se hace en dev y lo prueba Claude; el pase a producción lo aprueba Javier por avance.
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout main && git pull origin main
  npm run dev:limpio
  ```
