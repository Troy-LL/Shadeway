import { describe, expect, it, vi } from "vitest";
import { PilotDataMissing, loadPilot } from "./pilot";

describe("loadPilot", () => {
  it("sends a second request after the first manifest fetch fails", async () => {
    let manifestCalls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith("manifest.json")) {
        manifestCalls += 1;
        if (manifestCalls === 1) return { ok: false, status: 503 } as Response;
      }
      throw new PilotDataMissing();
    });
    await expect(loadPilot("/data/bgc/", fetchImpl as typeof fetch)).rejects.toBeInstanceOf(PilotDataMissing);
    expect(manifestCalls).toBe(2);
  });
});
