import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OndaPilot Studio | Programador musical para radio online",
  description: "Estudio de programación musical: playlists, parrilla semanal, biblioteca y campañas para emisoras online.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
