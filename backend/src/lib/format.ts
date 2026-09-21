export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  return `${hours}h${minutes.toString().padStart(2, "0")}`;
}

export const PROVIDER_LABELS: Record<string, string> = {
  CLAUDE: "Claude",
  CHATGPT: "ChatGPT",
  GEMINI: "Gemini",
  COPILOT: "Copilot",
  PERPLEXITY: "Perplexity",
  MISTRAL: "Mistral",
  GROK: "Grok",
  DEEPSEEK: "DeepSeek",
  META: "Meta AI",
  POE: "Poe",
  OTHER: "Autre",
};

export const SOURCE_LABELS: Record<string, string> = {
  BROWSER_EXTENSION: "Navigateur (web)",
  DESKTOP_AGENT: "PC (apps desktop)",
};

export const SOURCE_COLORS: Record<string, string> = {
  BROWSER_EXTENSION: "#38bdf8",
  DESKTOP_AGENT: "#a78bfa",
};

export const PROVIDER_COLORS: Record<string, string> = {
  CLAUDE: "#d97757",
  CHATGPT: "#10a37f",
  GEMINI: "#4285f4",
  COPILOT: "#8e5ce6",
  PERPLEXITY: "#1fb6a3",
  MISTRAL: "#ff7000",
  GROK: "#e5e5e5",
  DEEPSEEK: "#4d6bfe",
  META: "#0668e1",
  POE: "#8b5cf6",
  OTHER: "#737373",
};
