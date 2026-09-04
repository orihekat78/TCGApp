// Phase 7 Task 7.4: SceneArea
// プレイヤーの「現場」ゾーン (最大 5 キャラスロット) を静的表示。
// 操作系 (クリック/DnD/対象指定) は Phase 8 で実装。
// rules: 03-field-areas.md §現場5枚上限, 20-color-and-switch.md
// 視覚: design-mockups/01-board-mockup.html 1326-1356 / 1452-1483 行 + 376-478 行 CSS
// 由来: Claude Design (Research Preview) — engine 型に接続して取込み

/* eslint-disable no-irregular-whitespace -- The Japanese area label retains its typographic spacing. */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { SceneCharacter } from '@/engine/types/game-state.js';
import { CardArt } from './CardArt.js';
import './SceneArea.css';

// BUG-092/093: 名乗り例外 (速攻/突撃系) キーワードのバッジ表示。突撃の付与を視認できるように
// 名乗りバッジと同様に表示する。read.char.keywords の有効キーワード集合と照合する。
const CHARGE_BADGES: { kw: string; label: string }[] = [
  { kw: '迅速', label: '迅' },
  { kw: '突撃', label: '突' },
  { kw: '突撃[キャラ]', label: '突キ' },
  { kw: '突撃[事件]', label: '突事' },
];

// Phase 8.10g-2: 前回キャラ配列と現キャラ配列を比較し、消えた SceneCharacter を返す
export function pickRemovedCharacters(
  prev: readonly SceneCharacter[],
  current: readonly SceneCharacter[],
): SceneCharacter[] {
  const currentUids = new Set(current.map((c) => c.uid));
  return prev.filter((c) => !currentUids.has(c.uid));
}

const GHOST_DURATION_MS = 420;

export type CardColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple' | 'black' | 'white';

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
  /** Round 4l (BUG-001): 候補でないとき click で expand modal を開く */
  onExpand?: (cardId: string) => void;
  /** Requests a privacy-filtered browse view of cards set under a character. */
  onSetInspect?: (character: SceneCharacter) => void;
  /** Requests the public browse view of cards stacked under a character. */
  onStackInspect?: (character: SceneCharacter) => void;
  /**
   * Effect pick mode (User vision: SceneArea も pick UI として流用)。
   * 候補 uid 集合。空でなければ各 char が pick 対象として黄色枠 + click 可能化。
   * onPickChar が同時に渡された場合のみ動作。
   */
  pickCharUids?: ReadonlySet<string>;
  /** Pick mode で char が選択されたとき (uid 通知) */
  onPickChar?: (uid: string) => void;
  /** Exact pick target that receives focus when a direct-pick session opens. */
  autoFocusPickUid?: string;
  /**
   * BUG-092/093: char uid → 有効キーワード (read.char.keywords)。突撃/迅速 等のバッジ表示に使う。
   * 省略時はバッジ非表示。
   */
  resolveKeywords?: (uid: string) => readonly string[];
  /**
   * BUG-110: char uid → 修正反映後の有効 AP/LP (read.char.ap/lp)。カード下の数値を base ではなく
   * 「AP＋XXXX / LP＋X が反映された有効値」で表示するため。省略時は ch.apOverride ?? meta.ap (旧挙動)。
   */
  resolveCharStats?: (uid: string) => { ap: number; lp: number } | undefined;
  /**
   * アクティブカード「ぴこんポップ」(Task2): 効果解決中 / CPU が今動かしているカードの uid。
   * 一致する現場キャラをその場で軽く拡大+グロー (MasterDuel風) し、行動チップを表示する。
   */
  activeCardUid?: string | null;
  /** activeCardUid のカードに表示する行動ラベル (例: 効果解決 / 登場 / 推理 / アクション) */
  activeCardLabel?: string | null;
};

