---
name: refrescar-dev
description: Refresca tropicana-dev con datos reales de producción corriendo scripts/refresh-dev.mjs. Úsalo cuando Javier pida "refrescar dev", "traer datos de producción a dev" o similar, desde su Claude Code LOCAL (esta skill necesita shell y red hacia Supabase — no funciona en una sesión en la nube).
---

# Refrescar tropicana-dev con datos de producción

Esta skill automatiza el procedimiento manual de `scripts/refresh-dev.mjs`:
copia las tablas de dominio de producción a `tropicana-dev` (solo lectura en
prod, solo escritura en dev). Requiere correr en la máquina local de Javier,
parado en la raíz del repo `tropicana-app`, con Node instalado
(`npm install` ya corrido al menos una vez).

**Importante:** si esta sesión de Claude Code está corriendo en la nube (sin
acceso al filesystem/shell real de Javier), no se puede ejecutar el script —
avisale y sugerí correr esto desde su Claude Code local.

## Pasos

1. **Conseguir las dos connection strings.** Buscá primero si ya existen como
   variables de entorno en la sesión actual (`PROD_DB_URL`, `DEV_DB_URL`). Si
   no están, buscá un archivo `.env.refrescar-dev.local` en la raíz del repo
   (formato `CLAVE=valor`, una por línea). Ese archivo ya está cubierto por
   `.gitignore` (patrón `.env*`), así que si existe nunca se commitea.
   - Si tampoco existe ese archivo, explicale a Javier de dónde salen:
     Supabase → proyecto correspondiente → botón "Connect" → Connection
     string → URI → **Session pooler** (puerto 5432), reemplazando
     `[YOUR-PASSWORD]` por la contraseña real de la base. Una string es de
     "Tropicana" (producción) y la otra de "tropicana-dev".
   - Preguntale si querés guardarlas en `.env.refrescar-dev.local` para no
     tener que pegarlas cada vez. Si dice que sí, escribí el archivo con
     ambas líneas (`PROD_DB_URL=...` y `DEV_DB_URL=...`) y no vuelvas a
     mostrar su contenido en el chat.
   - **Nunca** repitas, loguees ni muestres las connection strings completas
     en tu respuesta — contienen la contraseña de las bases.

2. **Cargar las variables para esta corrida** (sin persistirlas si vinieron
   solo del archivo local, salvo que Javier ya haya pedido guardarlas en el
   paso 1) y ejecutar:
   ```
   node scripts/refresh-dev.mjs --yes
   ```

3. **Verificar el resultado.** El script imprime, por tabla, cuántas filas
   copió, y termina con una línea "Refresh completo". Si en cambio corta con
   `ERROR: PROD_DB_URL y DEV_DB_URL no pueden ser la misma base` u otro
   `ERROR:`, mostrale a Javier el mensaje de error (sin exponer las
   connection strings) y no reintentes solo — pedile que revise el valor
   correspondiente.

4. **Reportar en una frase**: cuántas tablas se refrescaron y que ya puede
   entrar a `tropicana-dev` con su usuario admin de siempre para probar.

## Garantías que esta skill preserva (no cambian respecto al script manual)

- Produccion solo recibe `SELECT` — nunca se escribe ahí.
- Dev recibe `TRUNCATE` + `INSERT` — sus datos previos de prueba se
  reemplazan por los de producción en cada corrida.
- El propio script aborta si `PROD_DB_URL === DEV_DB_URL`, como salvaguarda
  contra invertir las bases por error.
