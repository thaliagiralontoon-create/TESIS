import { describe,expect,it } from "vitest";
import { cumpleDisponibilidad,cumplePrecision,mesLima,PROTOCOLO,resumen,valorReferencia } from "../src/lib/medicion";

describe("medición pretest y postest",()=>{
 it("el protocolo tiene 10 reportes, 20 consultas y 20 verificaciones",()=>{expect(PROTOCOLO.filter(t=>t.indicador==="I1")).toHaveLength(10);expect(PROTOCOLO.filter(t=>t.indicador==="I3")).toHaveLength(20);expect(PROTOCOLO.filter(t=>t.indicador==="I4")).toHaveLength(20);expect(PROTOCOLO.filter(t=>t.indicador==="ML")).toHaveLength(20);expect(new Set(PROTOCOLO.map(t=>t.codigo)).size).toBe(70);});
 it("I3 exige datos actualizados y 60 segundos o menos",()=>{expect(cumpleDisponibilidad(60_000,true)).toBe(true);expect(cumpleDisponibilidad(60_001,true)).toBe(false);expect(cumpleDisponibilidad(5_000,false)).toBe(false);});
 it("I4 usa 0,5 en conteos y 1 % en promedios",()=>{expect(cumplePrecision(150.5,150,true)).toBe(true);expect(cumplePrecision(151,150,true)).toBe(false);expect(cumplePrecision(101,100,false)).toBe(true);expect(cumplePrecision(101.1,100,false)).toBe(false);});
 it("agrupa por mes en hora de Lima",()=>{expect(mesLima(new Date("2026-04-01T03:00:00Z"))).toBe("2026-03");expect(mesLima(new Date("2026-04-01T05:00:00Z"))).toBe("2026-04");});
 it("calcula los valores de referencia con casos hechos a mano",()=>{const rows=[{registradaEn:new Date("2026-03-10T15:00:00Z"),cerradaEn:new Date("2026-03-10T16:00:00Z"),resueltaEn:null,prioridad:"Alta"},{registradaEn:new Date("2026-03-11T15:00:00Z"),cerradaEn:null,resueltaEn:new Date("2026-03-11T18:00:00Z"),prioridad:"Media"},{registradaEn:new Date("2026-03-12T15:00:00Z"),cerradaEn:null,resueltaEn:null,prioridad:"Alta"}];expect(valorReferencia({tipo:"conteo_mes",mes:"2026-03"},rows)).toBe(3);expect(valorReferencia({tipo:"media_mes",mes:"2026-03"},rows)).toBe(120);expect(valorReferencia({tipo:"conteo_prioridad",prioridad:"Alta"},rows)).toBe(2);});
 it("resume media, DE, mediana y cuartiles",()=>{const s=resumen([1,2,3,4]);expect(s.media).toBe(2.5);expect(s.mediana).toBe(2.5);expect(s.q1).toBe(1.75);expect(s.q3).toBe(3.25);expect(s.de).toBeCloseTo(1.2910,4);});
});
