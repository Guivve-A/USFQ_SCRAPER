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
      <main className="flex flex-1 flex-col bg-gradient-to-b from-white via-zinc-50 to-zinc-100">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
          <header className="mb-4 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">HackBot</h1>
              <p className="text-xs text-zinc-500">
                Pregunta en lenguaje natural y descubre hackathons relevantes
              </p>
            </div>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
          >
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
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    handleInputChange({
                      target: { value: suggestion },
                    } as unknown as React.ChangeEvent<HTMLInputElement>);
                  }}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-4 flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100"
          >
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
              placeholder="Busca hackathons…"
              aria-label="Mensaje para HackBot"
              className="max-h-32 min-h-[2.25rem] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Enviar mensaje"
              className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </form>
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
            ? "bg-indigo-100 text-indigo-700"
            : "bg-zinc-900 text-white"
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
            ? "bg-indigo-600 text-white"
            : "bg-zinc-100 text-zinc-900"
        )}
      >
        {text}
      </div>
    );
  }

  if (part.type === "tool-searchHackathons") {
    if (part.state !== "output-available") {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
          <Loader2 className="size-3.5 animate-spin text-indigo-500" />
          Buscando hackathons…
        </div>
      );
    }

    const hits = Array.isArray(part.output) ? (part.output as SearchToolHit[]) : [];
    if (hits.length === 0) {
      return (
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
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
            className="group flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <span className="line-clamp-2 font-semibold text-zinc-900 group-hover:text-indigo-700">
              {hit.name}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              {hit.platform && (
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium uppercase tracking-wide">
                  {hit.platform}
                </span>
              )}
              {hit.online !== undefined && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-medium",
                    hit.online
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-zinc-100 text-zinc-700"
                  )}
                >
                  {hit.online ? "Online" : "Presencial"}
                </span>
              )}
              {hit.prize && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <Trophy className="size-3" />
                  {hit.prize}
                </span>
              )}
              {typeof hit.relevance === "number" && (
                <span className="ml-auto text-zinc-400">
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
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs italic text-indigo-900">
        {translated}
      </div>
    );
  }

  return null;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <span className="flex size-8 items-center justify-center rounded-full bg-zinc-900 text-white">
        <Bot className="size-4" />
      </span>
      <div className="flex gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400" />
      </div>
    </div>
  );
}
