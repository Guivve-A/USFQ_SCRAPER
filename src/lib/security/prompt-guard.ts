export type PromptBlockReason =
  | "prompt_override_attempt"
  | "db_modification_attempt";

const PROMPT_INJECTION_PATTERNS = [
  /\bignore\b.{0,40}\b(previous|prior|earlier)\b.{0,20}\binstructions?\b/i,
  /\bignora\b.{0,40}\binstrucciones?\b.{0,20}\b(anteriores|previas)\b/i,
  /\b(reveal|show|print|disclose|leak)\b.{0,50}\b(system prompt|hidden prompt|developer message|internal instructions?)\b/i,
  /\b(revela|muestra|imprime|filtra)\b.{0,50}\b(prompt del sistema|instrucciones internas|mensaje de desarrollador)\b/i,
  /\b(do not follow|bypass|override|jailbreak)\b.{0,40}\b(rules|safety|instructions?)\b/i,
  /\b(no sigas|omite|anula)\b.{0,40}\b(reglas|seguridad|instrucciones?)\b/i,
];

const DATA_MODIFICATION_PATTERNS = [
  /\b(drop|truncate|delete|update|insert|alter)\b.{0,40}\b(table|database|schema|hackathons?)\b/i,
  /\b(elimina|borra|actualiza|inserta|modifica)\b.{0,40}\b(base de datos|tabla|hackathons?)\b/i,
];

export function getPromptInjectionBlockReason(input: string): PromptBlockReason | null {
  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(input))) {
    return "prompt_override_attempt";
  }

  if (DATA_MODIFICATION_PATTERNS.some((pattern) => pattern.test(input))) {
    return "db_modification_attempt";
  }

  return null;
}
