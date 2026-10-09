import EnlaceWhatsapp from "@/components/entidades/EnlaceWhatsapp";
import LugarExterno from "@/components/LugarExterno";
import { Chip } from "@/components/nuevo/Chip";
import ChipTitular from "@/components/nuevo/ChipTitular";
import { Indicadores } from "@/components/nuevo/Indicador";
import { rotuloDiasMembresia } from "@/lib/inscripcion";
import { nombreVisible } from "@/lib/formato";
import { textoBonos } from "@/lib/bono";
import { formatearHoras } from "@/lib/horarios";
import { textoMenorFila } from "@/lib/listaMembresias";
import {
  fechaTexto,
  montoCorto,
  periodoTexto,
  type AvisoFicha,
  type EventoHistorial,
  type IndicadorFicha,
  type LineaPago,
} from "@/lib/fichaMembresia";
import type { FichaMembresiaCompleta } from "../../acciones";
import { ETIQUETA_TIPO, TONO_CHIP } from "../../presentacion";
import AccionesFicha from "./AccionesFicha";
import PestanasFicha, { type DatosReservas } from "./PestanasFicha";
import ProveedorNuevaReserva from "./NuevaReservaFicha";
import { ProveedorAvisos, TarjetaParaAvisar } from "./AvisosFicha";

const horas = (min: number) => `${formatearHoras(min / 60)} h`;

