## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **R20 E4a implementada y comprobada en dev (2026-10-10), rama `r20-e4a-contenidos`** (apilada sobre `r20-notificaciones`; PR aparte con base en esa rama). 0071+0072 en dev, sin conectar ni liberar nada. Falta: tu revisión, y la comprobación manual del PR #47 (bloqueada por login). **No autorizado:** E4b/E4c, E5 (conectar), E6 (pantallas), liberar contenido, producción.
- **Carril R20 Notificaciones, plan v2 aprobado (2026-10-09), rama `r20-notificaciones`.** Plan en `docs/relevamientos/2026-10-09-plan-r20-notificaciones-v2.md` (la v1 queda como antecedente). Autorizado: **E2 en hitos** (H1 N09–N10 → H2 evidencia de equivalencia + encargo a Design → H3 resto de casos), solo en dev. **No autorizado:** migraciones, conectar casos, tocar consentimiento o `no_contactar`, publicar contenido oficial, producción. Decisiones abiertas: C1 `no_contactar`, C2 consentimientos v1 ambiguos, C3 edición al enviar, C4 política aplicable, C5 retención (no aprobada), C6 roles.
- **⏸ EN PAUSA (2026-10-10) — estado A: propuesta de E4 escrita, sin aprobar.** Rama `r20-notificaciones`, último commit de trabajo `4c41b4b`. Plan: `docs/relevamientos/2026-10-10-r20-propuesta-e4.md`. Aprobado: solo la partición E4a/E4b/E4c. **No aprobado:** E4a, las decisiones D-E4a-1/2/3, migraciones, pantallas, pase a producción, merge del PR #47 (lo gestiona solo Javier).
- **Siguiente paso:** **revisión final de la propuesta de E4 corregida** (`docs/relevamientos/2026-10-10-r20-propuesta-e4.md`: E4a contenidos / E4b avisos / E4c documentos) **y decisión sobre ejecutar E4a en dev** (con D-E4a-1 publicar/liberar solo Administrador, D-E4a-2 módulo oculto hasta E6, D-E4a-3 historial editorial permanente). **Este cierre documental no autoriza migraciones ni pantallas.** El merge del PR #47 lo gestiona solo Javier.
- **Hecho:** E2 completo (H1, H2, H3; 21 casos, 284 variantes únicas, 0 diferencias; cierre documental de H3 aceptado el 2026-10-10 dentro del alcance de textos y condiciones sin aviso). **Pendiente:** la revisión técnica del cableado (`…-r20-revision-tecnica-cableado.md`) es **autorrevisión**; falta la revisión separada y la **comprobación manual en dev** de reservas particulares, clases y ventas. Las comprobaciones de datos y destinatarios reales quedan para la conexión de cada caso. Design ajusta la entrega 1 y prepara la 2.
- **I-012 fase 4 → Certificaciones (R20 entrega 7a).** El plan viejo es antecedente archivado; rige `docs/relevamientos/2026-10-09-plan-certificaciones-v2.md`. Espera solo la base de R20 (E4) y la revisión de diseño; no depende de conectar todos los avisos.
- **Carril I-012 Membresías CERRADO y en producción (2026-10-09).** Fases 0, 1a, 1b, 2 y RLS del Profesor (0070). Producción en **0001–0070**; `membresias_nuevas` y `menu_plegable` en `true`. Detalle en `docs/PASES.md` y `docs/ESTADO.md`.
- **Proceso vigente:** se valida en dev y, si funciona, a producción; sin interruptores nuevos salvo que Javier lo pida. Siguen el respaldo `*_previo_*`, el rollback probado y los cabos cerrados.
- **Otros candidatos, sin carril:** I-002 (corregir inscripciones, S3, D28) · reportes I-004/I-008/I-013 (pasan por Design) · H6 extensión de membresía (plan sin OK, numeración vieja) · H9 horario hábil (entra en la etapa 4 de R20).
- **Backlog de I-012 (sin disparar):** botones «Llega en la fase N» · plazo para reagendar sin validar · tiempo de abrir la hoja (~1,7 s) · pruebas intermitentes conocidas (`membresias-1b-busqueda`; menú ⋯ y «Deshacer» del muestrario).
- **Anotado, sin carril:** aviso React #418 al cargar `/caja` en producción · `registrarCobro` (`src/lib/cuentas.ts`) ignora el error de lectura · el `restantes` de la cuenta del alumno cuenta solo presentes (como I-011).
- **Abierto (S4, I-014):** simulación de retiro de profesor a fecha futura.
- **Caceres, Angel** retirado en producción (liquidación N° 4 de Bs. 75 abierta, por pagar en Caja). Danza Comercial y Zumba esperan profesor; avisarles y pagar la N° 4 quedan en manos de Javier.
- **Refresh dev↔prod:** apaga `membresias_nuevas` y `menu_plegable` en dev, no copia `membresia_bonos` (control 49 da 9 en dev) y deja dev sin `sala_horario_patron`, `sala_horario_excepciones` ni `sala_tarifas`; compararlas con producción y revisar `/sala`.
- **Dev:** `rol_visibilidad` solo tiene selector para asistencia, caja, contactos, liquidaciones y particulares. El usuario QA usa `tropicana_alto_contraste`.
- **Próxima migración libre: 0073.** Producción nunca sin tu OK (el hook lo exige).
- **Para arrancar la sesión siguiente** (local):
  ```
  git checkout r20-notificaciones && git pull origin r20-notificaciones
  npm run dev:limpio
  ```
