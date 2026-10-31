import { describe,expect,it } from "vitest";
import { chooseLeastLoaded,transitionAllowed } from "../src/lib/flujo-incidencias";

describe("flujo de incidencias",()=>{
 it("acepta solo las transiciones definidas por la guía",()=>{expect(transitionAllowed("Abierto","Asignado")).toBe(true);expect(transitionAllowed("Asignado","Resuelto")).toBe(true);expect(transitionAllowed("Resuelto","En proceso")).toBe(true);expect(transitionAllowed("Abierto","Cerrado")).toBe(false);expect(transitionAllowed("Cerrado","En proceso")).toBe(false);});
 it("elige al especialista con menos carga abierta",()=>{const spec=[{id:1},{id:2}],all=[...spec,{id:3}];expect(chooseLeastLoaded(spec,all,new Map([[1,2],[2,1],[3,0]]))?.id).toBe(2);});
 it("usa menor carga general si no hay especialista y desempata por id",()=>{expect(chooseLeastLoaded([],[{id:3},{id:2}],new Map([[3,0],[2,0]]))?.id).toBe(2);});
});
