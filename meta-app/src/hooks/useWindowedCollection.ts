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
  const nodeIndexesRef = useRef(new Map<HTMLElement, number>());
  const callbacksRef = useRef(new Map<number, (node: HTMLElement | null) => void>());
  const observerRef = useRef<ResizeObserver | null>(null);
  const pendingFocusKeyRef = useRef<string | null>(null);

  const keyIndexes = useMemo(() => new Map(items.map((item, index) => [getKey(item), index])), [getKey, items]);

  const metrics = (() => {
    const rows = new Map<number, number>();
    const rowCounts = new Map<number, number>();
    for (const measurement of measurementsRef.current.values()) {
      rows.set(measurement.top, Math.max(rows.get(measurement.top) ?? 0, measurement.height));
      rowCounts.set(measurement.top, (rowCounts.get(measurement.top) ?? 0) + 1);
    }
    const rowHeights = [...rows.values()];
    const columns = rowHeights.length === 0
      ? 1
      : Math.max(1, ...rowCounts.values());
    const rowHeight = rowHeights.length === 0
      ? FALLBACK_ROW_HEIGHT
      : rowHeights.reduce((total, height) => total + height, 0) / rowHeights.length;
    const rowTops = [...rows.keys()].sort((left, right) => left - right);
    const pitches = rowTops.slice(1).map((top, index) => top - rowTops[index]!);
    const rowPitch = pitches.length === 0
      ? rowHeight
      : pitches.reduce((total, pitch) => total + pitch, 0) / pitches.length;
    return { columns, rowPitch };
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
    const selectedIndex = selectedKey == null ? undefined : keyIndexes.get(selectedKey);
    const focusedIndex = focusedKey == null ? undefined : keyIndexes.get(focusedKey);
    const pins = [selectedIndex, focusedIndex].filter((index): index is number => index !== undefined);
    if (pins.length === 0) return;
    const first = Math.min(...pins);
    const last = Math.max(...pins);
    setRange((current) => {
      if (first >= current.start && last < current.end) return current;
      const priorityIndex = focusedIndex ?? selectedIndex!;
      if (last - first >= mountedLimit) {
        const next = rangeForIndex(priorityIndex);
        return next.start === current.start && next.end === current.end ? current : next;
      }
      const maxStart = Math.max(0, items.length - mountedLimit);
      const minimumStart = Math.max(0, last - mountedLimit + 1);
      const maximumStart = Math.min(first, maxStart);
      const preferredStart = rangeForIndex(priorityIndex).start;
      const start = Math.max(minimumStart, Math.min(maximumStart, preferredStart));
      const next = { start, end: Math.min(items.length, start + mountedLimit) };
      return next.start === current.start && next.end === current.end ? current : next;
    });
  }, [focusedKey, items.length, keyIndexes, mountedLimit, rangeForIndex, selectedKey]);

  useEffect(() => {
    if (!scrollElement) return;
    const onScroll = () => {
      const estimatedChunkHeight = Math.max(1, Math.ceil(chunkSize / metrics.columns) * metrics.rowPitch);
      const chunk = Math.floor(scrollElement.scrollTop / estimatedChunkHeight);
      const total = items.length;
      const start = Math.max(0, Math.min(Math.max(0, total - mountedLimit), chunk * chunkSize));
      setRange(start === 0 ? initialRange(total, chunkSize) : { start, end: Math.min(total, start + mountedLimit) });
    };
    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", onScroll);
  }, [chunkSize, items.length, metrics.columns, metrics.rowPitch, mountedLimit, scrollElement]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const node = entry.target as HTMLElement;
        const index = nodeIndexesRef.current.get(node);
        if (index === undefined) continue;
        const measurement = { top: node.offsetTop, height: node.offsetHeight };
        const previous = measurementsRef.current.get(index);
        measurementsRef.current.set(index, measurement);
        changed ||= !previous || previous.top !== measurement.top || previous.height !== measurement.height;
      }
      if (changed) setMeasurementVersion((version) => version + 1);
    });
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
        nodeIndexesRef.current.delete(currentNode);
        measurementsRef.current.delete(index);
      }
      currentNode = node;
      if (!node) {
        if (callbacksRef.current.get(index) === callback) callbacksRef.current.delete(index);
        return;
      }
      nodesRef.current.set(index, node);
      nodeIndexesRef.current.set(node, index);
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
      scrollElement.scrollTop = Math.floor(index / metrics.columns) * metrics.rowPitch;
    }
  }, [keyIndexes, metrics.columns, metrics.rowPitch, rangeForIndex, scrollElement]);

  const beforePx = Math.round(Math.floor(range.start / metrics.columns) * metrics.rowPitch);
  const totalRows = Math.ceil(items.length / metrics.columns);
  const afterPx = Math.max(0, Math.round(totalRows * metrics.rowPitch - Math.ceil(range.end / metrics.columns) * metrics.rowPitch));

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
