-- =====================================================================
-- TROPICANA - 0072: importacion de los predeterminados de comunicaciones (R20 E4a)
-- GENERADA por scripts/generar-importacion-predeterminados.mjs desde
-- src/lib/comunicaciones/predeterminados. NO SE EDITA A MANO NI SE VUELVE A
-- MODIFICAR una vez aplicada: si cambia un predeterminado, se genera otra.
-- Importa 24 contenido(s), 24 asignacion(es), 24 version(es) nueva(s).
-- Todo entra en estado 'borrador', origen 'predeterminado', y las asignaciones
-- quedan en modo 'legado' y sin version: NO aprueba, NO publica, NO libera.
-- Idempotente (on conflict do nothing). Los textos van exactos, sin normalizar.
-- =====================================================================

-- @contenido N01.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N01.unica.whatsapp', 'N01', 'unica', 'whatsapp', 'aviso', 'servicio', 'N01 · venta.inscripcion', 'titular o su tutor (dT)')
on conflict (clave) do nothing;

-- @contenido N02.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N02.unica.whatsapp', 'N02', 'unica', 'whatsapp', 'aviso', 'servicio', 'N02 · venta.recibo', 'titular o su tutor (dT)')
on conflict (clave) do nothing;

-- @contenido N03.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N03.unica.whatsapp', 'N03', 'unica', 'whatsapp', 'aviso', 'servicio', 'N03 · venta.prueba', 'titular o su tutor (dT)')
on conflict (clave) do nothing;

-- @contenido N04.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N04.unica.whatsapp', 'N04', 'unica', 'whatsapp', 'aviso', 'servicio', 'N04 · venta.particular', 'alumno o su tutor (dA)')
on conflict (clave) do nothing;

-- @contenido N05.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N05.unica.whatsapp', 'N05', 'unica', 'whatsapp', 'aviso', 'servicio', 'N05 · venta.particular', 'profesor de la membresía')
on conflict (clave) do nothing;

-- @contenido N06.titular.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N06.titular.whatsapp', 'N06', 'titular', 'whatsapp', 'aviso', 'servicio', 'N06 · venta.alquiler · titular', 'titular del alquiler, o la persona que atiende a la organización · a su propio titular')
on conflict (clave) do nothing;

-- @contenido N06.contacto.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N06.contacto.whatsapp', 'N06', 'contacto', 'whatsapp', 'aviso', 'servicio', 'N06 · venta.alquiler · contacto', 'titular del alquiler, o la persona que atiende a la organización · a la persona de contacto')
on conflict (clave) do nothing;

-- @contenido N07.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N07.unica.whatsapp', 'N07', 'unica', 'whatsapp', 'aviso', 'servicio', 'N07 · reserva.solicitada', 'alumno, tutor o titular (dA / dT)')
on conflict (clave) do nothing;

-- @contenido N08.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N08.unica.whatsapp', 'N08', 'unica', 'whatsapp', 'aviso', 'servicio', 'N08 · reserva.solicitada', 'profesor de la membresía (solo particular; el alquiler no tiene profesor)')
on conflict (clave) do nothing;

-- @contenido N09.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N09.unica.whatsapp', 'N09', 'unica', 'whatsapp', 'aviso', 'servicio', 'N09 · reserva.confirmada', 'alumno, tutor o titular (dA / dT)')
on conflict (clave) do nothing;

-- @contenido N10.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N10.unica.whatsapp', 'N10', 'unica', 'whatsapp', 'aviso', 'servicio', 'N10 · reserva.confirmada', 'profesor de la membresía (solo particular; el alquiler no tiene profesor)')
on conflict (clave) do nothing;

-- @contenido N11.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N11.unica.whatsapp', 'N11', 'unica', 'whatsapp', 'aviso', 'servicio', 'N11 · reserva.suspendida', 'alumno, tutor o titular (dA / dT)')
on conflict (clave) do nothing;

-- @contenido N12.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N12.unica.whatsapp', 'N12', 'unica', 'whatsapp', 'aviso', 'servicio', 'N12 · reserva.suspendida', 'profesor de la membresía (solo particular; el alquiler no tiene profesor)')
on conflict (clave) do nothing;

