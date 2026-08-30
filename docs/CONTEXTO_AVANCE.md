# Tropicana — Contexto y Avance del Proyecto

> Bitácora técnica que mantiene Claude Code entre sesiones. Fuente funcional:
> `Tropicana_Vision_Alcance_Requerimientos_v5.3` + `claude_guia-arranque-desarrollo.md`.
> Última actualización: **2026-08-30**.

## 1. Resumen

Aplicación web de gestión para la Escuela de Bailes Tropicana. Reemplaza el
Excel operativo (`Tropicana_Gestion.xlsx`, 25 hojas) por una app en la nube.
Construcción por etapas según las prioridades de Natalia (Sección 9 del v5.3).

## 2. Stack e infraestructura

| Pieza | Elección |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack) |
| Estilos | Tailwind, **tema oscuro por defecto**, fuentes grandes / alto contraste (NFR 8.1/8.4) |
| Base de datos + Auth | Supabase (Postgres + Auth email/contraseña) |
| Hosting (futuro) | Vercel |
| Repo | GitHub `jgonzalezw/tropicana-app` |
| Idioma UI | Español |
| Sistema de diseño | Handoff de Claude Design en `docs/design/` (README = Design Tokens, DECISIONES = bitácora). Tema oscuro cálido Tropicana. |

- Proyecto local: `C:\Users\Javier\OneDrive\Natalia\tropicana-app`
- Supabase URL: `https://pnvhpbxjbdmbktpwebtx.supabase.co`
- Variables en `.env.local` (excluido del repo): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secreta, solo servidor).
- Node.js LTS instalado con winget (`C:\Program Files\nodejs`).

## 3. Estado por etapa

| Etapa | Contenido | Estado |
|---|---|---|
| **0** | Administración: login, usuarios, roles/permisos, parámetros, catálogos | ✅ **Completada y probada** (2026-08-26) |
| 1 | Núcleo (alumnos, profesores, cursos, inscripción+cobro, asistencia, costos, comisiones) | ⚪ No iniciada |
| 2 | Ampliaciones + Sección 7 (liquidación mensual, particulares/alquiler, dashboard-balance) | ⚪ No iniciada |
| 3 | Cierre prioridad 3 (deuda vencida) | ⚪ No iniciada |
| 4 | Inventario | ⚪ No iniciada |

## 4. Etapa 0 — construido a la fecha

Módulos bajo `src/app/(privado)/administracion/`:

- **Login** (`/login`) + middleware de sesión + rutas protegidas por rol/permiso.
- **Usuarios** — listar, **crear** (ver §5), editar (nombre/apellido/WhatsApp/rol/activo),
  activar/desactivar.
- **Roles y permisos** — crear/renombrar/eliminar roles (los de sistema protegidos),
  matriz de permisos por módulo×acción, y **plantillas** de permisos aplicables con un clic.
- **Parámetros** — moneda (Bs.), tolerancia de faltas, vencimiento de paquetes (3 meses),
  mayoría de edad, etc.
- **Catálogos** — listas editables (canal de captación, categoría de comprador, etc.).

### Roles
- Base (sistema, no borrables): **Administrador**, **Profesor**.
- Creados/creables desde la app: **Gerente**, **Asistente**, y a futuro Contador, Vendedor…
- Plantillas de permisos: *Gerente (gestión)*, *Asistente (recepción)*, *Solo lectura*,
  *Acceso total*, *Sin permisos*.

### Modelo de permisos
- El **Administrador** (rol clave `administrador`) siempre puede todo (bypass en `tienePermiso`).
- El resto se rige por la matriz `rol_permisos` (módulo × acción).
- Helper server: `tienePermiso(modulo, accion)` en `src/lib/sesion.ts`.

## 5. Cambio de alcance (2026-08-26): creación de usuarios desde la app

**Antes:** las cuentas de acceso se creaban a mano en el panel de Supabase
(Authentication → Users) y la app solo editaba el perfil/rol.
**Ahora:** el Administrador (o un Gerente autorizado) crea la cuenta completa
desde la app —correo, contraseña y rol—, lista para ingresar de inmediato.

### Pantallas / flujos nuevos
- Formulario **"+ Nuevo usuario"** en Administración → Usuarios: nombre, apellido,
  WhatsApp, correo, contraseña (con **Generar** y **Ver**) y rol. Mensaje de éxito
  y refresco de la lista. La cuenta puede iniciar sesión sin pasar por Supabase.

### Cambios técnicos
Archivos nuevos:
- `src/lib/supabase/admin.ts` — cliente Supabase con `service_role` (solo servidor;
  devuelve `null` si falta la clave, para error controlado).
- `src/app/(privado)/administracion/usuarios/FormularioNuevoUsuario.tsx` — UI del alta.
- `src/lib/plantillas.ts` — definición de plantillas de permisos.
- `src/lib/texto.ts` — util `generarClave()` (slug para claves de rol).
- `src/components/SinAcceso.tsx` — pantalla de "sin permisos".
- `supabase/migrations/0002_modulo_usuarios.sql` — permisos del módulo `usuarios`.
- `scripts/seed_modulo_usuarios.mjs` — aplica la migración 0002 vía service_role (ya ejecutado).

