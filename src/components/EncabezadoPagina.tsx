export default function EncabezadoPagina({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{titulo}</h1>
        {descripcion && (
          <p className="text-[var(--texto-tenue)] mt-2 text-lg">{descripcion}</p>
        )}
      </div>
      {accion}
    </div>
  );
}
