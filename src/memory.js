export const DEFAULT_MEMORY = {
  profile: {
    name: "",
    notes: "",
    preferences: "",
    tone: "gentle"
  },
  piko: {
    personality: "small, warm, lightly funny, and never guilt-trippy",
    mood: "awake",
    energy: 70,
    trust: 50
  },
  facts: [],
  compacted: "",
  stats: {
    helpful: 0,
    tooMuch: 0,
    dismissed: 0,
    slept: 0,
    goalsDone: 0
  },
  updatedAt: 0
};

const MAX_FACTS = 24;
const MAX_FACT_CHARS = 120;

export async function getMemory() {
  const stored = await chrome.storage.local.get(["memory"]);
  const memory = normalizeMemory(stored.memory);
  if (!stored.memory) await chrome.storage.local.set({ memory });
  return memory;
}

export async function setMemory(patch) {
  const current = await getMemory();
  const memory = normalizeMemory({
    ...current,
    ...patch,
    profile: { ...current.profile, ...(patch.profile || {}) },
    piko: { ...current.piko, ...(patch.piko || {}) },
    stats: { ...current.stats, ...(patch.stats || {}) },
    updatedAt: Date.now()
  });
  await chrome.storage.local.set({ memory });
  return memory;
}

export async function updateMemory(mutator) {
  const memory = await getMemory();
  const next = normalizeMemory(mutator(memory) || memory);
  next.updatedAt = Date.now();
  await chrome.storage.local.set({ memory: next });
  return next;
}

export async function rememberFact(text, source = "user") {
  const clean = `${text || ""}`.replace(/\s+/g, " ").trim().slice(0, MAX_FACT_CHARS);
  if (!clean) return getMemory();

  return updateMemory((memory) => {
    const duplicate = memory.facts.some((item) => item.text.toLowerCase() === clean.toLowerCase());
    if (!duplicate) {
      memory.facts.push({ text: clean, source, weight: 1, at: Date.now() });
    }
    return compactMemoryIfNeeded(memory);
  });
}

export function compactMemoryIfNeeded(memory) {
  const normalized = normalizeMemory(memory);
  if (normalized.facts.length <= MAX_FACTS) return normalized;

  const overflow = normalized.facts.splice(0, normalized.facts.length - MAX_FACTS);
  const compactedText = overflow.map((item) => item.text).join("; ");
  normalized.compacted = [normalized.compacted, compactedText]
    .filter(Boolean)
    .join("; ")
    .slice(-900);
  return normalized;
}

export function memorySnapshot(memory) {
  const normalized = normalizeMemory(memory);
  return {
    profile: normalized.profile,
    piko: normalized.piko,
    compacted: normalized.compacted,
    facts: normalized.facts.slice(-10).map((item) => item.text),
    stats: normalized.stats
  };
}

export function moodFromSignals(memory, settings) {
  const normalized = normalizeMemory(memory);
  if (settings.quietUntil && settings.quietUntil > Date.now()) return "sleepy";
  if (normalized.stats.tooMuch > normalized.stats.helpful + 2) return "careful";
  if (normalized.stats.goalsDone > 0 && normalized.stats.goalsDone >= normalized.stats.dismissed) return "proud";
  return normalized.piko.mood || "awake";
}

function normalizeMemory(memory = {}) {
  return {
    ...DEFAULT_MEMORY,
    ...memory,
    profile: { ...DEFAULT_MEMORY.profile, ...(memory.profile || {}) },
    piko: { ...DEFAULT_MEMORY.piko, ...(memory.piko || {}) },
    facts: Array.isArray(memory.facts) ? memory.facts : [],
    stats: { ...DEFAULT_MEMORY.stats, ...(memory.stats || {}) }
  };
}
