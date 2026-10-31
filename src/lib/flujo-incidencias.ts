export const TRANSICIONES:Record<string,string[]>={Abierto:["Asignado","En proceso"],Asignado:["En proceso","Resuelto"],"En proceso":["Resuelto"],Resuelto:["Cerrado","En proceso"],Cerrado:[]};
export function transitionAllowed(current:string,next:string){return TRANSICIONES[current]?.includes(next)??false;}
export function chooseLeastLoaded<T extends {id:number}>(specialists:T[],allActive:T[],loads:Map<number,number>):T|undefined{
 const candidates=specialists.length?specialists:allActive;
 return [...candidates].sort((a,b)=>(loads.get(a.id)??0)-(loads.get(b.id)??0)||a.id-b.id)[0];
}
