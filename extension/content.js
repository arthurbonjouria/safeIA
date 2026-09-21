// Best-effort detection of "message sent" on AI chat sites. Generic heuristics only —
// we never read the prompt/response text, only detect the send action.

let lastSentAt = 0;

function notifyMessageSent() {
  const now = Date.now();
  if (now - lastSentAt < 1500) return; // debounce Enter + click firing for the same message
  lastSentAt = now;
  chrome.runtime.sendMessage({ type: "SAFEIA_MESSAGE_SENT" });
}

function isComposerElement(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === "textarea" || el.getAttribute?.("contenteditable") === "true";
}

document.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    if (isComposerElement(document.activeElement)) {
      notifyMessageSent();
    }
  },
  true
);

document.addEventListener(
  "click",
  (e) => {
    const target = e.target instanceof Element ? e.target.closest("button, [role='button']") : null;
    if (!target) return;
    const label = (target.getAttribute("aria-label") || target.textContent || "").toLowerCase();
    if (/(send|envoyer|submit)/.test(label) && target.type !== "reset") {
      notifyMessageSent();
    }
  },
  true
);
