"use client";

import Link from "next/link";
import { MessageCircle, Sparkles } from "lucide-react";

export function ChatWidget() {
  return (
    <Link
      href="/chat"
      aria-label="Abrir chat con HackBot"
      className="group fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300/60"
    >
      <span className="relative flex">
        <MessageCircle className="size-5" />
        <Sparkles className="absolute -right-1 -top-1 size-3 text-amber-300 opacity-90" />
      </span>
      <span className="hidden sm:inline">Pregunta a HackBot</span>
    </Link>
  );
}
