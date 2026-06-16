// spec: .claude/specs/meta-ui/02-design-system.md
// 原典: design-mockups_v2/06-shared.jsx の T オブジェクト (1:1 移植)
// src/ui/styles/tokens.css とは独立コピー (依存ゼロ原則)

import type { CardColor } from '../data/types';

export const T = {
  // Base palette
  bgDeep:     '#0a1a28',
  bgZone:     '#1b3a5c',
  bgSelf1:    '#0d2640',
  bgSelf2:    '#1b3a5c',
  bgOpp1:     '#0d2640',
  bgOpp2:     '#2a1b3c',
  bgCell:     'rgba(0,0,0,0.32)',
  borderZone: '#3a6ea5',
  borderSelf: '#44dd99',
  borderOpp:  '#aa66dd',

  // Accent
  gold:        '#ffd700',
  goldDim:     '#a88a1a',
  goldSoft:    '#ffd75e',
  neonBlue:    '#4ec3ff',
  neonYellow:  '#ffd54a',
  accentBlue:  '#3a6ea5',

  // Card colors
  blue:         '#2b6cb5',
  yellow:       '#d4a425',
  yellowBorder: '#e0b830',
  red:          '#c84040',
  green:        '#3aa67a',
  purple:       '#8a4cc0',
  black:        '#7d8597',
  white:        '#dfe5f0',

  // Stat colors
  apColor: '#ff9b6e',
  lpColor: '#ffd75e',
  lvColor: '#6ed1ff',

  // State
  stateSleep: 'rgba(40, 80, 200, 0.6)',
  stateStun:  'rgba(220, 50, 50, 0.65)',
  stateNamed: 'rgba(240, 200, 40, 0.95)',

  // Case status
  caseEditing:  '#3366ff',
  caseResolved: '#ee2255',

  // Targeting
  targetValid:   '#44dd99',
  targetInvalid: 'rgba(238, 80, 80, 0.5)',

  // Text
  textPrimary:   '#e0ecf8',
  textSecondary: '#b8d4f0',
  textMuted:     '#7090b5',
  textDisabled:  '#4a5a70',

  // Typography
  fontJp:    '"Hiragino Sans","Yu Gothic UI","Noto Sans JP",-apple-system,sans-serif',
  fontMono:  '"Cascadia Code","Consolas","JetBrains Mono",monospace',
  fontSerif: '"Hiragino Mincho ProN","Yu Mincho",serif',

  // Patterns
  keepOut: 'repeating-linear-gradient(90deg, #ffd700 0 22px, #0a0a0a 22px 44px)',
} as const;

export const COLOR_TOKEN: Record<CardColor, string> = {
  blue:   T.blue,
  yellow: T.yellow,
  red:    T.red,
  green:  T.green,
  purple: T.purple,
  black:  T.black,
  white:  T.white,
};

// 色のブレンド (-1.0 = 黒, +1.0 = 白)
export function shade(hex: string, amount: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const mix = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const nr = Math.round(r * (1 - a) + mix * a);
  const ng = Math.round(g * (1 - a) + mix * a);
  const nb = Math.round(b * (1 - a) + mix * a);
  return '#' + [nr, ng, nb].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export type TokenSet = typeof T;
