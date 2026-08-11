import { act, StrictMode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindowedCollection } from "../../meta-app/src/hooks/useWindowedCollection";

interface Item { key: string; height: number }

const items: Item[] = Array.from({ length: 180 }, (_, index) => ({
  key: `card-${index}`,
  height: index % 3 === 0 ? 36 : 20,
}));
const itemKey = (item: Item) => item.key;

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
  hiddenKeys = [],
  columns = 3,
  rowPitch = 40,
  itemHeight,
  onReady,
}: {
  layoutKey?: string;
  selectedKey?: string;
  focusedKey?: string;
  hiddenKeys?: readonly string[];
  columns?: number;
  rowPitch?: number;
  itemHeight?: number;
  onReady?: (api: ReturnType<typeof useWindowedCollection<Item>>) => void;
}) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const api = useWindowedCollection({
    items,
    getKey: itemKey,
    scrollElement,
    layoutKey,
    selectedKey,
    focusedKey,
  });

  onReady?.(api);
  return (
    <div ref={setScrollElement} data-testid="scroller">
      <output data-testid="range">{`${api.start}:${api.end}:${api.beforePx}:${api.afterPx}`}</output>
      {api.visibleItems.filter((item) => !hiddenKeys.includes(item.key)).map((item, offset) => {
        const index = api.start + offset;
        return <MeasuredItem key={item.key} item={item} index={index} columns={columns} rowPitch={rowPitch} itemHeight={itemHeight} registerItem={api.registerItem} />;
      })}
    </div>
  );
}

function MeasuredItem({
  item,
  index,
  columns,
  rowPitch,
  itemHeight,
  registerItem,
}: {
  item: Item;
  index: number;
  columns: number;
  rowPitch: number;
  itemHeight?: number;
  registerItem: ReturnType<typeof useWindowedCollection<Item>>["registerItem"];
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    const node = ref.current!;
    Object.defineProperties(node, {
      offsetTop: { configurable: true, value: Math.floor(index / columns) * rowPitch },
      offsetHeight: { configurable: true, value: itemHeight ?? item.height },
    });
    const register = registerItem(index);
    register(node);
    return () => register(null);
  }, [columns, index, item.height, itemHeight, registerItem, rowPitch]);
  return <button ref={ref} data-testid={item.key} type="button">{item.key}</button>;
}