-- @contenido N13.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N13.unica.whatsapp', 'N13', 'unica', 'whatsapp', 'aviso', 'servicio', 'N13 · reserva.restablecida', 'alumno, tutor o titular (dA / dT)')
on conflict (clave) do nothing;

-- @contenido N14.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N14.unica.whatsapp', 'N14', 'unica', 'whatsapp', 'aviso', 'servicio', 'N14 · reserva.restablecida', 'profesor de la membresía (solo particular; el alquiler no tiene profesor)')
on conflict (clave) do nothing;

-- @contenido N15.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N15.unica.whatsapp', 'N15', 'unica', 'whatsapp', 'aviso', 'servicio', 'N15 · reserva.reprogramada', 'alumno, tutor o titular (dA / dT)')
on conflict (clave) do nothing;

-- @contenido N16.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N16.unica.whatsapp', 'N16', 'unica', 'whatsapp', 'aviso', 'servicio', 'N16 · reserva.reprogramada', 'profesor de la membresía (solo particular; el alquiler no tiene profesor)')
on conflict (clave) do nothing;

-- @contenido N17.fuera_de_plazo.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N17.fuera_de_plazo.whatsapp', 'N17', 'fuera_de_plazo', 'whatsapp', 'aviso', 'servicio', 'N17 · reserva.cancelada_pedido · fuera_de_plazo', 'alumno, tutor o titular (dA / dT)')
on conflict (clave) do nothing;

-- @contenido N17.en_plazo.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N17.en_plazo.whatsapp', 'N17', 'en_plazo', 'whatsapp', 'aviso', 'servicio', 'N17 · reserva.cancelada_pedido · en_plazo', 'alumno, tutor o titular (dA / dT)')
on conflict (clave) do nothing;

-- @contenido N18.fuera_de_plazo.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N18.fuera_de_plazo.whatsapp', 'N18', 'fuera_de_plazo', 'whatsapp', 'aviso', 'servicio', 'N18 · reserva.cancelada_pedido · fuera_de_plazo', 'profesor de la membresía (solo particular; el alquiler no tiene profesor)')
on conflict (clave) do nothing;

-- @contenido N18.en_plazo.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N18.en_plazo.whatsapp', 'N18', 'en_plazo', 'whatsapp', 'aviso', 'servicio', 'N18 · reserva.cancelada_pedido · en_plazo', 'profesor de la membresía (solo particular; el alquiler no tiene profesor)')
on conflict (clave) do nothing;

-- @contenido N19.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N19.unica.whatsapp', 'N19', 'unica', 'whatsapp', 'aviso', 'servicio', 'N19 · clase.suspendida', 'alumno o su tutor (WhatsApp propio o, en un menor sin WhatsApp, el del tutor)')
on conflict (clave) do nothing;

-- @contenido N20.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N20.unica.whatsapp', 'N20', 'unica', 'whatsapp', 'aviso', 'servicio', 'N20 · clase.suspendida', 'profesor titular del curso en esa fecha')
on conflict (clave) do nothing;

-- @contenido N21.unica.whatsapp
insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)
values ('N21.unica.whatsapp', 'N21', 'unica', 'whatsapp', 'aviso', 'servicio', 'N21 · clase.restablecida', 'alumno o su tutor (WhatsApp propio o, en un menor sin WhatsApp, el del tutor)')
on conflict (clave) do nothing;

