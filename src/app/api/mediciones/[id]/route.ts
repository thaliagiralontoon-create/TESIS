import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { mediciones } from "@/db/schema";
import { AuthError,getCurrentUser } from "@/lib/auth";
export const runtime="nodejs";
// Sin borrados físicos: una tarea interrumpida se anula con su observación y se vuelve a medir.
const schema=z.object({observacion:z.string().trim().min(3).max(2000)});
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{const user=await getCurrentUser();if(user.rol!=="supervisor")return NextResponse.json({error:"Solo supervisión puede anular mediciones."},{status:403});const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Escribe el motivo de la anulación."},{status:400});const id=Number((await params).id);if(!Number.isInteger(id))return NextResponse.json({error:"Medición no válida."},{status:400});const db=await getDb();const [updated]=await db.update(mediciones).set({anulada:true,observacion:parsed.data.observacion}).where(eq(mediciones.id,id)).returning();if(!updated)return NextResponse.json({error:"Medición no encontrada."},{status:404});return NextResponse.json({registro:updated});}catch(e){if(e instanceof AuthError)return NextResponse.json({error:e.message},{status:e.status});console.error(e);return NextResponse.json({error:"No se pudo anular la medición."},{status:500});}}
