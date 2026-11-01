"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AssistantPanel, { type Analysis } from "./AssistantPanel";
import MetaAtencion, { META_MIN, duracion } from "./SlaMeta";
type DetailData={id:number;codigo:string;titulo:string;descripcion:string;prioridad:string;estado:string;origen:string;registradaEn:string;resueltaEn:string|null;cerradaEn:string|null;solucion:string|null;requirioExterno:boolean|null;tecnicoId:number|null;categoriaSugeridaId:number|null;categoriaConfirmadaId:number|null;confianzaSugerencia:string|null;modeloVersion:string|null;eventos:Array<{evento:string;detalle:string|null;ocurridoEn:string;actor:string|null}>;categorias:Array<{id:number;nombre:string}>;tecnicos:Array<{id:number;codigo:string;nombre:string;especialidadId:number|null}>;tecnico:{codigo:string;nombre:string}|null;reportante:{codigo:string;nombre:string}|null;area:string|null;asignacion:{sugeridoId:number|null;cargas:Array<{id:number;codigo:string;nombre:string;casos:number}>}|null};

const CARD={background:"#fff",border:"1px solid #E4E6EE",borderRadius:12} as const;
const MUTED="#6B7090";
const LABEL={fontSize:12,color:MUTED,marginBottom:4} as const;
const VALUE={fontSize:15,fontWeight:500} as const;
const H2={margin:0,fontSize:16,fontWeight:600} as const;
const ESTADO:Record<string,[string,string]>={"Abierto":["#ECEEFB","#1B2A8F"],"Asignado":["#ECEEFB","#1B2A8F"],"En proceso":["#FFF4D6","#8A5A00"],"Resuelto":["#DCFAE6","#067647"],"Cerrado":["#E4E6EE","#344054"]};
const PRIORIDAD:Record<string,[string,string]>={"Crítica":["#FDE8E8","#B42318"],"Alta":["#FFE6D5","#B93815"],"Media":["#FFF4D6","#8A5A00"],"Baja":["#ECEEFB","#1B2A8F"]};
const EVENTO:Record<string,string>={"Registrada":"#1B2A8F","Resuelto":"#12A150","Cerrado":"#12A150","Categoría confirmada":"#F5C400","Reasignada":"#98A2B3","En proceso":"#E8692C"};
const pill=(bg:string,fg:string)=>({display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:999,background:bg,color:fg}) as const;
const iniciales=(codigo:string)=>codigo.replace(/[^A-Z0-9]/gi,"").replace(/^([A-Z]).*?(\d+)$/i,(_,a,n)=>`${a}${Number(n)}`).slice(0,3).toUpperCase();
function hace(fecha:string){const d=(Date.now()-new Date(fecha).getTime())/86_400_000;return d<1?"hoy":d<2?"ayer":d<31?`hace ${Math.floor(d)} días`:d<365?`hace ${Math.floor(d/30)} meses`:`hace ${Math.floor(d/365)} años`;}

