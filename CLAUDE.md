@AGENTS.md
@docs/REGLAS.md
@docs/DECISIONES.md

## Método — equivalencias (kit de skills de usuario)
Las skills del método se usan en este repo con estos nombres. **El proyecto manda:** si un paso de una skill choca con una regla de `docs/REGLAS.md`, vale la regla.

| Método | En Tropicana |
|---|---|
| `docs/RETOMAR.md` | Bloque "Dónde retomar" de `docs/DECISIONES.md`. No crear RETOMAR.md |
| Hito H-nn | Nomenclatura propia (C3 H7), rama `h7-…` |
| Decisión D-nn | `docs/DECISIONES.md` (D23, D28…) |
| Incidentes | `docs/INCIDENTES.md` |
| `docs/ENTORNOS.md` | `docs/ENTORNOS_CLAUDE.md` |
| Control de migración | `scripts/control_migracion.sql` |
| Proyecto dev / producción | ver docs/ENTORNOS_CLAUDE.md / `pnvhpbxjbdmbktpwebtx` |
| Pase a producción | Igual que siempre: reglas de proceso de REGLAS + guardia de `.claude/hooks`. Las skills no lo reemplazan |

### Principios
- Simplicidad e impacto mínimo: el cambio más simple que resuelve; tocar solo lo necesario.
- Causa raíz, no parches. Medir antes de afirmar.
- Si algo se desvía del plan: parar y replanificar.
- Documentos grandes (ESTADO, DECISIONES): leerlos con subagente (`/explorar`), no enteros.
- Autonomía en dev: errores, logs y CI rojo se resuelven sin pedirle a Javier que investigue. Producción, nunca sin su OK.
- Cuando Javier corrige algo: si puede repetirse, regla con su "costó…" o, mejor, un control.
