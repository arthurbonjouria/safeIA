const apiBaseInput = document.getElementById("apiBase");
const apiTokenInput = document.getElementById("apiToken");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save");

async function load() {
  const { config } = await chrome.storage.local.get("config");
  if (config) {
    apiBaseInput.value = config.apiBase ?? "";
    apiTokenInput.value = config.apiToken ?? "";
  }
}

saveBtn.addEventListener("click", async () => {
  const apiBase = apiBaseInput.value.trim().replace(/\/$/, "");
  const apiToken = apiTokenInput.value.trim();

  if (!apiBase || !apiToken) {
    statusEl.textContent = "Renseigne l'URL et le token.";
    statusEl.className = "err";
    return;
  }

  let origin;
  try {
    origin = new URL(apiBase).origin + "/*";
  } catch {
    statusEl.textContent = "URL invalide.";
    statusEl.className = "err";
    return;
  }

  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    statusEl.textContent = "Permission refusée — impossible d'envoyer les données.";
    statusEl.className = "err";
    return;
  }

  await chrome.storage.local.set({
    config: { apiBase, apiToken, deviceName: `chrome-${navigator.platform}` },
  });

  statusEl.textContent = "Enregistré ✓";
  statusEl.className = "ok";
});

load();
