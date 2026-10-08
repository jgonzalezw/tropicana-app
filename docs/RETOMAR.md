## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **Carril cerrado: I-003** (bono de tolerancia por curso, D35), **en producción** desde el 2026-10-08: PR #19, merge `5b3093d`, deploy Producción `success`, chip PROD confirmado por Javier. Migración **0064** aplicada, corrección de Manuel Aguilar (4→59), Jorge Vilca (16→56) y Lucas Campero (20→63) **confirmada por Javier**, control 49 en 0. Las tablas de respaldo `bono_previo_0064` y `bono_correccion_i003_previo` se borraron de producción (con su OK); el rollback en producción ya no tiene respaldo.
- **Carril anterior cerrado: I-005** (retiro del profesor + pre-liquidación simulada), en producción desde el 2026-10-08 (migración 0063, PR #18). Falta la validación con Natalia.
- **Carril abierto: I-006** (baja de profesor por Retirar, control 48), rama `i-006-baja-por-retiro` (sale de `i-005b-pendientes`; mergear primero esa). Migración **0065 en dev y producción** (2026-10-08). **Caceres retirado en producción** (corte 14/09, control 48 en 0, liquidación N° 4 de Bs. 75 por pagar). Danza Comercial y Zumba esperan nuevo profesor; los Vivancos esperan. Respaldos `resp_i006_*` borrados de producción (con OK). Avisar a los Vivancos y pagar los Bs. 75 de la liquidación N° 4 quedan en manos de Javier (cerrados por él).
- **Producción:** migraciones **0001–0065** (el control 48 da 0).
- **Siguiente:** a elegir por Javier entre I-002 (corregir inscripciones, S3, D28) y los reportes I-004/I-006/I-007/I-008 (pasan por Design). Primer paso: plan en *plan mode*, abriendo con el backlog que toca. **Espera de Javier:** qué carril.
- **Pendientes chicos de I-005: resueltos en I-005b** (rama `i-005b-pendientes`, sin migración): cifra de liquidez en la simulación, botón «Retirar…» en la ficha; `semana` no se agrega (D36, postergada). Falta el PR y el pase a producción, con OK de Javier.
- **Datos de dev tocados por las pruebas:** Caceres, Angel y Nuñez, Oscar retirados; la membresía 35 (Leidy Ortiz) quedó `completada` y existe la venta 65. La skill `refrescar-dev` lo repone si molesta.
- **Otros carriles abiertos:** H6 extensión de membresía (rama `h6-extension-membresia`, plan sin OK). Antes, sin urgencia: Hito A (pruebas de alquiler/particulares), H8 talleres, H9 horario hábil.
- **Regla vigente:** todo se hace en dev y lo prueba Claude; el pase a producción lo aprueba Javier por avance.
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout main && git pull origin main
  npm run dev:limpio
  ```
