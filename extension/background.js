importScripts("providers.js");

const TICK_ALARM = "safeia-tick";
const FLUSH_ALARM = "safeia-flush";
const TICK_SECONDS = 20; // how often we sample the focused tab
const FLUSH_SECONDS = 60; // how often we send queued events to the backend
const MAX_QUEUE = 1000;

chrome.alarms.create(TICK_ALARM, { periodInMinutes: TICK_SECONDS / 60 });
chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_SECONDS / 60 });

function log(...args) {
  console.log("[SAFEIA]", ...args);
}

async function setStatus(patch) {
  const { status = {} } = await chrome.storage.local.get("status");
  await chrome.storage.local.set({ status: { ...status, ...patch } });
}

async function getConfig() {
  const { config } = await chrome.storage.local.get("config");
  return config ?? null;
}

async function enqueueEvent(event) {
  const { queue = [] } = await chrome.storage.local.get("queue");
  queue.push({ ...event, occurredAt: new Date().toISOString() });
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  await chrome.storage.local.set({ queue });
  await setStatus({ queueLength: queue.length, lastEventAt: new Date().toISOString() });
  log("enqueued", event.eventType, event.provider, "— queue size:", queue.length);
}

async function getDeviceName() {
  const { config } = await chrome.storage.local.get("config");
  return config?.deviceName || "browser-extension";
}

async function sampleFocusedTab() {
  try {
    const idleState = await chrome.idle.queryState(60);
    if (idleState !== "active") {
      log("skipped tick — idle state:", idleState);
      return;
    }

    const windows = await chrome.windows.getAll({ populate: true });
    const focusedWindow = windows.find((w) => w.focused);
    if (!focusedWindow) {
      log("skipped tick — no focused browser window");
      return;
    }

    const activeTab = focusedWindow.tabs?.find((t) => t.active);
    if (!activeTab?.url) {
      log("skipped tick — no active tab url");
      return;
    }

    const provider = self.SAFEIA_providerForUrl(activeTab.url);
    if (!provider) {
      log("skipped tick — not an AI site:", activeTab.url);
      return;
    }

    const deviceName = await getDeviceName();
    await enqueueEvent({
      source: "BROWSER_EXTENSION",
      provider,
      eventType: "HEARTBEAT",
      durationSeconds: TICK_SECONDS,
      messageCount: 0,
      url: activeTab.url,
      windowTitle: activeTab.title,
      deviceName,
      platform: "browser",
    });
  } catch (err) {
    log("tick error:", err);
    await setStatus({ lastError: String(err), lastErrorAt: new Date().toISOString() });
  }
}

async function flushQueue() {
  const config = await getConfig();
  if (!config?.apiBase || !config?.apiToken) {
    log("flush skipped — not configured");
    return;
  }

  const { queue = [] } = await chrome.storage.local.get("queue");
  if (queue.length === 0) return;

  try {
    const res = await fetch(`${config.apiBase.replace(/\/$/, "")}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiToken}`,
      },
      body: JSON.stringify(queue),
    });
    if (res.ok) {
      log("flushed", queue.length, "events successfully");
      await chrome.storage.local.set({ queue: [] });
      await setStatus({
        queueLength: 0,
        lastFlushAt: new Date().toISOString(),
        lastFlushCount: queue.length,
        lastError: null,
      });
    } else {
      const body = await res.text().catch(() => "");
      log("flush failed:", res.status, body);
      await setStatus({
        lastError: `HTTP ${res.status}: ${body.slice(0, 200)}`,
        lastErrorAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    log("flush network error:", err);
    await setStatus({ lastError: String(err), lastErrorAt: new Date().toISOString() });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK_ALARM) sampleFocusedTab();
  if (alarm.name === FLUSH_ALARM) flushQueue();
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "SAFEIA_TEST_NOW") {
    (async () => {
      await sampleFocusedTab();
      await flushQueue();
    })();
    return;
  }

  if (message?.type === "SAFEIA_MESSAGE_SENT" && sender.tab?.url) {
    const provider = self.SAFEIA_providerForUrl(sender.tab.url);
    if (!provider) return;
    getDeviceName().then((deviceName) =>
      enqueueEvent({
        source: "BROWSER_EXTENSION",
        provider,
        eventType: "MESSAGE_SENT",
        durationSeconds: 0,
        messageCount: 1,
        url: sender.tab.url,
        deviceName,
        platform: "browser",
      })
    );
  }
});

log("service worker loaded");
