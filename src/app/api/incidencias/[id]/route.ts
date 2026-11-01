import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { areas, categorias, incidenciaEventos, incidencias, usuarios } from "@/db/schema";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { chooseLeastLoaded, transitionAllowed } from "@/lib/flujo-incidencias";

export const runtime = "nodejs";
const patchSchema = z.object({ estado: z.enum(["En proceso", "Resuelto", "Cerrado"] ).optional(), categoriaConfirmadaId: z.coerce.number().int().positive().optional(), solucion: z.string().max(5000).optional(), causa: z.string().trim().max(160).optional(), repuestoUsado: z.string().trim().max(120).optional(), procedimientoUtil: z.boolean().optional(), requirioExterno: z.boolean().optional(), tecnicoId: z.coerce.number().int().positive().optional() });
const limaNow = () => new Date();
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(); const { id } = await params; const db = await getDb();
    const [row] = await db.select().from(incidencias).where(eq(incidencias.id, Number(id))).limit(1);
    if (!row) return NextResponse.json({ error: "Incidencia no encontrada." }, { status: 404 });
    if (user.rol === "colaborador" && row.usuarioId !== user.id) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    if (user.rol === "tecnico" && row.tecnicoId !== user.id) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const events = await db.select({ event: incidenciaEventos, actor: usuarios.nombre }).from(incidenciaEventos).leftJoin(usuarios, eq(usuarios.id, incidenciaEventos.usuarioId)).where(eq(incidenciaEventos.incidenciaId, row.id)).orderBy(incidenciaEventos.ocurridoEn, incidenciaEventos.id);
    const categories = await db.select().from(categorias);
    const staff = user.rol === "supervisor" ? await db.select().from(usuarios).where(and(eq(usuarios.rol, "tecnico"), eq(usuarios.activo, true))) : [];
    const [tecnico] = row.tecnicoId ? await db.select({ codigo: usuarios.codigo, nombre: usuarios.nombre }).from(usuarios).where(eq(usuarios.id, row.tecnicoId)).limit(1) : [];
    const [reportante] = row.usuarioId ? await db.select({ codigo: usuarios.codigo, nombre: usuarios.nombre }).from(usuarios).where(eq(usuarios.id, row.usuarioId)).limit(1) : [];
    const [area] = row.areaId ? await db.select({ nombre: areas.nombre }).from(areas).where(eq(areas.id, row.areaId)).limit(1) : [];
    // Asignación sugerida: carga de trabajo (casos asignados o en proceso) de cada técnico activo y el de menor carga,
    // con preferencia por los especialistas de la categoría, como en la priorización.
    let asignacion = null;
    if (staff.length) {
      const assigned = await db.select({ techId: incidencias.tecnicoId }).from(incidencias).where(and(inArray(incidencias.estado, ["Asignado", "En proceso"]), inArray(incidencias.tecnicoId, staff.map((t) => t.id))));
      const loads = new Map<number, number>(); for (const a of assigned) if (a.techId) loads.set(a.techId, (loads.get(a.techId) || 0) + 1);
      const categoriaId = row.categoriaConfirmadaId ?? row.categoriaSugeridaId;
      const sugerido = chooseLeastLoaded(staff.filter((t) => t.especialidadId === categoriaId), staff, loads);
      asignacion = { sugeridoId: sugerido?.id ?? null, cargas: staff.map((t) => ({ id: t.id, codigo: t.codigo, nombre: t.nombre, casos: loads.get(t.id) ?? 0 })).sort((a, b) => a.casos - b.casos || a.id - b.id) };
    }
    return NextResponse.json({ ...row, eventos: events.map(({ event, actor }) => ({ ...event, actor })), categorias: categories, tecnicos: staff, tecnico: tecnico ?? null, reportante: reportante ?? null, area: area?.nombre ?? null, asignacion });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "No se pudo cargar el detalle." }, { status: 500 });
  }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(); const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
    const db = await getDb(); const [row] = await db.select().from(incidencias).where(eq(incidencias.id, Number(id))).limit(1);
    if (!row) return NextResponse.json({ error: "Incidencia no encontrada." }, { status: 404 });
    const input = parsed.data; const now = limaNow();
    if (input.tecnicoId !== undefined) {
      if (user.rol !== "supervisor" || row.estado === "Cerrado") return NextResponse.json({ error: "Solo supervisión puede reasignar una incidencia sin cerrar." }, { status: 403 });
      const [tech] = await db.select().from(usuarios).where(and(eq(usuarios.id, input.tecnicoId), eq(usuarios.rol, "tecnico"), eq(usuarios.activo, true))).limit(1);
      if (!tech) return NextResponse.json({ error: "Técnico no disponible." }, { status: 400 });
      await db.update(incidencias).set({ tecnicoId: tech.id, estado: row.estado === "Abierto" ? "Asignado" : row.estado, asignadaEn: row.asignadaEn ?? now }).where(eq(incidencias.id, row.id));
      await db.insert(incidenciaEventos).values({ incidenciaId: row.id, usuarioId: user.id, evento: "Reasignada", detalle: `Asignada a ${tech.codigo}`, ocurridoEn: now });
    }
    if (input.categoriaConfirmadaId !== undefined) {
      if (!(["tecnico", "supervisor"].includes(user.rol)) || (user.rol === "tecnico" && row.tecnicoId !== user.id)) return NextResponse.json({ error: "Solo el técnico asignado o supervisión pueden confirmar la categoría." }, { status: 403 });
      const [category] = await db.select().from(categorias).where(eq(categorias.id, input.categoriaConfirmadaId)).limit(1);
      if (!category) return NextResponse.json({ error: "Categoría no válida." }, { status: 400 });
      await db.update(incidencias).set({ categoriaConfirmadaId: category.id, confirmadaPor: user.id, confirmadaEn: now }).where(eq(incidencias.id, row.id));
      await db.insert(incidenciaEventos).values({ incidenciaId: row.id, usuarioId: user.id, evento: "Categoría confirmada", detalle: category.nombre, ocurridoEn: now });
    }
    if (input.estado) {
      if (!transitionAllowed(row.estado,input.estado)) return NextResponse.json({ error: `No se permite pasar de ${row.estado} a ${input.estado}.` }, { status: 400 });
      if (input.estado === "Cerrado") {
        if (user.rol === "colaborador" ? row.usuarioId !== user.id : user.rol !== "supervisor") return NextResponse.json({ error: "Solo la persona que reportó o supervisión puede cerrar." }, { status: 403 });
        if (row.estado !== "Resuelto") return NextResponse.json({ error: "Primero debe quedar resuelta." }, { status: 400 });
      } else if (user.rol === "tecnico" ? row.tecnicoId !== user.id : user.rol !== "supervisor") return NextResponse.json({ error: "Solo el técnico asignado o supervisión puede cambiar este estado." }, { status: 403 });
      if (input.estado === "Resuelto" && !(input.categoriaConfirmadaId ?? row.categoriaConfirmadaId)) return NextResponse.json({ error: "Confirma la categoría antes de resolver." }, { status: 400 });
      if (input.estado === "Resuelto" && input.requirioExterno === undefined) return NextResponse.json({ error: "Indica si se requirió un técnico externo." }, { status: 400 });
      const update: Partial<typeof incidencias.$inferInsert> = { estado: input.estado };
      if (input.estado === "En proceso") { update.asignadaEn = row.asignadaEn ?? now; update.resueltaEn = null; update.cerradaEn = null; }
      if (input.estado === "Resuelto") { update.resueltaEn = now; update.solucion = input.solucion?.trim() || row.solucion; update.causa = input.causa || row.causa; update.repuestoUsado = input.repuestoUsado || row.repuestoUsado; if (input.procedimientoUtil !== undefined) update.procedimientoUtil = input.procedimientoUtil; update.requirioExterno = input.requirioExterno; }
      if (input.estado === "Cerrado") update.cerradaEn = now;
      await db.update(incidencias).set(update).where(eq(incidencias.id, row.id));
      await db.insert(incidenciaEventos).values({ incidenciaId: row.id, usuarioId: user.id, evento: input.estado, detalle: input.estado === "Resuelto" ? [input.solucion, input.causa && `Causa: ${input.causa}`, input.repuestoUsado && `Repuesto: ${input.repuestoUsado}`, `Técnico externo: ${input.requirioExterno ? "sí" : "no"}`].filter(Boolean).join(" · ") || null : null, ocurridoEn: now });
    }
    const [updated] = await db.select().from(incidencias).where(eq(incidencias.id, row.id));
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error); return NextResponse.json({ error: "No se pudo actualizar la incidencia." }, { status: 500 });
  }
}
