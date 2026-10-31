import { describe,expect,it } from "vitest";
import { compararDecisiones,decidir,riesgoDemora,type ModeloRiesgo } from "../src/lib/ml/riesgo";

// Curva de supervivencia hecha a mano: S(0)=1, S(15)=0,5, S(30)=0,2 (umbral 30 min).
const modelo:ModeloRiesgo={version:"prueba",umbral_min:30,paso_min:15,curvas:{Media:[1,.5,.2],Alta:[1,.1,0]}};
const base={prioridad:"Media",minutosAbierta:0,minutosSinMovimiento:0,tieneTecnico:true,categoriaConfirmada:true,confianza:.9};

describe("riesgo de demora",()=>{
 it("calcula P(T > umbral | T > t) con la curva de la prioridad",()=>{expect(riesgoDemora(modelo,"Media",0)).toBeCloseTo(.2);expect(riesgoDemora(modelo,"Media",20)).toBeCloseTo(.4);expect(riesgoDemora(modelo,"Alta",20)).toBe(0);expect(riesgoDemora(modelo,"Media",30)).toBe(1);});
 it("usa la curva Media si la prioridad no existe",()=>expect(riesgoDemora(modelo,"Otra",0)).toBeCloseTo(.2));
 it("sugiere asignar cuando no hay técnico",()=>expect(decidir(modelo,{...base,tieneTecnico:false}).accion).toBe("Asignar técnico"));
 it("sugiere escalar cuando supera el umbral",()=>expect(decidir(modelo,{...base,minutosAbierta:40}).accion).toBe("Escalar"));
 it("marca detenida y sugiere reactivar sin movimiento en 24 h",()=>{const d=decidir(modelo,{...base,minutosAbierta:2000,minutosSinMovimiento:1500});expect(d.detenida).toBe(true);expect(d.accion).toBe("Reactivar");});
 it("pide verificar y cerrar los casos con más de 3 días",()=>expect(decidir(modelo,{...base,minutosAbierta:5000,minutosSinMovimiento:5000}).accion).toBe("Verificar y cerrar"));
 it("pide confirmar categoría con confianza menor de 60 %",()=>expect(decidir(modelo,{...base,categoriaConfirmada:false,confianza:.4}).accion).toBe("Confirmar categoría"));
 it("prioriza atender primero cuando el riesgo es alto",()=>expect(decidir(modelo,{...base,minutosAbierta:20}).accion).toBe("Atender primero"));
 it("ordena escalar antes que seguimiento normal y deja al final los casos antiguos",()=>{const make=(m:number,s=0)=>({decision:decidir(modelo,{...base,minutosAbierta:m,minutosSinMovimiento:s}),minutosAbierta:m});const sorted=[make(5000,5000),make(0),make(40)].sort(compararDecisiones);expect(sorted.map(x=>x.decision.accion)).toEqual(["Escalar","Seguimiento normal","Verificar y cerrar"]);});
});
