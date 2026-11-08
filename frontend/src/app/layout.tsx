import type { Metadata } from "next";
import "./globals.css";
import "../features/workspaces.css";
import "../features/polish.css";

export const metadata: Metadata = {
  title: "Praxis · Docencia con IA",
  description: "Copiloto inteligente para profesores — Transforma tus documentos en clases, exámenes, rúbricas y presentaciones con IA.",
  keywords: "IA para docentes, generación de material educativo, clases con inteligencia artificial, rúbricas, exámenes, sílabos",
  authors: [{ name: "Praxis" }],
  openGraph: {
    title: "Praxis · Docencia con IA",
    description: "Copiloto inteligente para profesores",
    type: "website",
  },
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
