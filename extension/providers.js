// Shared provider detection logic, used by both background.js and content.js.

const PROVIDER_HOSTS = [
  { match: (host) => host === "claude.ai", provider: "CLAUDE" },
  { match: (host) => host === "chatgpt.com" || host === "chat.openai.com", provider: "CHATGPT" },
  { match: (host) => host === "gemini.google.com", provider: "GEMINI" },
  {
    match: (host) => host === "copilot.microsoft.com" || host === "m365.cloud.microsoft",
    provider: "COPILOT",
  },
  { match: (host) => host === "www.perplexity.ai" || host === "perplexity.ai", provider: "PERPLEXITY" },
  { match: (host) => host === "chat.mistral.ai" || host === "mistral.ai", provider: "MISTRAL" },
  { match: (host) => host === "grok.com" || host === "x.ai", provider: "GROK" },
  { match: (host) => host === "chat.deepseek.com", provider: "DEEPSEEK" },
  { match: (host) => host === "www.meta.ai" || host === "meta.ai", provider: "META" },
  { match: (host) => host === "poe.com", provider: "POE" },
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
