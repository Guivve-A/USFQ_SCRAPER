import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

import { LenisProvider } from "@/components/LenisProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HackFinder — Descubre tu próximo hackathon",
  description:
    "Buscador inteligente de hackathons con búsqueda semántica e IA. Eventos de Devpost, MLH, Eventbrite y GDG en un solo lugar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${spaceGrotesk.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preload"
          as="image"
          href="/textures/night_sky_stars.jpg"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/textures/earth-color.jpg"
          fetchPriority="high"
        />
        <link rel="preload" as="image" href="/textures/earth-normal.jpg" />
        <link rel="preload" as="image" href="/textures/earth-specular.jpg" />
        <link rel="preload" as="image" href="/textures/earth-clouds.jpg" />
      </head>
      <body className="relative min-h-full overflow-x-hidden bg-background text-foreground">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_-10%,rgba(139,92,246,0.12),transparent_60%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.08),transparent_55%)]"
        />
        <LenisProvider>
          <div className="relative flex min-h-screen flex-col">{children}</div>
        </LenisProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
