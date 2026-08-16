const BEST_URL = "/api/kv/clubbudg:best";
const UNLOCKS_URL = "/api/kv/clubbudg:unlocks";

async function read(url, fallback, fetcher) {
  try {
    const response = await fetcher(url);
    if (!response.ok) return fallback;
    return await response.text();
  } catch {
    return fallback;
  }
}

export async function loadProgress(fetcher = fetch) {
  const [bestText, unlocksText] = await Promise.all([
    read(BEST_URL, "0", fetcher),
    read(UNLOCKS_URL, "[]", fetcher),
  ]);
  const best = Number(bestText);
  let unlocks = [];
  try {
    const parsed = JSON.parse(unlocksText);
    if (Array.isArray(parsed)) unlocks = [...new Set(parsed.filter((item) => typeof item === "string"))];
  } catch {
    // Static or malformed storage starts with no unlocks.
  }
  return { best: Number.isFinite(best) && best >= 0 ? best : 0, unlocks };
}

export async function saveBest(score, currentBest, fetcher = fetch) {
  const next = Math.max(Math.round(score), currentBest);
  if (next <= currentBest) return currentBest;
  try {
    await fetcher(BEST_URL, { method: "PUT", body: String(next) });
  } catch {
    // Keep the result playable when host KV is unavailable.
  }
  return next;
}

export async function saveUnlocks(unlocks, fetcher = fetch) {
  const unique = [...new Set(unlocks)];
  try {
    await fetcher(UNLOCKS_URL, { method: "PUT", body: JSON.stringify(unique) });
  } catch {
    // Keep local session unlocks even without host KV.
  }
  return unique;
}
