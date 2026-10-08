## Dónde retomar

Se actualiza en el mismo commit que cierra cada carril; una sesión nueva lo lee **antes** de mirar ramas.

- **Carril en espera de validación: I-005** (retiro del profesor + pre-liquidación simulada, D29/D34). **Hecho y probado en dev**, rama `i-005-liquidar-profesor`, último commit `f0a2406`, empujada. **Sin PR** a propósito: Javier lo revisó y está OK, pero valida con Natalia antes de pedir el pase.
- **Qué incluye:** botón «Simular cierre del período» (Liquidaciones); «Retirar…» en Profesores (`/profesores/retirar/[id]`) con vista simulada, impresión sobre papel blanco, membresías inconclusas (una línea por membresía) y liquidación por finalización al confirmar; migración **0063** `retirar_profesor` (todo o nada) y control 48.
- **Espera de Javier:** la validación con Natalia y luego el OK explícito al pase (PR + migración 0063 a producción). Si Natalia pide cambios, se hacen en esa rama.
- **Pendientes chicos de I-005 (sin disparador urgente):** cifra de liquidez en la simulación; valor `semana` en el catálogo de `periodicidad_liquidacion` (la liquidación real solo sabe `mes`); botón «Retirar» también en la ficha.
- **Datos de dev tocados por las pruebas:** Caceres, Angel y Nuñez, Oscar fueron retirados (cierres devengados). la skill `refrescar-dev` los repone si molesta.
- **Cola registrada (`docs/INCIDENTES.md`):** I-003 bono por curso (S2, exige antes una decisión D) · I-002 corregir inscripciones (S3, D28) · I-004/I-006/I-007/I-008 reportes y pantalla de membresías (S3, pasan por Design).
- **Producción:** migraciones **0001–0062**, en `main` `b7e56c6` (I-001 e I-009 ya están). La 0063 **solo está en dev**.
- **Otros carriles abiertos:** H6 extensión de membresía (rama `h6-extension-membresia`, plan sin OK). Antes, sin urgencia: Hito A (pruebas de alquiler/particulares), H8 talleres, H9 horario hábil.
- **Regla vigente:** todo se hace en dev y lo prueba Claude; el pase a producción lo aprueba Javier por avance.
- **Para abrir el siguiente incidente** (desde `main`, sin tocar la rama de I-005):
  ```
  git checkout main && git pull origin main
  npm run dev:limpio
  ```
  Para volver a I-005: `git checkout i-005-liquidar-profesor && git pull origin i-005-liquidar-profesor`.
