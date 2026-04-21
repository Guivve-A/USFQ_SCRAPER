import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";

import Balatro from "@/components/Balatro";
import { SiteHeader } from "@/components/SiteHeader";

function LinkedInMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-3.5 fill-current"
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.44a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .78 0 1.74v20.52C0 23.22.79 24 1.77 24h20.46c.98 0 1.77-.78 1.77-1.74V1.74C24 .78 23.21 0 22.23 0z" />
    </svg>
  );
}

const LINKEDIN_URL =
  "https://www.linkedin.com/in/guillermo-armando-veliz-velez-1b4bb1251";

export const metadata = {
  title: "Sobre mí — HackFinder",
  description:
    "Guillermo Armando Veliz Velez — Estudiante de Electrónica y Automatización en ESPOL. Industria 4.0, IoT, Machine Learning y Edge AI.",
};

export default function AboutPage() {
  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="fixed inset-0 -z-10">
        <Balatro
          isRotate={false}
          mouseInteraction
          pixelFilter={1820}
          color1="#0F163D"
          color2="#2399e9"
          color3="#0B0D14"
        />
      </div>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(8,12,24,0.45)_60%,rgba(4,6,14,0.75)_100%)]"
      />

      <SiteHeader overlay />

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <section className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_40px_120px_-30px_rgba(4,10,30,0.9)] backdrop-blur-2xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,rgba(35,153,233,0.08)_0%,transparent_45%,rgba(15,22,61,0.1)_100%)]"
          />

          <div className="relative grid gap-0 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="relative w-full overflow-hidden md:min-h-[600px]">
              <Image
                src="/about/guillermo.jpg"
                alt="Guillermo Armando Veliz Velez"
                width={500}
                height={900}
                priority
                sizes="(max-width: 768px) 100vw, 45vw"
                className="h-full w-full object-cover"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(110deg, rgba(0,0,0,1) 58%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0) 100%)",
                  maskImage:
                    "linear-gradient(110deg, rgba(0,0,0,1) 58%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0) 100%)",
                  mixBlendMode: "luminosity",
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,20,0)_40%,rgba(4,8,20,0.55)_100%)]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(35,153,233,0.18),transparent_55%)] mix-blend-screen"
              />
            </div>

            <div className="relative flex flex-col justify-center gap-6 p-8 sm:p-10 md:p-12 lg:p-14">
              <span className="inline-flex w-fit items-center rounded-full border border-cyan-300/25 bg-cyan-200/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/85">
                Programador
              </span>

              <div>
                <h1 className="font-heading text-4xl font-semibold leading-[0.95] tracking-[-0.025em] text-white sm:text-5xl lg:text-6xl">
                  Guillermo
                  <br />
                  Veliz Velez
                </h1>
                <p className="mt-4 text-sm font-medium tracking-wide text-cyan-100/70 sm:text-base">
                  Líder del proyecto HackFinder
                </p>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-white/20 via-white/5 to-transparent" />

              <div className="space-y-4 text-[14px] leading-relaxed text-white/75 sm:text-[15px]">
                <p>
                  Estudiante de Electrónica y Automatización en la{" "}
                  <span className="text-white">ESPOL</span>, apasionado por la
                  Industria 4.0, IoT y Machine Learning. Desarrollo soluciones
                  en <span className="text-white">Edge AI</span>, FPGA y PLC.
                </p>
                <p>
                  Participo activamente en hackathons (NASA Space Apps entre
                  otros) y creo herramientas open source para que la comunidad
                  de desarrolladores en Ecuador y Latinoamérica encuentre, de
                  forma sencilla, los próximos eventos donde puedan construir,
                  aprender y conectar.
                </p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Link
                  href={LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-3 rounded-full border border-cyan-200/30 bg-cyan-100/10 py-2.5 pl-5 pr-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-50 transition-all hover:border-cyan-200/50 hover:bg-cyan-100/15"
                >
                  <LinkedInMark />
                  <span>Perfil LinkedIn</span>
                  <span className="flex size-8 items-center justify-center rounded-full border border-cyan-200/30 bg-cyan-200/10 transition-transform group-hover:rotate-45">
                    <Plus className="size-3.5" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
