# Sincronización de handoffs de Claude Design

Claude Design **no escribe en este repo ni en la nube por su cuenta**: publica un
Artifact y entrega un *export* (zip o carpeta). Para incorporarlo sin copiar
contenido a mano, usamos una **carpeta de paso (buzón)** en el disco local y un
script que la vuelca al repo.

## Cómo funciona

```
Claude Design ──export──▶  BUZÓN (carpeta Windows)  ──sync-design──▶  docs/design/handoff/
```

- **Buzón (default):** `C:\Users\Javier\OneDrive\Natalia\tropicana-Claude.Design-Handoff`
  (configurable con la variable `DESIGN_INBOX`).
- **Mirror en el repo:** `docs/design/handoff/` — copia **verbatim** del último
  export. Lo maneja el script; **no editar a mano** (se sobrescribe en cada sync).
  El manifiesto `docs/design/handoff/.synced.json` registra origen, fecha y el
  listado de archivos.
- Los documentos **vivos** (que sí editamos) van fuera del mirror:
  `docs/PLAN_ETAPA1.md`, `docs/CONTEXTO_AVANCE.md`, etc.

## Depositar un avance (paso manual mínimo)

1. En Claude Design, exportá el handoff.
2. Dejá el **zip** (o la carpeta descomprimida) en el buzón.
   - *Tip para que sea casi automático:* configurá la carpeta de descargas del
     navegador para que apunte al buzón; así el export cae solo.

No hace falta pegar contenido en ningún lado: solo que el archivo quede en el buzón.

## Tomarlo hacia el repo

Corriendo **Claude Code localmente** (o directamente con Node) en la máquina del
buzón:

```bash
npm run sync-design                 # sincroniza y muestra el diff
npm run sync-design -- --commit     # además: git add + commit
npm run sync-design -- --archive    # mueve el export consumido a _procesados/
```

El script:
- elige el export más nuevo del buzón (zip o carpeta),
- reemplaza `docs/design/handoff/` con su contenido,
- escribe el manifiesto y muestra qué se agregó / cambió / borró,
- con `--commit`, deja el commit listo para push.

Guardarraíl: el script sólo reemplaza `docs/design/handoff/`; nunca toca nada
fuera de `docs/design/`.
