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
  reveal: (key: string, options?: { focus?: boolean; preserveViewport?: boolean }) => void;
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
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const [, setMeasurementVersion] = useState(0);
  const measurementsRef = useRef(new Map<number, Measurement>());
  const nodesRef = useRef(new Map<number, HTMLElement>());
  const nodeIndexesRef = useRef(new Map<HTMLElement, number>());
  const callbacksRef = useRef(new Map<number, (node: HTMLElement | null) => void>());
  const observerRef = useRef<ResizeObserver | null>(null);
  const pendingFocusKeyRef = useRef<string | null>(null);
  const resetPinKeysRef = useRef<{ selected: string | null | undefined; focused: string | null | undefined }>({
    selected: undefined,
    focused: undefined,
  });
  const latestPinKeysRef = useRef(resetPinKeysRef.current);
  latestPinKeysRef.current = { selected: selectedKey, focused: focusedKey };

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

  const rangeForStart = useCallback((preferredStart: number, requestedItems: number): Range => {
    const total = items.length;
    const columns = Math.min(Math.max(1, metrics.columns), Math.max(1, requestedItems));
    const rowCapacity = Math.floor(mountedLimit / columns) * columns;
    if (total <= mountedLimit || rowCapacity === 0) return { start: 0, end: total };

    const capacity = Math.min(rowCapacity, total);
    const itemCount = Math.min(capacity, Math.max(1, requestedItems));
    const rowItemCount = Math.min(capacity, Math.ceil(itemCount / columns) * columns);
    const maxStart = Math.ceil(Math.max(0, total - capacity) / columns) * columns;
    const start = Math.max(0, Math.min(maxStart, Math.floor(preferredStart / columns) * columns));
    return { start, end: Math.min(total, start + rowItemCount) };
  }, [items.length, metrics.columns, mountedLimit]);

  const rangeForIndex = useCallback((index: number): Range => {
    const columns = Math.max(1, metrics.columns);
    const rowCapacity = Math.floor(mountedLimit / columns) * columns;
    const capacity = rowCapacity === 0 ? mountedLimit : rowCapacity;
    return rangeForStart(index - Math.floor(capacity / 2), capacity);
  }, [metrics.columns, mountedLimit, rangeForStart]);

  const rangeWithPins = useCallback((requested: Range, selectedIndex?: number, focusedIndex?: number): Range => {
    const pins = [selectedIndex, focusedIndex].filter((index): index is number => index !== undefined);
    if (pins.length === 0) return rangeForStart(requested.start, requested.end - requested.start);
    // A focus event fires before click. Do not replace an already-mounted target
    // between pointerdown and pointerup merely to expand the window for its pin.
    if (pins.every((index) => index >= requested.start && index < requested.end)) return requested;

    const columns = Math.max(1, metrics.columns);
    const rowCapacity = Math.floor(mountedLimit / columns) * columns;
    const capacity = rowCapacity === 0 ? mountedLimit : rowCapacity;
    const priorityIndex = focusedIndex ?? selectedIndex!;
    const first = Math.min(...pins);
    const last = Math.max(...pins);
    const pinStart = Math.floor(first / columns) * columns;
    const pinEnd = Math.min(items.length, Math.ceil((last + 1) / columns) * columns);
    if (pinEnd - pinStart > capacity) return rangeForIndex(priorityIndex);

    const maxStart = Math.ceil(Math.max(0, items.length - capacity) / columns) * columns;
    const minimumStart = Math.ceil(Math.max(0, pinEnd - capacity) / columns) * columns;
    const maximumStart = Math.floor(Math.min(pinStart, maxStart) / columns) * columns;
    if (minimumStart > maximumStart) return rangeForIndex(priorityIndex);

    const preferredStart = rangeForIndex(priorityIndex).start;
    const start = Math.max(minimumStart, Math.min(maximumStart, preferredStart));
    return rangeForStart(start, capacity);
  }, [items.length, metrics.columns, mountedLimit, rangeForIndex, rangeForStart]);
  const rangeWithPinsRef = useRef(rangeWithPins);
  rangeWithPinsRef.current = rangeWithPins;

  const reset = useCallback(() => {
    setRange(initialRange(items.length, chunkSize));
  }, [chunkSize, items.length]);

  useLayoutEffect(() => {
    resetPinKeysRef.current = latestPinKeysRef.current;
    reset();
    if (scrollElement) scrollElement.scrollTop = 0;
  }, [layoutKey, reset, scrollElement]);

  useLayoutEffect(() => {
    const selectedIndex = selectedKey == null || selectedKey === resetPinKeysRef.current.selected
      ? undefined
      : keyIndexes.get(selectedKey);
    const focusedIndex = focusedKey == null || focusedKey === resetPinKeysRef.current.focused
      ? undefined
      : keyIndexes.get(focusedKey);
    setRange((current) => {
      const next = rangeWithPinsRef.current(current, selectedIndex, focusedIndex);
      return next.start === current.start && next.end === current.end ? current : next;
    });
  }, [focusedKey, keyIndexes, selectedKey]);

  useEffect(() => {
    if (!scrollElement) return;
    const onScroll = () => {
      const estimatedChunkHeight = Math.max(1, Math.ceil(chunkSize / metrics.columns) * metrics.rowPitch);
      const chunk = Math.floor(scrollElement.scrollTop / estimatedChunkHeight);
      const selectedIndex = selectedKey == null || selectedKey === resetPinKeysRef.current.selected
        ? undefined
        : keyIndexes.get(selectedKey);
      const focusedIndex = focusedKey == null || focusedKey === resetPinKeysRef.current.focused
        ? undefined
        : keyIndexes.get(focusedKey);
      const next = rangeForStart(chunk * chunkSize, chunk === 0 ? chunkSize : mountedLimit);
      setRange((current) => {
        const pinned = rangeWithPins(next, selectedIndex, focusedIndex);
        return pinned.start === current.start && pinned.end === current.end ? current : pinned;
      });
    };
    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", onScroll);
  }, [chunkSize, focusedKey, keyIndexes, metrics.columns, metrics.rowPitch, mountedLimit, rangeForStart, rangeWithPins, scrollElement, selectedKey]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      let changed = false;
      // A resized card can move every later row without resizing those cards.
      // Refresh the whole bounded window so old and new offsetTop values never mix.
      for (const [index, node] of nodesRef.current) {
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

  const reveal = useCallback((key: string, options?: { focus?: boolean; preserveViewport?: boolean }) => {
    const index = keyIndexes.get(key);
    if (index === undefined) return;
    const alreadyMounted = index >= rangeRef.current.start && index < rangeRef.current.end;
    if (options?.focus) pendingFocusKeyRef.current = key;
    const selectedIndex = selectedKey == null || selectedKey === resetPinKeysRef.current.selected
      ? undefined
      : keyIndexes.get(selectedKey);
    const focusedIndex = options?.focus
      ? index
      : focusedKey == null || focusedKey === resetPinKeysRef.current.focused
        ? undefined
        : keyIndexes.get(focusedKey);
    setRange((current) => {
      if (index >= current.start && index < current.end) return current;
      const next = rangeWithPins(rangeForIndex(index), selectedIndex, focusedIndex);
      return next.start === current.start && next.end === current.end ? current : next;
    });
    if (scrollElement && (!alreadyMounted || !options?.preserveViewport)) {
      scrollElement.scrollTop = Math.floor(index / metrics.columns) * metrics.rowPitch;
    }
  }, [focusedKey, keyIndexes, metrics.columns, metrics.rowPitch, rangeForIndex, rangeWithPins, scrollElement, selectedKey]);

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
