export const DEFAULT_SETTINGS = {
  enabled: true,
  apiKey: "",
  model: "gemini-2.5-flash",
  currentGoal: "",
  goalUpdatedAt: 0,
  nudgeMode: "balanced",
  aiNudges: true,
  privacyMode: "titles",
  quietUntil: 0,
  lastNudgeAt: 0,
  lastNudgeReason: "",
  allowedDomains: [],
  blockedDomains: [],
  keepDays: 3
};

export const DEFAULT_STATE = {
  activeTabId: null,
  activeStartedAt: 0,
  activeUrl: "",
  activeTitle: "",
  sessionStartedAt: Date.now(),
  lastTickAt: 0,
  nudgeCountToday: 0,
  nudgeDate: new Date().toISOString().slice(0, 10)
};

export const DISTRACTION_HINTS = [
  "youtube.com",
  "reddit.com",
  "x.com",
  "twitter.com",
  "instagram.com",
  "facebook.com",
  "netflix.com",
  "tiktok.com",
  "twitch.tv"
];

export const SENSITIVE_HINTS = [
  "bank",
  "billing",
  "checkout",
  "password",
  "pay",
  "signin",
  "login",
  "account",
  "medical",
  "health",
  "wallet"
];

export function now() {
  return Date.now();
}

export function minutes(ms) {
  return Math.round(ms / 60000);
}

export function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function compactUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.slice(0, 100);
  } catch {
    return "";
  }
}

export function isSensitiveUrl(url, settings = DEFAULT_SETTINGS) {
  const lower = `${url || ""}`.toLowerCase();
  const domain = domainFromUrl(url);
  if (!domain) return true;
  if ((settings.blockedDomains || []).some((item) => domain.includes(item.toLowerCase()))) return true;
  return SENSITIVE_HINTS.some((hint) => lower.includes(hint));
}

export function isDomainAllowed(url, settings = DEFAULT_SETTINGS) {
  const domain = domainFromUrl(url);
  if (!domain) return false;
  if (isSensitiveUrl(url, settings)) return false;
  const allowed = settings.allowedDomains || [];
  if (!allowed.length) return true;
  return allowed.some((item) => domain.includes(item.toLowerCase()));
}

export async function readStorage(keys) {
  return chrome.storage.local.get(keys);
}

export async function writeStorage(values) {
  return chrome.storage.local.set(values);
}

export async function getSettings() {
  const stored = await readStorage(["settings"]);
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

export async function setSettings(patch) {
  const settings = { ...(await getSettings()), ...patch };
  await writeStorage({ settings });
  return settings;
}

export async function getState() {
  const stored = await readStorage(["state"]);
  return { ...DEFAULT_STATE, ...(stored.state || {}) };
}

export async function setState(patch) {
  const state = { ...(await getState()), ...patch };
  await writeStorage({ state });
  return state;
}

export async function getActivity() {
  const stored = await readStorage(["activity"]);
  return Array.isArray(stored.activity) ? stored.activity : [];
}

export async function setActivity(activity, keepDays = 3) {
  const cutoff = now() - keepDays * 24 * 60 * 60 * 1000;
  const trimmed = activity
    .filter((item) => item.endedAt >= cutoff)
    .slice(-500);
  await writeStorage({ activity: trimmed });
  return trimmed;
}

export async function addActivityEvent(event, settings) {
  const activity = await getActivity();
  activity.push(event);
  return setActivity(activity, settings.keepDays);
}

export function summarizeActivity(activity, spanMinutes = 45) {
  const cutoff = now() - spanMinutes * 60 * 1000;
  const recent = activity.filter((item) => item.endedAt >= cutoff);
  const totals = new Map();
  let switches = Math.max(0, recent.length - 1);
  let totalMs = 0;

  for (const item of recent) {
    totalMs += item.durationMs || 0;
    const domain = item.domain || "unknown";
    totals.set(domain, (totals.get(domain) || 0) + (item.durationMs || 0));
  }

  const topDomains = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, durationMs]) => ({ domain, minutes: minutes(durationMs) }));

  const distractingMinutes = topDomains
    .filter((item) => DISTRACTION_HINTS.some((hint) => item.domain.includes(hint)))
    .reduce((sum, item) => sum + item.minutes, 0);

  return {
    recent,
    topDomains,
    switches,
    totalMinutes: minutes(totalMs),
    distractingMinutes
  };
}

