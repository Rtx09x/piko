import {
  buildCompanionContext,
  buildCompanionNudgePrompt,
  buildCompanionPrompt,
  extractMemoryText,
  localToolReply,
  shouldAskForMemory
} from "./companion.js";
import {
  getMemory,
  rememberFact,
  setMemory,
  updateMemory
} from "./memory.js";
import {
  addGoal,
  completeGoal,
  dropGoal,
  focusGoal,
  getGoals,
  goalsContext,
  goalsSummary
} from "./goals.js";
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
  const stored = await chrome.storage.local.get(["settings", "state", "activity", "chat", "memory", "goals"]);
  if (!stored.settings) await writeStorage({ settings: DEFAULT_SETTINGS });
  if (!stored.state) await writeStorage({ state: DEFAULT_STATE });
  if (!stored.activity) await writeStorage({ activity: [] });
  if (!stored.chat) await writeStorage({ chat: [] });
  if (!stored.memory) await getMemory();
  if (!stored.goals) await getGoals(stored.settings || DEFAULT_SETTINGS);
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
  const memory = await getMemory();
  const goals = await getGoals(settings);
  const goalContext = goalsContext(goals);

  const candidate = selectNudgeCandidate(settings, state, activity, goalContext);
  if (!candidate) return;

  let text = fallbackNudge(candidate, settings);
  if (settings.aiNudges && settings.apiKey) {
    try {
      const companionContext = buildCompanionContext(settings, state, activity, memory, goalContext);
      text = await callGemini({
        apiKey: settings.apiKey,
        model: settings.model,
        text: settings.companionMode
          ? buildCompanionNudgePrompt(candidate, companionContext)
          : buildNudgePrompt(candidate, settings, state, activity, memory, goalContext),
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
    const [settings, state, activity, chatStore, memory] = await Promise.all([
      getSettings(),
      getState(),
      getActivity(),
      chrome.storage.local.get(["chat"]),
      getMemory()
    ]);
    const goals = await getGoals(settings);
    return { ok: true, settings: redactSettings(settings), state, activity, chat: chatStore.chat || [], memory, goals };
  }

  if (message.type === "PIKO_SET_GOAL") {
    const goal = `${message.goal || ""}`.trim();
    if (!goal) return { ok: false, error: "Goal is empty" };
    const result = await addGoal(goal);
    if (!result.ok) return { ok: false, error: "All 3 active goal slots are full.", goals: result.goals };
    const primary = goalsContext(result.goals).primary;
    const settings = await setSettings({ currentGoal: primary?.title || goal, goalUpdatedAt: now() });
    return { ok: true, settings: redactSettings(settings), goals: result.goals };
  }

  if (message.type === "PIKO_SAVE_SETTINGS") {
    const patch = { ...(message.patch || {}) };
    if (typeof patch.apiKey === "string") patch.apiKey = patch.apiKey.trim();
    const settings = await setSettings(patch);
    return { ok: true, settings: redactSettings(settings) };
  }

  if (message.type === "PIKO_SAVE_MEMORY") {
    const memory = await setMemory(message.patch || {});
    return { ok: true, memory };
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

  if (message.type === "PIKO_FEEDBACK") {
    const memory = await recordFeedback(message.feedback);
    return { ok: true, memory };
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
  const command = await parseCommand(text);
  if (command) return persistChatTurn(text, command.reply, command.extra || {});

  if (shouldAskForMemory(text)) {
    const memoryText = extractMemoryText(text);
    await rememberFact(memoryText, "user");
    return persistChatTurn(text, memoryText ? `I will remember: ${memoryText}` : "Tell me what to remember after /remember.");
  }

  const toolIntent = localToolReply(text);
  if (toolIntent.handled && toolIntent.tool === "search") {
    const query = toolIntent.query;
    if (query) await chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
    return persistChatTurn(text, query ? `I opened a search for: ${query}` : "Tell me what to search after /search.");
  }

  const [state, activity, memory, goals] = await Promise.all([
    getState(),
    getActivity(),
    getMemory(),
    getGoals(settings)
  ]);

  let reply = "Set a Gemini API key in Piko settings first, then I can chat with context.";
  if (settings.apiKey) {
    const goalContext = goalsContext(goals);
    const companionContext = buildCompanionContext(settings, state, activity, memory, goalContext);
    reply = await callGemini({
      apiKey: settings.apiKey,
      model: settings.model,
      text: settings.companionMode
        ? buildCompanionPrompt(toolIntent.cleaned || text, companionContext)
        : buildChatPrompt(text, settings, state, activity, memory, goalContext),
      temperature: 0.55,
      maxOutputTokens: 260
    });
  }

  return persistChatTurn(text, reply);
}

async function persistChatTurn(text, reply, extra = {}) {
  const chatStore = await chrome.storage.local.get(["chat"]);
  const chatItems = [
    ...(chatStore.chat || []),
    { role: "user", text, at: now() },
    { role: "piko", text: reply, at: now() }
  ].slice(-40);
  await chrome.storage.local.set({ chat: chatItems });
  return { ok: true, reply, chat: chatItems, ...extra };
}

async function parseCommand(text) {
  const lower = text.toLowerCase();
  if (lower.startsWith("/goal ")) {
    const goal = text.slice(6).trim();
    if (!goal) return { ok: true, reply: "Tell me the goal after /goal." };
    const result = await addGoal(goal);
    if (!result.ok) {
      return { ok: true, reply: "All 3 active goal slots are full. Use /done 1 or /drop 1 first." };
    }
    const primary = goalsContext(result.goals).primary;
    const settings = await setSettings({ currentGoal: primary?.title || goal, goalUpdatedAt: now() });
    return {
      ok: true,
      reply: `Added goal ${result.goals.find((item) => item.title === goal)?.slot || ""}: ${goal}`,
      settings: redactSettings(settings)
    };
  }

  if (lower === "/goal") {
    const settings = await getSettings();
    const goals = await getGoals(settings);
    return {
      ok: true,
      reply: goalsSummary(goals),
      settings: redactSettings(settings)
    };
  }

  if (lower === "/goals") {
    const goals = await getGoals(await getSettings());
    return { ok: true, reply: goalsSummary(goals) };
  }

  if (lower.startsWith("/focus ")) {
    const result = await focusGoal(text.slice(7).trim());
    if (!result.ok) return { ok: true, reply: "I could not find that active goal." };
    await setSettings({ currentGoal: result.goal.title, goalUpdatedAt: now() });
    return { ok: true, reply: `Focused goal ${result.goal.slot}: ${result.goal.title}` };
  }

  if (lower === "/done" || lower.startsWith("/done ")) {
    const slot = lower.startsWith("/done ") ? text.slice(6).trim() : null;
    const result = await completeGoal(slot);
    if (!result.ok) return { ok: true, reply: "I could not find an active goal to complete." };
    const context = goalsContext(result.goals);
    await setSettings({ currentGoal: context.primary?.title || "", goalUpdatedAt: context.primary ? now() : 0 });
    await updateMemory((memory) => {
      memory.stats.goalsDone += 1;
      memory.piko.mood = "proud";
      memory.piko.energy = Math.min(100, memory.piko.energy + 8);
      return memory;
    });
    return { ok: true, reply: `Done: ${result.goal.title}` };
  }

  if (lower.startsWith("/drop ")) {
    const result = await dropGoal(text.slice(6).trim());
    if (!result.ok) return { ok: true, reply: "I could not find that goal." };
    const context = goalsContext(result.goals);
    await setSettings({ currentGoal: context.primary?.title || "", goalUpdatedAt: context.primary ? now() : 0 });
    return { ok: true, reply: `Dropped goal ${result.goal.slot}: ${result.goal.title}` };
  }

  if (lower === "/pause" || lower === "/sleep") {
    const settings = await setSettings({ quietUntil: now() + 60 * 60 * 1000 });
    await recordFeedback("slept");
    return {
      ok: true,
      reply: "Piko is sleeping for 1 hour.",
      settings: redactSettings(settings)
    };
  }

  if (lower.startsWith("/sleep ")) {
    const minutesMatch = lower.match(/\/sleep\s+(\d+)/);
    const minutesValue = minutesMatch ? Math.max(5, Math.min(Number(minutesMatch[1]), 480)) : 60;
    const settings = await setSettings({ quietUntil: now() + minutesValue * 60 * 1000 });
    await recordFeedback("slept");
    return {
      ok: true,
      reply: `Piko is sleeping for ${minutesValue} minutes.`,
      settings: redactSettings(settings)
    };
  }

  if (lower === "/resume" || lower === "/wake") {
    const settings = await setSettings({ quietUntil: 0 });
    return {
      ok: true,
      reply: "Piko is back.",
      settings: redactSettings(settings)
    };
  }

  return null;
}

async function recordFeedback(feedback) {
  const key = ["helpful", "tooMuch", "dismissed", "slept"].includes(feedback) ? feedback : "dismissed";
  return updateMemory((memory) => {
    memory.stats[key] += 1;
    if (key === "helpful") {
      memory.piko.trust = Math.min(100, memory.piko.trust + 2);
      memory.piko.mood = "focused";
    }
    if (key === "tooMuch") {
      memory.piko.trust = Math.max(0, memory.piko.trust - 2);
      memory.piko.mood = "careful";
    }
    if (key === "slept") {
      memory.piko.mood = "sleepy";
    }
    return memory;
  });
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
