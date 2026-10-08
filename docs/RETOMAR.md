## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **I-011 (S2) cerrado y en producción (2026-10-08):** PR #28, merge `c4f0341`, deploy `success`; sin migración. Retiro con fecha pasada: avance al corte (`avanceAlCorte`), cuenta del alumno, bonos (también los de ventas anteriores a la 0064, leídos como excedente de `clases_plan`), sigla y ciclo junto al curso, A la fecha / Ya liquidado / Este cierre, interruptor para esconder la liquidación del que se retira, catálogo único de criterios. **Reconfirmado por Javier en producción** (Nuñez al 06/10/2026: Luz Marina, Yubinca, liquidación preliminar).
- **Pedido nuevo de Javier, sin carril (2026-10-08):** todos los cálculos de liquidación deben salir de un solo proceso estandarizado; el flujo (cierre normal, retiro, simulación) solo cambia el objetivo. Revisión hecha: el núcleo ya es uno (`calcularDevengos` y `calcularDevengosParticulares`), pero hay cuatro orquestaciones (`calcularPendientes*`, `lecturaPre`, `lecturaRetiro`, `cierreDeCuentas`), y el cierre por retiro es una rama de política aparte (avanza como criterio 2 sin importar el de la venta y paga sobre lo cobrado). Propuesta: carril propio, plan en *plan mode*. **Decidido (Javier, 2026-10-08):** el cierre por retiro se mantiene como política (D34 punto 4); en la unificación el retiro es un *modo* de la misma pieza.
- **Por abrir (Javier):** incidente de la simulación a fecha futura.
- **Carriles cerrados y en producción (2026-10-08):** I-003 (bono por curso, 0064) · I-005 (retiro y pre-liquidación simulada, 0063; falta validar con Natalia) · I-005b · I-006 (baja por Retirar, 0065) · I-007 (fecha efectiva del retiro, 0066) · I-010 (bono de Raquel López, script).
- **Producción:** migraciones **0001–0066**; controles 48 y 50 en 0. Último deploy de código: `c4f0341` (I-011, sin migración).
- **Caceres, Angel** retirado en producción (corte 14/09, liquidación N° 4 de Bs. 75 abierta, por pagar en Caja). **Danza Comercial y Zumba esperan nuevo profesor**; los 3 Vivancos esperan sus 2 clases. Avisarles y pagar la N° 4 quedan en manos de Javier.
- **Siguiente (si no hay otra urgencia):** I-002 (corregir inscripciones, S3, D28) o los reportes I-004/I-006/I-007/I-008 (pasan por Design). Primer paso: plan en *plan mode*, abriendo con el backlog que toca.
- **Anotado, sin carril:** `lineasPorPagar` (`src/lib/cuentas.ts`) ignora el error de lectura (calidad 1) · `desasignar` (`src/app/(privado)/profesores/acciones.ts`) lista las membresías pendientes con `clases_hechas` (mismo patrón de I-011; corregir con `avanceAlCorte`) · `docs/ESTADO.md` pasa de 25 KB: archivar los bloques de septiembre en `docs/archivo/`.
- **Dev refrescado con producción (2026-10-08, I-010):** el refresh no copia `membresia_bonos`; el control 49 da 9 en dev (membresías ajenas), no en producción.
- **Numeración a ordenar:** en `docs/INCIDENTES.md` I-004, I-006, I-007 e I-008 figuran como reportes abiertos, pero ESTADO y RETOMAR usan I-006 e I-007 para la baja por Retirar y la fecha efectiva del retiro; I-005b, I-006 e I-007 cerrados no tienen fila en INCIDENTES.
- **Otros carriles abiertos:** H6 extensión de membresía (rama `h6-extension-membresia`, plan sin OK). Antes, sin urgencia: Hito A, H8 talleres, H9 horario hábil.
- **Regla vigente:** todo se hace en dev y lo prueba Claude; el pase a producción lo aprueba Javier por avance.
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout main && git pull origin main
  npm run dev:limpio
  ```
