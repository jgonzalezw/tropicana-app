## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **Carril R20 Notificaciones, Etapa 0 entregada (2026-10-09), rama `r20-notificaciones`.** Plan en `docs/relevamientos/2026-10-09-plan-r20-notificaciones.md`; sin código ni migraciones. **Espera tu OK al alcance** y las decisiones de su §10 (primer caso, roles, `no_contactar`, edición al enviar, retención, orden con la fase 4).
- **Siguiente paso:** con el OK, incremento **1.1** (mover los textos a funciones puras con pruebas de caracterización, sin cambiar ninguno). En paralelo, el paquete para Claude Design (§9 del plan): mockups S01–S05 antes de cualquier pantalla.
- **PAUSA, estado A: I-012 fase 4 (Reporte de la membresía).** Plan en `docs/relevamientos/2026-10-09-plan-i012-fase-4-reporte.md`; se reconstruye sobre la capa de R20 (etapa 3), así que no se arranca antes.
- **Carril I-012 Membresías CERRADO y en producción (2026-10-09).** Fases 0, 1a, 1b, 2 y RLS del Profesor (0070). Producción en **0001–0070**; `membresias_nuevas` y `menu_plegable` en `true`. Detalle en `docs/PASES.md` y `docs/ESTADO.md`.
- **Proceso vigente:** se valida en dev y, si funciona, a producción; sin interruptores nuevos salvo que Javier lo pida. Siguen el respaldo `*_previo_*`, el rollback probado y los cabos cerrados.
- **Otros candidatos, sin carril:** I-002 (corregir inscripciones, S3, D28) · reportes I-004/I-008/I-013 (pasan por Design) · H6 extensión de membresía (plan sin OK, numeración vieja) · H9 horario hábil (entra en la etapa 4 de R20).
- **Backlog de I-012 (sin disparar):** botones «Llega en la fase N» · plazo para reagendar sin validar · tiempo de abrir la hoja (~1,7 s) · pruebas intermitentes conocidas (`membresias-1b-busqueda`; menú ⋯ y «Deshacer» del muestrario).
- **Anotado, sin carril:** aviso React #418 al cargar `/caja` en producción · `registrarCobro` (`src/lib/cuentas.ts`) ignora el error de lectura · el `restantes` de la cuenta del alumno cuenta solo presentes (como I-011).
- **Abierto (S4, I-014):** simulación de retiro de profesor a fecha futura.
- **Caceres, Angel** retirado en producción (liquidación N° 4 de Bs. 75 abierta, por pagar en Caja). Danza Comercial y Zumba esperan profesor; avisarles y pagar la N° 4 quedan en manos de Javier.
- **Refresh dev↔prod:** apaga `membresias_nuevas` y `menu_plegable` en dev, no copia `membresia_bonos` (control 49 da 9 en dev) y deja dev sin `sala_horario_patron`, `sala_horario_excepciones` ni `sala_tarifas`; compararlas con producción y revisar `/sala`.
- **Dev:** `rol_visibilidad` solo tiene selector para asistencia, caja, contactos, liquidaciones y particulares. El usuario QA usa `tropicana_alto_contraste`.
- **Próxima migración libre: 0071.** Producción nunca sin tu OK (el hook lo exige).
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout r20-notificaciones && git pull origin r20-notificaciones
  npm run dev:limpio
  ```
