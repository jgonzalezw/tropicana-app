## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **Carriles cerrados y en producción (2026-10-08):** I-003 (bono por curso, 0064, PR #19) · I-005 (retiro del profesor y pre-liquidación simulada, 0063, PR #18; falta validar con Natalia) · I-005b (cifra de liquidez en la simulación y «Retirar…» en la ficha, PR #21) · I-006 (baja por Retirar, triggers 0065, PR #22) · I-007 (fecha efectiva del retiro en la liquidación, 0066, PR #23) · I-010 (bono de Raquel López por script, sin migración).
- **Producción:** migraciones **0001–0066**; controles 48 y 50 en 0. Último deploy de código: `343b4bd` (`success`); después solo docs y scripts (I-010, PR #26).
- **Caceres, Angel** retirado en producción (corte 14/09, liquidación N° 4 de Bs. 75 abierta, por pagar en Caja). **Danza Comercial y Zumba esperan nuevo profesor**; los 3 Vivancos esperan sus 2 clases. Avisarles y pagar la N° 4 quedan en manos de Javier.
- **I-010:** Raquel López ya tiene su bono en la membresía 62. El respaldo `resp_i010_previo` se borró de producción con OK de Javier (2026-10-08): el rollback ya no tiene respaldo.
- **Respaldos de la 0066 borrados de producción** (con OK de Javier, 2026-10-08): el rollback de la 0066 ya no tiene respaldo. **Espera de Javier:** qué carril sigue.
- **Siguiente:** a elegir por Javier entre I-002 (corregir inscripciones, S3, D28) y los reportes I-004/I-006/I-007/I-008 (pasan por Design). Primer paso: plan en *plan mode*, abriendo con el backlog que toca. Postergadas nuevas: D36 (liquidación real por semana).
- **Anotado, sin carril:** la lectura `lineasPorPagar` (`src/lib/cuentas.ts`) ignora el error de lectura (calidad 1).
- **Dev refrescado con producción (2026-10-08, I-010):** ya no están los datos de prueba (Caceres, Nuñez, venta 65). El refresh no copia `membresia_bonos`: el control 49 da 9 en dev (membresías ajenas), no en producción. Refrescar de nuevo solo si se justifica.
- **Numeración a ordenar:** en `docs/INCIDENTES.md` I-004, I-006, I-007 e I-008 figuran como reportes abiertos, pero ESTADO y RETOMAR usan I-006 e I-007 para la baja por Retirar y la fecha efectiva del retiro; I-005b, I-006 e I-007 cerrados no tienen fila en INCIDENTES.
- **Otros carriles abiertos:** H6 extensión de membresía (rama `h6-extension-membresia`, plan sin OK). Antes, sin urgencia: Hito A, H8 talleres, H9 horario hábil.
- **Regla vigente:** todo se hace en dev y lo prueba Claude; el pase a producción lo aprueba Javier por avance.
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout main && git pull origin main
  npm run dev:limpio
  ```
