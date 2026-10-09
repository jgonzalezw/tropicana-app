// El clic en una fila responde al instante: este esqueleto ocupa el lugar de la
// ficha hasta que llegan sus datos (la lista de la izquierda no se mueve).
export default function CargandoFicha() {
  return (
    <div role="status" aria-label="Cargando la membresía" data-testid="ficha-cargando">
      <div className="n-esq" style={{ height: "1rem", width: "12.8571rem" }} />
      <div className="n-esq" style={{ height: "1.8571rem", width: "55%", marginTop: "0.8571rem" }} />
      <div className="n-esq" style={{ height: "1rem", width: "40%", marginTop: "0.7143rem" }} />
      <div style={{ display: "flex", gap: "0.8571rem", marginTop: "1.4286rem" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="n-esq" style={{ height: "4.5714rem", flex: 1 }} />
        ))}
      </div>
      <div className="n-cols" style={{ marginTop: "1.4286rem" }}>
        <div>
          <div className="n-esq" style={{ height: "2.2857rem", width: "18.5714rem" }} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="n-esq" style={{ height: "3.1429rem", marginTop: "0.7143rem" }} />
          ))}
        </div>
        <aside>
          <div className="n-esq" style={{ height: "10.7143rem" }} />
          <div className="n-esq" style={{ height: "6.4286rem", marginTop: "0.8571rem" }} />
        </aside>
      </div>
    </div>
  );
}
