import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { actividades } from "@/db/schema";
import { AuthError,getCurrentUser } from "@/lib/auth";
export async function PATCH(_request:Request,{params}:{params:Promise<{id:string}>}){try{const user=await getCurrentUser();const {id}=await params;const db=await getDb();const [row]=await db.select().from(actividades).where(eq(actividades.id,Number(id))).limit(1);if(!row)return NextResponse.json({error:"Actividad no encontrada."},{status:404});if(user.rol==="colaborador"||(user.rol==="tecnico"&&row.tecnicoId!==user.id))return NextResponse.json({error:"Sin permiso."},{status:403});if(row.estado!=="Programada")return NextResponse.json({error:"Solo se pueden marcar actividades programadas."},{status:400});const now=new Date();const [updated]=await db.update(actividades).set({estado:"Ejecutada",ejecutadaEn:now}).where(eq(actividades.id,row.id)).returning();return NextResponse.json(updated);}catch(e){if(e instanceof AuthError)return NextResponse.json({error:e.message},{status:e.status});return NextResponse.json({error:"No se pudo actualizar la actividad."},{status:500});}}
