## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **I-012 Membresías, fase 0 construida en dev (2026-10-08), rama `membresias/fase-0`, PR abierto para tu revisión:** solo datos, sin pantalla y sin migración; cuenta del alumno y recibo idénticos. **Siguiente: fase 1a** (shell básico: interruptor `membresias_nuevas`, componentes `src/components/nuevo/`, `seccionesVisibles`, Playwright), con plan propio antes de tocar código. Las 8 fases están en el handoff `D:dev	ropicana-Claude.Design-Handoff61008 - appshell basico + ficha membresia`; decisiones en D37.
- **Hito 0 (higiene) cerrado y en producción (2026-10-08):** PR #32, merge `bf76d8a`, deploy `success`; sin migración; **chip PROD confirmado por Javier**. Caja lee con `exigir()` (`lineasPorPagar`, `lineasPorCobrar`), INCIDENTES ordenado (reportes I-012/I-013), ESTADO archivado (38 → 20 KB).
- **I-011 (S2) cerrado y en producción (2026-10-08):** PR #28, merge `c4f0341`, deploy `success`; sin migración. Retiro con fecha pasada: avance al corte (`avanceAlCorte`), cuenta del alumno, bonos (también los de ventas anteriores a la 0064, leídos como excedente de `clases_plan`), sigla y ciclo junto al curso, A la fecha / Ya liquidado / Este cierre, interruptor para esconder la liquidación del que se retira, catálogo único de criterios. **Reconfirmado por Javier en producción** (Nuñez al 06/10/2026: Luz Marina, Yubinca, liquidación preliminar).
- **L-01 cerrado y en producción (2026-10-08):** PR #31, merge `dd3a629`, deploy `success`; sin migración. Un solo proceso de cálculo (`liquidar`) y una sola exposición de liquidación (línea, formateador y tablas compartidas) en retiro, pre-liquidación, simulación, Liquidaciones y comprobante; las trabas del retiro nombran alumno, curso y fecha. Validado por Javier en dev. El cierre por retiro sigue como política (D34 punto 4).
- **Abierto (S4, I-014):** simulación de retiro de profesor a fecha futura; Javier cuenta qué vio cuando se retome.
- **Carriles cerrados y en producción (2026-10-08):** I-003 (bono por curso, 0064) · I-005 (retiro y pre-liquidación simulada, 0063; falta validar con Natalia) · I-005b · I-006 (baja por Retirar, 0065) · I-007 (fecha efectiva del retiro, 0066) · I-010 (bono de Raquel López, script).
- **Producción:** migraciones **0001–0066**; controles 48 y 50 en 0. Último deploy de código: `bf76d8a` (Hito 0, sin migración).
- **Caceres, Angel** retirado en producción (corte 14/09, liquidación N° 4 de Bs. 75 abierta, por pagar en Caja). **Danza Comercial y Zumba esperan nuevo profesor**; los 3 Vivancos esperan sus 2 clases. Avisarles y pagar la N° 4 quedan en manos de Javier.
- **Siguiente:** I-012 fase 1a · luego I-002 (corregir inscripciones, S3, D28) · luego los reportes I-004/I-008/I-012/I-013 (pasan por Design). Primer paso: plan en *plan mode*, abriendo con el backlog que toca.
- **Anotado, sin carril:** `estadoDeCuenta` y `registrarCobro` (`src/lib/cuentas.ts`) ignoran el error de lectura (calidad 1; `lineasPorPagar` y `lineasPorCobrar` ya se corrigieron en el Hito 0) · `desasignar` ya usa `avanceAlCorte` (L-01).
- **Dev refrescado con producción (2026-10-08, I-010):** el refresh no copia `membresia_bonos`; el control 49 da 9 en dev (membresías ajenas), no en producción.
- **Refresh dev↔prod y horarios de sala (2026-10-08):** el refresh dejó dev sin `sala_horario_patron`, `sala_horario_excepciones` ni `sala_tarifas`, y con paquetes de horas de más; se repusieron desde producción (huellas md5 iguales). Tras todo refresh, comparar esas tablas con producción y `/sala` en dev.
- **Numeración (ordenada en el Hito 0, 2026-10-08):** los reportes abiertos pasan a I-012 (membresías) e I-013 (curso); I-004 e I-008 siguen. I-005b, I-006 e I-007 cerrados ya tienen fila en `docs/INCIDENTES.md`.
- **Otros carriles abiertos:** H6 extensión de membresía (rama `h6-extension-membresia`, plan sin OK). Antes, sin urgencia: Hito A, H8 talleres, H9 horario hábil.
- **Regla vigente:** todo se hace en dev y lo prueba Claude; el pase a producción lo aprueba Javier por avance.
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout main && git pull origin main
  npm run dev:limpio
  ```
