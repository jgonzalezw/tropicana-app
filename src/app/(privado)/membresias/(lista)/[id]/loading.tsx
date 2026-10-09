// El clic en una fila responde al instante: este esqueleto ocupa el lugar de la
// ficha hasta que llegan sus datos (la lista de la izquierda no se mueve).
export default function CargandoFicha() {
  return (
    <div role="status" aria-label="Cargando la membresía" data-testid="ficha-cargando">
      <div className="n-esq" style={{ height: 14, width: 180 }} />
      <div className="n-esq" style={{ height: 26, width: "55%", marginTop: 12 }} />
      <div className="n-esq" style={{ height: 14, width: "40%", marginTop: 10 }} />
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="n-esq" style={{ height: 64, flex: 1 }} />
        ))}
      </div>
      <div className="n-cols" style={{ marginTop: 20 }}>
        <div>
          <div className="n-esq" style={{ height: 32, width: 260 }} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="n-esq" style={{ height: 44, marginTop: 10 }} />
          ))}
        </div>
        <aside>
          <div className="n-esq" style={{ height: 150 }} />
          <div className="n-esq" style={{ height: 90, marginTop: 12 }} />
        </aside>
      </div>
    </div>
  );
}
