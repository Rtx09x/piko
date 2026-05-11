import {
  addActivityEvent,
  buildChatPrompt,
  buildNudgePrompt,
  callGemini,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  domainFromUrl,
  fallbackNudge,
  getActivity,
  getSettings,
  getState,
  isDomainAllowed,
  now,
  selectNudgeCandidate,
  setActivity,
  setSettings,
  setState,
  writeStorage
} from "./core.js";

const ALARM_NAME = "piko-nudge-tick";

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["settings", "state", "activity", "chat"]);
  if (!stored.settings) await writeStorage({ settings: DEFAULT_SETTINGS });
  if (!stored.state) await writeStorage({ state: DEFAULT_STATE });
  if (!stored.activity) await writeStorage({ activity: [] });
  if (!stored.chat) await writeStorage({ chat: [] });
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 3 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 3 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    tickNudge().catch(console.error);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await closeActiveEvent();
  const tab = await getTab(tabId);
  await setActiveTab(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && !changeInfo.title) return;
  const state = await getState();
  if (state.activeTabId !== tabId) return;
  await closeActiveEvent();
  await setActiveTab(tab);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await closeActiveEvent();
    await setState({ activeTabId: null, activeStartedAt: 0, activeUrl: "", activeTitle: "" });
    return;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  await closeActiveEvent();
  await setActiveTab(tabs[0]);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function getTab(tabId) {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

async function setActiveTab(tab) {
  if (!tab || !tab.id || !tab.url) return;
  const settings = await getSettings();
  const shouldTrack = isDomainAllowed(tab.url, settings);
  await setState({
    activeTabId: tab.id,
    activeStartedAt: now(),
    activeUrl: shouldTrack ? tab.url : "",
    activeTitle: shouldTrack ? tab.title || "" : "Private or blocked page",
    lastTickAt: now()
  });
}

async function closeActiveEvent() {
  const settings = await getSettings();
  const state = await getState();
  if (!state.activeStartedAt || !state.activeUrl) return;

  const endedAt = now();
  const durationMs = endedAt - state.activeStartedAt;
  if (durationMs < 5000) return;

  await addActivityEvent(
    {
      title: state.activeTitle || "",
      url: settings.privacyMode === "titles" ? "" : state.activeUrl,
      domain: domainFromUrl(state.activeUrl),
      startedAt: state.activeStartedAt,
      endedAt,
      durationMs
    },
    settings
  );
  await setState({ activeStartedAt: endedAt });
}

async function tickNudge() {
  const settings = await getSettings();
  const state = await getState();
  await closeActiveEvent();
  const activity = await getActivity();

  const candidate = selectNudgeCandidate(settings, state, activity);
  if (!candidate) return;

  let text = fallbackNudge(candidate, settings);
  if (settings.aiNudges && settings.apiKey) {
    try {
      text = await callGemini({
        apiKey: settings.apiKey,
        model: settings.model,
        text: buildNudgePrompt(candidate, settings, state, activity),
        temperature: 0.85,
        maxOutputTokens: 80
      });
    } catch (error) {
      console.warn("Piko Gemini nudge failed, using fallback", error);
    }
  }

  await setState({ lastNudgeAt: now(), lastNudgeReason: candidate.reason });
  await broadcastNudge({ text, reason: candidate.reason });
}

async function broadcastNudge(nudge) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url?.startsWith("http")) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "PIKO_NUDGE", nudge });
  } catch {
    await chrome.scripting?.executeScript?.({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    });
  }
}

async function handleMessage(message) {
  if (!message || !message.type) return { ok: false, error: "Unknown message" };

  if (message.type === "PIKO_GET_DASHBOARD") {
    const [settings, state, activity, chatStore] = await Promise.all([
      getSettings(),
      getState(),
      getActivity(),
      chrome.storage.local.get(["chat"])
    ]);
    return { ok: true, settings: redactSettings(settings), state, activity, chat: chatStore.chat || [] };
  }

  if (message.type === "PIKO_SET_GOAL") {
    const goal = `${message.goal || ""}`.trim();
    const settings = await setSettings({ currentGoal: goal, goalUpdatedAt: goal ? now() : 0 });
    return { ok: true, settings: redactSettings(settings) };
  }

  if (message.type === "PIKO_SAVE_SETTINGS") {
    const patch = { ...(message.patch || {}) };
    if (typeof patch.apiKey === "string") patch.apiKey = patch.apiKey.trim();
    const settings = await setSettings(patch);
    return { ok: true, settings: redactSettings(settings) };
  }

  if (message.type === "PIKO_QUIET") {
    const minutes = Number(message.minutes || 60);
    const settings = await setSettings({ quietUntil: now() + minutes * 60 * 1000 });
    return { ok: true, settings: redactSettings(settings) };
  }

  if (message.type === "PIKO_WAKE") {
    const settings = await setSettings({ quietUntil: 0 });
    return { ok: true, settings: redactSettings(settings) };
  }

  if (message.type === "PIKO_CLEAR_ACTIVITY") {
    await setActivity([], 1);
    await chrome.storage.local.set({ chat: [] });
    return { ok: true };
  }

  if (message.type === "PIKO_IMPORT_HISTORY") {
    return importHistory(Number(message.hours || 6));
  }

  if (message.type === "PIKO_CHAT") {
    return chat(message.text);
  }

  return { ok: false, error: "Unsupported message" };
}