-- @uso venta.inscripcion.alumno unica whatsapp N01.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'venta.inscripcion.alumno', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N01.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso venta.recibo.alumno unica whatsapp N02.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'venta.recibo.alumno', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N02.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso venta.prueba.alumno unica whatsapp N03.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'venta.prueba.alumno', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N03.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso venta.particular.alumno unica whatsapp N04.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'venta.particular.alumno', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N04.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso venta.particular.profesor unica whatsapp N05.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'venta.particular.profesor', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N05.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso venta.alquiler titular whatsapp N06.titular.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'venta.alquiler', 'titular', 'whatsapp', c.id from public.contenidos c where c.clave = 'N06.titular.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso venta.alquiler contacto whatsapp N06.contacto.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'venta.alquiler', 'contacto', 'whatsapp', c.id from public.contenidos c where c.clave = 'N06.contacto.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.solicitada.alumno unica whatsapp N07.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.solicitada.alumno', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N07.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.solicitada.profesor unica whatsapp N08.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.solicitada.profesor', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N08.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.confirmada.alumno unica whatsapp N09.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.confirmada.alumno', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N09.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.confirmada.profesor unica whatsapp N10.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.confirmada.profesor', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N10.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.suspendida.alumno unica whatsapp N11.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.suspendida.alumno', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N11.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.suspendida.profesor unica whatsapp N12.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.suspendida.profesor', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N12.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.restablecida.alumno unica whatsapp N13.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.restablecida.alumno', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N13.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.restablecida.profesor unica whatsapp N14.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.restablecida.profesor', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N14.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.reprogramada.alumno unica whatsapp N15.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.reprogramada.alumno', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N15.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.reprogramada.profesor unica whatsapp N16.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.reprogramada.profesor', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N16.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.cancelada_pedido.alumno fuera_de_plazo whatsapp N17.fuera_de_plazo.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.cancelada_pedido.alumno', 'fuera_de_plazo', 'whatsapp', c.id from public.contenidos c where c.clave = 'N17.fuera_de_plazo.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.cancelada_pedido.alumno en_plazo whatsapp N17.en_plazo.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.cancelada_pedido.alumno', 'en_plazo', 'whatsapp', c.id from public.contenidos c where c.clave = 'N17.en_plazo.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.cancelada_pedido.profesor fuera_de_plazo whatsapp N18.fuera_de_plazo.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.cancelada_pedido.profesor', 'fuera_de_plazo', 'whatsapp', c.id from public.contenidos c where c.clave = 'N18.fuera_de_plazo.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso reserva.cancelada_pedido.profesor en_plazo whatsapp N18.en_plazo.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'reserva.cancelada_pedido.profesor', 'en_plazo', 'whatsapp', c.id from public.contenidos c where c.clave = 'N18.en_plazo.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso clase.suspendida.alumno unica whatsapp N19.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'clase.suspendida.alumno', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N19.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso clase.suspendida.profesor unica whatsapp N20.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'clase.suspendida.profesor', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N20.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @uso clase.restablecida.alumno unica whatsapp N21.unica.whatsapp
insert into public.contenido_usos (uso, variante, canal, contenido_id)
select 'clase.restablecida.alumno', 'unica', 'whatsapp', c.id from public.contenidos c where c.clave = 'N21.unica.whatsapp'
on conflict (uso, variante, canal) do nothing;

