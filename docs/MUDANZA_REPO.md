# Mudanza del repo: de OneDrive a `D:\dev\tropicana-app`

Procedimiento para ejecutar la decisión **D2** de `docs/DECISIONES.md`.

**Leelo desde GitHub en el navegador mientras lo hacés** — vas a estar cerrando
terminales y moviendo carpetas justo cuando lo necesites.

---

## Por qué se mueve, y por qué ahora se puede

Turbopack escribe `.next` todo el tiempo; OneDrive la sincroniza por debajo al
mismo tiempo. El resultado es un build a medias que se sirve igual: un cambio
que no aparece, o una ruta que existe y devuelve **404 de Next**, llevándose
puesto el app-shell. **Ya costó tres veces** (`2a26010`, `8fb648c`, y el 404 de
`/liquidaciones/2`), y las tres se fue el tiempo revisando datos, RLS y
componentes que estaban bien.

No hay arreglo por configuración: la salida natural sería mandar el build afuera
con `distDir`, y la doc de Next lo prohíbe — *"distDir should not leave your
project directory"*. La única cura es mover el repo.

**Lo que frenaba la mudanza** era el respaldo: el repo estaba en OneDrive para
sobrevivir a una falla de disco. Ese motivo **está cubierto por GitHub**, que es
mejor réplica que OneDrive —versionada, con historia, y no propaga un borrado
accidental como sí lo hace una sincronización.

> **`D:` es una partición del mismo disco físico que `C:`.** Si el disco falla,
> se van las dos juntas. La mudanza **no aporta redundancia**: la protección
> viene entera de GitHub. Por eso el **paso 2 no es opcional**.

---

## 1. Confirmar que no queda nada suelto en la carpeta vieja

Desde la carpeta actual (la de OneDrive):

```powershell
git status
git log --oneline origin/main..HEAD
git stash list
```

Los tres tienen que salir vacíos, o `git status` decir *working tree clean*. Si
aparece algo, **commitealo y pusheálo antes de seguir**: lo que no esté en
GitHub no viaja.

## 2. Poner a salvo el `.env.local` — el único archivo que no se recupera solo

Está en `.gitignore`, y tiene que seguir estándolo: son credenciales y no van al
repo. Pero entonces es **lo único** que OneDrive cubría y GitHub no, y en `D:`
va a quedar sin réplica de ningún tipo.

```powershell
notepad .env.local
```

Copiá estos valores a tu **gestor de contraseñas** (no a otra carpeta):

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | a qué base se conecta la app |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave pública del cliente |
| `SUPABASE_SERVICE_ROLE_KEY` | clave de servidor (acciones con permisos) |
| `DEV_DB_URL` | conexión directa a dev (script de refresh) |
| `PROD_DB_URL` | conexión directa a producción (script de refresh) |
| `DESIGN_INBOX` *(si lo tenés cargado)* | carpeta de paso del handoff de Design |
| `DESIGN_HANDOFF_DIR` *(si lo tenés cargado)* | destino del mirror de Design |

Si igual se perdieran: las claves de Supabase se vuelven a sacar del panel del
proyecto. No es fatal, es un rato de fastidio evitable.

## 3. Clonar limpio en el destino

**Clonar, no mover.** Arrastrar la carpeta se lleva `.next` y `node_modules`,
que son justo los que pelean con el sincronizador y los que querés dejar atrás.

```powershell
New-Item -ItemType Directory -Force -Path D:\dev
cd D:\dev
git clone https://github.com/jgonzalezw/tropicana-app.git tropicana-app
cd D:\dev\tropicana-app
```

## 4. Traer el `.env.local` y la rama de trabajo

```powershell
Copy-Item "$env:USERPROFILE\OneDrive\Natalia\tropicana-app\.env.local" .
git fetch origin
git branch -a
```

Ajustá la ruta de origen si tu carpeta de OneDrive tiene otro nombre. Después
pasate a la rama en la que estés trabajando:

```powershell
git checkout <rama-de-trabajo>
```

## 5. Instalar y arrancar

```powershell
npm install
npm run dev:limpio
```

`dev:limpio` borra la build antes de levantar. La primera vez conviene, para
arrancar sin nada heredado.

## 6. Verificar que quedó bien

| Qué | Cómo se ve si está bien |
| --- | --- |
| **El aviso de carpeta sincronizada** | **Ya no aparece.** `scripts/chequeo-entorno.mjs` corre solo antes de `npm run dev` y grita cuando detecta OneDrive/Dropbox/Drive/iCloud. Si arranca callado, el problema se fue de raíz |
| **El chip de entorno** | Dice **DEV** y el commit corto correcto |
| **Las pantallas que más sufrieron el bug** | `/liquidaciones` y `/cursos` cargan enteras, sin 404 |

Recargá con **Ctrl+F5** la primera vez.

## 7. Apuntar las herramientas a la ruta nueva

Cerrá y reabrí en `D:\dev\tropicana-app`: Claude Code local, el editor, y
cualquier terminal que haya quedado abierta en la ruta vieja.

`.claude\settings.local.json` viaja en el repo y **no tiene rutas absolutas**,
así que se porta solo: los permisos quedan igual.

---

## Dos cosas que NO hay que hacer

**No toques la carpeta de handoff de Design.** `scripts/sync-design.mjs` apunta
por defecto a `C:\Users\Javier\OneDrive\Natalia\tropicana-Claude.Design-Handoff`.
Es **otra** carpeta —la de paso por donde Design entrega— y **tiene que seguir
sincronizando**. Mover el repo no la afecta.

**No borres la carpeta vieja desde OneDrive todavía.** Borrar ahí borra también
la copia de la nube. Dejala **una semana** por si algo quedó fuera de git, y
recién después eliminala.

---

## Si algo sale mal

La carpeta vieja sigue intacta y funcionando: la mudanza es un clon nuevo, no un
movimiento destructivo. Volvés a trabajar ahí y no se perdió nada.

---

## Al terminar

Avisale a la sesión para que **cierre D2** en `docs/DECISIONES.md` y actualice
`docs/ESTADO.md` con el hito.
