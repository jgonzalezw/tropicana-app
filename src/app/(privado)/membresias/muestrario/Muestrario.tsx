"use client";

import { useState } from "react";
import { useAviso } from "@/components/nuevo/Aviso";
import { Chip, FiltroChips } from "@/components/nuevo/Chip";
import ConfirmacionIrreversible from "@/components/nuevo/ConfirmacionIrreversible";
import HojaLateral from "@/components/nuevo/HojaLateral";
import { Indicadores } from "@/components/nuevo/Indicador";
import MenuAcciones from "@/components/nuevo/MenuAcciones";
import TarjetaConfirmacion from "@/components/nuevo/TarjetaConfirmacion";

const TIPOS = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "regulares", etiqueta: "Regulares" },
  { valor: "pruebas", etiqueta: "Pruebas" },
  { valor: "particulares", etiqueta: "Particulares" },
  { valor: "alquileres", etiqueta: "Alquileres" },
];

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 py-5 border-b" style={{ borderColor: "var(--n-linea)" }}>
      <h2 className="text-base font-semibold m-0">{titulo}</h2>
      {children}
    </section>
  );
}

export default function Muestrario() {
  const [hoja, setHoja] = useState<"formulario" | "guardado" | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [tipo, setTipo] = useState("todas");
  const [enviado, setEnviado] = useState(false);
  const [nombre, setNombre] = useState("");
  const { aviso, mostrar } = useAviso();

  function cerrarHoja() {
    setHoja(null);
    setEnviado(false);
    setNombre("");
  }

  return (
    <div>
      <h1 className="text-xl font-semibold m-0 mb-1">Muestrario</h1>
      <p style={{ color: "var(--n-fg2)" }} className="m-0">
        Componentes compartidos de las secciones nuevas. Solo para ver y probar.
      </p>

      <Seccion titulo="Hoja lateral y tarjeta de confirmación">
        <div>
          <button type="button" className="n-boton n-boton--primario" onClick={() => setHoja("formulario")}>
            Abrir hoja
          </button>
        </div>
      </Seccion>

      <Seccion titulo="Confirmación irreversible">
        <div>
          <button type="button" className="n-boton" onClick={() => setConfirmando(true)}>
            Dar de baja…
          </button>
        </div>
      </Seccion>

      <Seccion titulo="Menú de acciones">
        <div className="flex justify-end">
          <MenuAcciones
            items={[
              { label: "Modificar", sub: "Días, curso o profesor", onClick: () => mostrar("Modificar") },
              { label: "Renovar", onClick: () => mostrar("Renovar") },
              { label: "Dar de baja…", peligro: true, separador: true, onClick: () => setConfirmando(true) },
            ]}
          />
        </div>
      </Seccion>

      <Seccion titulo="Chips y filtros">
        <FiltroChips etiqueta="Tipo" opciones={TIPOS} valor={tipo} onCambio={setTipo} />
        <div className="flex flex-wrap gap-2">
          <Chip tono="exito">Activa</Chip>
          <Chip tono="ambar">Por vencer</Chip>
          <Chip tono="peligro">Con deuda</Chip>
          <Chip tono="neutro">Solicitud</Chip>
          <Chip tono="tenue">Histórica</Chip>
        </div>
      </Seccion>

      <Seccion titulo="Indicadores">
        <Indicadores
          celdas={[
            { etiqueta: "Clases", valor: "5 / 8", sub: "3 restantes", progreso: 62 },
            { etiqueta: "Saldo", valor: "Bs. 120", sub: "Vence el 15/10", tono: "peligro" },
            { etiqueta: "Fin de ciclo", valor: "30/10", tono: "acento" },
          ]}
        />
      </Seccion>

      <Seccion titulo="Aviso">
        <div className="flex gap-2">
          <button
            type="button"
            className="n-boton"
            onClick={() =>
              mostrar("Membresía guardada", [{ txt: "Deshacer", onClick: () => mostrar("Cambio deshecho") }])
            }
          >
            Mostrar aviso
          </button>
        </div>
      </Seccion>

      {hoja === "formulario" && (
        <HojaLateral
          contexto="Ana Pérez · Salsa"
          titulo="Hoja de ejemplo"
          onCerrar={cerrarHoja}
          sucia={nombre.trim() !== ""}
          pie={nombre.trim() === "" ? "Escribí un nombre para guardar." : undefined}
          primaria={{
            txt: "Guardar",
            bloqueada: nombre.trim() === "",
            onClick: () => setHoja("guardado"),
          }}
        >
          <label className="flex flex-col gap-1">
            <span style={{ color: "var(--n-fg2)" }}>Nombre</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="n-boton"
              style={{ height: 36, textAlign: "left" }}
            />
          </label>
        </HojaLateral>
      )}
      {hoja === "guardado" && (
        <HojaLateral
          contexto="Ana Pérez · Salsa"
          titulo="Hoja de ejemplo"
          onCerrar={cerrarHoja}
          verCancelar={false}
          pie={enviado ? undefined : "El aviso queda sin enviar si cerrás."}
          primaria={{ txt: "Listo", onClick: cerrarHoja }}
        >
          <TarjetaConfirmacion
            titulo="Guardado"
            sub="Cambio registrado en el historial"
            datos={[
              { clave: "Nombre", valor: nombre },
              { clave: "Monto", valor: "Bs. 120" },
            ]}
            aviso={{ nombre: "Ana Pérez", whatsapp: "+59171234567", mensaje: `Hola Ana, registramos tu cambio: ${nombre}.` }}
            enviado={enviado}
            onEnviado={() => setEnviado(true)}
          />
        </HojaLateral>
      )}
      {confirmando && (
        <ConfirmacionIrreversible
          titulo="¿Dar de baja esta membresía?"
          texto="Es un ejemplo: no se guarda nada."
          txtConfirmar="Dar de baja"
          onVolver={() => setConfirmando(false)}
          onConfirmar={() => {
            setConfirmando(false);
            mostrar("Baja de ejemplo confirmada");
          }}
        />
      )}
      {aviso}
    </div>
  );
}