type SceneCharacterCardProps = {
  ch: SceneCharacter;
  meta: ResolvedCardMeta;
  isCandidate: boolean;
  onClick?: () => void;
  /** Round 4l (BUG-001): 候補でないとき click で expand modal を開く */
  onExpand?: (cardId: string) => void;
  onSetInspect?: () => void;
  onStackInspect?: () => void;
  /** Phase 8.10g-2: ゴースト (fade-out 中) の場合 true → .removing クラスを付与 */
  isGhost?: boolean;
  /** Pick mode (effect pick) — true で黄色枠 + cursor pointer。onPickClick 経由で発火 */
  isPickable?: boolean;
  /** Pick mode で click → onPickClick (uid 通知) */
  onPickClick?: () => void;
  /** Direct-pick mode entry moves keyboard focus to this exact card target. */
  focusPick?: boolean;
  /** One-based visible scene position, used to distinguish duplicate card names. */
  pickOrdinal?: number;
  /** BUG-092/093: このキャラの有効キーワード一覧 (突撃/迅速 バッジ表示用) */
  chargeKeywords?: readonly string[];
  /** BUG-110: 修正反映後の有効 AP/LP (省略時は ch.apOverride ?? meta.ap) */
  stats?: { ap: number; lp: number };
  /** Task2: このキャラがアクティブカード (効果解決中/CPU 操作中) のとき true → ぴこんポップ + チップ */
  isActive?: boolean;
  /** isActive 時にチップに出す行動ラベル */
  activeLabel?: string | null;
};

function SceneCharacterCard({ ch, meta, isCandidate, onClick, onExpand, onSetInspect, onStackInspect, isGhost, isPickable, onPickClick, focusPick, pickOrdinal, chargeKeywords, stats, isActive, activeLabel }: SceneCharacterCardProps): JSX.Element {
  const pickButtonRef = useRef<HTMLButtonElement>(null);
  const charges = CHARGE_BADGES.filter((b) => (chargeKeywords ?? []).includes(b.kw));
  // BUG-110: カード下の数値は「修正反映後の有効値」(read.char.ap/lp) を表示する。
  // base (印字値 meta.ap/lp) と異なれば .modified を付けて着色し、AP＋XXXX/LP＋X の反映を視認可能にする。
  const ap = stats?.ap ?? ch.apOverride ?? meta.ap;
  const lp = stats?.lp ?? ch.lpOverride ?? meta.lp;
  const apModified = ap !== meta.ap;
  const lpModified = lp !== meta.lp;

  const classes = [
    'card',
    `color-${meta.color}`,
    ch.state === 'sleep' && 'sleep',
    ch.state === 'stun' && 'stun',
    isCandidate && 'candidate',
    isGhost && 'removing',
    isPickable && 'effect-pickable',
    isActive && 'is-active-pop',
  ]
    .filter(Boolean)
    .join(' ');

  const setCount = ch.setCards.length;
  const browseSetCards = setCount > 0 && onSetInspect !== undefined;
  const stackCount = Array.isArray(ch.stackedCards) ? ch.stackedCards.length : ch.stackedCards;
  const pickHandler = !isGhost && isPickable ? onPickClick : undefined;

  useEffect(() => {
    if (focusPick) pickButtonRef.current?.focus();
  }, [focusPick]);

  return (
    <div
      className={classes}
      data-uid={ch.uid}
      data-card-id={ch.cardId}
      // Task5 FLIP: 実カードのみに付与 (ゴーストは leave アニメ専任なので除外)。
      // useFlipAnimation がこの属性を計測対象として reflow 移動をトゥイーンする。
      data-flip-id={isGhost ? undefined : ch.uid}
      data-state={ch.state}
      onClick={
        isGhost
          ? undefined
          : pickHandler
            ? undefined
            : isCandidate && onClick
              ? onClick
              : undefined
      }
      style={((isCandidate || isPickable) && !isGhost) ? { cursor: 'pointer' } : undefined}
      aria-hidden={isGhost ? 'true' : undefined}
    >
      {pickHandler ? (
        <button
          ref={pickButtonRef}
          type="button"
          className="scene-card-pick-button"
          data-testid={`scene-card-pick-${ch.uid}`}
          aria-label={`${meta.name}を選択（現場${pickOrdinal ?? 1}枚目）`}
          onClick={(event) => {
            event.stopPropagation();
            pickHandler();
          }}
        />
      ) : null}
      <div className="color-stripe" />
      {isActive && activeLabel ? (
        <div className="card-activity-chip">{activeLabel}</div>
      ) : null}
      <div className="art">
        <CardArt cardId={ch.cardId} alt={meta.name} />
      </div>
      <div className="name">{meta.name}</div>
      <div className="stats">
        <span className={apModified ? 'ap modified' : 'ap'} data-mod={apModified ? (ap > meta.ap ? 'up' : 'down') : undefined}>{ap}</span>
        <span className={lpModified ? 'lp modified' : 'lp'} data-mod={lpModified ? (lp > meta.lp ? 'up' : 'down') : undefined}>{lp}</span>
        <span className="lv">{meta.lv}</span>
      </div>

      {ch.isNamed && <div className="named-badge">名</div>}
      {charges.length > 0 && (
        <div className="charge-badges" data-testid={`charge-badges-${ch.uid}`}>
          {charges.map((b) => (
            <div key={b.kw} className="charge-badge" title={b.kw}>
              {b.label}
            </div>
          ))}
        </div>
      )}
      {onExpand && !isGhost && (
        <button
          type="button"
          className="scene-card-detail-button"
          data-testid={`scene-card-detail-${ch.uid}`}
          aria-label={`${meta.name}の詳細を確認`}
          onClick={(event) => {
            event.stopPropagation();
            onExpand(ch.cardId);
          }}
        >
          <span className="scene-card-detail-icon" aria-hidden="true">🔍</span>
        </button>
      )}
      {browseSetCards && !isGhost && (
        <button
          type="button"
          className="set-badge"
          data-testid={`scene-set-inspect-${ch.uid}`}
          aria-label={`セットカード ${setCount}枚を確認`}
          onClick={(event) => {
            event.stopPropagation();
            onSetInspect();
          }}
        >
          +{setCount}
        </button>
      )}
      {stackCount > 0 && !isGhost && (onStackInspect ? (
          <button
            type="button"
            className="stack-badge"
            data-testid={`scene-stack-inspect-${ch.uid}`}
            aria-label={`重ねたカード ${stackCount}枚を確認`}
            onClick={(event) => {
              event.stopPropagation();
              onStackInspect();
            }}
          >
            ×{stackCount + 1}
          </button>
        ) : (
          <div className="stack-badge">×{stackCount + 1}</div>
        ))}
    </div>
  );
}

