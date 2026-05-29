// spec: .claude/specs/meta-ui/02-design-system.md
// 原典: design-mockups_v2/06-shared.jsx の CardSilhouette + RoleIcon + helpers
// 著作権上カード画像同梱不可のため、漢字頭文字 + 役職アイコン + ID シードパターンで代替

import type { CardDef } from '../data/types';

interface Props {
  card: CardDef | undefined;
}

export function CardSilhouette({ card }: Props) {
  const seed = stringSeed(card?.num || 'X');
  const initial = (card?.name || '?').charAt(0);
  const role = pickRole(card?.features || [], card?.type);
  const isPartner = card?.type === 'partner';
  const isEvent = card?.type === 'event';
  const bgId = `bg-${card?.num || 'x'}`;

  return (
    <svg width="92%" height="92%" viewBox="0 0 100 100" fill="none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={bgId} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
      </defs>
      {!isEvent && Array.from({ length: 5 }, (_, i) => {
        const r = 14 + i * 9;
        const dash = (seed % (4 + i)) * 1.5 + 2;
        const rot = (seed * (i + 1)) % 360;
        return (
          <circle key={i} cx="50" cy="50" r={r}
            stroke="rgba(255,255,255,0.22)" strokeWidth="0.7"
            strokeDasharray={`${dash} ${dash * 1.5}`}
            transform={`rotate(${rot} 50 50)`}
            fill="none" />
        );
      })}
      {isEvent && (
        <>
          <rect x="22" y="14" width="56" height="72" rx="2"
            stroke="rgba(255,255,255,0.4)" strokeWidth="1"
            fill={`url(#${bgId})`} />
          {[24, 34, 44, 54].map((y, i) => (
            <line key={i} x1="28" y1={y} x2={68 - i * 4} y2={y}
              stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />
          ))}
        </>
      )}
      <circle cx="50" cy="50" r={isEvent ? 18 : 26} fill={`url(#${bgId})`} />
      <text x="50" y={isPartner ? 56 : 58}
        textAnchor="middle"
        fontFamily="'Hiragino Mincho ProN','Yu Mincho',serif"
        fontSize={isPartner ? 38 : 34}
        fontWeight="900"
        fill="rgba(255,255,255,0.95)"
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.7)', filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.6))' }}>
        {initial}
      </text>
      <g transform="translate(76, 18)">
        <RoleIcon kind={role} />
      </g>
      {isPartner && (
        <path d="M28 22 L40 28 L50 22 L60 28 L72 22 L70 30 L30 30 Z"
          fill="rgba(255,215,0,0.85)" stroke="rgba(140,90,0,0.7)" strokeWidth="0.6" />
      )}
    </svg>
  );
}

function stringSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return Math.abs(h);
}

type RoleKind = 'glass' | 'badge' | 'hat' | 'star' | 'flask' | 'gear' | 'fist' | 'doc' | 'plain';

function pickRole(features: string[], type?: string): RoleKind {
  if (type === 'event') return 'doc';
  for (const f of features) {
    if (f === '探偵' || f === '私立探偵' || f === '毛利探偵事務所') return 'glass';
    if (f === '警察') return 'badge';
    if (f === '怪盗') return 'hat';
    if (f === '少年探偵団') return 'star';
    if (f === '科学者') return 'flask';
    if (f === '発明家') return 'gear';
    if (f === '空手家') return 'fist';
  }
  return 'plain';
}

function RoleIcon({ kind }: { kind: RoleKind }) {
  const stroke = 'rgba(255,215,0,0.95)';
  const fill = 'rgba(255,215,0,0.18)';
  const w = 1.4;
  switch (kind) {
    case 'glass':
      return (
        <g>
          <circle cx="0" cy="0" r="6" stroke={stroke} strokeWidth={w} fill={fill} />
          <line x1="4" y1="4" x2="10" y2="10" stroke={stroke} strokeWidth={w + 0.4} strokeLinecap="round" />
        </g>
      );
    case 'badge':
      return <path d="M0 -7 L1.8 -2.5 L7 -2 L3 1.3 L4.3 6.5 L0 3.5 L-4.3 6.5 L-3 1.3 L-7 -2 L-1.8 -2.5 Z" stroke={stroke} strokeWidth={w} fill={fill} strokeLinejoin="round" />;
    case 'hat':
      return (
        <g>
          <rect x="-6" y="-1" width="12" height="2" stroke={stroke} strokeWidth={w} fill={fill} />
          <rect x="-4" y="-7" width="8" height="6" stroke={stroke} strokeWidth={w} fill={fill} />
        </g>
      );
    case 'star':
      return <path d="M0 -6 L1.5 -2 L6 -2 L2.5 0.8 L3.8 5 L0 2.6 L-3.8 5 L-2.5 0.8 L-6 -2 L-1.5 -2 Z" stroke={stroke} strokeWidth={w} fill={fill} strokeLinejoin="round" />;
    case 'flask':
      return (
        <g>
          <path d="M-2 -6 L-2 -2 L-5 5 L5 5 L2 -2 L2 -6 Z" stroke={stroke} strokeWidth={w} fill={fill} strokeLinejoin="round" />
          <line x1="-2" y1="-6" x2="2" y2="-6" stroke={stroke} strokeWidth={w} />
        </g>
      );
    case 'gear':
      return (
        <g>
          <circle cx="0" cy="0" r="3.5" stroke={stroke} strokeWidth={w} fill={fill} />
          {[0, 60, 120, 180, 240, 300].map((a, i) => (
            <line key={i} x1="0" y1="0"
              x2={Math.cos((a * Math.PI) / 180) * 7}
              y2={Math.sin((a * Math.PI) / 180) * 7}
              stroke={stroke} strokeWidth={w + 0.3} strokeLinecap="round" />
          ))}
        </g>
      );
    case 'fist':
      return (
        <g>
          <rect x="-5" y="-3" width="10" height="6" rx="1.5" stroke={stroke} strokeWidth={w} fill={fill} />
          <line x1="-3" y1="-3" x2="-3" y2="3" stroke={stroke} strokeWidth={w * 0.6} />
          <line x1="0" y1="-3" x2="0" y2="3" stroke={stroke} strokeWidth={w * 0.6} />
          <line x1="3" y1="-3" x2="3" y2="3" stroke={stroke} strokeWidth={w * 0.6} />
        </g>
      );
    case 'doc':
      return (
        <g>
          <circle cx="0" cy="0" r="5" stroke={stroke} strokeWidth={w} fill={fill} />
          <path d="M-2.5 0 L-0.5 2 L3 -2" stroke={stroke} strokeWidth={w + 0.2} fill="none" strokeLinecap="round" />
        </g>
      );
    default:
      return <circle cx="0" cy="0" r="4" stroke={stroke} strokeWidth={w} fill={fill} />;
  }
}
