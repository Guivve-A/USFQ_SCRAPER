"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-rose-400/25 bg-rose-500/10 text-rose-300">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-white">Algo salió mal</h1>
        <p className="max-w-md text-sm text-white/55">
          Ocurrió un error inesperado. Puedes intentar recargar la página.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
