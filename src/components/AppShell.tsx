"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const allLinks = [
  { href: "/", label: "Tablero", icon: "▦", roles: ["tecnico", "supervisor"] },
  { href: "/analisis", label: "Análisis predictivo", icon: "◔", roles: ["tecnico", "supervisor"] },
  { href: "/prioridades", label: "Priorización", icon: "⚑", roles: ["tecnico", "supervisor"] },
  { href: "/incidencias", label: "Incidencias", icon: "◉", roles: ["colaborador", "tecnico", "supervisor"] },
  { href: "/actividades", label: "Actividades", icon: "✓", roles: ["tecnico", "supervisor"] },
  { href: "/verificaciones", label: "Verificaciones", icon: "◎", roles: ["supervisor"] },
  { href: "/reportes", label: "Reportes", icon: "▤", roles: ["supervisor"] },
  { href: "/medicion", label: "Medición", icon: "◷", roles: ["supervisor"] },
  { href: "/modelo", label: "Modelo ML", icon: "✳", roles: ["supervisor"] },
  { href: "/usuarios", label: "Usuarios", icon: "♙", roles: ["supervisor"] },
];
export default function AppShell({ children, user }: { children: React.ReactNode; user: { nombre: string; rol: string; codigo: string } }) {
  const pathname = usePathname(); const links = allLinks.filter((link) => link.roles.includes(user.rol));
  const access = allLinks.find((link) => pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href)));
  const allowed = !access || access.roles.includes(user.rol);
  return <div className="layout">
    <aside className="sidebar">
      <div className="brand"><Image src="/nakama-logo.jpeg" alt="Nakama" width={180} height={64} priority/><span className="brand-mark">N</span></div>
      <div className="nav-label">Mesa de ayuda</div>
      <nav className="nav" aria-label="Navegación principal">{links.map((link) => <Link className={pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href)) ? "active" : ""} href={link.href} key={link.href}><span className="nav-icon" aria-hidden="true">{link.icon}</span><span>{link.label}</span></Link>)}</nav>
      <div className="sidebar-foot">Nakama · Soporte TI</div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="crumb">Nakama <span aria-hidden="true">/</span> {links.find((link) => pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href)))?.label ?? "Mesa de ayuda"}</div><div className="profile"><div className="avatar">{user.nombre.slice(0, 1).toUpperCase()}</div><div><strong>{user.nombre}</strong><div className="subtle" style={{ fontSize: 11 }}>{user.rol} · {user.codigo}</div></div></div></header>
      <main className="content">{allowed ? children : <section className="panel"><div className="alert">No tienes permiso para ver este módulo.</div></section>}</main>
    </div>
  </div>;
}
