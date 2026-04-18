"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ChatError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-rose-400/25 bg-rose-500/10 text-rose-300">
        <AlertTriangle className="size-5" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white">HackBot no disponible</h2>
        <p className="max-w-sm text-sm text-white/55">
          Ocurrió un error al cargar el chat. Intenta de nuevo.
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
          href="/"
          className="rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-4 py-2 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-600/30"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
