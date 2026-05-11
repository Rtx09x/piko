const apiKey = document.querySelector("#apiKey");
const model = document.querySelector("#model");
const enabled = document.querySelector("#enabled");
const aiNudges = document.querySelector("#aiNudges");
const nudgeMode = document.querySelector("#nudgeMode");
const privacyMode = document.querySelector("#privacyMode");
const allowedDomains = document.querySelector("#allowedDomains");
const blockedDomains = document.querySelector("#blockedDomains");
const saveSettings = document.querySelector("#saveSettings");
const clearActivity = document.querySelector("#clearActivity");
const importHistory = document.querySelector("#importHistory");
const saveStatus = document.querySelector("#saveStatus");

saveSettings.addEventListener("click", async () => {
  const patch = {
    apiKey: apiKey.value.trim() || undefined,
    model: model.value.trim() || "gemini-2.5-flash",
    enabled: enabled.checked,
    aiNudges: aiNudges.checked,
    nudgeMode: nudgeMode.value,
    privacyMode: privacyMode.value,
    allowedDomains: lines(allowedDomains.value),
    blockedDomains: lines(blockedDomains.value)
  };
  if (patch.apiKey === undefined) delete patch.apiKey;
  const response = await send({ type: "PIKO_SAVE_SETTINGS", patch });
  saveStatus.textContent = response.ok ? "Saved." : response.error || "Save failed.";
  setTimeout(() => (saveStatus.textContent = ""), 2200);
});

clearActivity.addEventListener("click", async () => {
  const response = await send({ type: "PIKO_CLEAR_ACTIVITY" });
  saveStatus.textContent = response.ok ? "Local activity and chat cleared." : response.error || "Clear failed.";
});

importHistory.addEventListener("click", async () => {
  const granted = await chrome.permissions.request({ permissions: ["history"] });
  if (!granted) {
    saveStatus.textContent = "History permission was not granted.";
    return;
  }

  const response = await send({ type: "PIKO_IMPORT_HISTORY", hours: 6 });
  saveStatus.textContent = response.ok
    ? `Imported ${response.imported} recent history items.`
    : response.error || "Import failed.";
});

load();

async function load() {
  const response = await send({ type: "PIKO_GET_DASHBOARD" });
  if (!response.ok) {
    saveStatus.textContent = response.error || "Could not load settings.";
    return;
  }

  const settings = response.settings;
  apiKey.value = settings.apiKey ? "" : "";
  apiKey.placeholder = settings.apiKey ? "Saved. Paste a new key to replace it." : "Paste your Gemini API key";
  model.value = settings.model || "gemini-2.5-flash";
  enabled.checked = Boolean(settings.enabled);
  aiNudges.checked = Boolean(settings.aiNudges);
  nudgeMode.value = settings.nudgeMode || "balanced";
  privacyMode.value = settings.privacyMode || "titles";
  allowedDomains.value = (settings.allowedDomains || []).join("\n");
  blockedDomains.value = (settings.blockedDomains || []).join("\n");
}

function lines(value) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function send(message) {
  return chrome.runtime.sendMessage(message);
}