-- @version N01.unica.whatsapp 1 ade1c449555c5c077bf565ca551740517b8d70717367ddbac2e4312d67a8e9ab
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Confirmamos {{#si venta.es_menor}}la inscripción de {{alumno.nombre}}{{#sino}}tu inscripción{{/si}} en {{venta.plan}}.

{{#si venta.varios_cursos}}Cursos:{{#sino}}Curso:{{/si}}{{#cada venta.cursos}}
• {{.}}{{/cada}}

Incluye: {{#si venta.ilimitado}}clases ilimitadas durante {{venta.ciclo_dias}} días{{#sino}}{{venta.clases_plan}}{{#si venta.hay_bono}} (incluye {{venta.bono}} de bono{{#si venta.hay_bono_cursos}} de {{#cada venta.bono_cursos sep=" y "}}{{.}}{{/cada}}{{/si}}){{/si}}{{/si}}.
Empieza el {{venta.inicio}}{{#si venta.hay_fin}} y el ciclo termina aprox. el {{venta.fin}}{{/si}}.
{{#si venta.hay_tolerancia}}Si faltás hasta {{venta.tolerancia}} por ciclo avisando con licencia, la clase se repone con un bono de ese mismo curso, que vale en tu próxima inscripción que lo incluya; una falta sin aviso se pierde y anula el bono de ese curso.{{#sino}}Las faltas no se reponen.{{/si}}

Precio: {{venta.precio}}.{{#si venta.hay_credito}} Crédito de tu clase de prueba: {{venta.credito}}.{{/si}}{{#si venta.hay_cobrado}} Pagado: {{venta.cobrado}}{{#si venta.hay_medio}} ({{venta.medio}}){{/si}}.{{#sino}} Todavía sin pago.{{/si}}{{#si venta.hay_saldo}} Saldo: {{venta.saldo}}{{#si venta.hay_compromiso}} hasta el {{venta.compromiso}}{{/si}}.{{#sino}} Cuota saldada.{{/si}}

¡Te esperamos!$cuerpo$, null,
       $esquema${"condiciones":["venta.es_menor","venta.varios_cursos","venta.ilimitado","venta.hay_bono","venta.hay_bono_cursos","venta.hay_fin","venta.hay_tolerancia","venta.hay_credito","venta.hay_cobrado","venta.hay_medio","venta.hay_saldo","venta.hay_compromiso"],"listas":["venta.cursos","venta.bono_cursos"],"variables":[{"nombre":"alumno.nombre","obligatoria":true,"permiteVacia":true},{"nombre":"venta.plan","obligatoria":true,"permiteVacia":true},{"nombre":"venta.ciclo_dias","obligatoria":true,"permiteVacia":false},{"nombre":"venta.clases_plan","obligatoria":true,"permiteVacia":false},{"nombre":"venta.bono","obligatoria":true,"permiteVacia":false},{"nombre":"venta.inicio","obligatoria":true,"permiteVacia":false},{"nombre":"venta.fin","obligatoria":true,"permiteVacia":false},{"nombre":"venta.tolerancia","obligatoria":true,"permiteVacia":false},{"nombre":"venta.precio","obligatoria":true,"permiteVacia":false},{"nombre":"venta.credito","obligatoria":true,"permiteVacia":false},{"nombre":"venta.cobrado","obligatoria":true,"permiteVacia":false},{"nombre":"venta.medio","obligatoria":true,"permiteVacia":false},{"nombre":"venta.saldo","obligatoria":true,"permiteVacia":false},{"nombre":"venta.compromiso","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, 'ade1c449555c5c077bf565ca551740517b8d70717367ddbac2e4312d67a8e9ab', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N01.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N02.unica.whatsapp 1 1c7cdbf9acec9010db3efda6065de07b22849562d9c52e844273f5a626c2ae13
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Recibo de pago — {{recibo.fecha}}
Recibimos de {{alumno.nombre}}: {{recibo.monto}}{{#si recibo.hay_medio}} ({{recibo.medio}}){{/si}}.
Concepto: {{venta.plan}}.
{{#si recibo.hay_saldo}}Saldo pendiente: {{recibo.saldo}}{{#si recibo.hay_compromiso}} hasta el {{recibo.compromiso}}{{/si}}.{{#sino}}Cuota saldada. ¡Gracias!{{/si}}$cuerpo$, null,
       $esquema${"condiciones":["recibo.hay_medio","recibo.hay_saldo","recibo.hay_compromiso"],"listas":[],"variables":[{"nombre":"recibo.fecha","obligatoria":true,"permiteVacia":false},{"nombre":"alumno.nombre","obligatoria":true,"permiteVacia":true},{"nombre":"recibo.monto","obligatoria":true,"permiteVacia":false},{"nombre":"recibo.medio","obligatoria":true,"permiteVacia":false},{"nombre":"venta.plan","obligatoria":true,"permiteVacia":true},{"nombre":"recibo.saldo","obligatoria":true,"permiteVacia":false},{"nombre":"recibo.compromiso","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '1c7cdbf9acec9010db3efda6065de07b22849562d9c52e844273f5a626c2ae13', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N02.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N03.unica.whatsapp 1 91e171713738dd5078f2908f0ef2f9ab615dc6bb4f23bf1e67560b28e73413f5
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Confirmamos {{#si venta.es_menor}}la clase de prueba de {{alumno.nombre}}{{#sino}}tu clase de prueba{{/si}} ({{venta.plan}}, {{venta.gente}}):{{#si venta.hay_clases}} {{#cada venta.clases sep=" y "}}{{.}}{{/cada}}{{/si}}. ¡Te esperamos!$cuerpo$, null,
       $esquema${"condiciones":["venta.es_menor","venta.hay_clases"],"listas":["venta.clases"],"variables":[{"nombre":"alumno.nombre","obligatoria":true,"permiteVacia":true},{"nombre":"venta.plan","obligatoria":true,"permiteVacia":true},{"nombre":"venta.gente","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '91e171713738dd5078f2908f0ef2f9ab615dc6bb4f23bf1e67560b28e73413f5', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N03.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N04.unica.whatsapp 1 fc97a3e623827f62b72afb5b8785f1ade1630661617576d7e8e87449cbef4712
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Confirmamos tu paquete de {{venta.horas}} h de clases particulares ({{venta.plan}}) con {{profesor.nombre}} en {{venta.lugar}}. {{#si venta.es_fija}}{{#si venta.una_sesion}}Tu clase reservada es{{#sino}}Tus clases reservadas son{{/si}}{{#sino}}Tu primera clase reservada es{{/si}}: {{venta.agenda}}.{{#si venta.hay_resto}} El resto se coordina después.{{/si}} ¡Te esperamos!$cuerpo$, null,
       $esquema${"condiciones":["venta.es_fija","venta.una_sesion","venta.hay_resto"],"listas":[],"variables":[{"nombre":"venta.horas","obligatoria":true,"permiteVacia":false},{"nombre":"venta.plan","obligatoria":true,"permiteVacia":true},{"nombre":"profesor.nombre","obligatoria":true,"permiteVacia":true},{"nombre":"venta.lugar","obligatoria":true,"permiteVacia":true},{"nombre":"venta.agenda","obligatoria":true,"permiteVacia":true}]}$esquema$::jsonb, 'fc97a3e623827f62b72afb5b8785f1ade1630661617576d7e8e87449cbef4712', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N04.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N05.unica.whatsapp 1 1b4602a0463d34d83eabe972c02d24a293131885893a5f5a08b7fa2d49ac11ef
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Se te agendó una clase particular ({{venta.plan}}) con {{alumno.nombre}} en {{venta.lugar}}. {{#si venta.es_fija}}{{#si venta.una_sesion}}La clase es{{#sino}}Las clases son{{/si}}{{#sino}}La primera clase es{{/si}}: {{venta.agenda}}.{{#si venta.hay_resto}} El resto se coordina después.{{/si}}$cuerpo$, null,
       $esquema${"condiciones":["venta.es_fija","venta.una_sesion","venta.hay_resto"],"listas":[],"variables":[{"nombre":"venta.plan","obligatoria":true,"permiteVacia":true},{"nombre":"alumno.nombre","obligatoria":true,"permiteVacia":true},{"nombre":"venta.lugar","obligatoria":true,"permiteVacia":true},{"nombre":"venta.agenda","obligatoria":true,"permiteVacia":true}]}$esquema$::jsonb, '1b4602a0463d34d83eabe972c02d24a293131885893a5f5a08b7fa2d49ac11ef', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N05.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N06.titular.whatsapp 1 1ecf3bde0593a792c7934aff6972ab9c19155a1e23c5728851d347ae9f72e1fc
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Confirmamos tu alquiler de sala ({{venta.plan}}): {{venta.horas}} h en {{venta.lugar}}. Reservado: {{venta.agenda}}.{{#si venta.hay_resto}} El resto de las horas se coordina después.{{/si}} ¡Te esperamos!$cuerpo$, null,
       $esquema${"condiciones":["venta.hay_resto"],"listas":[],"variables":[{"nombre":"venta.plan","obligatoria":true,"permiteVacia":true},{"nombre":"venta.horas","obligatoria":true,"permiteVacia":false},{"nombre":"venta.lugar","obligatoria":true,"permiteVacia":true},{"nombre":"venta.agenda","obligatoria":true,"permiteVacia":true}]}$esquema$::jsonb, '1ecf3bde0593a792c7934aff6972ab9c19155a1e23c5728851d347ae9f72e1fc', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N06.titular.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N06.contacto.whatsapp 1 c3ebd32281a8022a3d4623294c9623234e414a7808d537b80810b30ed266d363
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Confirmamos el alquiler de sala ({{venta.plan}}) de {{alquiler.titular}}: {{venta.horas}} h en {{venta.lugar}}. Reservado: {{venta.agenda}}.{{#si venta.hay_resto}} El resto de las horas se coordina después.{{/si}} ¡Los esperamos!$cuerpo$, null,
       $esquema${"condiciones":["venta.hay_resto"],"listas":[],"variables":[{"nombre":"venta.plan","obligatoria":true,"permiteVacia":true},{"nombre":"alquiler.titular","obligatoria":true,"permiteVacia":true},{"nombre":"venta.horas","obligatoria":true,"permiteVacia":false},{"nombre":"venta.lugar","obligatoria":true,"permiteVacia":true},{"nombre":"venta.agenda","obligatoria":true,"permiteVacia":true}]}$esquema$::jsonb, 'c3ebd32281a8022a3d4623294c9623234e414a7808d537b80810b30ed266d363', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N06.contacto.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N07.unica.whatsapp 1 f7fd746add08d744b2a3c7d8ee5e84a9cf587adfb5ab78bb003ca0076cb5fab2
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Estamos coordinando {{reserva.tu_clase}} para el {{reserva.cuando}}, en {{reserva.lugar}}. Te la confirmamos a la brevedad.$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.tu_clase","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.lugar","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, 'f7fd746add08d744b2a3c7d8ee5e84a9cf587adfb5ab78bb003ca0076cb5fab2', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N07.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N08.unica.whatsapp 1 4b6cd07c423d2095fe948cdf329d719758ba2bb148f1e2ec6c7b7fc2a59727f7
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Estamos coordinando una clase particular ({{reserva.plan}}) con {{alumno.nombre}} para el {{reserva.cuando}}, en {{reserva.lugar}}. ¿Te queda bien? Te confirmamos.$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.plan","obligatoria":true,"permiteVacia":false},{"nombre":"alumno.nombre","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.lugar","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '4b6cd07c423d2095fe948cdf329d719758ba2bb148f1e2ec6c7b7fc2a59727f7', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N08.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N09.unica.whatsapp 1 95f417445265351728ff8c6f0bf59b2b8d5a148fc89668a2d299a8e624309805
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Confirmamos {{reserva.tu_clase}}: {{reserva.cuando}}, en {{reserva.lugar}}. Te quedan {{saldo.disponible_horas}} h de tu {{saldo.paquete}} de {{saldo.contratadas_horas}} h. ¡Te esperamos!$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.tu_clase","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.lugar","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.disponible_horas","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.paquete","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.contratadas_horas","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '95f417445265351728ff8c6f0bf59b2b8d5a148fc89668a2d299a8e624309805', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N09.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N10.unica.whatsapp 1 08fa778574de2d35584c873b0bea1859b8aeb03ff253c995542bfcc9c6981cc7
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Se te confirmó una clase particular ({{reserva.plan}}) con {{alumno.nombre}}: {{reserva.cuando}}, en {{reserva.lugar}}.$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.plan","obligatoria":true,"permiteVacia":false},{"nombre":"alumno.nombre","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.lugar","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '08fa778574de2d35584c873b0bea1859b8aeb03ff253c995542bfcc9c6981cc7', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N10.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N11.unica.whatsapp 1 adb97f40325ae4ff50ec34d9ffd7790f004193691f840118516e753d92b514f8
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! {{reserva.tu_clase_corta|mayuscula_inicial}} del {{reserva.cuando}} quedó suspendida ({{reserva.motivo}}). Esa hora vuelve a tu {{saldo.paquete}}: Te quedan {{saldo.disponible_horas}} h de tu {{saldo.paquete}} de {{saldo.contratadas_horas}} h. Coordinamos una nueva fecha.$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.tu_clase_corta","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.motivo","obligatoria":true,"permiteVacia":true},{"nombre":"saldo.paquete","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.disponible_horas","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.contratadas_horas","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, 'adb97f40325ae4ff50ec34d9ffd7790f004193691f840118516e753d92b514f8', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N11.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N12.unica.whatsapp 1 6321d0279adee3e8f0f7bf78cc9ccce4313c47119d7535f5d8487863621bffb7
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! La clase particular ({{reserva.plan}}) con {{alumno.nombre}} del {{reserva.cuando}}, en {{reserva.lugar}}, quedó suspendida ({{reserva.motivo}}).$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.plan","obligatoria":true,"permiteVacia":false},{"nombre":"alumno.nombre","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.lugar","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.motivo","obligatoria":true,"permiteVacia":true}]}$esquema$::jsonb, '6321d0279adee3e8f0f7bf78cc9ccce4313c47119d7535f5d8487863621bffb7', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N12.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N13.unica.whatsapp 1 792bc87fcb7ae44dd3dac52a7dfe6ef7e1b0ea57f8353c07e4d529ae75568787
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Se restableció {{reserva.tu_clase}}: {{reserva.cuando}}, en {{reserva.lugar}}. Te quedan {{saldo.disponible_horas}} h de tu {{saldo.paquete}} de {{saldo.contratadas_horas}} h. ¡Te esperamos!$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.tu_clase","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.lugar","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.disponible_horas","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.paquete","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.contratadas_horas","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '792bc87fcb7ae44dd3dac52a7dfe6ef7e1b0ea57f8353c07e4d529ae75568787', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N13.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N14.unica.whatsapp 1 1098ea29231f4bd649963563470cf4ae279533107abe6bdc5741d6d1142da124
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Se restableció una clase particular ({{reserva.plan}}) con {{alumno.nombre}}: {{reserva.cuando}}, en {{reserva.lugar}}.$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.plan","obligatoria":true,"permiteVacia":false},{"nombre":"alumno.nombre","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.lugar","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '1098ea29231f4bd649963563470cf4ae279533107abe6bdc5741d6d1142da124', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N14.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N15.unica.whatsapp 1 800548123b2e0b8a1ffd08aa3bd1348b4abbdf515628cce5103faefee2c759d0
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Reprogramamos {{reserva.tu_clase}}: pasa del {{reserva.antes}} al {{reserva.cuando}}, en {{reserva.lugar}}. Te quedan {{saldo.disponible_horas}} h de tu {{saldo.paquete}} de {{saldo.contratadas_horas}} h. ¡Te esperamos!$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.tu_clase","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.antes","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.lugar","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.disponible_horas","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.paquete","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.contratadas_horas","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '800548123b2e0b8a1ffd08aa3bd1348b4abbdf515628cce5103faefee2c759d0', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N15.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N16.unica.whatsapp 1 702abd4f6bbc66721089b47c4b6220e081686f9937b0dd202bd19cd5934ac88b
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Se reprogramó la clase particular ({{reserva.plan}}) con {{alumno.nombre}}: pasa del {{reserva.antes}} al {{reserva.cuando}}, en {{reserva.lugar}}.$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.plan","obligatoria":true,"permiteVacia":false},{"nombre":"alumno.nombre","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.antes","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.lugar","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '702abd4f6bbc66721089b47c4b6220e081686f9937b0dd202bd19cd5934ac88b', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N16.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N17.fuera_de_plazo.whatsapp 1 4e78c087e74ab2c46646abd08e02c04b408b777a55cf1da38ce073cc737876a9
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Registramos la cancelación de {{reserva.tu_clase_corta}} del {{reserva.cuando}}. Como fue con menos de {{reserva.plazo_horas}} h de anticipación, esa hora se descuenta del {{saldo.paquete}}. Te quedan {{saldo.disponible_horas}} h de tu {{saldo.paquete}} de {{saldo.contratadas_horas}} h.$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.tu_clase_corta","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.plazo_horas","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.paquete","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.disponible_horas","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.contratadas_horas","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '4e78c087e74ab2c46646abd08e02c04b408b777a55cf1da38ce073cc737876a9', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N17.fuera_de_plazo.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N17.en_plazo.whatsapp 1 c8194395be9ce8ce26115dcda077eb53545c7202e0e5d24521ebe6f023d9806f
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Cancelamos {{reserva.tu_clase_corta}} del {{reserva.cuando}}, como pediste. Esa hora vuelve a tu {{saldo.paquete}}: Te quedan {{saldo.disponible_horas}} h de tu {{saldo.paquete}} de {{saldo.contratadas_horas}} h. Coordinamos una nueva fecha.$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.tu_clase_corta","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.paquete","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.disponible_horas","obligatoria":true,"permiteVacia":false},{"nombre":"saldo.contratadas_horas","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, 'c8194395be9ce8ce26115dcda077eb53545c7202e0e5d24521ebe6f023d9806f', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N17.en_plazo.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N18.fuera_de_plazo.whatsapp 1 7bf453a17c903d36835e9e7b7ea9f3d297b8f29e29695f98ca34a3c3eaa31137
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! {{alumno.nombre}} canceló fuera de plazo la clase particular ({{reserva.plan}}) del {{reserva.cuando}}, en {{reserva.lugar}}. Ya no hace falta que vayas.$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"alumno.nombre","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.plan","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.lugar","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '7bf453a17c903d36835e9e7b7ea9f3d297b8f29e29695f98ca34a3c3eaa31137', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N18.fuera_de_plazo.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N18.en_plazo.whatsapp 1 148512c5649800bbc3928285e26baa488726a2b971a988edcf5d942cdf48a3fb
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola! Se canceló a pedido del alumno la clase particular ({{reserva.plan}}) con {{alumno.nombre}} del {{reserva.cuando}}, en {{reserva.lugar}}.$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"reserva.plan","obligatoria":true,"permiteVacia":false},{"nombre":"alumno.nombre","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.cuando","obligatoria":true,"permiteVacia":false},{"nombre":"reserva.lugar","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '148512c5649800bbc3928285e26baa488726a2b971a988edcf5d942cdf48a3fb', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N18.en_plazo.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N19.unica.whatsapp 1 bb81e688a2342d6d397f434e0e5cad5dbeb27ed2d21abfe022c0df7e8ff60f10
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola {{alumno.nombre_pila}}! Te avisamos que tu clase de {{#cada clase.detalle sep=", "}}{{.}}{{/cada}} {{#si clase.varias}}quedaron suspendidas{{#sino}}quedó suspendida{{/si}} por {{clase.motivo}}.{{#si clase.hay_ciclo}} Tu ciclo se corrió: ahora vence el {{clase.fin_ciclo}}.{{/si}} Cualquier duda, escribinos por acá. ¡Gracias!$cuerpo$, null,
       $esquema${"condiciones":["clase.varias","clase.hay_ciclo"],"listas":["clase.detalle"],"variables":[{"nombre":"alumno.nombre_pila","obligatoria":true,"permiteVacia":false},{"nombre":"clase.motivo","obligatoria":true,"permiteVacia":true},{"nombre":"clase.fin_ciclo","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, 'bb81e688a2342d6d397f434e0e5cad5dbeb27ed2d21abfe022c0df7e8ff60f10', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N19.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N20.unica.whatsapp 1 93083967f432ab7d0c011724846298468dbea595be11666f2b59c6218af6b567
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola {{profesor.nombre_pila}}! Te avisamos que la clase de {{clase.curso}} del {{clase.fecha}} quedó suspendida por {{clase.motivo}}. No hace falta que la dictes.$cuerpo$, null,
       $esquema${"condiciones":[],"listas":[],"variables":[{"nombre":"profesor.nombre_pila","obligatoria":true,"permiteVacia":false},{"nombre":"clase.curso","obligatoria":true,"permiteVacia":false},{"nombre":"clase.fecha","obligatoria":true,"permiteVacia":false},{"nombre":"clase.motivo","obligatoria":true,"permiteVacia":true}]}$esquema$::jsonb, '93083967f432ab7d0c011724846298468dbea595be11666f2b59c6218af6b567', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N20.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;

-- @version N21.unica.whatsapp 1 1acc90c41143e9441c1d89df2629d870d3f2f53be7fbfd7f6d1243a676cca72e
insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)
select c.id, 1, $cuerpo$Hola {{alumno.nombre_pila}}! Te avisamos que tu clase de {{clase.curso}} del {{clase.fecha}} se restableció: se dicta con normalidad.{{#si clase.hay_ciclo}} Tu ciclo vuelve a vencer el {{clase.fin_ciclo}}.{{/si}} Cualquier duda, escribinos por acá. ¡Gracias!$cuerpo$, null,
       $esquema${"condiciones":["clase.hay_ciclo"],"listas":[],"variables":[{"nombre":"alumno.nombre_pila","obligatoria":true,"permiteVacia":false},{"nombre":"clase.curso","obligatoria":true,"permiteVacia":false},{"nombre":"clase.fecha","obligatoria":true,"permiteVacia":false},{"nombre":"clase.fin_ciclo","obligatoria":true,"permiteVacia":false}]}$esquema$::jsonb, '1acc90c41143e9441c1d89df2629d870d3f2f53be7fbfd7f6d1243a676cca72e', 'predeterminado', 'borrador'
  from public.contenidos c where c.clave = 'N21.unica.whatsapp'
on conflict (contenido_id, hash) do nothing;
