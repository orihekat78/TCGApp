import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLazyRoute, lazyScreens } from "../../meta-app/src/router/lazyScreens";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

function render(node: React.ReactNode): void {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(node));
}

describe("lazy route screens", () => {
  it("shows an accessible loading state before the route module resolves", async () => {
    let resolve!: (value: { Screen(): React.ReactNode }) => void;
    const Route = createLazyRoute(() => new Promise((done) => { resolve = done; }), "Screen");

    render(<Route />);

    expect(document.activeElement).toBe(container?.querySelector('[aria-label="画面を読み込み中"]'));
    expect(container?.textContent).toContain("画面を読み込んでいます");

    await act(async () => resolve({ Screen: () => <p>Loaded route</p> }));
    expect(container?.textContent).toContain("Loaded route");
    expect(document.activeElement).toBe(container?.querySelector('[data-testid="lazy-route-content"]'));
  });

  it("focuses an error and retries a failed route load", async () => {
    const load = vi
      .fn<() => Promise<{ Screen(): React.ReactNode }>>()
      .mockRejectedValueOnce(new Error("chunk unavailable"))
      .mockResolvedValue({ Screen: () => <p>Recovered route</p> });
    const Route = createLazyRoute(load, "Screen");

    render(<Route />);
    await act(async () => undefined);

    const alert = container?.querySelector('[role="alert"]');
    expect(document.activeElement).toBe(alert);
    expect(alert?.textContent).toContain("画面を読み込めませんでした");

    await act(async () => {
      (container?.querySelector("button") as HTMLButtonElement).click();
    });

    expect(container?.textContent).toContain("Recovered route");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("prepares the game runtime before importing a dependent route", async () => {
    const order: string[] = [];
    const prepare = vi.fn(async () => { order.push("runtime"); });
    const load = vi.fn(async () => {
      order.push("route");
      return { Screen: () => <p>Prepared route</p> };
    });
    const Route = createLazyRoute(load, "Screen", prepare);

    render(<Route />);
    await act(async () => undefined);

    expect(order).toEqual(["runtime", "route"]);
    expect(container?.textContent).toContain("Prepared route");
  });

  it("keeps HOME eager and maps every other route to a lazy screen", () => {
    expect("home" in lazyScreens).toBe(false);
    expect(Object.keys(lazyScreens).sort()).toEqual([
      "cards", "deck", "history", "match", "replay", "result", "settings", "setup", "tutorial",
    ]);
  });
});
