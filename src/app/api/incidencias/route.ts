import { NextResponse } from "next/server";
import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { categorias, incidenciaEventos, incidencias, usuarios } from "@/db/schema";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { sugerir } from "@/lib/ml/clasificador";
import { BASE_CONOCIMIENTO, getModeloActivo } from "@/lib/ml/modelos";
import { recomendarProcedimiento } from "@/lib/ml/asistente";
import { chooseLeastLoaded } from "@/lib/flujo-incidencias";

export const runtime = "nodejs";
const createSchema = z.object({ titulo: z.string().trim().min(4).max(160), descripcion: z.string().trim().min(8).max(5000), prioridad: z.enum(["Baja", "Media", "Alta", "Crítica"]).default("Media"), areaId: z.coerce.number().int().positive().optional() });
const limaNow = () => new Date();
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(); const db = await getDb(); const { searchParams } = new URL(request.url);
    const status = searchParams.get("estado"); const origin = searchParams.get("origen"); const query = searchParams.get("q");
    const filters = [status ? eq(incidencias.estado, status) : undefined, origin ? eq(incidencias.origen, origin) : undefined, query ? or(ilike(incidencias.codigo, `%${query}%`), ilike(incidencias.titulo, `%${query}%`), ilike(incidencias.descripcion, `%${query}%`)) : undefined];
    if (user.rol === "colaborador") filters.push(eq(incidencias.usuarioId, user.id));
    if (user.rol === "tecnico") filters.push(eq(incidencias.tecnicoId, user.id));
    const requestedLimit = Number(searchParams.get("limit") || 50);
    const requestedOffset = Number(searchParams.get("offset") || 0);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.trunc(requestedLimit))) : 50;
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.trunc(requestedOffset)) : 0;
    const [totalRows,rows] = await Promise.all([
      db.select({ total: count() }).from(incidencias).where(and(...filters)),
      db.select({ incident: incidencias, category: categorias.nombre, technician: usuarios.nombre }).from(incidencias).leftJoin(categorias, eq(categorias.id, incidencias.categoriaConfirmadaId)).leftJoin(usuarios, eq(usuarios.id, incidencias.tecnicoId)).where(and(...filters)).orderBy(desc(incidencias.registradaEn)).limit(limit).offset(offset),
    ]);
    return NextResponse.json({ rows: rows.map(({ incident, category, technician }) => ({ ...incident, categoriaConfirmada: category, tecnico: technician })), total: totalRows[0]?.total ?? 0, limit, offset });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "No se pudieron cargar las incidencias." }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(); const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Completa el título y describe el problema." }, { status: 400 });
    const db = await getDb();
    const categoryRows = await db.select().from(categorias);
    const model = await getModeloActivo(db);
    const suggestions = sugerir(model, parsed.data.titulo, parsed.data.descripcion, 3);
    const primary = suggestions[0];
    const { procedimiento } = recomendarProcedimiento(BASE_CONOCIMIENTO, `${parsed.data.titulo} ${parsed.data.descripcion}`, primary?.categoria ?? null);
    const category = primary ? categoryRows.find((row) => row.nombre === primary.categoria) : undefined;
    const allTechs = await db.select().from(usuarios).where(and(eq(usuarios.rol, "tecnico"), eq(usuarios.activo, true)));
    const techs = category ? allTechs.filter((tech) => tech.especialidadId === category.id) : [];
    const assigned = allTechs.length ? await db.select({ techId: incidencias.tecnicoId }).from(incidencias).where(and(inArray(incidencias.estado, ["Asignado", "En proceso"]), inArray(incidencias.tecnicoId, allTechs.map((tech) => tech.id)))) : [];
    const loads = new Map<number, number>(); for (const row of assigned) if (row.techId) loads.set(row.techId, (loads.get(row.techId) || 0) + 1);
    const technician = chooseLeastLoaded(techs, allTechs, loads);
    const now = limaNow();
    const all = await db.select({ id: incidencias.id }).from(incidencias).orderBy(desc(incidencias.id)).limit(1);
    const code = `INC-${String((all[0]?.id ?? 0) + 1).padStart(6, "0")}`;
    const [created] = await db.insert(incidencias).values({ codigo: code, titulo: parsed.data.titulo, descripcion: parsed.data.descripcion, usuarioId: user.id, areaId: parsed.data.areaId ?? user.areaId, prioridad: parsed.data.prioridad, estado: technician ? "Asignado" : "Abierto", categoriaSugeridaId: category?.id, confianzaSugerencia: primary?.probabilidad.toFixed(4), modeloVersion: model.version, procedimientoId: procedimiento?.id, tecnicoId: technician?.id, registradaEn: now, asignadaEn: technician ? now : null }).returning();
    await db.insert(incidenciaEventos).values([
      { incidenciaId: created.id, usuarioId: user.id, evento: "Registrada", detalle: "Incidencia registrada", ocurridoEn: now },
      ...(primary ? [{ incidenciaId: created.id, usuarioId: user.id, evento: "Categoría sugerida (ML)", detalle: `${primary.categoria} (${(primary.probabilidad * 100).toFixed(1)} % confianza)`, ocurridoEn: now }] : []),
      ...(procedimiento ? [{ incidenciaId: created.id, usuarioId: user.id, evento: "Procedimiento sugerido (ML)", detalle: procedimiento.repuesto ? `${procedimiento.titulo} · llevar ${procedimiento.repuesto}` : procedimiento.titulo, ocurridoEn: now }] : []),
      ...(technician ? [{ incidenciaId: created.id, usuarioId: user.id, evento: "Asignada", detalle: `Asignada a ${technician.codigo}`, ocurridoEn: now }] : []),
    ]);
    return NextResponse.json({ ...created, sugerencias: suggestions }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("No se pudo registrar la incidencia", error);
    return NextResponse.json({ error: "No se pudo registrar. Verifica que existan categorías y técnicos activos en la base." }, { status: 500 });
  }
}
