import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nakama | Mesa de ayuda",
  description: "Mesa de ayuda e indicadores de soporte técnico de Nakama",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
