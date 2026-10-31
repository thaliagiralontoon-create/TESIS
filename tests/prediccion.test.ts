import { describe,expect,it } from "vitest";
import { auc,mesSiguiente,nivelProbabilidad,probabilidadesReincidencia,pronosticar,serieMensual } from "../src/lib/ml/prediccion";

const d=(s:string)=>new Date(`${s}T12:00:00-05:00`);
describe("análisis predictivo",()=>{
 it("arma la serie mensual y cuenta solo los días transcurridos del mes en curso",()=>{const s=serieMensual([d("2026-01-05"),d("2026-01-20"),d("2026-03-02")],d("2026-03-10"));expect(s.map(p=>[p.mes,p.incidencias,p.dias])).toEqual([["2026-01",2,31],["2026-02",0,28],["2026-03",1,10]]);});
 it("pronostica con la tendencia lineal de la tasa diaria",()=>{const serie=[1,2,3,4].map((r,i)=>({mes:`2026-0${i+1}`,incidencias:r*30,dias:30,porDia:r}));const p=pronosticar(serie)!;expect(p.mes).toBe("2026-05");expect(p.estimado).toBe(155);expect(p.minimo).toBe(155);expect(p.tendencia).toBe("en aumento");});
 it("no pronostica con menos de 3 meses",()=>expect(pronosticar([{mes:"2026-01",incidencias:1,dias:31,porDia:1/31}])).toBeNull());
 it("pasa de diciembre a enero",()=>expect(mesSiguiente("2026-12")).toBe("2027-01"));
 it("suaviza la probabilidad de reincidencia hacia el promedio del grupo",()=>{const ref=d("2026-04-01");const ev=[...Array(6)].map(()=>({usuario:"A",fecha:d("2026-03-15")}));const p=probabilidadesReincidencia(ev,["A","B"],ref);const a=p.get("A")!,b=p.get("B")!;expect(a.recientes).toBe(6);expect(a.esperadas).toBeCloseTo((6+1)/4);expect(b.esperadas).toBeCloseTo(1/4);expect(a.probabilidad).toBeGreaterThan(b.probabilidad);});
 it("calcula el AUC por rangos",()=>{expect(auc([.9,.8,.2,.1],[true,true,false,false])).toBe(1);expect(auc([.5,.5],[true,false])).toBe(.5);});
 it("clasifica la proyección",()=>expect([.8,.5,.1].map(nivelProbabilidad)).toEqual(["Alta","Media","Baja"]));
});
