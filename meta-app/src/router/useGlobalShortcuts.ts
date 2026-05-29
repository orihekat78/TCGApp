// spec: .claude/specs/meta-ui/03-routing.md
// グローバルキーボードショートカット
// H/D/C/T/S = HOME/DECK/CARDS/TUTORIAL/SETTINGS
// P/M/R/Y/L = SETUP/MATCH/RESULT/HISTORY/REPLAY
// Enter (HOME 時) = 推理開始 → SETUP
// Esc / Backspace = 戻る
// ? = ヘルプ表示 (state を返す)

import { useEffect, useState } from 'react';
import type { Route } from './routes';

const KEY_MAP: Record<string, Route> = {
  h: 'home',
  d: 'deck',
  c: 'cards',
  t: 'tutorial',
  s: 'settings',
  p: 'setup',
  m: 'match',
  r: 'result',
  y: 'history',
  l: 'replay',
};

interface Options {
  route: Route;
  onNav: (r: Route) => void;
}

export function useGlobalShortcuts({ route, onNav }: Options): {
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
} {
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // input/textarea にフォーカス中は無効
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (helpOpen) {
          setHelpOpen(false);
        } else if (route !== 'home') {
          e.preventDefault();
          onNav('home');
        }
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === 'Enter' && route === 'home') {
        e.preventDefault();
        onNav('setup');
        return;
      }
      const target = KEY_MAP[e.key.toLowerCase()];
      if (target) {
        e.preventDefault();
        onNav(target);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [route, onNav, helpOpen]);

  return { helpOpen, setHelpOpen };
}