async function chat(rawText) {
  const text = `${rawText || ""}`.trim();
  if (!text) return { ok: false, error: "Empty message" };

  const settings = await getSettings();
  const command = parseCommand(text);
  if (command) return command;

  const [state, activity, chatStore] = await Promise.all([
    getState(),
    getActivity(),
    chrome.storage.local.get(["chat"])
  ]);

  let reply = "Set a Gemini API key in Piko settings first, then I can chat with context.";
  if (settings.apiKey) {
    reply = await callGemini({
      apiKey: settings.apiKey,
      model: settings.model,
      text: buildChatPrompt(text, settings, state, activity),
      temperature: 0.55,
      maxOutputTokens: 260
    });
  }

  const chatItems = [
    ...(chatStore.chat || []),
    { role: "user", text, at: now() },
    { role: "piko", text: reply, at: now() }
  ].slice(-40);
  await chrome.storage.local.set({ chat: chatItems });
  return { ok: true, reply, chat: chatItems };
}

function parseCommand(text) {
  const lower = text.toLowerCase();
  if (lower.startsWith("/goal ")) {
    const goal = text.slice(6).trim();
    return setSettings({ currentGoal: goal, goalUpdatedAt: goal ? now() : 0 }).then((settings) => ({
      ok: true,
      reply: goal ? `Goal set: ${goal}` : "Goal cleared.",
      settings: redactSettings(settings)
    }));
  }

  if (lower === "/goal") {
    return getSettings().then((settings) => ({
      ok: true,
      reply: settings.currentGoal ? `Current goal: ${settings.currentGoal}` : "No goal set yet. Try /goal finish the report.",
      settings: redactSettings(settings)
    }));
  }

  if (lower === "/pause" || lower === "/sleep") {
    return setSettings({ quietUntil: now() + 60 * 60 * 1000 }).then((settings) => ({
      ok: true,
      reply: "Piko is sleeping for 1 hour.",
      settings: redactSettings(settings)
    }));
  }

  if (lower.startsWith("/sleep ")) {
    const minutesMatch = lower.match(/\/sleep\s+(\d+)/);
    const minutesValue = minutesMatch ? Math.max(5, Math.min(Number(minutesMatch[1]), 480)) : 60;
    return setSettings({ quietUntil: now() + minutesValue * 60 * 1000 }).then((settings) => ({
      ok: true,
      reply: `Piko is sleeping for ${minutesValue} minutes.`,
      settings: redactSettings(settings)
    }));
  }

  if (lower === "/resume" || lower === "/wake") {
    return setSettings({ quietUntil: 0 }).then((settings) => ({
      ok: true,
      reply: "Piko is back.",
      settings: redactSettings(settings)
    }));
  }

  return null;
}

async function importHistory(hours) {
  const allowed = await chrome.permissions.contains({ permissions: ["history"] });
  if (!allowed) return { ok: false, error: "History permission has not been granted." };

  const settings = await getSettings();
  const historyItems = await chrome.history.search({
    text: "",
    startTime: now() - Math.max(1, Math.min(hours, 48)) * 60 * 60 * 1000,
    maxResults: 200
  });

  const existing = await getActivity();
  const imported = historyItems
    .filter((item) => item.url && isDomainAllowed(item.url, settings))
    .map((item) => {
      const endedAt = item.lastVisitTime || now();
      return {
        title: item.title || domainFromUrl(item.url),
        url: settings.privacyMode === "titles" ? "" : item.url,
        domain: domainFromUrl(item.url),
        startedAt: endedAt - 30000,
        endedAt,
        durationMs: 30000,
        imported: true
      };
    });

  await setActivity([...existing, ...imported], settings.keepDays);
  return { ok: true, imported: imported.length };
}

function redactSettings(settings) {
  return {
    ...settings,
    apiKey: settings.apiKey ? "saved" : ""
  };
}
