# Setup de `tropicana-dev` (base de pruebas separada de producción)

> Objetivo: tener un **segundo proyecto Supabase gratis** solo para probar, para
> que 1B/1C (venta, asistencia, liquidación) no ensucien los datos reales de
> Natalia. Producción (Vercel) **no se toca**: sigue con sus propias variables.
>
> Todo esto corre en la máquina de Javier. Cuando termines, tu `next dev` local
> apunta a `tropicana-dev`, y producción sigue apuntando a su propio Supabase.

## 1. Crear el proyecto en Supabase
1. Entrá a https://supabase.com → **New project**.
2. Nombre: `tropicana-dev`. Elegí una **región** cercana y una **Database Password**
   (guardala, aunque no la vas a necesitar para esto).
3. Esperá a que el proyecto quede **Active** (1-2 min).

## 2. Copiar las 3 claves
En el proyecto nuevo → **Settings → API**. Copiá:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** (secreta) → `SUPABASE_SERVICE_ROLE_KEY`

> La `service_role` es secreta: no la pegues en el chat ni la subas al repo.

## 3. Cargar el esquema (un solo pegado)
1. En `tropicana-dev` → **SQL Editor → New query**.
2. Abrí `scripts/setup_dev_full.sql` (en el repo) y **pegá TODO** el contenido.
3. **Run.** Trae las migraciones 0001..0011 juntas (idempotente).
4. Verificación rápida (pegá y Run):
   ```sql
   select count(*) as tablas from information_schema.tables where table_schema='public';
   ```
   Debería dar **23**.

## 4. Crear tu usuario administrador
La base nueva arranca sin usuarios. El **primer** usuario que crees queda
**administrador** automáticamente (lo hace un trigger del sistema).
1. `tropicana-dev` → **Authentication → Users → Add user**.
2. Poné tu **email** y una **password**, y marcá **Auto Confirm User**.
3. (Opcional) En user metadata podés poner `{"nombre":"...","apellido":"..."}`.

## 5. Apuntar tu local a `tropicana-dev`
1. En la carpeta del repo, **guardá una copia** de tu `.env.local` actual (el que
   apunta a producción), renombrándola a `.env.local.prod` — así podés volver.
2. Editá `.env.local` con las claves del **paso 2**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...tu Project URL de dev...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...anon de dev...
   SUPABASE_SERVICE_ROLE_KEY=...service_role de dev...
   ```
   (Mantené el resto de variables que ya tuvieras.)
3. Reiniciá el server local: cortá `npm run dev` y volvé a levantarlo.

> Para volver a apuntar el local a producción: restaurá el `.env.local.prod`
> como `.env.local` y reiniciá. Producción en Vercel usa sus variables propias
> (cargadas en Vercel), así que **nunca se ve afectada** por lo que hagas acá.

## 6. (Si hace falta) habilitar el módulo Usuarios
Si al entrar como admin no ves el módulo **Usuarios**, corré una vez, con el
`.env.local` ya apuntando a dev:
```
node scripts/seed_modulo_usuarios.mjs
```

## 7. Probar
1. Entrá a http://localhost:3000 y logueate con el usuario del paso 4.
2. La base arranca **vacía** (sin cursos/alumnos). Para probar 1B vas a cargar a
   mano **2-3 cursos y alumnos** de prueba (o, más adelante, armamos el script de
   *refresh* que copia datos de producción a dev — pendiente de tu pedido).

## 8. Refresh de datos: producción → dev (opcional, para probar con datos reales)
Copia los datos de dominio de producción a `tropicana-dev` (alumnos, cursos,
planes, membresías, cuotas, pagos, asistencia, etc.). **Lee** de producción (solo
SELECT) y **escribe** en dev (borra y reemplaza). Producción **no se toca**.
Los usuarios/login y la config (perfiles, parámetros) **no** se copian: dev
conserva su propio admin. Las referencias a usuarios se anulan.

**Requisitos:** haber aplicado `0012` en dev (paso de 1B) y tener `pg` instalado
(`npm install` en la carpeta del repo ya lo trae).

1. En Supabase, de **cada** proyecto (producción y `tropicana-dev`): **Settings →
   Database → Connection string → URI**. Usá la del **"Session pooler"** (puerto
   5432). Traen la contraseña adentro: son secretas, no las pegues en ningún lado.
2. En la carpeta del repo, corré (PowerShell):
   ```powershell
   $env:PROD_DB_URL="<URI de producción>"
   $env:DEV_DB_URL="<URI de tropicana-dev>"
   node scripts/refresh-dev.mjs --yes
   ```
   (En `cmd` usá `set PROD_DB_URL=...` en vez de `$env:`.)
3. El script imprime cuántas filas copió por tabla. Al terminar, recargá la app
   local: vas a ver los datos reales. Seguís logueándote con tu **usuario admin de
   dev** (no cambió).

> Es re-ejecutable: cada corrida deja dev igual a producción en ese momento.
> Nunca escribe en producción. Si `PROD_DB_URL` y `DEV_DB_URL` fueran iguales, el
> script aborta.

---
Cuando `tropicana-dev` esté andando, avisá y arrancamos **1B** (venta del Plan
Regular + asistencia) probándolo contra esta base, sin riesgo para producción.