export default function IncidentDetail({id}:{id:string}) {
 const [row,setRow]=useState<DetailData|null>(null);const [role,setRole]=useState("");const [userId,setUserId]=useState(0);const [category,setCategory]=useState("");const [tech,setTech]=useState("");const [solution,setSolution]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(true);const [saving,setSaving]=useState(false);
 const [analysis,setAnalysis]=useState<Analysis|null>(null);const [cause,setCause]=useState("");const [part,setPart]=useState("");const [useful,setUseful]=useState("");const [external,setExternal]=useState("");
 useEffect(()=>{void fetch(`/api/incidencias/${id}/asistente`,{cache:"no-store"}).then(r=>r.ok?r.json():null).then((d:Analysis|null)=>{if(!d)return;setAnalysis(d);setPart(p=>p||(d.procedimiento?.repuesto??""));}).catch(()=>{});},[id]);
 const load=useCallback(async()=>{setBusy(true);try{const [r,m]=await Promise.all([fetch(`/api/incidencias/${id}`,{cache:"no-store"}),fetch("/api/me")]);const data=await r.json();const me=await m.json();if(!r.ok)throw new Error(data.error);setRow(data);setRole(me.rol);setUserId(me.id);setCategory(String(data.categoriaConfirmadaId??data.categoriaSugeridaId??""));setTech(String(data.tecnicoId??""));setSolution(data.solucion??"");}catch(e){setError(e instanceof Error?e.message:"No se pudo abrir el caso.");}finally{setBusy(false);}},[id]);
 useEffect(()=>{void load();},[load]);
 async function update(body:Record<string,unknown>){setSaving(true);setError("");try{const r=await fetch(`/api/incidencias/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error);await load();}catch(e){setError(e instanceof Error?e.message:"No se guardaron los cambios.");}finally{setSaving(false);}}
 if(busy)return <div className="panel empty">Cargando detalle…</div>;if(!row)return <section className="panel"><div className="alert">{error||"No se encontró el registro."}</div><Link href="/incidencias" className="btn ghost" style={{marginTop:12}}>Volver</Link></section>;
 const canWork=role==="supervisor"||(role==="tecnico"&&row.tecnicoId===userId);const confirmedAllowed=canWork;const statusChoices=row.estado==="Abierto"&&canWork?["En proceso"]:row.estado==="Asignado"&&canWork?["En proceso","Resuelto"]:row.estado==="En proceso"&&canWork?["Resuelto"]:row.estado==="Resuelto"?role==="supervisor"?["Cerrado","En proceso"]:role==="tecnico"&&row.tecnicoId===userId?["En proceso"]:[]:[];
 const fecha=(d:string)=>new Date(d).toLocaleString("es-PE",{dateStyle:"short",timeStyle:"short"});const nombreCategoria=(id:number|null)=>row.categorias.find(c=>c.id===id)?.nombre;const fin=row.cerradaEn??row.resueltaEn;
 const canAssign=role==="supervisor"&&!["Resuelto","Cerrado"].includes(row.estado);const canCategorize=confirmedAllowed&&row.estado!=="Cerrado";
 const hasActions=canCategorize||statusChoices.length>0||(row.estado==="Resuelto"&&role==="colaborador")||row.estado==="Cerrado";
 const minutos=Math.round(((fin?new Date(fin).getTime():Date.now())-new Date(row.registradaEn).getTime())/60_000);const fueraDeMeta=minutos>META_MIN;
 const [eBg,eFg]=ESTADO[row.estado]??ESTADO.Abierto;const [pBg,pFg]=PRIORIDAD[row.prioridad]??PRIORIDAD.Media;
 return <>
 <div style={{display:"flex",gap:24,alignItems:"flex-start",flexWrap:"wrap",marginBottom:22}}>
  <div style={{flex:1,minWidth:280}}>
   <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
    <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",fontSize:13,fontWeight:600,color:"#1B2A8F",background:"#ECEEFB",padding:"3px 8px",borderRadius:5}}>{row.codigo}</span>
    <span style={pill(eBg,eFg)}><span style={{width:6,height:6,borderRadius:"50%",background:eFg}}/>{row.estado}</span>
    <span style={pill(pBg,pFg)}>Prioridad {row.prioridad.toLowerCase()}</span>
    {fueraDeMeta&&<span style={pill("#FDE8E8","#B42318")}>{fin?"Meta de 8 h incumplida":"Meta de 8 h vencida"}</span>}
   </div>
   <h1 style={{margin:0,fontSize:26,lineHeight:1.25,fontWeight:600}}>{row.titulo}</h1>
   {(row.reportante||row.area)&&<div style={{marginTop:8,fontSize:14,color:MUTED}}>Reportada{row.reportante&&<> por <b style={{color:"#1A1D2E",fontWeight:500}}>{row.reportante.codigo}</b></>}{row.area&&` · ${row.area}`} · {hace(row.registradaEn)}</div>}
  </div>
  <Link href="/incidencias" className="btn ghost">← Incidencias</Link>
 </div>
 {error&&<div className="alert" role="alert" style={{marginBottom:14}}>{error}</div>}

 <section style={{...CARD,padding:"20px 22px",marginBottom:20}}>
  {row.descripcion.trim()!==row.titulo.trim()&&<p style={{whiteSpace:"pre-wrap",margin:"0 0 16px",fontSize:15}}>{row.descripcion}</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"18px 24px"}}>
   <div><div style={LABEL}>Técnico</div><div style={{...VALUE,display:"flex",alignItems:"center",gap:8}}>{row.tecnico?<><span style={{width:24,height:24,borderRadius:"50%",background:"#ECEEFB",color:"#1B2A8F",fontSize:10,fontWeight:700,display:"grid",placeItems:"center"}}>{iniciales(row.tecnico.codigo)}</span>{row.tecnico.codigo}</>:"Sin asignar"}</div></div>
   <div><div style={LABEL}>Categoría</div><div style={VALUE}>{nombreCategoria(row.categoriaConfirmadaId)??"Sin confirmar"}</div></div>
   <div><div style={LABEL}>Registrada</div><div style={VALUE}>{fecha(row.registradaEn)}</div></div>
   <div><div style={LABEL}>{row.cerradaEn?"Cerrada":"Resuelta"}</div><div style={VALUE}>{fin?fecha(fin):"Pendiente"}</div></div>
   <div><div style={LABEL}>Tiempo de atención</div><div style={{...VALUE,fontWeight:600,color:fueraDeMeta?"#B42318":"#1A1D2E"}}>{fin?`${minutos.toLocaleString("es-PE")} min (${duracion(minutos)})`:"En curso"}</div></div>
   {row.requirioExterno!==null&&<div><div style={LABEL}>Técnico externo</div><div style={VALUE}>{row.requirioExterno?"Sí":"No"}</div></div>}
  </div>
  <div style={{borderTop:"1px solid #EEF0F5",marginTop:18,paddingTop:16}}><MetaAtencion registradaEn={row.registradaEn} fin={fin}/></div>
  {row.solucion&&<div style={{marginTop:14,fontSize:14,background:"#F4F5F8",borderRadius:8,padding:"10px 14px"}}><b>Solución:</b> {row.solucion}</div>}
 </section>

 <div className="detail-layout">
  <div style={{display:"flex",flexDirection:"column",gap:20,minWidth:0}}>
   {analysis&&<AssistantPanel data={analysis} categoriaActual={nombreCategoria(row.categoriaConfirmadaId)}/>}
   <section style={{...CARD,padding:"18px 22px"}}>
    <h2 style={{...H2,marginBottom:16}}>Historial</h2>
    {row.eventos.map((event,index)=><div key={`${event.evento}-${index}`} style={{display:"grid",gridTemplateColumns:"14px 1fr auto",gap:12,paddingBottom:16}}>
     <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}><span style={{width:10,height:10,borderRadius:"50%",background:EVENTO[event.evento]??"#98A2B3",marginTop:5}}/>{index<row.eventos.length-1&&<span style={{flex:1,width:1,background:"#E4E6EE",marginTop:4}}/>}</div>
     <div style={{fontSize:14,lineHeight:1.45}}><b style={{fontWeight:600}}>{event.evento}</b>{event.actor&&<span style={{color:MUTED}}> · {event.actor}</span>}{event.detalle&&!event.detalle.startsWith("Importada")&&<div>{event.detalle}</div>}</div>
     <div style={{fontSize:12,color:MUTED,fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",whiteSpace:"nowrap"}}>{fecha(event.ocurridoEn)}</div>
    </div>)}
   </section>
  </div>

  <aside style={{display:"flex",flexDirection:"column",gap:20}}>
   {row.asignacion&&<section style={{...CARD,padding:"18px 20px"}}>
    <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:12}}><h2 style={H2}>Asignación</h2><span style={{fontSize:12,color:MUTED}}>Carga actual</span></div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>{row.asignacion.cargas.map(t=>{const sel=canAssign&&tech===String(t.id);return <button key={t.id} type="button" disabled={!canAssign} onClick={()=>setTech(String(t.id))} style={{font:"inherit",display:"grid",gridTemplateColumns:"32px 1fr auto",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:9,textAlign:"left",cursor:canAssign?"pointer":"default",background:sel?"#F6F7FD":"#fff",border:sel?"1.5px solid #1B2A8F":"1px solid #E4E6EE",color:"#1A1D2E"}}>
     <span style={{width:32,height:32,borderRadius:"50%",background:"#ECEEFB",color:"#1B2A8F",fontSize:11,fontWeight:700,display:"grid",placeItems:"center"}}>{iniciales(t.codigo)}</span>
     <span style={{display:"flex",flexDirection:"column",gap:2}}><span style={{fontSize:15,fontWeight:600,display:"flex",gap:6,alignItems:"center"}}>{t.codigo}{t.id===row.asignacion!.sugeridoId&&<span style={{fontSize:10,fontWeight:700,letterSpacing:".04em",padding:"2px 6px",borderRadius:4,background:"#F5C400",color:"#3D2E00"}}>SUGERIDO</span>}</span><span style={{fontSize:12,color:MUTED}}>{t.casos} en curso</span></span>
     {canAssign&&<span style={{width:16,height:16,borderRadius:"50%",border:sel?"5px solid #1B2A8F":"1.5px solid #C3C7D6"}}/>}
    </button>;})}</div>
    {canAssign&&<button className="btn" style={{marginTop:12,width:"100%"}} disabled={!tech||tech===String(row.tecnicoId??"")||saving} onClick={()=>void update({tecnicoId:Number(tech)})}>Asignar técnico</button>}
   </section>}

   {hasActions&&<section style={{...CARD,padding:"18px 20px",display:"flex",flexDirection:"column",gap:18}}>
    <h2 style={H2}>Gestión</h2>
    {canCategorize&&<div><div style={{...LABEL,fontWeight:600}}>Confirmar categoría</div><select className="select full" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Selecciona una categoría</option>{row.categorias.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select><button className="btn ghost" style={{marginTop:8,width:"100%"}} disabled={!category||saving} onClick={()=>void update({categoriaConfirmadaId:Number(category)})}>{row.categoriaConfirmadaId?"Guardar categoría":"Confirmar categoría"}</button>{Number(row.confianzaSugerencia??1)<.6&&<div className="help" style={{marginTop:9}}>La confianza fue menor al 60 %. Revisa la descripción antes de confirmar.</div>}</div>}
    {statusChoices.length>0&&<div style={{display:"flex",flexDirection:"column",gap:8}}><div style={{...LABEL,fontWeight:600,marginBottom:0}}>Cambiar estado</div>{statusChoices.map(next=><div key={next}>{next==="Resuelto"&&<div className="stack" style={{gap:8,marginBottom:8}}><textarea className="textarea" style={{minHeight:80}} value={solution} onChange={e=>setSolution(e.target.value)} placeholder="Describe la solución aplicada"/><input id="causa" className="field full" value={cause} onChange={e=>setCause(e.target.value)} placeholder="Causa encontrada (ej. teclado dañado por derrame)" aria-label="Causa encontrada"/><input id="repuesto" className="field full" value={part} onChange={e=>setPart(e.target.value)} placeholder="Repuesto usado (deja vacío si no se usó)" aria-label="Repuesto usado"/><label className="subtle" style={{fontSize:13}}>¿Se requirió un técnico externo? <select id="externo" className="select" value={external} onChange={e=>setExternal(e.target.value)}><option value="">Selecciona</option><option value="si">Sí</option><option value="no">No</option></select></label>{analysis?.procedimiento&&<label className="subtle" style={{fontSize:13}}>¿Te sirvió el procedimiento sugerido «{analysis.procedimiento.titulo}»? <select id="util" className="select" value={useful} onChange={e=>setUseful(e.target.value)}><option value="">Sin responder</option><option value="si">Sí</option><option value="no">No</option></select></label>}</div>}<button className={`btn ${next==="Resuelto"?"gold":"ghost"}`} style={{width:"100%"}} disabled={saving||next==="Resuelto"&&(!row.categoriaConfirmadaId||!external)} onClick={()=>void update({estado:next,...(next==="Resuelto"?{solucion:solution,causa:cause||undefined,repuestoUsado:part||undefined,requirioExterno:external==="si",...(useful?{procedimientoUtil:useful==="si"}:{})}: {})})}>{saving?"Guardando…":next==="En proceso"?"Iniciar atención":next==="Resuelto"?"Marcar como resuelta":next==="Cerrado"?"Cerrar incidencia":"Cambiar a "+next}</button></div>)}</div>}
    {row.estado==="Resuelto"&&role==="colaborador"&&<button className="btn gold" disabled={saving} onClick={()=>void update({estado:"Cerrado"})}>Confirmar y cerrar</button>}
    {row.estado==="Cerrado"&&<div className="success">Caso cerrado el {row.cerradaEn?fecha(row.cerradaEn):""}</div>}
   </section>}
  </aside>
 </div>
 </>;
}
