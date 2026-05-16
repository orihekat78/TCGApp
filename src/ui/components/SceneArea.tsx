// Phase 7 Task 7.4: SceneArea
// プレイヤーの「現場」ゾーン (最大 5 キャラスロット) を静的表示。
// 操作系 (クリック/DnD/対象指定) は Phase 8 で実装。
// rules: 03-field-areas.md §現場5枚上限, 20-color-and-switch.md
// 視覚: design-mockups/01-board-mockup.html 1326-1356 / 1452-1483 行 + 376-478 行 CSS
// 由来: Claude Design (Research Preview) — engine 型に接続して取込み

import { useEffect, useRef, useState, type JSX } from 'react';
import type { SceneCharacter } from '@/engine/types/game-state.js';
import './SceneArea.css';

// Phase 8.10g-2: 前回キャラ配列と現キャラ配列を比較し、消えた SceneCharacter を返す
export function pickRemovedCharacters(
  prev: readonly SceneCharacter[],
  current: readonly SceneCharacter[],
): SceneCharacter[] {
  const currentUids = new Set(current.map((c) => c.uid));
  return prev.filter((c) => !currentUids.has(c.uid));
}

const GHOST_DURATION_MS = 420;

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
  /** Phase 8.5: 推理/アクション 対象選択時の候補 uid 集合 (highlight 表示) */
  candidateUids?: ReadonlySet<string>;
  /** Phase 8.5: 候補キャラがクリックされたとき (uid 通知) */
  onUnitClick?: (uid: string) => void;
};

type SceneCharacterCardProps = {
  ch: SceneCharacter;
  meta: ResolvedCardMeta;
  isCandidate: boolean;
  onClick?: () => void;
  /** Phase 8.10g-2: ゴースト (fade-out 中) の場合 true → .removing クラスを付与 */
  isGhost?: boolean;
};

function SceneCharacterCard({ ch, meta, isCandidate, onClick, isGhost }: SceneCharacterCardProps): JSX.Element {
  const ap = ch.apOverride ?? meta.ap;
  const lp = ch.lpOverride ?? meta.lp;

  const classes = [
    'card',
    `color-${meta.color}`,
    ch.state === 'sleep' && 'sleep',
    ch.state === 'stun' && 'stun',
    isCandidate && 'candidate',
    isGhost && 'removing',
  ]
    .filter(Boolean)
    .join(' ');

  const setCount = ch.setCards.length;

  return (
    <div
      className={classes}
      data-uid={ch.uid}
      data-state={ch.state}
      onClick={isCandidate && onClick && !isGhost ? onClick : undefined}
      style={isCandidate && !isGhost ? { cursor: 'pointer' } : undefined}
      aria-hidden={isGhost ? 'true' : undefined}
    >
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
  const { characters, side, resolveCard, maxSlots = 5, candidateUids, onUnitClick } = props;

  // enterOrder 昇順で並べ替えて表示順を安定させる
  const sorted = [...characters].sort((a, b) => a.enterOrder - b.enterOrder);
  const filled = sorted.slice(0, maxSlots);
  const emptyCount = Math.max(0, maxSlots - filled.length);

  // Phase 8.10g-2: ゴーストトラッカー — 前回いて今いないキャラを 420ms フェード表示
  const prevCharsRef = useRef<SceneCharacter[]>([]);
  const [ghosts, setGhosts] = useState<
    Array<{ ch: SceneCharacter; meta: ResolvedCardMeta; key: string }>
  >([]);

  useEffect(() => {
    const removed = pickRemovedCharacters(prevCharsRef.current, characters);
    if (removed.length > 0) {
      const ts = Date.now();
      const newGhosts = removed.map((ch, i) => ({
        ch,
        meta: resolveCard(ch.cardId),
        key: `${ch.uid}-${ts}-${i}`,
      }));
      const keys = newGhosts.map((g) => g.key);
      setGhosts((prev) => [...prev, ...newGhosts]);
      setTimeout(() => {
        setGhosts((prev) => prev.filter((g) => !keys.includes(g.key)));
      }, GHOST_DURATION_MS);
    }
    prevCharsRef.current = characters;
  }, [characters, resolveCard]);

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
        {filled.map((ch) => {
          const isCandidate = candidateUids?.has(ch.uid) ?? false;
          return (
            <SceneCharacterCard
              key={ch.uid}
              ch={ch}
              meta={resolveCard(ch.cardId)}
              isCandidate={isCandidate}
              onClick={onUnitClick ? () => onUnitClick(ch.uid) : undefined}
            />
          );
        })}
        {ghosts.map((g) => (
          <SceneCharacterCard
            key={g.key}
            ch={g.ch}
            meta={g.meta}
            isCandidate={false}
            isGhost
          />
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <div key={`empty-${i}`} className="slot-empty" />
        ))}
      </div>
    </div>
  );
}
