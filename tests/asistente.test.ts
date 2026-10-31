import { describe,expect,it } from "vitest";
import { accionPreparacion,recomendarProcedimiento,tokens,type BaseConocimiento,type Procedimiento } from "../src/lib/ml/asistente";
import { entrenar,evaluar,particionTemporal } from "../src/lib/ml/entrenamiento";
import { sugerir } from "../src/lib/ml/clasificador";
import base from "../src/lib/ml/base_conocimiento.json";

const BASE=base as unknown as BaseConocimiento;
const proc=(o:Partial<Procedimiento>):Procedimiento=>({id:"x",categoria:"Hardware",titulo:"x",remoto:false,repuesto:null,pasos:[],texto:"",casos:0,cerradas:0,medianaMin:null,p75Min:null,pctMas8h:null,...o});

describe("asistente ML",()=>{
 it("recorta palabras para tolerar variantes",()=>expect(tokens("Teclado teclas imprime imprimir")).toEqual(["tecla","tecla","impri","impri"]));
 it("relaciona frases nuevas con el procedimiento correcto",()=>{
  const casos:Array<[string,string]>=[["El teclado no responde, algunas teclas no escriben","hw-teclado"],["Mi mouse se desconecta a cada rato","hw-mouse"],["Necesito cambiar el tóner de la impresora","imp-toner"],["No puedo entrar a la VPN desde casa","con-vpn"],["El cargador de mi laptop no carga","hw-cargador"]];
  for(const [texto,id] of casos)expect(recomendarProcedimiento(BASE,texto,null).procedimiento?.id,texto).toBe(id);
 });
 it("no inventa un procedimiento si el texto no se parece a nada",()=>expect(recomendarProcedimiento(BASE,"xyz qwerty",null).procedimiento).toBeNull());
 it("cubre todas las incidencias históricas con tiempos reales",()=>expect(BASE.procedimientos.reduce((s,p)=>s+p.casos,0)).toBe(1232));
 it("sugiere llevar el repuesto o atender en remoto",()=>{expect(accionPreparacion(proc({repuesto:"Teclado USB"}))).toContain("Teclado USB");expect(accionPreparacion(proc({remoto:true}))).toContain("remoto");expect(accionPreparacion(null)).toBeNull();});
});

describe("entrenamiento en el sistema",()=>{
 const d=(s:string)=>new Date(`${s}T12:00:00-05:00`);
 const filas=[...Array(30)].flatMap((_,i)=>[{texto:`la impresora no imprime ${i%3}`,categoria:"Impresora",fecha:d(i<20?"2026-03-10":"2026-08-10")},{texto:`el teclado falla ${i%3}`,categoria:"Hardware",fecha:d(i<20?"2026-03-11":"2026-08-11")},{texto:`no hay internet en la red ${i%3}`,categoria:"Conectividad",fecha:d(i<20?"2026-03-12":"2026-08-12")}]);
 it("separa por fecha de corte",()=>{const p=particionTemporal(filas,d("2026-07-01"));expect(p.entrenamiento).toHaveLength(60);expect(p.prueba).toHaveLength(30);});
 it("aprende y clasifica textos nuevos",()=>{const m=entrenar(filas.slice(0,60),10,150);expect(sugerir(m,"","la impresora no imprime nada")[0].categoria).toBe("Impresora");const e=evaluar(m,filas.slice(60));expect(e.exactitud).toBe(1);expect(e.kappa).toBe(1);expect(e.matriz.flat().reduce((a,b)=>a+b,0)).toBe(30);});
});
