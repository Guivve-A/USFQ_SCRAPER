"use client";

import { ArrowUp, Bot, Loader2, Sparkles, Trophy, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { useChat } from "@/hooks/useChat";
import { cn } from "@/lib/utils";

type ChatMessage = ReturnType<typeof useChat>["messages"][number];

type SearchToolHit = {
  hackathonId: number;
  name: string;
  link?: string;
  prize?: string | null;
  online?: boolean;
  platform?: string;
  relevance?: number;
};

type ToolPart = {
  type: string;
  state?: string;
  output?: unknown;
};

const SUGGESTIONS = [
  "Hackathons de IA online con buen premio",
  "Eventos en Ecuador este mes",
  "Hackathons para principiantes en web3",
  "Competencias de ciberseguridad presenciales",
];

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 flex-col bg-[#0A0A0A] text-gray-200">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(37,99,235,0.18),transparent_45%),radial-gradient(circle_at_82%_100%,rgba(34,211,238,0.12),transparent_50%)]"
        />

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6">
          <header className="mb-4 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-[0_10px_28px_-10px_rgba(34,211,238,0.6)]">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-white">HackBot</h1>
              <p className="text-xs text-gray-400">
                Pregunta en lenguaje natural y descubre hackathons relevantes
              </p>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/[0.02] shadow-2xl backdrop-blur-md">
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="space-y-5">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {isLoading && messages.at(-1)?.role !== "assistant" && (
                  <TypingIndicator />
                )}
              </div>
            </div>

            {messages.length <= 1 && (
              <div className="border-t border-white/10 px-4 pb-1 pt-3 sm:px-6">
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        handleInputChange({
                          target: { value: suggestion },
                        } as unknown as React.ChangeEvent<HTMLInputElement>);
                      }}
                      className="rounded-full border border-cyan-500/30 bg-transparent px-4 py-2 text-sm text-cyan-400 transition-all duration-300 hover:border-cyan-400 hover:bg-cyan-500/10 hover:shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="mt-3 border-t border-white/10 p-3 sm:p-4"
            >
              <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/40 p-2 transition-all focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500/50">
                <textarea
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  rows={1}
                  placeholder="Busca hackathons..."
                  aria-label="Mensaje para HackBot"
                  className="max-h-32 min-h-[2.25rem] flex-1 resize-none rounded-xl border border-transparent bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  aria-label="Enviar mensaje"
                  className="flex size-9 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-600/80 text-white shadow-[0_0_14px_rgba(37,99,235,0.35)] transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const parts = (message.parts ?? []) as ToolPart[];

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "border border-blue-500/40 bg-blue-600/20 text-blue-100"
            : "border border-cyan-500/30 bg-white/5 text-cyan-300"
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        {parts.map((part, index) => (
          <PartRenderer key={index} part={part} isUser={isUser} />
        ))}
      </div>
    </div>
  );
}

function PartRenderer({ part, isUser }: { part: ToolPart; isUser: boolean }) {
  if (part.type === "text") {
    const text = (part as { text?: string }).text ?? "";
    if (!text) return null;
    return (
      <div
        className={cn(
          "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "border border-blue-500/30 bg-blue-600/20 text-blue-100"
            : "border border-white/10 border-l-2 border-l-cyan-500 bg-white/5 text-gray-300"
        )}
      >
        {text}
      </div>
    );
  }

  if (part.type === "tool-searchHackathons") {
    if (part.state !== "output-available") {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-400">
          <Loader2 className="size-3.5 animate-spin text-cyan-400" />
          Buscando hackathons…
        </div>
      );
    }

    const hits = Array.isArray(part.output) ? (part.output as SearchToolHit[]) : [];
    if (hits.length === 0) {
      return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-400">
          Sin coincidencias en la base de datos.
        </div>
      );
    }

    return (
      <div className="grid w-full max-w-md gap-2">
        {hits.slice(0, 5).map((hit) => (
          <Link
            key={hit.hackathonId}
            href={`/events/${hit.hackathonId}`}
            className="group flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm transition hover:border-cyan-400/40 hover:bg-white/[0.05] hover:shadow-[0_0_14px_rgba(34,211,238,0.18)]"
          >
            <span className="line-clamp-2 font-semibold text-white group-hover:text-cyan-200">
              {hit.name}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
              {hit.platform && (
                <span className="rounded-md border border-cyan-500/20 bg-cyan-900/25 px-1.5 py-0.5 font-medium uppercase tracking-wide text-cyan-300">
                  {hit.platform}
                </span>
              )}
              {hit.online !== undefined && (
                <span
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 font-medium",
                    hit.online
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : "border-white/15 bg-white/5 text-gray-300"
                  )}
                >
                  {hit.online ? "Online" : "Presencial"}
                </span>
              )}
              {hit.prize && (
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Trophy className="size-3" />
                  {hit.prize}
                </span>
              )}
              {typeof hit.relevance === "number" && (
                <span className="ml-auto text-gray-500">
                  match {(hit.relevance * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  if (part.type === "tool-translateDescription" && part.state === "output-available") {
    const translated = (part.output as { translated?: string } | undefined)?.translated;
    if (!translated) return null;
    return (
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-900/20 px-3 py-2 text-xs italic text-cyan-200">
        {translated}
      </div>
    );
  }

  return null;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span className="flex size-8 items-center justify-center rounded-full border border-cyan-500/30 bg-white/5 text-cyan-300">
        <Bot className="size-4" />
      </span>
      <div className="flex gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-cyan-400" />
      </div>
    </div>
  );
}
