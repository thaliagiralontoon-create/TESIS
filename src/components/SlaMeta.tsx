"use client";
import { useEffect, useState } from "react";

// Meta de atención de 8 h (una jornada), mostrada como en las herramientas de mesa de ayuda: reloj que avanza hacia la meta
// mientras la incidencia sigue abierta (naranja en la última hora, rojo si se venció) y ✓ / ✗ cuando ya se resolvió.
export const META_MIN = 480;
const COLOR = { verde: "#1E8E5A", naranja: "#E8692C", rojo: "#C62828" };
export const duracion = (min: number) => { const m = Math.round(Math.abs(min)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`; };

function useAhora(activo: boolean) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => { if (!activo) return; const id = setInterval(() => setAhora(Date.now()), 60_000); return () => clearInterval(id); }, [activo]);
  return ahora;
}

export function estadoMeta(registradaEn: string, fin: string | null, ahora: number) {
  const min = ((fin ? new Date(fin).getTime() : ahora) - new Date(registradaEn).getTime()) / 60_000;
  const restante = META_MIN - min;
  const color = fin ? (min <= META_MIN ? COLOR.verde : COLOR.rojo) : restante < 0 ? COLOR.rojo : restante <= 60 ? COLOR.naranja : COLOR.verde;
  const texto = fin
    ? min <= META_MIN ? `✓ Dentro de la meta · ${duracion(min)}` : `✗ Fuera de la meta por ${duracion(-restante)}`
    : restante < 0 ? `Vencida hace ${duracion(-restante)}` : `Quedan ${duracion(restante)}`;
  return { min, color, texto };
}

// Versión corta para la lista de incidencias.
export function MetaEtiqueta({ registradaEn, fin }: { registradaEn: string; fin: string | null }) {
  const { color, texto } = estadoMeta(registradaEn, fin, useAhora(!fin));
  return <span style={{ color, fontWeight: 600, whiteSpace: "nowrap" }}>{texto}</span>;
}

// Versión con barra para el detalle de la incidencia.
export default function MetaAtencion({ registradaEn, fin }: { registradaEn: string; fin: string | null }) {
  const { min, color, texto } = estadoMeta(registradaEn, fin, useAhora(!fin));
  const avance = Math.min(min / META_MIN, 1);
  return <div style={{ marginTop: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <span className="metric-label">Meta de atención: 8 h</span><strong style={{ color }}>{texto}</strong>
    </div>
    <div style={{ height: 10, borderRadius: 5, background: "#E6E9F0", overflow: "hidden" }} role="progressbar" aria-valuemin={0} aria-valuemax={META_MIN} aria-valuenow={Math.round(min)}>
      <div style={{ width: `${avance * 100}%`, height: "100%", background: color, transition: "width .4s" }} />
    </div>
    <div className="subtle" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}><span>Registro</span><span>{fin ? `${duracion(min)} de atención` : `${duracion(min)} transcurridas`}</span><span>8 h</span></div>
  </div>;
}
