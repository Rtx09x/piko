import { minutes, summarizeActivity } from "./core.js";

const goalInput = document.querySelector("#goalInput");
const saveGoal = document.querySelector("#saveGoal");
const goalMeta = document.querySelector("#goalMeta");
const focusMinutes = document.querySelector("#focusMinutes");
const switchCount = document.querySelector("#switchCount");
const topDomain = document.querySelector("#topDomain");
const sleepTitle = document.querySelector("#sleepTitle");
const sleepMeta = document.querySelector("#sleepMeta");
const chatLog = document.querySelector("#chatLog");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const apiStatus = document.querySelector("#apiStatus");
const sleep20 = document.querySelector("#sleep20");
const sleep60 = document.querySelector("#sleep60");
const wakeButton = document.querySelector("#wakeButton");
const clearData = document.querySelector("#clearData");
const openOptions = document.querySelector("#openOptions");

let dashboard = null;

saveGoal.addEventListener("click", async () => {
  await send({ type: "PIKO_SET_GOAL", goal: goalInput.value });
  await refresh();
});

goalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveGoal.click();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";
  appendMessage("user", text);
  appendMessage("piko", "Thinking...");
  const response = await send({ type: "PIKO_CHAT", text });
  await refresh();
  if (!response.ok) appendMessage("piko", response.error || "Something failed.");
});

sleep20.addEventListener("click", () => sleepFor(20));
sleep60.addEventListener("click", () => sleepFor(60));
wakeButton.addEventListener("click", async () => {
  await send({ type: "PIKO_WAKE" });
  await refresh();
});

clearData.addEventListener("click", async () => {
  await send({ type: "PIKO_CLEAR_ACTIVITY" });
  await refresh();
});

openOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refresh();

async function refresh() {
  dashboard = await send({ type: "PIKO_GET_DASHBOARD" });
  if (!dashboard.ok) return;
  render(dashboard);
}

function render(data) {
  const { settings, activity, chat } = data;
  const summary = summarizeActivity(activity, 50);
  goalInput.value = settings.currentGoal || "";
  goalMeta.textContent = settings.currentGoal
    ? `Active for ${settings.goalUpdatedAt ? minutes(Date.now() - settings.goalUpdatedAt) : 0} min. Commands: /goal, /sleep, /wake.`
    : "No goal set. Piko only nudges after you set one.";
  focusMinutes.textContent = `${summary.totalMinutes} min`;
  switchCount.textContent = summary.switches;
  topDomain.textContent = summary.topDomains[0]?.domain || "none";
  apiStatus.textContent = settings.apiKey ? `${settings.model} connected` : "Gemini key not set";
  renderSleep(settings);
  renderChat(chat);
}

async function sleepFor(minutesValue) {
  await send({ type: "PIKO_QUIET", minutes: minutesValue });
  await refresh();
}

function renderSleep(settings) {
  const quietUntil = Number(settings.quietUntil || 0);
  const remaining = quietUntil - Date.now();
  if (remaining > 0) {
    sleepTitle.textContent = "Piko is sleeping";
    sleepMeta.textContent = `Wakes in ${Math.max(1, minutes(remaining))} min. Chat still works.`;
    wakeButton.disabled = false;
    return;
  }

  sleepTitle.textContent = "Piko is awake";
  sleepMeta.textContent = "Nudges are allowed when they look useful.";
  wakeButton.disabled = true;
}

function renderChat(chat) {
  chatLog.innerHTML = "";
  if (!chat.length) {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.textContent = "Ask Piko for a reset, or set a goal with /goal.";
    chatLog.appendChild(empty);
    return;
  }
  for (const item of chat.slice(-12)) {
    appendMessage(item.role === "user" ? "user" : "piko", item.text);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function appendMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  chatLog.appendChild(message);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function send(message) {
  return chrome.runtime.sendMessage(message);
}
