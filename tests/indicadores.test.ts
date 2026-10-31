import { describe,expect,it } from "vitest";
import { classificationMetrics,i1,i2,i3,i4,i5 } from "../src/lib/indicadores";

describe("indicadores de tesis",()=>{
 it("I1 promedia la duración de reportes en minutos",()=>expect(i1([60_000,120_000])).toBe(1.5));
 it("I2 calcula media y mediana y excluye casos abiertos",()=>{const result=i2([{registered:"2026-01-01T00:00:00Z",closed:"2026-01-01T01:00:00Z"},{registered:"2026-01-01T00:00:00Z",closed:"2026-01-01T02:00:00Z"},{registered:"2026-01-01T00:00:00Z",closed:null}]);expect(result).toEqual({promedio:90,mediana:90,n:2});});
 it("I3 cuenta consultas actualizadas con respuesta dentro de tres segundos",()=>expect(i3([{updated:true,responseMs:3000},{updated:true,responseMs:3001},{updated:false,responseMs:10}])).toBeCloseTo(100/3));
 it("I4 usa tolerancia relativa de un por ciento",()=>expect(i4([{system:101,recalculated:100},{system:102,recalculated:100}])).toBe(50));
 it("I5 excluye canceladas y exige ejecución antes del vencimiento",()=>expect(i5([{state:"Ejecutada",executed:"2026-01-01T09:00:00Z",due:"2026-01-01T10:00:00Z"},{state:"Ejecutada",executed:"2026-01-01T11:00:00Z",due:"2026-01-01T10:00:00Z"},{state:"Cancelada",due:"2026-01-01T10:00:00Z"}])).toBe(50));
 it("calcula exactitud, F1 macro y kappa desde sugerencia frente a confirmación",()=>{const result=classificationMetrics([{expected:"Audio",predicted:"Audio"},{expected:"Audio",predicted:"Hardware"},{expected:"Hardware",predicted:"Hardware"}]);expect(result.exactitud).toBeCloseTo(200/3);expect(result.f1Macro).toBeCloseTo(2/3);expect(result.n).toBe(3);});
});
