import { NextResponse } from "next/server";
import { getCurrentUser, AuthError } from "@/lib/auth";
export async function GET() { try { const user = await getCurrentUser(); return NextResponse.json({ id: user.id, codigo: user.codigo, nombre: user.nombre, rol: user.rol }); } catch (error) { if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: "No autorizado." }, { status: 401 }); } }