function Fila({ k, v, destacado, tono }: { k: string; v: React.ReactNode; destacado?: boolean; tono?: "peligro" }) {
  return (
    <div className="n-kv" data-destacado={destacado ? "true" : undefined} data-tono={tono}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Tarjeta({ titulo, children, testid }: { titulo: string; children: React.ReactNode; testid?: string }) {
  return (
    <section className="n-tarjeta" data-testid={testid}>
      <h2 className="n-tarjeta__titulo">{titulo}</h2>
      {children}
    </section>
  );
}

const ROL: Record<string, string> = { alumno: "Alumno", profesor: "Profesor de Tropicana", sin_rol: "" };

/**
 * La ficha de una membresía (I-012). Dibuja lo que ya calculó
 * `fichaMembresia.ts` y lo que leyó `obtenerMembresia`; no decide nada. Las
 * reservas (fase 2) son lo único que se opera desde acá; el resto de las
 * acciones está deshabilitado con su fase.
 */
export default function FichaMembresiaVista({
  ficha,
  indicadores,
  avisos,
  historial,
  pagos,
  reservas,
  puedeVerRecibo,
}: {
  ficha: FichaMembresiaCompleta;
  indicadores: IndicadorFicha[];
  avisos: AvisoFicha[];
  historial: EventoHistorial[];
  pagos: LineaPago[];
  reservas: DatosReservas | null;
  puedeVerRecibo: boolean;
}) {
  const { fila, cuenta, titular, alquiler, detalle } = ficha;
  const conHoras = fila.tipo === "particular" || fila.tipo === "alquiler";
  const deBaja = fila.estado === "baja";

  const esOrganizacion = fila.titular.tipo === "organizacion";
  const rolTexto = titular.rol === "sin_rol" ? (esOrganizacion ? "Institución" : "Persona sin rol en la escuela") : ROL[titular.rol];
  const horario = conHoras
    ? "Reservas flexibles"
    : cuenta.cursos.map((c) => `${nombreVisible(c.nombre)}${c.dias.length ? ` · ${rotuloDiasMembresia(c.dias)}` : ""}`).join(" — ") || "Sin horario";

  const quienDicto = [...new Set(ficha.clases.filter((c) => c.estadoSesion === "dictada" && c.profesorNombre).map((c) => c.profesorNombre as string))];
  const precio = cuenta.cuotas.reduce((a, c) => a + c.devengado, 0);
  const descuentos = cuenta.cuotas.reduce((a, c) => a + c.descuentoAdelanto, 0) + ficha.pagos.reduce((a, p) => a + p.descuento, 0);
  const pagado = cuenta.cuotas.reduce((a, c) => a + c.cobrado, 0);

  return (
    <ProveedorAvisos>
    <ProveedorNuevaReserva datos={reservas}>
    <article data-testid="ficha-membresia" data-membresia-id={fila.id}>
      <div className="n-enc-cab">
        <div className="n-enc__chips">
          <Chip tono="tipo">{ETIQUETA_TIPO[fila.tipo]}</Chip>
          <Chip tono={TONO_CHIP[fila.chip.clave]}>{fila.chip.texto}</Chip>
          <span className="n-enc__ciclo">
            Ciclo {fila.cicloNumero ?? 1} · {fechaTexto(fila.fechaInicio)} – {fechaTexto(cuenta.fechaFin)}
          </span>
        </div>
        <div className="n-enc">
          <div className="n-enc__izq">
            <h1 className="n-enc__titulo">{nombreVisible(fila.planNombre)}</h1>
            <div className="n-enc__sub">
              <ChipTitular nombre={fila.titularNombre || "Sin titular"} testid="ficha-titular" />
              <span>{[rolTexto, horario].filter(Boolean).join(" · ")}</span>
            </div>
            {textoMenorFila(fila) && (
              <p className="n-enc__menor" data-testid="ficha-menor">
                {textoMenorFila(fila)}
              </p>
            )}
          </div>
          <AccionesFicha alumnoId={fila.alumnoId} deBaja={deBaja} conReservas={conHoras} />
        </div>
      </div>

      <div className="n-indicadores-bloque">
        <Indicadores celdas={indicadores} />
      </div>

      <div className="n-cols">
        <PestanasFicha
          clases={conHoras ? null : ficha.clases}
          reservas={reservas}
          pagos={pagos}
          puedeVerRecibo={puedeVerRecibo}
          historial={historial}
        />

        <aside>
          <TarjetaParaAvisar />
          <Tarjeta titulo="Cuotas y cuenta" testid="bloque-cuotas">
            {cuenta.cuotas.map((c) => (
              <Fila
                key={c.id}
                k={`Cuota ${periodoTexto(c.periodo)}`}
                v={
                  <>
                    {montoCorto(c.saldo)}
                    <small style={{ display: "block", color: "var(--n-fg3)", fontWeight: 400 }}>
                      {c.saldo > 0 ? (c.vencimiento ? `Vence ${fechaTexto(c.vencimiento)}` : "Sin vencimiento") : "Pagada"}
                    </small>
                  </>
                }
                tono={c.saldo > 0 ? "peligro" : undefined}
              />
            ))}
            {!cuenta.cuotas.length && <p className="n-vacio" style={{ padding: 0 }}>Sin cuotas.</p>}
            <hr className="n-sep" />
            <Fila k="Precio de la venta" v={montoCorto(precio)} />
            {descuentos > 0 && <Fila k="Descuentos" v={`− ${montoCorto(descuentos)}`} />}
            <Fila k="Pagado" v={`− ${montoCorto(pagado)}`} />
            <Fila k="Saldo" v={<b data-testid="saldo-cuenta">{montoCorto(cuenta.saldo)}</b>} tono={cuenta.saldo > 0 ? "peligro" : undefined} />
          </Tarjeta>

          {detalle && (
            <Tarjeta titulo="Saldo de horas" testid="bloque-saldo-horas">
              <Fila k="Contratadas" v={horas(detalle.saldo.contratadasMin)} />
              <Fila k="Disponible para pedir" v={horas(detalle.saldo.disponibleMin)} destacado />
              <Fila k="Solicitadas vigentes" v={horas(detalle.saldo.solicitadasVigentesMin)} />
              <Fila k="Reservadas" v={horas(detalle.saldo.reservadasMin)} />
              <Fila k="Realizadas" v={horas(detalle.saldo.realizadasMin)} />
              <Fila k="Consumidas" v={horas(detalle.saldo.consumidasMin)} />
            </Tarjeta>
          )}

          {!conHoras && (
            <Tarjeta titulo="Cursos y asistencia">
              {cuenta.cursos.map((c) => (
                <Fila key={c.nombre} k={nombreVisible(c.nombre)} v={c.dias.length ? rotuloDiasMembresia(c.dias) : "—"} />
              ))}
              <Fila k="Faltas" v={`${cuenta.faltasSinLicencia} sin licencia · ${cuenta.faltasConLicencia} con licencia`} />
              {cuenta.bonos.length > 0 && <Fila k="Bono por usar" v={textoBonos(cuenta.bonos)} destacado />}
              {cuenta.renovacionBonificada && (
                <Fila k="Para no perder el bono" v={`Inscribirse a más tardar el ${fechaTexto(cuenta.renovacionBonificada)}`} />
              )}
              {cuenta.fechaFinEstimada && <Fila k="Fin de ciclo" v={`Estimado: ${fechaTexto(cuenta.fechaFin)}`} />}
            </Tarjeta>
          )}

          {fila.tipo === "particular" && detalle && (
            <Tarjeta titulo="Plan y titular">
              <Fila k="Estilo" v={detalle.estilo || "—"} />
              <Fila k="Titular" v={fila.titularNombre} />
              {titular.avisarA && <Fila k="Avisos a" v={titular.avisarA.nombre} />}
              <Fila k="Lugar externo" v={detalle.permiteSalaExterna ? "Permitido por el plan" : "No permitido por el plan"} />
            </Tarjeta>
          )}

          {alquiler && (
            <Tarjeta titulo="Precio y categoría" testid="bloque-alquiler">
              <Fila k="Categoría" v={alquiler.categoria} />
              {alquiler.personas != null && <Fila k="Personas" v={alquiler.personas} />}
              {alquiler.categoriaCambiada && (
                <Fila k="Categoría cambiada a mano" v={`Sí${alquiler.motivo ? ` · ${alquiler.motivo}` : ""}`} />
              )}
              {alquiler.glosa && <Fila k="Glosa" v={alquiler.glosa} />}
              {alquiler.precio != null && <Fila k="Precio" v={montoCorto(alquiler.precio)} />}
              {titular.avisarA && <Fila k="Avisos a" v={titular.avisarA.nombre} />}
            </Tarjeta>
          )}

          {detalle?.permiteSalaExterna && (
            <Tarjeta titulo="Lugar externo" testid="bloque-lugar-externo">
              <LugarExterno
                variante="nuevo"
                membresiaId={fila.id}
                nombre={detalle.salasDeLaMembresia.find((s) => s.esExterna)?.nombre ?? null}
                puedeEditar={reservas?.puedeEditar ?? false}
              />
            </Tarjeta>
          )}

          <Tarjeta titulo={fila.tipo === "alquiler" ? "Servicio" : conHoras ? "Profesor titular" : "Profesor"}>
            {fila.tipo === "alquiler" ? (
              <p style={{ margin: 0, fontSize: "0.9286rem" }}>Alquiler de sala · sin profesor</p>
            ) : conHoras ? (
              <>
                <p style={{ margin: 0, fontWeight: 500 }}>{fila.profesorNombre ?? detalle?.profesorNombre ?? "Sin profesor"}</p>
                {detalle?.estilo && <small style={{ color: "var(--n-fg3)" }}>{detalle.estilo}</small>}
                {(fila.profesorNombre ?? detalle?.profesorNombre) && (
                  <p style={{ margin: "0.2857rem 0 0", fontSize: "0.9286rem" }} data-testid="profesor-whatsapp">
                    <EnlaceWhatsapp numero={fila.profesorWhatsapp} vacio="Sin WhatsApp cargado" />
                  </p>
                )}
              </>
            ) : (
              // En un curso el profesor es el titular del curso (asignación, regla 20); quién dictó
              // cada clase —con su sustituto— se ve en la pestaña Clases.
              <>
                {ficha.profesoresCurso.length ? (
                  ficha.profesoresCurso.map((p) => (
                    <p key={p.curso} style={{ margin: "0 0 0.4286rem", fontWeight: 500 }} data-testid="profesor-titular">
                      {p.profesor ?? "Sin titular asignado"}
                      <small style={{ display: "block", color: "var(--n-fg3)", fontWeight: 400 }}>Titular de {nombreVisible(p.curso)}</small>
                      {p.profesor && (
                        <span style={{ display: "block", fontSize: "0.9286rem", fontWeight: 400, marginTop: "0.2857rem" }} data-testid="profesor-whatsapp">
                          <EnlaceWhatsapp numero={p.whatsapp} vacio="Sin WhatsApp cargado" />
                        </span>
                      )}
                    </p>
                  ))
                ) : (
                  <p style={{ margin: 0, fontWeight: 500 }}>Sin titular asignado</p>
                )}
                {quienDicto.length > 0 && <small style={{ color: "var(--n-fg3)" }}>Dictaron las clases: {quienDicto.join(", ")}</small>}
              </>
            )}
          </Tarjeta>

          {titular.avisarA && (
            <Tarjeta titulo="Avisos por WhatsApp" testid="bloque-whatsapp">
              <p style={{ margin: 0, fontWeight: 500 }} data-testid="whatsapp-destinatario">{titular.avisarA.nombre}</p>
              <p style={{ margin: "0.2857rem 0 0", fontSize: "0.9286rem" }} data-testid="whatsapp-numero">
                <EnlaceWhatsapp numero={titular.avisarA.whatsapp} vacio="Sin WhatsApp cargado" />
              </p>
              {titular.esMenor && <small style={{ color: "var(--n-fg3)" }}>Es menor: los avisos van a su tutor.</small>}
            </Tarjeta>
          )}

          <Tarjeta titulo="Avisos" testid="bloque-avisos">
            {avisos.length ? (
              avisos.map((a) => (
                <div key={a.clave} className="n-aviso-item">
                  <b>{a.titulo}</b>
                  <small>{a.sub}</small>
                </div>
              ))
            ) : (
              <div className="n-aviso-item">
                <b>Sin avisos pendientes</b>
                <small>Todo al día</small>
              </div>
            )}
          </Tarjeta>
        </aside>
      </div>
    </article>
    </ProveedorNuevaReserva>
    </ProveedorAvisos>
  );
}
