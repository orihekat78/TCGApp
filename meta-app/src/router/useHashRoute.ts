// spec: .claude/specs/meta-ui/03-routing.md
// URL ハッシュとルートを同期するフック

import { useEffect, useState, useCallback, useRef } from 'react';
import { DEFAULT_ROUTE, isRoute, type Route } from './routes';
import type { RouteChangeSource, RouteLeaveGuard } from './navigationBlocker';

const REPLAY_ARTIFACT_ID = /^[A-Za-z0-9._:-]{1,256}$/;
const HISTORY_INDEX_KEY = '__conanRouteIndex';

interface AcceptedRoute {
  route: Route;
  hash: string;
  index: number;
}

export function routeFromHash(hash: string): Route {
  const value = hash.replace(/^#/, '');
  const [base] = value.split('/');
  return isRoute(base) ? base : DEFAULT_ROUTE;
}

export function replayArtifactIdFromHash(hash: string): string | null {
  const value = hash.replace(/^#/, '');
  const parts = value.split('/');
  if (parts.length !== 2 || parts[0] !== 'replay' || !parts[1]) return null;
  try {
    const artifactId = decodeURIComponent(parts[1]);
    return REPLAY_ARTIFACT_ID.test(artifactId) ? artifactId : null;
  } catch {
    return null;
  }
}

export function buildReplayHash(artifactId: string): string {
  if (!REPLAY_ARTIFACT_ID.test(artifactId)) throw new Error('Invalid replay artifact ID');
  return `#replay/${encodeURIComponent(artifactId)}`;
}

function parseHash(): Route {
  if (typeof window === 'undefined') return DEFAULT_ROUTE;
  return routeFromHash(window.location.hash);
}

function currentHash(): string {
  return window.location.hash || `#${DEFAULT_ROUTE}`;
}

function readHistoryIndex(): number | null {
  const value = window.history.state?.[HISTORY_INDEX_KEY];
  return Number.isSafeInteger(value) ? value : null;
}

function stampCurrentHistory(index: number): void {
  const state = window.history.state;
  const base = state && typeof state === 'object' ? state : {};
  window.history.replaceState({ ...base, [HISTORY_INDEX_KEY]: index }, '', window.location.href);
}

export function useHashRoute(guard?: RouteLeaveGuard): [Route, (r: Route) => boolean] {
  const [route, setRoute] = useState<Route>(parseHash);
  const guardRef = useRef(guard);
  guardRef.current = guard;
  const acceptedRef = useRef<AcceptedRoute>({
    route,
    hash: typeof window === 'undefined' ? `#${DEFAULT_ROUTE}` : currentHash(),
    index: typeof window === 'undefined' ? 0 : (readHistoryIndex() ?? 0),
  });
  const preacceptedRef = useRef<AcceptedRoute | null>(null);
  const restoringRef = useRef(false);

  useEffect(() => {
    if (readHistoryIndex() === null) stampCurrentHistory(acceptedRef.current.index);

    const handleExternalNavigation = (source: RouteChangeSource) => {
      const hash = currentHash();
      const accepted = acceptedRef.current;

      if (hash === accepted.hash) {
        if (readHistoryIndex() === null) stampCurrentHistory(accepted.index);
        restoringRef.current = false;
        return;
      }

      if (restoringRef.current) return;

      const preaccepted = preacceptedRef.current;
      if (preaccepted?.hash === hash) {
        stampCurrentHistory(preaccepted.index);
        acceptedRef.current = preaccepted;
        preacceptedRef.current = null;
        setRoute(preaccepted.route);
        return;
      }

      const existingIndex = readHistoryIndex();
      // Chromium emits popstate before hashchange for a direct location.hash
      // write. All app-owned entries are stamped, so an unstamped popstate is
      // the newly-created hash entry rather than a history traversal target.
      const effectiveSource = source === 'history' && existingIndex === null ? 'hash' : source;
      const targetIndex = effectiveSource === 'hash'
        ? accepted.index + 1
        : existingIndex!;
      const targetRoute = routeFromHash(hash);
      const canLeave = targetRoute === accepted.route || !guardRef.current || guardRef.current({
        from: accepted.route,
        to: targetRoute,
        source: effectiveSource,
      });

      if (canLeave) {
        if (effectiveSource === 'hash' || existingIndex === null) stampCurrentHistory(targetIndex);
        acceptedRef.current = { route: targetRoute, hash, index: targetIndex };
        setRoute(targetRoute);
        return;
      }

      // Stamp the rejected entry before returning to the accepted one. This
      // preserves an exact index for a later forward navigation attempt.
      if (effectiveSource === 'hash' || existingIndex === null) stampCurrentHistory(targetIndex);
      const delta = accepted.index - targetIndex;
      if (delta !== 0) {
        restoringRef.current = true;
        window.history.go(delta);
      } else {
        window.history.replaceState(
          { ...window.history.state, [HISTORY_INDEX_KEY]: accepted.index },
          '',
          accepted.hash,
        );
      }
    };

    const onHashChange = () => handleExternalNavigation('hash');
    const onPopState = () => handleExternalNavigation('history');
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const nav = useCallback((r: Route) => {
    if (typeof window === 'undefined') return false;
    const accepted = acceptedRef.current;
    const hash = `#${r}`;
    if (hash === currentHash()) return true;
    if (r !== accepted.route && guardRef.current && !guardRef.current({
      from: accepted.route,
      to: r,
      source: 'app',
    })) return false;

    preacceptedRef.current = { route: r, hash, index: accepted.index + 1 };
    window.location.hash = hash;
    return true;
  }, []);

  return [route, nav];
}
