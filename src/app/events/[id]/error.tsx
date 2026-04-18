"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function EventDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[EventDetailError]", error);
  }, [error]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-white/10 bg-[#121212] p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-rose-400/25 bg-rose-500/10 text-rose-300">
          <AlertTriangle className="size-5" />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-semibold text-white">No se pudo cargar el evento</h2>
          <p className="text-sm text-white/55">
            El evento no existe o hubo un error al obtener los datos.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Reintentar
          </button>
          <Link
            href="/events"
            className="rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-4 py-2 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-600/30"
          >
            Ver eventos
          </Link>
        </div>
      </div>
    </div>
  );
}
