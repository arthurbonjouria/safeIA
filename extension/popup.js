const apiBaseInput = document.getElementById("apiBase");
const apiTokenInput = document.getElementById("apiToken");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save");
const statusBox = document.getElementById("statusBox");
const testNowBtn = document.getElementById("testNow");

async function load() {
  const { config } = await chrome.storage.local.get("config");
  if (config) {
    apiBaseInput.value = config.apiBase ?? "";
    apiTokenInput.value = config.apiToken ?? "";
  }
  await renderStatus();
}

function timeAgo(iso) {
  if (!iso) return null;
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes}min`;
  return `il y a ${Math.round(minutes / 60)}h`;
}

async function renderStatus() {
  const { config } = await chrome.storage.local.get("config");
  const { status = {} } = await chrome.storage.local.get("status");

  if (!config?.apiBase || !config?.apiToken) {
    statusBox.innerHTML = `<span class="muted">Pas encore configuré — renseigne l'URL et le token ci-dessus.</span>`;
    return;
  }

  const rows = [
    `<div class="row"><span class="muted">Dernier événement détecté</span><span>${
      timeAgo(status.lastEventAt) ?? "aucun"
    }</span></div>`,
    `<div class="row"><span class="muted">Dernier envoi réussi</span><span>${
      timeAgo(status.lastFlushAt) ?? "aucun"
    }</span></div>`,
    `<div class="row"><span class="muted">En attente d'envoi</span><span>${
      status.queueLength ?? 0
    }</span></div>`,
  ];

  let html = rows.join("");
  if (status.lastError) {
    html += `<div class="error">⚠ ${status.lastError} (${timeAgo(status.lastErrorAt)})</div>`;
  }
  statusBox.innerHTML = html;
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
  await renderStatus();
});

testNowBtn.addEventListener("click", async () => {
  testNowBtn.textContent = "Test en cours…";
  testNowBtn.disabled = true;

  chrome.runtime.sendMessage({ type: "SAFEIA_TEST_NOW" }, async (response) => {
    testNowBtn.disabled = false;
    testNowBtn.textContent = "Tester maintenant";

    if (!response) {
      statusEl.textContent = "Pas de réponse de l'extension — recharge-la dans chrome://extensions.";
      statusEl.className = "err";
    } else if (!response.configured) {
      statusEl.textContent = "Configure d'abord l'URL et le token ci-dessus.";
      statusEl.className = "err";
    } else if (!response.found) {
      statusEl.textContent = "Aucun onglet Claude/ChatGPT/Gemini... ouvert. Ouvre-en un puis réessaie.";
      statusEl.className = "err";
    } else if (response.flush?.ok) {
      statusEl.textContent = `Détecté (${response.provider}) et envoyé ✓`;
      statusEl.className = "ok";
    } else {
      statusEl.textContent = `Détecté (${response.provider}) mais envoi échoué : ${response.flush?.reason ?? "erreur inconnue"}`;
      statusEl.className = "err";
    }

    await renderStatus();
  });
});

load();
setInterval(renderStatus, 3000);
