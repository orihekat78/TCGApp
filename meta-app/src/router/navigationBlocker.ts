import type { Route } from './routes';

export type RouteChangeSource = 'app' | 'history' | 'hash';

export interface RouteChange {
  from: Route;
  to: Route;
  source: RouteChangeSource;
}

export type RouteLeaveGuard = (change: RouteChange) => boolean;

export interface NavigationBlocker {
  confirmRouteLeave: RouteLeaveGuard;
  shouldWarnBeforeUnload: () => boolean;
}

export type RegisterNavigationBlocker = (blocker: NavigationBlocker) => () => void;
