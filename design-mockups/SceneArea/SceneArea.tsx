// SceneArea.tsx
// プレイヤーの「現場」ゾーン (最大 5 キャラスロット) を静的表示するコンポーネント。
// Phase 7 では操作系 (クリック/DnD/対象指定) は実装しない。
//
// 依存: SceneArea.css を読み込んでおくこと。
// クラス名は design-mockups/01-board-mockup.html の構造を流用しています。

import * as React from 'react';

// ------------------------------------------------------------------
// 型 (外部からも import できるよう export する)
// ------------------------------------------------------------------

export type CardColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';

export type SceneCharacter = {
  cardId: string;
  uid: string;
  state: 'active' | 'sleep' | 'stun';
  isNamed: boolean;
  enterOrder: number;
  setCards: { cardId: string; faceUp: boolean }[];
  stackedCards: number;
  apOverride: number | null;
  lpOverride: number | null;
};

// SceneArea は SceneCharacter しか受け取らないが、表示には
// 「カード ID → 名前 / 色 / AP / LP / Lv」を解決する必要がある。
// 本プロトタイプでは外部から resolveCard を注入する形にし、
// 実プロジェクトの CardDB と疎結合に保つ。
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
  /** cardId → 表示用メタを返す解決関数 (テスト時はモック注入) */
  resolveCard: (cardId: string) => ResolvedCardMeta;
  /** 最大スロット数 (デフォルト 5) */
  maxSlots?: number;
};

// ------------------------------------------------------------------
// 個別カード
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// SceneArea 本体
// ------------------------------------------------------------------

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

export default SceneArea;
