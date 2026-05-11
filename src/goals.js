export const MAX_ACTIVE_GOALS = 3;
export const MAX_SAVED_GOALS = 12;

export async function getGoals(settings = null) {
  const stored = await chrome.storage.local.get(["goals"]);
  let goals = Array.isArray(stored.goals) ? stored.goals : [];
  if (!goals.length && settings?.currentGoal) {
    goals = [createGoal(settings.currentGoal, 1, true)];
    await setGoals(goals);
  }
  return normalizeGoals(goals);
}

export async function setGoals(goals) {
  const normalized = normalizeGoals(goals);
  await chrome.storage.local.set({ goals: normalized });
  return normalized;
}

export function createGoal(title, slot = 1, primary = false) {
  const time = Date.now();
  return {
    id: `g_${time}_${Math.random().toString(36).slice(2, 7)}`,
    title: `${title || ""}`.trim().slice(0, 140),
    slot,
    status: "active",
    primary,
    createdAt: time,
    updatedAt: time,
    completedAt: 0,
    nudges: 0
  };
}

export async function addGoal(title) {
  const goals = await getGoals();
  const active = activeGoals(goals);
  if (active.length >= MAX_ACTIVE_GOALS) {
    return { ok: false, reason: "full", goals };
  }

  const usedSlots = new Set(active.map((goal) => goal.slot));
  const slot = [1, 2, 3].find((item) => !usedSlots.has(item)) || 1;
  goals.push(createGoal(title, slot, active.length === 0));
  return { ok: true, goals: await setGoals(goals) };
}

export async function focusGoal(slotOrId) {
  const goals = await getGoals();
  const target = findGoal(goals, slotOrId);
  if (!target || target.status !== "active") return { ok: false, goals };

  for (const goal of goals) goal.primary = goal.id === target.id;
  target.updatedAt = Date.now();
  return { ok: true, goal: target, goals: await setGoals(goals) };
}

export async function completeGoal(slotOrId = null) {
  const goals = await getGoals();
  const target = slotOrId ? findGoal(goals, slotOrId) : primaryGoal(goals);
  if (!target || target.status !== "active") return { ok: false, goals };

  target.status = "done";
  target.primary = false;
  target.completedAt = Date.now();
  target.updatedAt = Date.now();

  const next = activeGoals(goals)[0];
  if (next) next.primary = true;
  return { ok: true, goal: target, goals: await setGoals(goals) };
}

export async function dropGoal(slotOrId) {
  const goals = await getGoals();
  const target = findGoal(goals, slotOrId);
  if (!target) return { ok: false, goals };

  target.status = "dropped";
  target.primary = false;
  target.updatedAt = Date.now();
  const next = activeGoals(goals)[0];
  if (next && !activeGoals(goals).some((goal) => goal.primary)) next.primary = true;
  return { ok: true, goal: target, goals: await setGoals(goals) };
}

export function activeGoals(goals) {
  return normalizeGoals(goals)
    .filter((goal) => goal.status === "active")
    .sort((a, b) => a.slot - b.slot);
}

export function primaryGoal(goals) {
  const active = activeGoals(goals);
  return active.find((goal) => goal.primary) || active[0] || null;
}

export function goalsSummary(goals) {
  const active = activeGoals(goals);
  if (!active.length) return "No active goals.";
  return active.map((goal) => `${goal.slot}. ${goal.primary ? "*" : ""}${goal.title}`).join("\n");
}

export function goalsContext(goals) {
  const active = activeGoals(goals);
  return {
    primary: primaryGoal(goals),
    active: active.map((goal) => ({
      slot: goal.slot,
      title: goal.title,
      primary: goal.primary
    }))
  };
}

function normalizeGoals(goals = []) {
  const normalized = goals
    .filter((goal) => goal?.title)
    .map((goal, index) => ({
      id: goal.id || `g_${Date.now()}_${index}`,
      title: `${goal.title}`.trim().slice(0, 140),
      slot: Number(goal.slot || index + 1),
      status: goal.status || "active",
      primary: Boolean(goal.primary),
      createdAt: Number(goal.createdAt || Date.now()),
      updatedAt: Number(goal.updatedAt || Date.now()),
      completedAt: Number(goal.completedAt || 0),
      nudges: Number(goal.nudges || 0)
    }))
    .slice(-MAX_SAVED_GOALS);

  const active = normalized.filter((goal) => goal.status === "active").slice(0, MAX_ACTIVE_GOALS);
  active.forEach((goal, index) => {
    goal.slot = index + 1;
  });
  if (active.length && !active.some((goal) => goal.primary)) active[0].primary = true;
  if (active.filter((goal) => goal.primary).length > 1) {
    let seen = false;
    for (const goal of active) {
      if (goal.primary && !seen) {
        seen = true;
      } else {
        goal.primary = false;
      }
    }
  }
  return normalized;
}

function findGoal(goals, slotOrId) {
  const query = `${slotOrId || ""}`.trim();
  if (!query) return null;
  const slot = Number(query);
  return normalizeGoals(goals).find((goal) => goal.id === query || goal.slot === slot) || null;
}
