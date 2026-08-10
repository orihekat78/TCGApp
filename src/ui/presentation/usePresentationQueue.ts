import { useSyncExternalStore } from 'react';
import { getPresentationQueue } from './coordinator';

const subscribe = (listener: () => void): (() => void) => (
  getPresentationQueue().subscribe(listener)
);

const snapshot = (): number => getPresentationQueue().revision();

/** React bridge for the mutable presentation queue singleton. */
export function usePresentationOutstandingCount(): number {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return getPresentationQueue().outstandingCount();
}

/** Final execution-time race guard for autonomous turn callbacks. */
export function hasOutstandingPresentation(): boolean {
  return getPresentationQueue().outstandingCount() > 0;
}
