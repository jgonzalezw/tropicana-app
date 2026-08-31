# Sincronización de handoffs de Claude Design

Claude Design **no escribe en este repo por su cuenta**: publica un Artifact y
entrega un *export* (zip). Para incorporarlo sin copiar contenido a mano usamos
una **carpeta de paso (buzón)** en el disco local y un script que la vuelca al
repo.

## Cómo funciona

```
Claude Design ──export (zip)──▶  BUZÓN (carpeta Windows)  ──sync-design──▶  docs/design/
```

- **Buzón (default):** `C:\Users\Javier\OneDrive\Natalia\tropicana-Claude.Design-Handoff`
  (configurable con `DESIGN_INBOX`). Podés dejar todos los zips ahí: el script
  toma **siempre el más nuevo por fecha**.
- **Mirror en el repo:** **`docs/design/`** es una copia **verbatim** del último
  export (los `.dc.html`, el README —que es la **fuente de verdad del diseño**—,
  `DECISIONES.md`, `_ds/`, `screenshots/`, `assets/`). Lo maneja el script;
  **no editar a mano**: se reemplaza entero en cada sync. `docs/design/.synced.json`
  registra origen, fecha y archivos.
- Los documentos **vivos nuestros** (que sí editamos) viven en `docs/`, fuera del
  mirror: `docs/ESTADO.md`, `docs/PLAN_ETAPA1.md`, `docs/CONTEXTO_AVANCE.md`,
  este `docs/DESIGN_SYNC.md`.

## Depositar un avance (paso manual mínimo)

1. En Claude Design, exportá el handoff.
2. Dejá el **zip** en el buzón. *Tip:* apuntá la carpeta de descargas del
   navegador al buzón y el export cae solo — sin pegar nada.

## Tomarlo hacia el repo

Corriendo **Claude Code localmente** (o directamente con Node) en la máquina del
buzón:

```bash
npm run sync-design                 # sincroniza docs/design/ y muestra el diff
npm run sync-design -- --commit     # además: git add docs/design + commit
npm run sync-design -- --archive    # mueve el export consumido a _procesados/
```

El script elige el export más nuevo (zip o carpeta), desciende a la raíz del
handoff, reemplaza `docs/design/` con su contenido, escribe el manifiesto y
muestra qué se agregó / cambió / borró. Guardarraíl: sólo reemplaza `docs/design/`.
