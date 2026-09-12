# Dónde corre la sesión: Claude Code local vs. en la nube

Los dos se llaman Claude Code. Lo que cambia es **dónde se ejecuta el trabajo**,
y eso decide qué puede y qué no puede hacer la sesión.

*Escrito el 2026-09-12, a pedido de Javier: para él los dos eran "locales",
porque las dos ventanas las abre él en su Windows.*

---

## Los dos

| | Cómo lo llamamos | Dónde corre | Qué ve |
| --- | --- | --- | --- |
| `claude` escrito en PowerShell | **Claude Code local** (CLI) | **La PC de Javier** | Sus carpetas, su `.env.local`, sus stashes, sus procesos |
| La ventana de la app de escritorio, o claude.ai/code | **Claude Code en la nube** (sesión remota) | Un contenedor Linux efímero | Un **clon propio** del repo, traído de GitHub |

**De dónde sale el malentendido:** la app de escritorio la abre Javier en
Windows, así que se siente local. Pero la app es solo la **ventana**; el trabajo
puede ejecutarse en su máquina o en la nube. Que la ventana sea de Windows no
dice nada sobre dónde corre el código.

---

## Cómo saber en cuál estás, sin preguntar

Listar una carpeta de Javier:

```
ls C:\Users\Javier
```

Si no existe —y encima el sistema es Linux y el usuario es `root`— es la nube.

**El caso real que lo hizo evidente** (2026-09-12, preparando la mudanza del
repo): la carpeta vieja tenía un `stash@{0}` con trabajo sin commitear. La
sesión en la nube **no podía verlo**: un stash vive en el disco de quien lo
creó. Lo encontró Javier corriendo `git stash list` en PowerShell, y la sesión
se enteró porque él lo pegó en el chat.

---

## Qué se puede hacer en cada uno

**Solo en el local (PowerShell):** todo lo que toca el disco de Javier.

- Mover el repo (D2 / `docs/MUDANZA_REPO.md`).
- `npm run dev`, `npm run dev:limpio` — el server corre en su máquina.
- La skill `refrescar-dev` — necesita su shell y su red.
- Ver su `.env.local`, sus stashes, sus archivos sin commitear.

**En cualquiera de los dos**, porque van por red y no por disco:

- Migraciones a Supabase, dev y producción, vía el conector MCP.
- Leer y escribir código, commitear, pushear, mergear a `main`.
- Correr `scripts/control_migracion.sql` contra cualquiera de las dos bases.

---

## La consecuencia práctica: GitHub es el puente

Cada entorno tiene **su propio clon**. No comparten carpeta. La única vía por la
que se pasan trabajo es **GitHub**.

De ahí salen dos hábitos que evitan sorpresas:

1. **Antes de trabajar en el local, `git pull`.** Si la sesión en la nube
   pusheó, la copia local está atrasada y no se entera sola. Pasó el 2026-09-12:
   el local de Javier no tenía los commits del día.
2. **Antes de dar por perdido algo, mirar del otro lado.** Lo que no está
   commiteado y pusheado **solo existe en un lado**: stashes, `.env.local`,
   archivos ignorados, ramas locales sin subir.

---

## Para la sesión, no para Javier

**No prometas lo que tu entorno no puede hacer.** Una sesión en la nube no puede
levantar el server de Javier, abrir su `.env.local`, ni ver sus stashes. Si el
paso requiere su disco, se lo decís y le pasás el comando para que lo corra él
— no lo intentás y le informás un resultado que mide otra máquina.

Y al revés: no le pidas que corra a mano algo que la sesión puede hacer sola
(una migración, un control, un push).
