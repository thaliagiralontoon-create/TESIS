import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db/client";
import { usuarios, type User } from "@/db/schema";

export class AuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
  }
}

export async function getCurrentUser(): Promise<User> {
  const email = (await headers()).get("x-nakama-verified-email")?.trim().toLowerCase();
  if (!email) throw new AuthError("Acceso no autorizado.");
  const db = await getDb();
  const [user] = await db.select().from(usuarios).where(eq(usuarios.correo, email)).limit(1);
  if (!user || !user.activo) throw new AuthError("Acceso no autorizado.");
  return user;
}

export async function requireRole(...roles: User["rol"][]) {
  const user = await getCurrentUser();
  if (!roles.includes(user.rol)) throw new AuthError("No tienes permiso para esta acción.", 403);
  return user;
}
