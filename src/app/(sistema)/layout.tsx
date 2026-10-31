import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";
export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  try {
    const user = await getCurrentUser();
    return <AppShell user={{ nombre: user.nombre, rol: user.rol, codigo: user.codigo }}>{children}</AppShell>;
  } catch (error) {
    if (error instanceof AuthError) redirect("/acceso-denegado");
    throw error;
  }
}
