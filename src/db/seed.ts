import { eq } from "drizzle-orm";
import type { AppDb } from "./client";
import { categorias, usuarios } from "./schema";

export const CATEGORIES = [
  "Accesos",
  "Audio",
  "Conectividad",
  "Correo electrónico",
  "Hardware",
  "Impresora",
  "Seguridad",
  "Software/licencias",
] as const;

export async function seedCategories(db: AppDb) {
  await db.insert(categorias)
    .values(CATEGORIES.map((nombre) => ({ nombre })))
    .onConflictDoNothing({ target: categorias.nombre });
}

export async function ensureLocalSupervisor(db: AppDb) {
  const email = (process.env.DEV_USER_EMAIL || "supervisor@nakama.local").trim().toLowerCase();
  await seedCategories(db);
  const existing = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.correo, email)).limit(1);
  if (!existing.length) {
    await db.insert(usuarios).values({
      codigo: "SUP-LOCAL",
      nombre: "Supervisor local",
      correo: email,
      rol: "supervisor",
      activo: true,
    }).onConflictDoNothing();
  }
}
