import Link from "next/link";
import { MessageCircle } from "lucide-react";

export function ChatWidget() {
  return (
    <Link
      href="/chat"
      aria-label="Abrir chat con HackBot"
      className="group fixed bottom-6 right-6 z-40"
    >
      <span className="relative flex items-center gap-2.5 rounded-full border border-white/[0.14] bg-[rgba(2,6,23,0.78)] px-4 py-2.5 text-[12px] font-medium tracking-[0.01em] text-slate-100/92 shadow-[0_10px_36px_-24px_rgba(2,6,23,0.9)] backdrop-blur-xl transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-white/[0.22] group-hover:text-white">
        <MessageCircle className="size-3.5" />
        <span className="hidden sm:inline tracking-luxury">Pregunta a HackBot</span>
      </span>
    </Link>
  );
}