export function selectNudgeCandidate(settings, state, activity) {
  const time = now();
  if (!settings.enabled) return null;
  if (settings.quietUntil && settings.quietUntil > time) return null;
  if (!settings.currentGoal.trim()) return null;

  const minGap = settings.nudgeMode === "gentle" ? 45 : settings.nudgeMode === "active" ? 12 : 25;
  const jitter = Math.floor(Math.random() * 9);
  if (state.lastNudgeAt && time - state.lastNudgeAt < (minGap + jitter) * 60 * 1000) return null;

  const summary = summarizeActivity(activity, 50);
  const currentDomain = domainFromUrl(state.activeUrl);
  const goalAgeMinutes = settings.goalUpdatedAt ? minutes(time - settings.goalUpdatedAt) : 0;

  if (summary.switches >= 10 && summary.totalMinutes >= 15) {
    return {
      reason: "tab-switching",
      prompt: "The user is switching tabs a lot while a goal is active. Give one short friendly nudge."
    };
  }

  if (summary.distractingMinutes >= 8) {
    return {
      reason: "distraction-loop",
      prompt: "The user spent notable time on likely distraction sites while a goal is active. Give one short non-judgmental nudge."
    };
  }

  if (goalAgeMinutes >= 35 && summary.totalMinutes >= 20) {
    return {
      reason: "goal-check",
      prompt: "The user's goal has been active for a while. Ask whether they want a small next step."
    };
  }

  if (currentDomain && DISTRACTION_HINTS.some((hint) => currentDomain.includes(hint))) {
    return {
      reason: "current-distraction",
      prompt: "The active tab looks distracting. Give a gentle check-in with an easy dismissal."
    };
  }

  return null;
}

export function buildContext(settings, state, activity) {
  const summary = summarizeActivity(activity, 50);
  const lastItems = summary.recent.slice(-8).map((item) => ({
    title: item.title,
    domain: item.domain,
    minutes: minutes(item.durationMs),
    at: new Date(item.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }));

  return {
    goal: settings.currentGoal || "No goal set",
    current: {
      title: state.activeTitle || "",
      domain: domainFromUrl(state.activeUrl),
      url: settings.privacyMode === "titles" ? compactUrl(state.activeUrl) : ""
    },
    summary: {
      totalMinutes: summary.totalMinutes,
      switches: summary.switches,
      topDomains: summary.topDomains,
      likelyDistractingMinutes: summary.distractingMinutes
    },
    recentActivity: lastItems
  };
}

export function fallbackNudge(candidate, settings) {
  const options = {
    "tab-switching": [
      "You are bouncing a bit. Want one tiny next step?",
      "This tab pile is getting busy. Want me to make it simpler?"
    ],
    "distraction-loop": [
      "Tiny check: break, research, or avoidance?",
      "We drifted a little. Want to return to the goal?"
    ],
    "goal-check": [
      "Still on this goal? I can turn it into a small next move.",
      "Want a quick reset around the goal?"
    ],
    "current-distraction": [
      "This looks like a detour. Stay here or head back?",
      "Piko check: is this helping the goal?"
    ]
  };
  const list = options[candidate?.reason] || options["goal-check"];
  return list[Math.floor(Math.random() * list.length)].replace("the goal", settings.currentGoal || "the goal");
}

export async function callGemini({ apiKey, model, text, temperature = 0.7, maxOutputTokens = 160 }) {
  if (!apiKey) throw new Error("Missing Gemini API key");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text }]
        }
      ],
      generationConfig: {
        temperature,
        maxOutputTokens
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText.slice(0, 160)}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const result = parts.map((part) => part.text || "").join("").trim();
  if (!result) throw new Error("Gemini returned no text");
  return result;
}

export function buildNudgePrompt(candidate, settings, state, activity) {
  const context = buildContext(settings, state, activity);
  return [
    "You are Piko, a tiny browser focus companion.",
    "Write exactly one gentle nudge under 24 words.",
    "Do not guilt the user. Do not mention private surveillance. Be cute, useful, and easy to dismiss.",
    `Goal: ${context.goal}`,
    `Current tab: ${context.current.title} on ${context.current.domain}`,
    `Recent summary: ${JSON.stringify(context.summary)}`,
    `Trigger: ${candidate.reason}`,
    candidate.prompt
  ].join("\n");
}

export function buildChatPrompt(message, settings, state, activity) {
  const context = buildContext(settings, state, activity);
  return [
    "You are Piko, a tiny AI focus companion inside a browser extension.",
    "Answer briefly and practically. Use the user's browser context only to help them refocus.",
    "Supported commands are /goal, /goal text, /sleep, /sleep minutes, and /wake.",
    "If they ask for a plan, give 1-3 next actions.",
    "Avoid guilt, diagnosis, or pretending to know more than the browser activity shows.",
    `Context: ${JSON.stringify(context)}`,
    `User message: ${message}`
  ].join("\n");
}
