// Shared provider detection logic, used by both background.js and content.js.

const PROVIDER_HOSTS = [
  { match: (host) => host === "claude.ai", provider: "CLAUDE" },
  { match: (host) => host === "chatgpt.com" || host === "chat.openai.com", provider: "CHATGPT" },
  { match: (host) => host === "gemini.google.com", provider: "GEMINI" },
  { match: (host) => host === "copilot.microsoft.com", provider: "COPILOT" },
  { match: (host) => host === "www.perplexity.ai" || host === "perplexity.ai", provider: "PERPLEXITY" },
  { match: (host) => host === "chat.mistral.ai", provider: "MISTRAL" },
];

function providerForUrl(url) {
  try {
    const host = new URL(url).hostname;
    const found = PROVIDER_HOSTS.find((p) => p.match(host));
    return found ? found.provider : null;
  } catch {
    return null;
  }
}

// Exposed for both service worker (importScripts) and content script (classic script tag) contexts.
if (typeof self !== "undefined") {
  self.SAFEIA_providerForUrl = providerForUrl;
}
