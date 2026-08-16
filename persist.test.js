import { describe, expect, it, vi } from "vitest";
import { loadProgress, saveBest, saveUnlocks } from "./persist.js";

describe("clubbudg persistence", () => {
  it("loads best score and unlocked badges from the required KV keys", async () => {
    const fetcher = vi.fn(async (url) => ({
      ok: true,
      text: async () => (url.endsWith(":best") ? "82" : '["safe","popular"]'),
    }));
    await expect(loadProgress(fetcher)).resolves.toEqual({ best: 82, unlocks: ["safe", "popular"] });
    expect(fetcher).toHaveBeenCalledWith("/api/kv/clubbudg:best");
    expect(fetcher).toHaveBeenCalledWith("/api/kv/clubbudg:unlocks");
  });

  it("writes only improved scores and unique unlocks", async () => {
    const fetcher = vi.fn(async () => ({ ok: true }));
    await expect(saveBest(70, 80, fetcher)).resolves.toBe(80);
    await expect(saveBest(91, 80, fetcher)).resolves.toBe(91);
    await expect(saveUnlocks(["safe", "safe"], fetcher)).resolves.toEqual(["safe"]);
    expect(fetcher).toHaveBeenCalledWith("/api/kv/clubbudg:best", { method: "PUT", body: "91" });
    expect(fetcher).toHaveBeenCalledWith("/api/kv/clubbudg:unlocks", {
      method: "PUT",
      body: '["safe"]',
    });
  });
});
