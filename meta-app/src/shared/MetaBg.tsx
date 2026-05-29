// spec: .claude/specs/meta-ui/02-design-system.md
// 原典: design-mockups_v2/06-shared.jsx の MetaBg + SceneOverlay + SCENE_OVERLAYS
// 9 scene 別装飾オーバーレイ。SVG/CSS で低不透明度レイヤを重ねる

import type { ReactNode, ComponentType } from 'react';

export type SceneTheme = 'noir' | 'crimson';
export type SceneName =
  | 'home' | 'deck' | 'cards' | 'history' | 'tutorial'
  | 'settings' | 'setup' | 'result' | 'replay' | 'match' | 'default';

interface Props {
  theme?: SceneTheme;
  scene?: SceneName;
  children?: ReactNode;
}

const PALETTE = {
  noir: {
    spot: 'rgba(78,195,255,0.10)',
    base: 'radial-gradient(ellipse at 50% 30%, #15263e 0%, #0a1424 50%, #050a14 100%)',
    accentSvg: '%234ec3ff',
    magnifier: '%23ffd75e',
  },
  crimson: {
    spot: 'rgba(196,24,24,0.10)',
    base: 'radial-gradient(ellipse at 50% 30%, #2a0e18 0%, #14060c 60%, #06030a 100%)',
    accentSvg: '%23ff7ab8',
    magnifier: '%23ffd75e',
  },
} as const;

export function MetaBg({ theme = 'noir', scene = 'default', children }: Props) {
  const palette = PALETTE[theme];
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(ellipse 70% 50% at 50% -8%, ${palette.spot}, transparent 70%),
        repeating-linear-gradient(115deg, transparent 0 80px, rgba(0,0,0,0.10) 80px 82px),
        url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360' viewBox='0 0 360 360'><g fill='none' stroke='${palette.magnifier}' stroke-width='1.4' opacity='0.06'><circle cx='150' cy='150' r='95'/><circle cx='150' cy='150' r='80'/><line x1='220' y1='220' x2='320' y2='320' stroke-width='10'/><circle cx='150' cy='150' r='55' stroke-dasharray='2 5'/></g></svg>"),
        url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><g fill='none' stroke='${palette.accentSvg}' stroke-width='0.5' opacity='0.06'><path d='M0 0h48v48H0z'/><path d='M24 0v48M0 24h48'/></g></svg>"),
        ${palette.base}
      `,
      backgroundRepeat: 'no-repeat, no-repeat, no-repeat, repeat, no-repeat',
      backgroundPosition: '0 0, 0 0, right -40px bottom -40px, 0 0, 0 0',
      backgroundSize: 'auto, auto, 360px 360px, 48px 48px, auto',
    }}>
      <SceneOverlay scene={scene} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(0,0,0,0.55) 100%)',
      }} />
      {children}
    </div>
  );
}

function SceneOverlay({ scene }: { scene: SceneName }) {
  const Overlay = SCENE_OVERLAYS[scene];
  if (!Overlay) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <Overlay />
    </div>
  );
}

const SCENE_OVERLAYS: Partial<Record<SceneName, ComponentType>> = {
  deck: DeckOverlay,
  cards: CardsOverlay,
  history: HistoryOverlay,
  tutorial: TutorialOverlay,
  settings: SettingsOverlay,
  setup: SetupOverlay,
  result: ResultOverlay,
  replay: ReplayOverlay,
};

function DeckOverlay() {
  return (
    <>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05 }}>
        <defs>
          <pattern id="ruled" width="100%" height="36" patternUnits="userSpaceOnUse">
            <line x1="0" y1="35.5" x2="100%" y2="35.5" stroke="#4ec3ff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ruled)" />
      </svg>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 24,
        background: 'linear-gradient(90deg, rgba(255,215,94,0.08), transparent)',
        borderRight: '1px dashed rgba(255,215,94,0.10)',
      }} />
    </>
  );
}

function CardsOverlay() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06 }}>
      <defs>
        <pattern id="filecols" width="240" height="100%" patternUnits="userSpaceOnUse">
          <line x1="239.5" y1="0" x2="239.5" y2="100%" stroke="#ffd75e" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#filecols)" />
    </svg>
  );
}

function HistoryOverlay() {
  return (
    <>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08 }}>
        <defs>
          <pattern id="cork" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="5" r="0.7" fill="#c98a4a" />
            <circle cx="14" cy="8" r="0.5" fill="#a8763a" />
            <circle cx="8" cy="16" r="0.6" fill="#b87a3e" />
            <circle cx="18" cy="17" r="0.4" fill="#c98a4a" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cork)" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 60% 50%, rgba(180,120,60,0.04), transparent 60%)',
      }} />
    </>
  );
}

function TutorialOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse at 50% 40%, rgba(58,166,122,0.05), transparent 70%)',
    }} />
  );
}

function SettingsOverlay() {
  return (
    <>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(78,195,255,0.04) 2px 3px)',
      }} />
      <div style={{
        position: 'absolute', right: 32, top: 84,
        fontFamily: '"Cascadia Code",monospace', fontSize: 10, color: 'rgba(78,195,255,0.18)',
        letterSpacing: '0.1em', lineHeight: 1.6, textAlign: 'right',
      }}>
        <div>SYS · 0x4E8F · OK</div>
        <div>RENDER · 1920x1080 · 60fps</div>
        <div>ENGINE · v0.8.3-phase10</div>
        <div>NET · LOCAL · 0ms</div>
      </div>
    </>
  );
}

function SetupOverlay() {
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: '50%', bottom: 0,
        background: 'radial-gradient(ellipse at 30% 40%, rgba(68,221,153,0.06), transparent 60%)' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, width: '50%', bottom: 0,
        background: 'radial-gradient(ellipse at 70% 40%, rgba(138,76,192,0.06), transparent 60%)' }} />
    </>
  );
}

function ResultOverlay() {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '15%',
      width: 900, height: 900, marginLeft: -450,
      background: 'radial-gradient(circle, rgba(255,215,94,0.12) 0%, rgba(255,215,94,0.04) 30%, transparent 65%)',
      filter: 'blur(10px)',
    }} />
  );
}

function ReplayOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,215,94,0.04) 3px 4px)',
    }} />
  );
}
