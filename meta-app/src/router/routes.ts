// spec: .claude/specs/meta-ui/03-routing.md
// 全ルート定数 (10-D で useHashRoute と統合)

export const ROUTES = [
  'home', 'setup', 'match', 'result',
  'deck', 'cards',
  'history', 'replay', 'tutorial', 'settings',
] as const;

export type Route = typeof ROUTES[number];

export function isRoute(s: string): s is Route {
  return (ROUTES as readonly string[]).includes(s);
}

export const DEFAULT_ROUTE: Route = 'home';