function DirectRefHarness({ onRender }: { onRender: () => void }) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const { visibleItems, start, registerItem } = useWindowedCollection({
    items,
    getKey: itemKey,
    scrollElement,
  });
  const refs = useMemo(
    () => visibleItems.map((_, offset) => registerItem(start + offset)),
    [registerItem, start, visibleItems],
  );

  onRender();
  return (
    <div ref={setScrollElement} data-testid="direct-scroller">
      {visibleItems.map((item, offset) => (
        <button key={item.key} ref={refs[offset]} type="button">{item.key}</button>
      ))}
    </div>
  );
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

  it("uses measured grid row pitch for spacers and reveal scroll offsets", () => {
    let api!: ReturnType<typeof useWindowedCollection<Item>>;
    act(() => root.render(<Harness columns={1} rowPitch={254} itemHeight={240} onReady={(next) => { api = next; }} />));
    const scroller = container.querySelector<HTMLElement>("[data-testid=scroller]")!;

    expect(container.querySelector("[data-testid=range]")?.textContent).toBe("0:48:0:33528");
    act(() => api.reveal("card-100"));
    expect(scroller.scrollTop).toBe(25_400);
  });

  it("does not move an already mounted focus target before its click can finish", () => {
    let api!: ReturnType<typeof useWindowedCollection<Item>>;
    act(() => root.render(<Harness onReady={(next) => { api = next; }} />));
    const scroller = container.querySelector<HTMLElement>("[data-testid=scroller]")!;
    Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 40, writable: true });

    act(() => api.reveal("card-20", { preserveViewport: true }));

    expect(scroller.scrollTop).toBe(40);
    expect(container.querySelector("[data-testid=range]")?.textContent?.split(":").slice(0, 2))
      .toEqual(["0", "48"]);
  });

  it("uses measured list row pitch when the gap exceeds item height", () => {
    act(() => root.render(<Harness columns={1} rowPitch={45} itemHeight={42} />));

    expect(container.querySelector("[data-testid=range]")?.textContent).toBe("0:48:0:5940");
  });

  it.each([
    { columns: 5, scrollTop: 400, range: "45:140", beforePx: 360, afterPx: 320, revealOffset: 800 },
    { columns: 7, scrollTop: 280, range: "42:133", beforePx: 240, afterPx: 280, revealOffset: 560 },
  ])("keeps $columns-column partial windows aligned after scrolling", ({ columns, scrollTop, range, beforePx, afterPx, revealOffset }) => {
    let api!: ReturnType<typeof useWindowedCollection<Item>>;
    act(() => root.render(
      <Harness columns={columns} rowPitch={40} itemHeight={36} onReady={(next) => { api = next; }} />,
    ));
    const scroller = container.querySelector<HTMLElement>("[data-testid=scroller]")!;

    act(() => {
      scroller.scrollTop = scrollTop;
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(container.querySelector("[data-testid=range]")?.textContent)
      .toBe(`${range}:${beforePx}:${afterPx}`);
    act(() => api.reveal("card-100"));
    expect(scroller.scrollTop).toBe(revealOffset);
  });

  it("keeps 7-column windows and spacers aligned to complete rows", () => {
    act(() => root.render(<Harness columns={7} rowPitch={40} itemHeight={36} />));
    const scroller = container.querySelector<HTMLElement>("[data-testid=scroller]")!;

    act(() => {
      scroller.scrollTop = 280;
      scroller.dispatchEvent(new Event("scroll"));
    });

    const [start, end, beforePx, afterPx] = container.querySelector("[data-testid=range]")!
      .textContent!.split(":").map(Number);
    expect(start % 7).toBe(0);
    expect(end % 7).toBe(0);
    expect(end - start).toBeLessThanOrEqual(96);
    expect(beforePx).toBe(Math.floor(start / 7) * 40);
    expect(afterPx).toBe((Math.ceil(items.length / 7) - Math.ceil(end / 7)) * 40);
  });

  it("stabilizes direct mapped refs after strict reattachment", () => {
    let renders = 0;

    act(() => root.render(
      <StrictMode><DirectRefHarness onRender={() => { renders += 1; }} /></StrictMode>,
    ));

    expect(renders).toBeLessThan(10);
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

  it("does not mistake variable card height for row pitch", () => {
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
    expect(beforeAfterResize).toBe(beforePx);
  });

  it("refreshes row pitch from ResizeObserver offsets", () => {
    act(() => root.render(<Harness columns={1} rowPitch={45} itemHeight={42} />));
    const scroller = container.querySelector<HTMLElement>("[data-testid=scroller]")!;
    act(() => {
      Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 20_000, writable: true });
      scroller.dispatchEvent(new Event("scroll"));
    });
    const beforePx = Number(container.querySelector("[data-testid=range]")!.textContent!.split(":")[2]);
    const nodes = [...container.querySelectorAll<HTMLElement>("button")];
    for (const node of nodes) {
      const index = Number(node.dataset.testid!.replace("card-", ""));
      Object.defineProperty(node, "offsetTop", { configurable: true, value: index * 50 });
    }
    act(() => ResizeObserverStub.instances[0]!.callback(
      nodes.map((target) => ({ target } as ResizeObserverEntry)),
      ResizeObserverStub.instances[0] as unknown as ResizeObserver,
    ));

    expect(Number(container.querySelector("[data-testid=range]")!.textContent!.split(":")[2]))
      .toBeGreaterThan(beforePx);
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

  it("resets ahead of an unchanged distant selection but pins later selection changes", () => {
    act(() => root.render(<Harness selectedKey="card-150" />));
    expect(container.querySelector("[data-testid=range]")?.textContent).toMatch(/^0:48:/);
    expect(container.querySelector("[data-testid='card-150']")).toBeNull();

    act(() => root.render(<Harness selectedKey="card-151" />));
    expect(container.querySelector("[data-testid='card-151']")).not.toBeNull();

    act(() => root.render(<Harness layoutKey="filtered" selectedKey="card-151" />));
    expect(container.querySelector("[data-testid=range]")?.textContent).toMatch(/^0:48:/);
    expect(container.querySelector("[data-testid='card-151']")).toBeNull();

    act(() => root.render(<Harness layoutKey="filtered" selectedKey="card-152" />));
    expect(container.querySelector("[data-testid='card-152']")).not.toBeNull();
  });

  it("keeps selected and focused keys mounted when they fit one bounded window", () => {
    act(() => root.render(<Harness />));
    act(() => root.render(<Harness selectedKey="card-80" focusedKey="card-131" />));

    expect(container.querySelector("[data-testid='card-80']")).not.toBeNull();
    expect(container.querySelector("[data-testid='card-131']")).not.toBeNull();
    expect(container.querySelectorAll("button").length).toBeLessThanOrEqual(96);
  });

  it("prioritizes the focused key when selected and focused keys cannot share the cap", () => {
    act(() => root.render(<Harness />));
    act(() => root.render(<Harness selectedKey="card-0" focusedKey="card-150" />));

    expect(container.querySelector("[data-testid='card-150']")).not.toBeNull();
    expect(container.querySelector("[data-testid='card-0']")).toBeNull();
    expect(container.querySelectorAll("button").length).toBeLessThanOrEqual(96);
  });

  it("prioritizes the focused key even when the selected key has the higher index", () => {
    act(() => root.render(<Harness />));
    act(() => root.render(<Harness selectedKey="card-150" focusedKey="card-0" />));

    expect(container.querySelector("[data-testid='card-0']")).not.toBeNull();
    expect(container.querySelector("[data-testid='card-150']")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(96);
  });

  it("retains focused and selected pins after later scroll ranges", () => {
    act(() => root.render(<Harness />));
    act(() => root.render(<Harness selectedKey="card-80" focusedKey="card-131" />));
    const scroller = container.querySelector<HTMLElement>("[data-testid=scroller]")!;

    act(() => {
      Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 0, writable: true });
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(container.querySelector("[data-testid='card-80']")).not.toBeNull();
    expect(container.querySelector("[data-testid='card-131']")).not.toBeNull();
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

  it("releases a callback when its registered item unmounts", () => {
    let api!: ReturnType<typeof useWindowedCollection<Item>>;
    act(() => root.render(<Harness onReady={(next) => { api = next; }} />));
    const oldCallback = api.registerItem(0);

    act(() => root.render(<Harness hiddenKeys={["card-0"]} onReady={(next) => { api = next; }} />));

    expect(api.registerItem(0)).not.toBe(oldCallback);
  });
});