Archivos modificados:
- `.../usuarios/acciones.ts` — nueva `crearUsuario()` (usa `admin.auth.admin.createUser`
  con `email_confirm: true` + `user_metadata`, luego fija rol/estado); `actualizarUsuario()`
  ahora gatea por `tienePermiso('usuarios', ...)`.
- `.../usuarios/page.tsx` — integra el formulario y guard `usuarios.ver`.
- `.../roles/page.tsx`, `.../parametros/page.tsx`, `.../catalogos/page.tsx` — guard `administracion.ver`.
- `.../administracion/layout.tsx` — acceso a la sección si `usuarios.ver` o `administracion.ver`.
- `(privado)/layout.tsx` + `components/BarraLateral.tsx` — navegación según permisos.
- `src/lib/tipos.ts` — nuevo módulo `usuarios` en `MODULOS` / `ETIQUETA_MODULO`.
- `src/lib/sesion.ts` — nuevo helper `tienePermiso()`.
- `.env.example`, `.env.local` — variable `SUPABASE_SERVICE_ROLE_KEY`.

### Decisión de diseño clave
Se separó **"Usuarios"** como **módulo de permisos independiente** de "Administración".
Así un Gerente puede gestionar usuarios **sin** ver Roles/Parámetros/Catálogos.
La plantilla *Gerente (gestión)* incluye el módulo Usuarios; *Asistente (recepción)* no.

## 5b. Sistema de diseño y temas conmutables (2026-08-30)

Antes de Etapa 1 se **unificó el estilo visual** de las pantallas de
Administración (Usuarios, Roles, Parámetros, Catálogos) con el sistema de
diseño real de Tropicana. Fue un cambio de **estilo**, sin tocar estructura
ni comportamiento.

- **Fuente de verdad:** `docs/design/README.md` (sección Design Tokens) +
  `docs/design/DECISIONES.md`, versionados en el repo junto al bundle de
  prototipos de Etapa 1 en `docs/design/handoff/`.
- **Tokens centrales** en `src/app/globals.css`: superficies (bg→surface→
  elevado), rampas neutral/accent/accent-2, acento `#e08b4f`, radios por tipo
  de elemento (tarjetas 28px, paneles 20px, controles/chips píldora 999px),
  tipografía **Montserrat 800** títulos + **Figtree** cuerpo (vía `next/font`),
  foco y tamaño de fuente tematizables, **sin sombras**.
- **Temas como catálogo ampliable por datos** (línea "no hardcode"): tabla
  `public.temas` (una fila por tema, tokens en JSON) + `src/lib/temas.ts`
  (con temas *built-in* de fallback si la tabla no existe). Sumar una variante
  = insertar una fila, sin tocar código.
- **Preferencia por usuario:** columna `perfiles.tema`. Cada persona elige su
  tema (selector en la barra lateral) y no afecta a los demás. El layout raíz
  inyecta los tokens del tema activo desde el servidor (`data-theme` en `<html>`),
  sin flash.
- **Dos temas de arranque:** `tropicana` (estándar, default) y
  `tropicana_alto_contraste` (baja visión: más contraste, fuente más grande,
  foco/bordes marcados). Los valores del estándar salen del README; los de la
  variante de accesibilidad son una propuesta ajustable por datos (no están en
  el handoff).

Archivos nuevos: `src/lib/temas.ts`, `src/lib/acciones-tema.ts`,
`src/components/SelectorTema.tsx`, `supabase/migrations/0003_temas.sql`.

## 6. Pasos manuales en Supabase

- **service_role**: cargada en `.env.local` local. **Pendiente**: cargarla en Vercel
  como variable de entorno al desplegar.
- **Migración 0002** (`usuarios` para Administrador): **ya aplicada** por script
  (`scripts/seed_modulo_usuarios.mjs`). No requiere acción manual.
- Para que un rol **Gerente ya existente** tome el módulo Usuarios: reaplicar la
  plantilla "Gerente (gestión)" desde la app (1 clic).
- Migración 0001 (esquema base + roles/permisos/parámetros/catálogos): aplicada por Javier.
- **Migración 0003** (`temas` + `perfiles.tema`): **PENDIENTE de aplicar** en
  Supabase → SQL Editor (pegar `supabase/migrations/0003_temas.sql`). Trae DDL,
  así que va por el SQL Editor como la 0001, no por script. Mientras no se
  aplique, la app funciona igual con los dos temas *built-in* (fallback en
  `src/lib/temas.ts`); al aplicarla, el catálogo pasa a ser editable por datos.

## 7. Decisiones / parámetros afectados por este cambio

- **Se revierte la decisión previa "opción 2"** (crear usuarios solo desde Supabase).
  Ahora la creación es completa desde la app. Requiere la `service_role` en el servidor.
- Nuevo **módulo de permisos `usuarios`** → la matriz de permisos ahora tiene 14 módulos
  (antes 13). Roles existentes deben reaplicar plantilla para tomarlo.
- No cambia ningún parámetro operativo (moneda, tolerancia, vencimientos, etc.).

## 8. Pendientes inmediatos

- ✅ Prueba de creación de usuario y login end-to-end (Javier, 2026-08-26): OK.
- ✅ Etapa 0 cerrada. **Siguiente: Etapa 1 (Núcleo).**
- Al desplegar: cargar `SUPABASE_SERVICE_ROLE_KEY` en Vercel (pendiente hasta el deploy).
