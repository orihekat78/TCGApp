// spec: .claude/specs/meta-ui/03-routing.md
// MetaShell — ルート判定 + シーン別背景 + 280ms フェード遷移

import type { ReactNode } from 'react';
import { MetaBg, type SceneName } from './shared/MetaBg';
import { ensureInteractionStyles } from './shared/interactionStyles';
import type { Route } from './router/routes';
import { useMetaStore } from './state/metaStore';
import {
  CloudSyncIndicator,
  shouldShowCloudSyncIndicator,
} from './shared/CloudSyncIndicator';

interface Props {
  route: Route;
  children: ReactNode;
}

// route 名 → MetaBg の scene 名 (一致するが型上区別)
function sceneFor(route: Route): SceneName {
  switch (route) {
    case 'home':     return 'home';
    case 'setup':    return 'setup';
    case 'match':    return 'match';
    case 'result':   return 'result';
    case 'deck':     return 'deck';
    case 'cards':    return 'cards';
    case 'history':  return 'history';
    case 'replay':   return 'replay';
    case 'tutorial': return 'tutorial';
    case 'settings': return 'settings';
    default:         return 'default';
  }
}

export function MetaShell({ route, children }: Props) {
  ensureInteractionStyles();
  const density = useMetaStore((state) => state.settings.density);
  return (
    <div className={`meta-shell meta-shell--${density}`} data-density={density} style={{
      position: 'fixed', inset: 0,
      overflow: 'hidden',
      color: '#e0ecf8',
    }}>
      <MetaBg theme="noir" scene={sceneFor(route)}>
        {/* key で route 切替時に再マウント → meta-fade アニメ発火 */}
        <div key={route} className="meta-fade" style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
        }}>
          {children}
        </div>
      </MetaBg>
      {shouldShowCloudSyncIndicator(route) && <CloudSyncIndicator />}
    </div>
  );
}
