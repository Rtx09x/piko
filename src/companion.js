import { DISTRACTION_HINTS, domainFromUrl, minutes, summarizeActivity } from "./core.js";
import { memorySnapshot, moodFromSignals } from "./memory.js";

export function buildCompanionContext(settings, state, activity, memory, goals = null) {
  const summary = summarizeActivity(activity, 60);
  const currentDomain = domainFromUrl(state.activeUrl);
  return {
    goal: goals?.primary?.title || settings.currentGoal || "",
    goals: goals?.active || [],
    tone: memory.profile.tone || "gentle",
    user: {
      name: memory.profile.name || "",
      notes: memory.profile.notes || "",
      preferences: memory.profile.preferences || ""
    },
    piko: {
      ...memory.piko,
      mood: moodFromSignals(memory, settings)
    },
    memory: memorySnapshot(memory),
    browser: {
      currentTitle: state.activeTitle || "",
      currentDomain,
      currentLooksDistracting: DISTRACTION_HINTS.some((hint) => currentDomain.includes(hint)),
      activeForMinutes: state.activeStartedAt ? minutes(Date.now() - state.activeStartedAt) : 0,
      summary
    }
  };
}

export function shouldAskForMemory(message) {
  const lower = `${message || ""}`.toLowerCase();
  return lower.startsWith("/remember ") || lower.includes("remember that ");
}

export function extractMemoryText(message) {
  const text = `${message || ""}`.trim();
  if (text.toLowerCase().startsWith("/remember ")) return text.slice(10).trim();
  const marker = text.toLowerCase().indexOf("remember that ");
  if (marker >= 0) return text.slice(marker + "remember that ".length).trim();
  return "";
}

export function buildCompanionPrompt(message, context) {
  return [
    "You are Piko, a tiny persistent browser companion.",
    "Be concise, warm, and useful. Never guilt the user.",
    "You may answer quick questions, think through an idea, suggest a next step, or help the user return to their goal.",
    "If the user asks for web search, say you can open a search tab for them. Do not pretend you searched unless tool context says so.",
    "Use memory and preferences lightly. Do not over-explain the memory.",
    "Keep responses under 90 words unless the user explicitly asks for more.",
    `Companion context: ${JSON.stringify(context)}`,
    `User message: ${message}`
  ].join("\n");
}

export function buildCompanionNudgePrompt(candidate, context) {
  return [
    "You are Piko, a tiny persistent browser companion.",
    "Decide if this nudge should be spoken. If yes, write one gentle message under 28 words.",
    "If the user appears to be researching productively, be quiet unless the current tab is clearly a drift.",
    "Do not guilt the user. Sound small, alive, and helpful.",
    `Candidate: ${JSON.stringify(candidate)}`,
    `Context: ${JSON.stringify(context)}`
  ].join("\n");
}

export function localToolReply(message) {
  const text = `${message || ""}`.trim();
  const lower = text.toLowerCase();

  if (lower.startsWith("/think ")) {
    return { handled: false, cleaned: text.slice(7).trim() };
  }

  if (lower.startsWith("/idea")) {
    return { handled: false, cleaned: text.replace(/^\/idea\s*/i, "Give me one small useful idea about ") || "Give me one small useful idea." };
  }

  if (lower.startsWith("/search ")) {
    return {
      handled: true,
      tool: "search",
      query: text.slice(8).trim()
    };
  }

  if (lower.startsWith("search for ")) {
    return {
      handled: true,
      tool: "search",
      query: text.slice(11).trim()
    };
  }

  if (lower.startsWith("websearch ") || lower.startsWith("web search ")) {
    return {
      handled: true,
      tool: "search",
      query: text.replace(/^web\s?search\s+/i, "").trim()
    };
  }

  return { handled: false, cleaned: text };
}
