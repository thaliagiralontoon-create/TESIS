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

// Versión con barra para el detalle: el tramo hasta la meta en azul (o en el color del estado si sigue abierta)
// y el exceso sobre las 8 h en rojo rayado, con la marca de la meta.
export default function MetaAtencion({ registradaEn, fin }: { registradaEn: string; fin: string | null }) {
  const { min, color, texto } = estadoMeta(registradaEn, fin, useAhora(!fin));
  const escala = Math.max(min, META_MIN); const dentro = Math.min(min, META_MIN) / escala; const exceso = Math.max(min - META_MIN, 0) / escala; const marca = META_MIN / escala;
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Cumplimiento de la meta <span style={{ fontWeight: 400, color: "#6B7090" }}>· 8 h</span></div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{texto}</div>
    </div>
    <div style={{ display: "flex", height: 12, borderRadius: 6, background: "#EEF0F5", overflow: "hidden" }} role="progressbar" aria-valuemin={0} aria-valuemax={META_MIN} aria-valuenow={Math.round(min)}>
      <div style={{ width: `${dentro * 100}%`, background: fin || min > META_MIN ? "#1B2A8F" : color, transition: "width .4s" }} />
      {exceso > 0 && <div style={{ width: `${exceso * 100}%`, background: "repeating-linear-gradient(135deg,#D92D20 0 6px,#E8574C 6px 12px)" }} />}
    </div>
    <div style={{ position: "relative", height: 20, fontSize: 12, color: "#6B7090", marginTop: 6 }}>
      <span style={{ position: "absolute", left: 0 }}>0 h</span>
      {exceso > 0 && <span style={{ position: "absolute", left: `${marca * 100}%`, transform: "translateX(-50%)", color: "#1A1D2E", fontWeight: 600 }}>▲ meta 8 h</span>}
      <span style={{ position: "absolute", right: 0, color: min > META_MIN ? "#B42318" : "#1A1D2E", fontWeight: 600 }}>{exceso > 0 ? duracion(min) : fin ? duracion(min) : "8 h"}</span>
    </div>
  </div>;
}
