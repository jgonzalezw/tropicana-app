-- =====================================================================
-- TROPICANA - 0021: el corrimiento pasa a hablar del FIN DE CICLO
-- ---------------------------------------------------------------------
-- POR QUE (Javier, 2026-09-10)
-- ----------------------------
-- `corrimientos_ciclo` nacio en la 0009, cuando una inscripcion era una
-- mensualidad y el ciclo ERA el mes pago: por eso guarda
-- `vencimiento_anterior` / `vencimiento_nuevo` y movia `cuotas.vencimiento`.
-- Con el motor de planes (0010) el ciclo termina cuando ocurren N clases,
-- que es otra cosa que un mes pago, y el corrimiento nunca se recableo.
--
-- Javier zanja la definicion: el corrimiento hace al **fin de ciclo de la
-- membresia** y a la **fecha maxima de renovacion bonificada**. La cuota
-- queda afuera: su vencimiento es el plazo de pago, otro asunto.
--
-- QUE HACE
-- --------
-- Aditiva. Agrega `fin_ciclo_anterior` / `fin_ciclo_nuevo`, que son las que
-- el codigo escribe de ahora en adelante. Las columnas viejas se CONSERVAN
-- con su dato: son el registro de lo que efectivamente se hizo bajo la
-- politica anterior, y borrarlas seria perder historia de una operacion real.
--
-- No revierte ningun `cuotas.vencimiento` ya corrido: esas fechas se le
-- comunicaron a alumnos de verdad. Se congelan como estan.
--
-- Idempotente.
-- =====================================================================

alter table public.corrimientos_ciclo
  add column if not exists fin_ciclo_anterior date,
  add column if not exists fin_ciclo_nuevo    date;

comment on column public.corrimientos_ciclo.fin_ciclo_anterior is
  'Fin de ciclo de la membresia (inscripciones.fecha_fin) antes de este corrimiento.';
comment on column public.corrimientos_ciclo.fin_ciclo_nuevo is
  'Fin de ciclo de la membresia despues de este corrimiento.';
comment on column public.corrimientos_ciclo.vencimiento_anterior is
  'HISTORICO (politica anterior a 0021): vencimiento de la cuota antes del corrimiento. Ya no se escribe.';
comment on column public.corrimientos_ciclo.vencimiento_nuevo is
  'HISTORICO (politica anterior a 0021): vencimiento de la cuota despues del corrimiento. Ya no se escribe.';

comment on table public.corrimientos_ciclo is
  'Traza y deshacer de los corrimientos de fin de ciclo. Una fila por (inscripcion, sesion). Desde 0021 el fin de ciclo se CALCULA desde las sesiones reales (ver finDeCicloReal): esta tabla explica y audita, ya no es la fuente de verdad.';

-- Las filas tipo 'falta' son residuo de la politica vieja (una falta tolerada
-- corria el ciclo). Hoy la falta con licencia acredita bono y no corre nada.
-- Se marcan como historicas dejando el fin de ciclo en null: la fila queda
-- como registro, pero no participa del calculo actual.
update public.corrimientos_ciclo
set fin_ciclo_anterior = null, fin_ciclo_nuevo = null
where tipo = 'falta';
