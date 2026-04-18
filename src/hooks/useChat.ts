"use client";

import { useChat as useVercelChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useMemo, useState } from "react";

const WELCOME_MESSAGE: UIMessage = {
  id: "hackbot-welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Hola, soy HackBot. Cuentame que tipo de hackathon buscas y te recomendare los mejores eventos.",
    },
  ],
};

function toChatErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");

  if (/429|rate\s*limit|quota|resource_exhausted|too\s*many\s*requests/i.test(rawMessage)) {
    return "Alcanzamos el limite temporal del proveedor de IA. Espera unos segundos e intenta de nuevo.";
  }

  if (/network|fetch|timeout|econnreset|aborted/i.test(rawMessage)) {
    return "Se perdio la conexion durante la respuesta. Intenta nuevamente.";
  }

  return "No pude completar la respuesta en este momento. Intenta nuevamente.";
}

export function useChat() {
  const [input, setInput] = useState("");
  const [chatErrorMessage, setChatErrorMessage] = useState<string | null>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );

  const { messages, sendMessage, status, error, clearError } = useVercelChat({
    transport,
    messages: [WELCOME_MESSAGE],
  });

  const providerErrorMessage = error ? toChatErrorMessage(error) : null;
  const visibleChatErrorMessage = chatErrorMessage ?? providerErrorMessage;

  const clearChatError = useCallback(() => {
    setChatErrorMessage(null);
    clearError();
  }, [clearError]);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (visibleChatErrorMessage) clearChatError();
    setInput(event.target.value);
  };

  const handleSubmit = async (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();

    const content = input.trim();
    if (!content) return;

    setInput("");
    clearChatError();

    try {
      await sendMessage({ text: content });
    } catch (error) {
      setChatErrorMessage(toChatErrorMessage(error));
    }
  };

  const sendPrompt = async (prompt: string) => {
    const content = prompt.trim();
    if (!content) return;

    setInput("");
    clearChatError();

    try {
      await sendMessage({ text: content });
    } catch (error) {
      setChatErrorMessage(toChatErrorMessage(error));
    }
  };

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    sendPrompt,
    isLoading: status === "submitted" || status === "streaming",
    chatErrorMessage: visibleChatErrorMessage,
    clearChatError,
  };
}
