"use client";

import { Languages, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export interface TranslateButtonProps {
  hackathonId: number;
  description: string;
  initialTranslation: string | null;
}

export function TranslateButton({
  hackathonId,
  description,
  initialTranslation,
}: TranslateButtonProps) {
  const [translation, setTranslation] = useState<string | null>(initialTranslation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTranslate() {
    if (translation || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hackathonId, description, targetLanguage: "es" }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const detail =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "No se pudo traducir.";
        setError(detail);
        return;
      }

      const data = (await res.json()) as { translated: string };
      setTranslation(data.translated);
    } catch {
      setError("Error de red al traducir. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {!translation && (
        <Button
          type="button"
          variant="outline"
          onClick={handleTranslate}
          disabled={loading}
          className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 hover:text-cyan-100"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Languages className="size-4" />
          )}
          {loading ? "Traduciendo…" : "Traducir al español"}
        </Button>
      )}

      {translation && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
            Resumen en español
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">
            {translation}
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-300">{error}</p>
      )}
    </div>
  );
}
