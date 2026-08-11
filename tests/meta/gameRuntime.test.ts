import { describe, expect, it, vi } from "vitest";
import { createGameRuntime } from "../../meta-app/src/services/gameRuntime";

describe("game runtime ownership", () => {
  it("shares one card registration across concurrent callers", async () => {
    const registerAll = vi.fn();
    const endMatchSession = vi.fn();
    const load = vi.fn(async () => ({ registerAll, endMatchSession }));
    const runtime = createGameRuntime(load);

    await Promise.all([
      runtime.ensureReady(),
      runtime.ensureReady(),
      runtime.ensureReady(),
    ]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(registerAll).toHaveBeenCalledTimes(1);
    runtime.endMatchSession({ preserveGameState: true });
    expect(endMatchSession).toHaveBeenCalledWith({ preserveGameState: true });
  });

  it("retries after a failed load without duplicating a successful registration", async () => {
    const registerAll = vi.fn();
    const endMatchSession = vi.fn();
    const load = vi
      .fn<() => Promise<{ registerAll(): void; endMatchSession(): void }>>()
      .mockRejectedValueOnce(new Error("chunk unavailable"))
      .mockResolvedValue({ registerAll, endMatchSession });
    const runtime = createGameRuntime(load);

    runtime.endMatchSession();
    expect(endMatchSession).not.toHaveBeenCalled();

    await expect(runtime.ensureReady()).rejects.toThrow("chunk unavailable");
    runtime.endMatchSession();
    expect(endMatchSession).not.toHaveBeenCalled();

    await Promise.all([runtime.ensureReady(), runtime.ensureReady()]);

    expect(load).toHaveBeenCalledTimes(2);
    expect(registerAll).toHaveBeenCalledTimes(1);
    runtime.endMatchSession();
    expect(endMatchSession).toHaveBeenCalledTimes(1);
  });
});
