import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface UseWindowedCollectionOptions<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  scrollElement: HTMLElement | null;
  layoutKey?: unknown;
  selectedKey?: string | null;
  focusedKey?: string | null;
  initialItems?: number;
  maxMountedItems?: number;
}

export interface WindowedCollection<T> {
  start: number;
  end: number;
  visibleItems: readonly T[];
  beforePx: number;
  afterPx: number;
  registerItem: (index: number) => (node: HTMLElement | null) => void;
  reveal: (key: string, options?: { focus?: boolean }) => void;
}

interface Measurement {
  top: number;
  height: number;
}

interface Range {
  start: number;
  end: number;
}

const FALLBACK_ROW_HEIGHT = 240;

function initialRange(total: number, initialItems: number): Range {
  return { start: 0, end: Math.min(total, initialItems) };
}

export function useWindowedCollection<T>({
  items,
  getKey,
  scrollElement,
  layoutKey,
  selectedKey,
  focusedKey,
  initialItems = 48,
  maxMountedItems = 96,
}: UseWindowedCollectionOptions<T>): WindowedCollection<T> {
  const chunkSize = Math.max(1, Math.min(initialItems, maxMountedItems));
  const mountedLimit = Math.max(chunkSize, maxMountedItems);
  const [range, setRange] = useState(() => initialRange(items.length, chunkSize));
  const [, setMeasurementVersion] = useState(0);
  const measurementsRef = useRef(new Map<number, Measurement>());
  const nodesRef = useRef(new Map<number, HTMLElement>());
  const callbacksRef = useRef(new Map<number, (node: HTMLElement | null) => void>());
  const observerRef = useRef<ResizeObserver | null>(null);
  const pendingFocusKeyRef = useRef<string | null>(null);

  const keyIndexes = useMemo(() => new Map(items.map((item, index) => [getKey(item), index])), [getKey, items]);

  const metrics = (() => {
    const rows = new Map<number, number>();
    for (const measurement of measurementsRef.current.values()) {
      rows.set(measurement.top, Math.max(rows.get(measurement.top) ?? 0, measurement.height));
    }
    const rowHeights = [...rows.values()];
    const columns = rowHeights.length === 0
      ? 1
      : Math.max(1, Math.round(measurementsRef.current.size / rowHeights.length));
    const rowHeight = rowHeights.length === 0
      ? FALLBACK_ROW_HEIGHT
      : rowHeights.reduce((total, height) => total + height, 0) / rowHeights.length;
    return { columns, rowHeight };
  })();

  const rangeForIndex = useCallback((index: number): Range => {
    const total = items.length;
    if (total <= chunkSize) return initialRange(total, chunkSize);
    const maxStart = Math.max(0, total - mountedLimit);
    const start = Math.max(0, Math.min(maxStart, index - Math.floor(mountedLimit / 2)));
    return { start, end: Math.min(total, start + mountedLimit) };
  }, [chunkSize, items.length, mountedLimit]);

  const reset = useCallback(() => {
    setRange(initialRange(items.length, chunkSize));
  }, [chunkSize, items.length]);

  useLayoutEffect(() => {
    reset();
    if (scrollElement) scrollElement.scrollTop = 0;
  }, [layoutKey, reset, scrollElement]);

  useLayoutEffect(() => {
    const pins = [selectedKey, focusedKey]
      .map((key) => key == null ? undefined : keyIndexes.get(key))
      .filter((index): index is number => index !== undefined);
    if (pins.length === 0) return;
    const first = Math.min(...pins);
    const last = Math.max(...pins);
    setRange((current) => {
      if (first >= current.start && last < current.end) return current;
      return rangeForIndex(last);
    });
  }, [focusedKey, keyIndexes, rangeForIndex, selectedKey]);

  useEffect(() => {
    if (!scrollElement) return;
    const onScroll = () => {
      const estimatedChunkHeight = Math.max(1, Math.ceil(chunkSize / metrics.columns) * metrics.rowHeight);
      const chunk = Math.floor(scrollElement.scrollTop / estimatedChunkHeight);
      const total = items.length;
      const start = Math.max(0, Math.min(Math.max(0, total - mountedLimit), chunk * chunkSize));
      setRange(start === 0 ? initialRange(total, chunkSize) : { start, end: Math.min(total, start + mountedLimit) });
    };
    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", onScroll);
  }, [chunkSize, items.length, metrics.columns, metrics.rowHeight, mountedLimit, scrollElement]);

  useEffect(() => {
    const observer = new ResizeObserver(() => setMeasurementVersion((version) => version + 1));
    observerRef.current = observer;
    for (const node of nodesRef.current.values()) observer.observe(node);
    return () => {
      observer.disconnect();
      if (observerRef.current === observer) observerRef.current = null;
    };
  }, []);

  const registerItem = useCallback((index: number) => {
    const cached = callbacksRef.current.get(index);
    if (cached) return cached;
    let currentNode: HTMLElement | null = null;
    const callback = (node: HTMLElement | null) => {
      if (currentNode === node) return;
      if (currentNode) {
        observerRef.current?.unobserve(currentNode);
        nodesRef.current.delete(index);
        measurementsRef.current.delete(index);
      }
      currentNode = node;
      if (!node) return;
      nodesRef.current.set(index, node);
      const measurement = { top: node.offsetTop, height: node.offsetHeight };
      const previous = measurementsRef.current.get(index);
      measurementsRef.current.set(index, measurement);
      observerRef.current?.observe(node);
      if (!previous || previous.top !== measurement.top || previous.height !== measurement.height) {
        setMeasurementVersion((version) => version + 1);
      }
    };
    callbacksRef.current.set(index, callback);
    return callback;
  }, []);

  useLayoutEffect(() => {
    const key = pendingFocusKeyRef.current;
    if (!key) return;
    const index = keyIndexes.get(key);
    const node = index == null ? undefined : nodesRef.current.get(index);
    if (!node) return;
    node.focus();
    pendingFocusKeyRef.current = null;
  }, [keyIndexes, range]);

  const reveal = useCallback((key: string, options?: { focus?: boolean }) => {
    const index = keyIndexes.get(key);
    if (index === undefined) return;
    if (options?.focus) pendingFocusKeyRef.current = key;
    setRange(rangeForIndex(index));
    if (scrollElement) {
      scrollElement.scrollTop = Math.floor(index / metrics.columns) * metrics.rowHeight;
    }
  }, [keyIndexes, metrics.columns, metrics.rowHeight, rangeForIndex, scrollElement]);

  const beforePx = Math.round(Math.floor(range.start / metrics.columns) * metrics.rowHeight);
  const totalRows = Math.ceil(items.length / metrics.columns);
  const afterPx = Math.max(0, Math.round(totalRows * metrics.rowHeight - Math.ceil(range.end / metrics.columns) * metrics.rowHeight));

  return {
    start: range.start,
    end: range.end,
    visibleItems: items.slice(range.start, range.end),
    beforePx,
    afterPx,
    registerItem,
    reveal,
  };
}
