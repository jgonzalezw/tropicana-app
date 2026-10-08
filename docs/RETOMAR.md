## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **Carril abierto: I-011 (S2) — retiro con fecha pasada.** Rama `fix/i-011-retiro-fecha-pasada`, **corregido en dev, sin push ni pase a producción**. Medido en producción con Oscar Nuñez al 06/10/2026: (1) Luz Marina Araujo mostraba 1 de 8 porque el avance leía `clases_hechas` (solo presentes); ahora usa la regla de Asistencia (`avanceAlCorte` en `src/lib/ordinalClase.ts`) y da 2 de 8; (2) Yubinca (particular) da Bs. 250 a la fecha, pero Bs. 150 ya estaban en la liquidación N° 3: la línea ahora dice A la fecha / Ya liquidado (N° 3) / Este cierre (100); la plata no cambió; (3) las líneas traen precio, descuento, pagado, saldo, bono aplicado, bono para renovar y la sigla del criterio; (4) interruptor «Incluir la liquidación del profesor que se retira» (pantalla e impreso apaisado) para dar la hoja al profesor nuevo; (5) un solo catálogo de criterios (`src/lib/liquidacion/criterios.ts`; había cuatro).
- **Espera de Javier:** reconfirmar en pantalla (Retirar a Nuñez, corte 06/10/2026: Luz Marina 2 de 8; Yubinca 250 / 150 N° 3 / 100; el interruptor) y dar el OK del pase (solo código, sin migración).
- **Pedido nuevo de Javier, sin carril (2026-10-08):** todos los cálculos de liquidación deben salir de un solo proceso estandarizado; el flujo (cierre normal, retiro, simulación) solo cambia el objetivo. Revisión hecha: el núcleo ya es uno (`calcularDevengos` y `calcularDevengosParticulares`), pero hay cuatro orquestaciones (`calcularPendientes*`, `lecturaPre`, `lecturaRetiro`, `cierreDeCuentas`), y el cierre por retiro es una rama de política aparte (avanza como criterio 2 sin importar el de la venta y paga sobre lo cobrado). Propuesta: carril propio, plan en *plan mode*. **Antes necesita su decisión:** ¿la excepción del retiro (D34) se mantiene como política o cada criterio dice qué se paga al retirarse?
- **Por abrir (Javier):** incidente de la simulación a fecha futura.
- **Carriles cerrados y en producción (2026-10-08):** I-003 (bono por curso, 0064) · I-005 (retiro y pre-liquidación simulada, 0063; falta validar con Natalia) · I-005b · I-006 (baja por Retirar, 0065) · I-007 (fecha efectiva del retiro, 0066) · I-010 (bono de Raquel López, script).
- **Producción:** migraciones **0001–0066**; controles 48 y 50 en 0. Último deploy de código: `343b4bd`; después solo docs y scripts. I-011 no lleva migración.
- **Caceres, Angel** retirado en producción (corte 14/09, liquidación N° 4 de Bs. 75 abierta, por pagar en Caja). **Danza Comercial y Zumba esperan nuevo profesor**; los 3 Vivancos esperan sus 2 clases. Avisarles y pagar la N° 4 quedan en manos de Javier.
- **Siguiente (si no hay otra urgencia):** I-002 (corregir inscripciones, S3, D28) o los reportes I-004/I-006/I-007/I-008 (pasan por Design). Primer paso: plan en *plan mode*, abriendo con el backlog que toca.
- **Anotado, sin carril:** `lineasPorPagar` (`src/lib/cuentas.ts`) ignora el error de lectura (calidad 1) · `desasignar` (`src/app/(privado)/profesores/acciones.ts`) lista las membresías pendientes con `clases_hechas` (mismo patrón de I-011; corregir con `avanceAlCorte`) · `docs/ESTADO.md` pasa de 25 KB: archivar los bloques de septiembre en `docs/archivo/`.
- **Dev refrescado con producción (2026-10-08, I-010):** el refresh no copia `membresia_bonos`; el control 49 da 9 en dev (membresías ajenas), no en producción.
- **Numeración a ordenar:** en `docs/INCIDENTES.md` I-004, I-006, I-007 e I-008 figuran como reportes abiertos, pero ESTADO y RETOMAR usan I-006 e I-007 para la baja por Retirar y la fecha efectiva del retiro; I-005b, I-006 e I-007 cerrados no tienen fila en INCIDENTES.
- **Otros carriles abiertos:** H6 extensión de membresía (rama `h6-extension-membresia`, plan sin OK). Antes, sin urgencia: Hito A, H8 talleres, H9 horario hábil.
- **Regla vigente:** todo se hace en dev y lo prueba Claude; el pase a producción lo aprueba Javier por avance.
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout fix/i-011-retiro-fecha-pasada
  npm run dev:limpio
  ```
