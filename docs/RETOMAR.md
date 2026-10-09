## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **Carril I-012 Membresías CERRADO y en producción (2026-10-09).** Fases 0, 1a, 1b y 2 (PR #34, #37, #38, #39, #41) y RLS del Profesor (0070, PR #44, merge `ae427b3`, chip PROD `#ae427b3`). Producción en **0001–0070**; `membresias_nuevas` y `menu_plegable` en `true`. Token de producción: ES256 (`5bbd09b5…`), 3600 s. Detalle en `docs/PASES.md` y `docs/ESTADO.md`. Sin pendientes del pase: sin tablas `*_previo`, sin membresía de prueba.
- **Proceso vigente (desde 2026-10-09):** se valida en dev y, si funciona, a producción; sin interruptores nuevos ni etapas salvo que Javier lo pida. Siguen el respaldo `*_previo_*`, el rollback probado y los cabos cerrados (memoria `feedback_proceso_pase_simple`).
- **Siguiente paso:** Javier elige carril. Candidatos, en este orden: I-002 (corregir inscripciones, S3, D28) · reportes I-004/I-008/I-013 (pasan por Design) · H6 extensión de membresía (rama `h6-extension-membresia`, plan sin OK). Todo plan abre mostrando el backlog que toca.
- **Backlog de I-012 (sin disparar):** botones «Llega en la fase N» (Cobrar, Renovar, menú ⋯, lugar externo) · plazo para reagendar sin validar · decidir si se baja más el tiempo de abrir la hoja (~1,7 s, unificando consultas en una función SQL; la acción hace ~15 consultas) · pruebas intermitentes conocidas (`membresias-1b-busqueda` por pushState; menú ⋯ y aviso «Deshacer» del muestrario).
- **Anotado, sin carril:** aviso React #418 (hidratación de texto) visto una vez al cargar `/caja` en producción, a revisar cuando se toque esa pantalla · `registrarCobro` (`src/lib/cuentas.ts`) ignora el error de lectura (calidad 1) · el `restantes` de la cuenta del alumno cuenta solo presentes (mismo defecto de I-011).
- **Abierto (S4, I-014):** simulación de retiro de profesor a fecha futura; Javier cuenta qué vio cuando se retome.
- **Caceres, Angel** retirado en producción (corte 14/09, liquidación N° 4 de Bs. 75 abierta, por pagar en Caja). **Danza Comercial y Zumba esperan nuevo profesor**; los 3 Vivancos esperan sus 2 clases. Avisarles y pagar la N° 4 quedan en manos de Javier.
- **Refresh dev↔prod:** el refresh apaga `membresias_nuevas` y `menu_plegable` en dev si no se reponen, no copia `membresia_bonos` (el control 49 da 9 en dev, no en producción), y deja dev sin `sala_horario_patron`, `sala_horario_excepciones` ni `sala_tarifas`; tras todo refresh, comparar esas tablas con producción y revisar `/sala`.
- **Dev:** `rol_visibilidad` solo tiene selector para asistencia, caja, contactos, liquidaciones y particulares (regla de calidad 11). El usuario QA usa `tropicana_alto_contraste`.
- **Próxima migración libre: 0071.** Pendiente de ordenar: el plan de H6 usa una numeración vieja.
- **Regla vigente:** todo se hace en dev y lo prueba Claude; el pase a producción lo aprueba Javier cada vez (el hook lo exige).
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout main && git pull origin main
  npm run dev:limpio
  ```
