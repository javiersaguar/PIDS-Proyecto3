export type Cifra = { valor: string; nombre: string; detalle?: string };

export function Cifras({ cifras }: { cifras: Cifra[] }) {
  return (
    <div className="cifras">
      {cifras.map((c) => (
        <div className="cifra" key={c.nombre}>
          <div className="valor">{c.valor}</div>
          <div className="nombre">{c.nombre}</div>
          {c.detalle && <div className="detalle">{c.detalle}</div>}
        </div>
      ))}
    </div>
  );
}
