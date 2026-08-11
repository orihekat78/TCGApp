import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useLandscapeExperience, type LandscapeExperience } from "../../meta-app/src/hooks/useLandscapeExperience";

type Listener = (event: Event) => void;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function createMediaQuery(initialMatches = false) {
  let matches = initialMatches;
  const listeners = new Set<Listener>();
  return {
    query: {
      get matches() { return matches; },
      addEventListener: vi.fn((_: "change", listener: Listener) => listeners.add(listener)),
      removeEventListener: vi.fn((_: "change", listener: Listener) => listeners.delete(listener)),
    },
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener(new Event("change")));
    },
  };
}

function Harness({ onRender }: { onRender: (experience: LandscapeExperience) => void }) {
  const experience = useLandscapeExperience();
  useEffect(() => { onRender(experience); }, [experience, onRender]);
  return <output data-testid="experience">{`${experience.status}:${experience.requestResult}`}</output>;
}

describe("useLandscapeExperience", () => {
  let container: HTMLDivElement;
  let root: Root;
  let media: ReturnType<typeof createMediaQuery>;
  let orientationListeners: Listener[];
  let requestFullscreen: ReturnType<typeof vi.fn>;
  let lock: ReturnType<typeof vi.fn>;
  let current!: LandscapeExperience;
  let renders: LandscapeExperience[];

  beforeAll(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    media = createMediaQuery(false);
    orientationListeners = [];
    requestFullscreen = vi.fn().mockResolvedValue(undefined);
    lock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("matchMedia", vi.fn(() => media.query));
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(screen, "orientation", {
      configurable: true,
      value: {
        addEventListener: vi.fn((_: "change", listener: Listener) => orientationListeners.push(listener)),
        removeEventListener: vi.fn((_: "change", listener: Listener) => {
          orientationListeners = orientationListeners.filter((candidate) => candidate !== listener);
        }),
        lock,
      },
    });
    renders = [];
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function render() {
    act(() => root.render(<Harness onRender={(experience) => { current = experience; renders.push(experience); }} />));
  }

  it("reports pending before passive detection resolves", () => {
    render();
    expect(renders[0]).toMatchObject({ status: "pending", requestResult: "idle" });
    expect(current.status).toBe("portrait");
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it("updates status from media, resize, and orientation change events", () => {
    render();
    act(() => media.setMatches(true));
    expect(current.status).toBe("landscape");
    act(() => {
      media.setMatches(false);
      window.dispatchEvent(new Event("resize"));
      orientationListeners.forEach((listener) => listener(new Event("change")));
    });
    expect(current.status).toBe("portrait");
  });

  it("requests fullscreen then locks landscape only after a user request", async () => {
    render();
    await act(async () => { await current.requestLandscape(); });
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledWith("landscape");
    expect(current.requestResult).toBe("entered");
  });

  it("falls back to rotate when supported requests are denied", async () => {
    requestFullscreen.mockRejectedValueOnce(new Error("denied"));
    render();
    await act(async () => { await current.requestLandscape(); });
    expect(lock).not.toHaveBeenCalled();
    expect(current.requestResult).toBe("denied");
  });

  it("falls back to rotate when browser APIs are unsupported or orientation lock rejects", async () => {
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: undefined });
    lock.mockRejectedValueOnce(new Error("locked"));
    render();
    await act(async () => { await current.requestLandscape(); });
    expect(lock).toHaveBeenCalledWith("landscape");
    expect(current.requestResult).toBe("rotate");
  });

  it("removes every browser listener on cleanup", () => {
    render();
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    act(() => root.unmount());
    expect(media.query.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(screen.orientation.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("supports legacy media query listeners through mount, rotation, and cleanup", () => {
    let matches = false;
    let listener!: Listener;
    const addListener = vi.fn((next: Listener) => { listener = next; });
    const removeListener = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      get matches() { return matches; },
      addListener,
      removeListener,
    })));

    render();
    expect(current.status).toBe("portrait");
    act(() => {
      matches = true;
      listener(new Event("change"));
    });
    expect(current.status).toBe("landscape");
    act(() => root.unmount());
    expect(removeListener).toHaveBeenCalledWith(listener);
  });

  it("does not update or continue deferred browser requests after unmount", async () => {
    const fullscreen = deferred<void>();
    const orientationLock = deferred<void>();
    requestFullscreen.mockReturnValueOnce(fullscreen.promise).mockResolvedValueOnce(undefined);
    lock.mockReturnValueOnce(orientationLock.promise);
    render();
    const fullscreenRequest = current.requestLandscape();
    act(() => root.unmount());
    await act(async () => { fullscreen.resolve(); await Promise.resolve(); });
    expect(lock).not.toHaveBeenCalled();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    render();
    const lockRequest = current.requestLandscape();
    await act(async () => { await Promise.resolve(); });
    expect(lock).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    await act(async () => { orientationLock.resolve(); await lockRequest; });
    expect(current.requestResult).toBe("idle");
    void fullscreenRequest;
  });

  it("keeps the latest rapid request result", async () => {
    const firstFullscreen = deferred<void>();
    requestFullscreen.mockReturnValueOnce(firstFullscreen.promise).mockResolvedValueOnce(undefined);
    lock.mockRejectedValueOnce(new Error("rotate"));
    render();
    const first = current.requestLandscape();
    const second = current.requestLandscape();
    await act(async () => { await second; });
    expect(current.requestResult).toBe("rotate");
    await act(async () => { firstFullscreen.reject(new Error("denied")); await first; });
    expect(current.requestResult).toBe("rotate");
  });
});
