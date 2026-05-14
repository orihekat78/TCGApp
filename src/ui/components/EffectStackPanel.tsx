// Phase 7 Task 7.14: EffectStackPanel
// pendingEffects (効果スタック) の件数 + 各エントリを静的表示。
// 開閉は Phase 8 (本コンポーネントは件数表示 + open prop で展開)。
//
// mock には件数バッジ (.effect-stack, 1221 行・CSS 97 行) のみ。
// パネル本体は spec ベースで実装。
// rules: 15-abilities-effects.md, 22-qa-action-contact.md, 25-qa-effects-resolution.md

import type { JSX } from 'react';
import type { EffectStackEntry } from '@/engine/types/effect-stack.js';
import './EffectStackPanel.css';

export type EffectStackPanelProps = {
  entries: EffectStackEntry[];
  open: boolean;
};

const STATE_LABEL: Record<EffectStackEntry['state'], string> = {
  pending:   '待機中',
  resolving: '解決中',
  resolved:  '解決済',
  cancelled: '無効化',
};

export function EffectStackPanel({ entries, open }: EffectStackPanelProps): JSX.Element {
  const count = entries.length;
  const showBadge = count > 0;

  // ownerChosenOrder 昇順 → triggeredAt.nano 昇順で安定ソート
  const sorted = [...entries].sort((a, b) => {
    const ao = a.ownerChosenOrder ?? Number.MAX_SAFE_INTEGER;
    const bo = b.ownerChosenOrder ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.triggeredAt.nano - b.triggeredAt.nano;
  });

  return (
    <div className={`effect-stack-panel${open ? ' open' : ''}`} aria-expanded={open}>
      <div className="effect-stack-badge" aria-live="polite">
        <span className="effect-stack-label">効果解決</span>
        {showBadge && <span className="effect-stack-count">{count}</span>}
        {!showBadge && <span className="effect-stack-empty">—</span>}
      </div>

      {open && (
        <div className="effect-stack-list" role="list">
          {sorted.length === 0 ? (
            <div className="effect-stack-empty-list">スタックは空です</div>
          ) : (
            sorted.map((e) => (
              <div
                key={e.id}
                className={`effect-stack-entry side-${e.source.player} state-${e.state}`}
                data-effect-id={e.id}
                role="listitem"
              >
                <span className="entry-state">{STATE_LABEL[e.state]}</span>
                <span className="entry-player">{e.source.player === 'self' ? '自' : '相'}</span>
                <span className="entry-hook">{e.triggeredBy.hook}</span>
                {e.source.cardId !== undefined && (
                  <span className="entry-source">[{e.source.cardId}]</span>
                )}
                <span className="entry-turn">T{e.triggeredAt.turn}</span>
                {e.ownerChosenOrder !== undefined && (
                  <span className="entry-order">#{e.ownerChosenOrder + 1}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