export function SceneArea(props: SceneAreaProps): JSX.Element {
  const { characters, side, resolveCard, maxSlots = 5, candidateUids, onUnitClick, onExpand, onSetInspect, onStackInspect, pickCharUids, onPickChar, autoFocusPickUid, resolveKeywords, resolveCharStats, activeCardUid, activeCardLabel } = props;

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
        {filled.map((ch, index) => {
          const isCandidate = candidateUids?.has(ch.uid) ?? false;
          const isPickable = pickCharUids?.has(ch.uid) ?? false;
          return (
            <SceneCharacterCard
              key={ch.uid}
              ch={ch}
              meta={resolveCard(ch.cardId)}
              isCandidate={isCandidate}
              onClick={onUnitClick ? () => onUnitClick(ch.uid) : undefined}
              onExpand={onExpand}
              onSetInspect={onSetInspect ? () => onSetInspect(ch) : undefined}
              onStackInspect={onStackInspect ? () => onStackInspect(ch) : undefined}
              isPickable={isPickable}
              onPickClick={isPickable && onPickChar ? () => onPickChar(ch.uid) : undefined}
              focusPick={isPickable && ch.uid === autoFocusPickUid}
              pickOrdinal={index + 1}
              chargeKeywords={resolveKeywords?.(ch.uid)}
              stats={resolveCharStats?.(ch.uid)}
              isActive={activeCardUid != null && ch.uid === activeCardUid}
              activeLabel={activeCardLabel}
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
