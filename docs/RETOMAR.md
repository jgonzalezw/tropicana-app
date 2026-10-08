## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **I-011 (S2) cerrado y en producción (2026-10-08):** PR #28, merge `c4f0341`, deploy `success`; sin migración. Retiro con fecha pasada: avance al corte (`avanceAlCorte`), cuenta del alumno, bonos (también los de ventas anteriores a la 0064, leídos como excedente de `clases_plan`), sigla y ciclo junto al curso, A la fecha / Ya liquidado / Este cierre, interruptor para esconder la liquidación del que se retira, catálogo único de criterios. **Reconfirmado por Javier en producción** (Nuñez al 06/10/2026: Luz Marina, Yubinca, liquidación preliminar).
- **L-01 cerrado y en producción (2026-10-08):** PR #31, merge `dd3a629`, deploy `success`; sin migración. Un solo proceso de cálculo (`liquidar`) y una sola exposición de liquidación (línea, formateador y tablas compartidas) en retiro, pre-liquidación, simulación, Liquidaciones y comprobante; las trabas del retiro nombran alumno, curso y fecha. Validado por Javier en dev. El cierre por retiro sigue como política (D34 punto 4).
- **Por abrir (Javier):** incidente de la simulación a fecha futura.
- **Carriles cerrados y en producción (2026-10-08):** I-003 (bono por curso, 0064) · I-005 (retiro y pre-liquidación simulada, 0063; falta validar con Natalia) · I-005b · I-006 (baja por Retirar, 0065) · I-007 (fecha efectiva del retiro, 0066) · I-010 (bono de Raquel López, script).
- **Producción:** migraciones **0001–0066**; controles 48 y 50 en 0. Último deploy de código: `dd3a629` (L-01, sin migración).
- **Caceres, Angel** retirado en producción (corte 14/09, liquidación N° 4 de Bs. 75 abierta, por pagar en Caja). **Danza Comercial y Zumba esperan nuevo profesor**; los 3 Vivancos esperan sus 2 clases. Avisarles y pagar la N° 4 quedan en manos de Javier.
- **Siguiente (si no hay otra urgencia):** I-002 (corregir inscripciones, S3, D28) o los reportes I-004/I-006/I-007/I-008 (pasan por Design). Primer paso: plan en *plan mode*, abriendo con el backlog que toca.
- **Anotado, sin carril:** `lineasPorPagar` (`src/lib/cuentas.ts`) ignora el error de lectura (calidad 1) · `desasignar` (`src/app/(privado)/profesores/acciones.ts`) lista las membresías pendientes con `clases_hechas` (mismo patrón de I-011; corregir con `avanceAlCorte`) · `docs/ESTADO.md` sigue en 38 KB tras archivar 0bis/0quinquies/0duodecies en `docs/archivo/ESTADO-2026-09.md`: archivar también las secciones 1–7 cuando se consoliden.
- **Dev refrescado con producción (2026-10-08, I-010):** el refresh no copia `membresia_bonos`; el control 49 da 9 en dev (membresías ajenas), no en producción.
- **Refresh dev↔prod y horarios de sala (2026-10-08):** el refresh dejó dev sin `sala_horario_patron`, `sala_horario_excepciones` ni `sala_tarifas`, y con paquetes de horas de más; se repusieron desde producción (huellas md5 iguales). Tras todo refresh, comparar esas tablas con producción y `/sala` en dev.
- **Numeración a ordenar:** en `docs/INCIDENTES.md` I-004, I-006, I-007 e I-008 figuran como reportes abiertos, pero ESTADO y RETOMAR usan I-006 e I-007 para la baja por Retirar y la fecha efectiva del retiro; I-005b, I-006 e I-007 cerrados no tienen fila en INCIDENTES.
- **Otros carriles abiertos:** H6 extensión de membresía (rama `h6-extension-membresia`, plan sin OK). Antes, sin urgencia: Hito A, H8 talleres, H9 horario hábil.
- **Regla vigente:** todo se hace en dev y lo prueba Claude; el pase a producción lo aprueba Javier por avance.
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout main && git pull origin main
  npm run dev:limpio
  ```
