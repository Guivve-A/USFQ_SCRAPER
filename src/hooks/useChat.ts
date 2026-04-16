"use client";

import { useChat as useVercelChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useState } from "react";

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

export function useChat() {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );

  const { messages, sendMessage, status } = useVercelChat({
    transport,
    messages: [WELCOME_MESSAGE],
  });

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setInput(event.target.value);
  };

  const handleSubmit = async (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();

    const content = input.trim();
    if (!content) return;

    setInput("");
    await sendMessage({ text: content });
  };

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: status === "submitted" || status === "streaming",
  };
}
