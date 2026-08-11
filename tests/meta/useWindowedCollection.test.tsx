import { act, useLayoutEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindowedCollection } from "../../meta-app/src/hooks/useWindowedCollection";

interface Item { key: string; height: number }

const items: Item[] = Array.from({ length: 180 }, (_, index) => ({
  key: `card-${index}`,
  height: index % 3 === 0 ? 36 : 20,
}));

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this);
  }
}

function Harness({
  layoutKey = "grid",
  selectedKey,
  focusedKey,
  onReady,
}: {
  layoutKey?: string;
  selectedKey?: string;
  focusedKey?: string;
  onReady?: (api: ReturnType<typeof useWindowedCollection<Item>>) => void;
}) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const api = useWindowedCollection({
    items,
    getKey: (item) => item.key,
    scrollElement,
    layoutKey,
    selectedKey,
    focusedKey,
  });

  onReady?.(api);
  return (
    <div ref={setScrollElement} data-testid="scroller">
      <output data-testid="range">{`${api.start}:${api.end}:${api.beforePx}:${api.afterPx}`}</output>
      {api.visibleItems.map((item, offset) => {
        const index = api.start + offset;
        return <MeasuredItem key={item.key} item={item} index={index} registerItem={api.registerItem} />;
      })}
    </div>
  );
}

function MeasuredItem({
  item,
  index,
  registerItem,
}: {
  item: Item;
  index: number;
  registerItem: ReturnType<typeof useWindowedCollection<Item>>["registerItem"];
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    const node = ref.current!;
    Object.defineProperties(node, {
      offsetTop: { configurable: true, value: Math.floor(index / 3) * 40 },
      offsetHeight: { configurable: true, value: item.height },
    });
    const register = registerItem(index);
    register(node);
    return () => register(null);
  }, [index, item.height, registerItem]);
  return <button ref={ref} data-testid={item.key} type="button">{item.key}</button>;
}

describe("useWindowedCollection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  beforeEach(() => {
    ResizeObserverStub.instances = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("starts with the first 48 items", () => {
    act(() => root.render(<Harness />));

    expect(container.querySelector("[data-testid=range]")?.textContent?.split(":").slice(0, 2))
      .toEqual(["0", "48"]);
    expect(container.querySelectorAll("button")).toHaveLength(48);
  });

  it("replaces the initial chunk with no more than two chunks after a distant scroll", () => {
    act(() => root.render(<Harness />));
    const first = container.querySelector("[data-testid='card-0']")!;
    const scroller = container.querySelector<HTMLElement>("[data-testid=scroller]")!;

    act(() => {
      Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 20_000, writable: true });
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(container.querySelectorAll("button").length).toBeLessThanOrEqual(96);
    expect(first.isConnected).toBe(false);
  });

  it("refreshes variable row measurements from ResizeObserver entries", () => {
    act(() => root.render(<Harness />));
    const scroller = container.querySelector<HTMLElement>("[data-testid=scroller]")!;
    act(() => {
      Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 20_000, writable: true });
      scroller.dispatchEvent(new Event("scroll"));
    });

    const [, , beforePx] = container.querySelector("[data-testid=range]")!
      .textContent!.split(":").map(Number);
    expect(beforePx).toBeGreaterThan(0);

    const resized = container.querySelector<HTMLElement>("[data-testid='card-84']")!;
    Object.defineProperty(resized, "offsetHeight", { configurable: true, value: 96 });
    act(() => ResizeObserverStub.instances[0]!.callback([
      { target: resized } as ResizeObserverEntry,
    ], ResizeObserverStub.instances[0] as unknown as ResizeObserver));

    const [, , beforeAfterResize] = container.querySelector("[data-testid=range]")!
      .textContent!.split(":").map(Number);
    expect(beforeAfterResize).toBeGreaterThan(beforePx);
  });

  it("resets to the initial chunk when the layout key changes", () => {
    act(() => root.render(<Harness layoutKey="grid" />));
    const scroller = container.querySelector<HTMLElement>("[data-testid=scroller]")!;
    act(() => {
      Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 20_000, writable: true });
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(container.querySelector("[data-testid=range]")?.textContent).not.toMatch(/^0:48:/);

    act(() => root.render(<Harness layoutKey="list" />));
    expect(container.querySelector("[data-testid=range]")?.textContent).toMatch(/^0:48:/);
  });

  it("keeps selected and focused keys mounted when they fit one bounded window", () => {
    act(() => root.render(<Harness selectedKey="card-80" focusedKey="card-131" />));

    expect(container.querySelector("[data-testid='card-80']")).not.toBeNull();
    expect(container.querySelector("[data-testid='card-131']")).not.toBeNull();
    expect(container.querySelectorAll("button").length).toBeLessThanOrEqual(96);
  });

  it("prioritizes the focused key when selected and focused keys cannot share the cap", () => {
    act(() => root.render(<Harness selectedKey="card-0" focusedKey="card-150" />));

    expect(container.querySelector("[data-testid='card-150']")).not.toBeNull();
    expect(container.querySelector("[data-testid='card-0']")).toBeNull();
    expect(container.querySelectorAll("button").length).toBeLessThanOrEqual(96);
  });

  it("reveals and focuses a requested key", () => {
    let reveal!: ReturnType<typeof useWindowedCollection<Item>>["reveal"];
    act(() => root.render(<Harness onReady={(api) => { reveal = api.reveal; }} />));

    act(() => reveal("card-150", { focus: true }));

    const target = container.querySelector<HTMLButtonElement>("[data-testid='card-150']");
    expect(target).not.toBeNull();
    expect(document.activeElement).toBe(target);
  });

  it("disconnects its ResizeObserver when unmounted", () => {
    act(() => root.render(<Harness />));
    const observer = ResizeObserverStub.instances[0]!;

    act(() => root.unmount());

    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it("releases observed nodes while traversing bounded windows", () => {
    act(() => root.render(<Harness />));
    const observer = ResizeObserverStub.instances[0]!;
    const scroller = container.querySelector<HTMLElement>("[data-testid=scroller]")!;
    for (const scrollTop of [20_000, 0, 20_000]) {
      act(() => {
        Object.defineProperty(scroller, "scrollTop", { configurable: true, value: scrollTop, writable: true });
        scroller.dispatchEvent(new Event("scroll"));
      });
      expect(container.querySelectorAll("button").length).toBeLessThanOrEqual(96);
    }
    expect(observer.unobserve).toHaveBeenCalled();
  });
});
