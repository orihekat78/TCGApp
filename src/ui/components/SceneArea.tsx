// Phase 7 Task 7.4: SceneArea
// プレイヤーの「現場」ゾーン (最大 5 キャラスロット) を静的表示。
// 操作系 (クリック/DnD/対象指定) は Phase 8 で実装。
// rules: 03-field-areas.md §現場5枚上限, 20-color-and-switch.md
// 視覚: design-mockups/01-board-mockup.html 1326-1356 / 1452-1483 行 + 376-478 行 CSS
// 由来: Claude Design (Research Preview) — engine 型に接続して取込み

import type { JSX } from 'react';
import type { SceneCharacter } from '@/engine/types/game-state.js';
import './SceneArea.css';

export type CardColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';

// cardId → 表示用メタを解決する関数 (CardDB と疎結合に保つための注入点)
export type ResolvedCardMeta = {
  name: string;
  color: CardColor;
  ap: number;
  lp: number;
  lv: number;
};

export type SceneAreaProps = {
  characters: SceneCharacter[];
  side: 'self' | 'opp';
  resolveCard: (cardId: string) => ResolvedCardMeta;
  /** 最大スロット数 (デフォルト 5; rules/03 で 5 枚上限) */
  maxSlots?: number;
};

type SceneCharacterCardProps = {
  ch: SceneCharacter;
  meta: ResolvedCardMeta;
};

function SceneCharacterCard({ ch, meta }: SceneCharacterCardProps): JSX.Element {
  const ap = ch.apOverride ?? meta.ap;
  const lp = ch.lpOverride ?? meta.lp;

  const classes = [
    'card',
    `color-${meta.color}`,
    ch.state === 'sleep' && 'sleep',
    ch.state === 'stun' && 'stun',
  ]
    .filter(Boolean)
    .join(' ');

  const setCount = ch.setCards.length;

  return (
    <div className={classes} data-uid={ch.uid}>
      <div className="color-stripe" />
      <div className="art">
        <div className="silhouette" />
      </div>
      <div className="name">{meta.name}</div>
      <div className="stats">
        <span className="ap">{ap}</span>
        <span className="lp">{lp}</span>
        <span className="lv">{meta.lv}</span>
      </div>

      {ch.isNamed && <div className="named-badge">名</div>}
      {setCount > 0 && <div className="set-badge">+{setCount}</div>}
      {ch.stackedCards > 0 && (
        <div className="stack-badge">×{ch.stackedCards + 1}</div>
      )}
    </div>
  );
}

export function SceneArea(props: SceneAreaProps): JSX.Element {
  const { characters, side, resolveCard, maxSlots = 5 } = props;

  // enterOrder 昇順で並べ替えて表示順を安定させる
  const sorted = [...characters].sort((a, b) => a.enterOrder - b.enterOrder);
  const filled = sorted.slice(0, maxSlots);
  const emptyCount = Math.max(0, maxSlots - filled.length);

  return (
    <div
      className={`zone scene-col scene-zone scene-area side-${side}`}
      data-side={side}
    >
      <div className="zone-watermark" aria-hidden="true">
        現　場
      </div>
      <div className="zone-label">
        <span>現場</span>
        <span className="count">
          {filled.length} / {maxSlots}
        </span>
      </div>
      <div className="scene-slots">
        {filled.map((ch) => (
          <SceneCharacterCard
            key={ch.uid}
            ch={ch}
            meta={resolveCard(ch.cardId)}
          />
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <div key={`empty-${i}`} className="slot-empty" />
        ))}
      </div>
    </div>
  );
}
