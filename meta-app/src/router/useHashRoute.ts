// spec: .claude/specs/meta-ui/03-routing.md
// URL ハッシュとルートを同期するフック

import { useEffect, useState, useCallback } from 'react';
import { DEFAULT_ROUTE, isRoute, type Route } from './routes';

function parseHash(): Route {
  if (typeof window === 'undefined') return DEFAULT_ROUTE;
  const h = window.location.hash.replace(/^#/, '');
  return isRoute(h) ? h : DEFAULT_ROUTE;
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const nav = useCallback((r: Route) => {
    if (typeof window === 'undefined') return;
    window.location.hash = `#${r}`;
  }, []);

  return [route, nav];
}
