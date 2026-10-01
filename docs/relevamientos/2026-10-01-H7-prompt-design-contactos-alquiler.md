# C3 H7 — prompt corto para Claude Design: el titular del alquiler (contactos)

Complemento del prompt principal (`2026-10-01-H7-prompt-design-alquiler.md`):
bloque **1. Titular** de *Vender alquiler de sala*. Pegar junto al principal.

---

## El titular de un alquiler es un contacto, no un alumno

Un **contacto** es el único registro de una persona u organización: nombre,
WhatsApp, redes, documento y relaciones viven ahí **una sola vez**, sea cual
sea el rol que después tenga. El que alquila **no se vuelve alumno ni entra al
padrón**: queda solo como contacto. La pantalla de venta tiene que cubrir
**cuatro escenarios** al buscar al titular:

| # | Escenario | Qué ve y qué hace la pantalla |
| --- | --- | --- |
| A | **Ya existe como contacto** (alumno, profesor o un alquiler anterior) | Aparece en el buscador (por nombre o WhatsApp) con su **rol como etiqueta** (Alumno · Profesor · Solo contacto). Se elige y **no se le vuelve a pedir ningún dato**. Esa etiqueta es la que explica la **categoría propuesta** del bloque 3. |
| B | **Tercero persona nueva** | Alta mínima en la misma pantalla (contexto *Tercero · persona*). |
| C | **Tercero empresa / organización nueva** | Alta mínima con **razón social** en lugar de nombre y apellido (contexto *Tercero · organización*). |
| D | **Posible duplicado** | El mismo panel que ya usamos: si el WhatsApp (o el documento) ya existe, muestra al contacto existente y ofrece **usarlo** en vez de crear otro. |

### Persona vs. empresa

Un selector **Persona / Organización** al dar de alta; cambia los campos:

- **Persona**: nombre (obligatorio), apellido (opcional), WhatsApp (obligatorio).
- **Organización**: **razón social** (obligatoria), WhatsApp (obligatorio). Sin
  nombre ni apellido.
- **Una empresa puede tener una persona de contacto**: es otro contacto
  (persona) unido a la empresa con una relación **"trabaja en"**. En el alta de
  la empresa, un campo opcional **"Persona de contacto"** que busca o crea esa
  persona. Vale la pena mostrar a quién se le escribe por WhatsApp.

### Datos que se piden, y los que se ofrecen aparte

La obligatoriedad **no está fija en el diseño: la gobierna la matriz de
mínimos** (Administración → Catálogos), que cada contexto configura como
**Obligatorio / Visible opcional / Oculto**. Hoy, para terceros:

| Dato | Tercero · persona | Tercero · organización |
| --- | --- | --- |
| Nombre | **Obligatorio** | oculto |
| Apellido | opcional | oculto |
| Razón social | oculto | **Obligatoria** |
| WhatsApp | **Obligatorio** | **Obligatorio** |
| Red social | opcional | opcional |
| Consentimiento de contacto | opcional | opcional |
| Documento | oculto | oculto |
| Email | oculto | oculto |
| Fecha de nacimiento · sexo · canal de captación | ocultos | ocultos |

**Diseñar todos los campos, también los ocultos**, como bloques que aparecen
cuando la matriz los activa (hoy no se muestran). El más probable de activar
para alquiler es el **documento** de la empresa (NIT, para facturar). Por eso
tienen que existir en el diseño:

- **Documento**: tipo (lista: *Cédula de identidad*, *CI extranjero*,
  *Pasaporte*, *NIT*), número, complemento, expedido y país emisor. Cada tipo
  tiene su **formato de validación** (CI 5–10 dígitos, NIT 5–15 dígitos,
  pasaporte alfanumérico 5–15; CI extranjero libre). No puede haber **dos
  contactos con el mismo documento**: mismo panel de duplicado que el WhatsApp.
  El documento es un **dato privado**: solo lo ven los roles con permiso; marcar
  esa condición visualmente.
- **Email** y **teléfono alternativo**.
- **Redes sociales**: lista elegida (Instagram, Facebook, TikTok, WhatsApp) con
  el usuario; cada red se puede abrir en su perfil.
- **Fecha de nacimiento** y **sexo**: solo personas.
- **Facturación**: la matriz lo contempla pero **todavía no tiene dónde
  guardarse**; mostrarlo **deshabilitado con una nota** que lo diga, no
  esconderlo.

### Formato del WhatsApp

Se normaliza a formato internacional (`+591…`): 8 dígitos → se antepone +591;
quien escribe un "+" a mano (número extranjero) lo conserva. Si el formato no es
válido, el botón de **WhatsApp** de la tarjeta de confirmación queda
**deshabilitado explicando por qué**, nunca escondido.

### Consentimiento y políticas

- Un **consentimiento** es un hecho que ocurrió: se registra uno nuevo, **nunca
  se edita ni se borra**; la pantalla muestra el **vigente** (otorgado o no, cuándo,
  por qué medio y con qué versión del texto de política).
- El texto de la política (versión actual, finalidad *contacto*) se muestra para
  que quien carga lo lea o lo lea al cliente antes de marcarlo. El medio por el
  que se otorgó se elige de una lista.
- Un contacto con **"no contactar"** activo: el botón de WhatsApp de la venta
  **no se ofrece**, con la explicación visible ("pidió no ser contactado"). Los
  avisos de la operación nunca se mandan a quien lo pidió.
- Es un dato **opcional** para terceros hoy, pero el diseño debe poder mostrarlo
  **obligatorio** si la matriz lo cambia.

### Qué NO resuelve esta pantalla

- No pide **profesor, estilo ni tutor** (no hay menores en un alquiler: el
  titular es un adulto o una organización).
- No pregunta **cómo nos conoció** (canal de captación) a un tercero: oculto.
- La **edición completa** del contacto (todas las relaciones, historial de
  consentimientos) vive en su ficha, no en la venta: aquí solo el alta mínima y
  un enlace "Ver ficha".

### Estados

Buscando, sin resultados (ofrece crear), error de lectura (no se disfraza de
"sin resultados"), y el alta con el botón **deshabilitado** hasta completar los
obligatorios *según la matriz*, diciendo qué falta.
