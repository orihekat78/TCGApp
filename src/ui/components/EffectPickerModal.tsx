// user_request 20260522_01 #2/#6 BUG-054: human player による effect 対象選択 modal
//
// 役割:
//   - useGameStateStore.pendingEffectPick を subscribe
//   - pending.player === 'self' で表示
//   - 候補から 1 つ選択 → effectPickResolve dispatch
//   - n.min === 0 (任意効果) なら「スキップ」button 表示

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { def as readDef } from '@/engine/read/def.js';
import { isSceneDirectPick } from '@/ui/services/scenePick.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { CardArt } from './CardArt.js';
import { CardExpandModal } from './CardExpandModal.js';
import './EffectPickerModal.css';

/**
 * User vision: area-based pick は既存 UI (CardListModal / HandZone 拡大) を流用する方が
 * UX が良いため、EffectPickerModal は表示しない。
 * - evidenceToHand / handAddFromRemove → CardListModal kind='evidence'/'remove' (auto-open)
 * - discard → HandZone を pick mode で auto-expand
 * scene char / その他のキャラ pick は引き続き本 modal を使用する。
 */
// D11014 driver 2026-05-26: charModifyAP は scene pick (D08003 sceneRemove と同 UI 流用)、
// sceneEnter は CardListModal pick (D08013 evidenceToHand と同 UI 流用、area: remove)
const AREA_PICK_VERBS = new Set(['evidenceToHand', 'handAddFromRemove', 'deckRevealUntil', 'discard', 'sceneRemove', 'charModifyAP', 'sceneEnter', 'charStackCard']);

export function EffectPickerModal(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingEffectPick);
  const gameState = useGameStateStore((s) => s.gameState);
  // 夜間 W0 (2026-07-11, B08019 a2): multi-select mode (nMax>1) の選択集合。
  // pending が入れ替わったら選択をリセット (hook は early-return より前に置く — rules of hooks)。
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const expandModal = useCardExpandModal();
  useEffect(() => {
    setMultiSelected([]);
  }, [pending]);
  if (!pending || pending.player !== 'self') return null;
  // area pick は CardListModal に譲る (Playmat.tsx が auto-open する)
  if (AREA_PICK_VERBS.has(pending.atomVerb)) return null;
  // UI picker Direct Manipulation 化: scene-char を 1 枚選ぶ pick は Playmat が
  // 現場カード直接クリックで処理する (本 modal は出さない)。Playmat の isScenePick と
  // **同一述語** を共有して二重 UI / soft-lock を防ぐ (設計 v2 BLOCKER)。
  // 本 modal は n.max>1 や非scene混在の画像付きフォールバックとして残る。
  if (isSceneDirectPick(pending, gameState)) return null;

  const sourceName = pending.source.cardId
    ? readDef.card(pending.source.cardId)?.names?.[0] ?? pending.source.cardId
    : '効果';
  // W2b (P50/r27): mustBeSelectedByOppEvent forced 集合 — forced 以外は click 不可、skip 封じ。
  const forced = (pending.forcedUids ?? []).filter((u) => pending.candidates.some((c) => c.uid === u));
  const canSkip = pending.nMin === 0 && forced.length === 0;

  // 夜間 W0 (2026-07-11, B08019 a2「合わせて2枚 (自分と相手で1枚ずつ)」): nMax>1 = multi-select mode。
  //   - perSideMax: side 別選択数 quota — 到達 side の未選択候補を click 不可化 (engine greedy は AI 経路
  //     のみのため human enforce は本 modal が唯一の層、forcedUids と同 posture)。
  //   - nMin は engine 側で候補数に clamp されない (resolve-picks は printed n をそのまま運ぶ) —
  //     quota 下の実選択可能数 effAvail に clamp して soft-lock を防ぐ (「可能な限り行う」rules/15)。
  const isMulti = pending.nMax > 1;
  const quotaCappedAvail = (() => {
    if (typeof pending.perSideMax !== 'number') return pending.candidates.length;
    const bySide: Record<string, number> = {};
    for (const c of pending.candidates) bySide[c.player] = (bySide[c.player] ?? 0) + 1;
    return Object.values(bySide).reduce((acc, n) => acc + Math.min(n, pending.perSideMax!), 0);
  })();
  const effMin = Math.min(pending.nMin, quotaCappedAvail, pending.nMax);
  const effMax = Math.min(pending.nMax, quotaCappedAvail);
  const sideCount = (side: 'self' | 'opp'): number =>
    multiSelected.filter((u) => pending.candidates.find((c) => c.uid === u)?.player === side).length;
  const selectedLevel = multiSelected.reduce(
    (sum, uid) => sum + (readDef.card(pending.candidates.find((c) => c.uid === uid)?.cardId ?? '')?.level ?? 0),
    0,
  );
  const toggleMulti = (uid: string): void => {
    setMultiSelected((prev) => (prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]));
  };
  const multiBlocked = (c: { uid: string; cardId: string; player: 'self' | 'opp' }): boolean => {
    if (multiSelected.includes(c.uid)) return false; // 解除は常に可
    if (multiSelected.length >= effMax) return true;
    if (typeof pending.perSideMax === 'number' && sideCount(c.player) >= pending.perSideMax) return true;
    const level = readDef.card(c.cardId)?.level ?? 0;
    if (typeof pending.aggregateLevelMax === 'number' && selectedLevel + level > pending.aggregateLevelMax) return true;
    return false;
  };
  const multiConfirmOk = multiSelected.length >= effMin && multiSelected.length <= effMax;
  const handleMultiConfirm = (): void => {
    const first = multiSelected[0];
    if (first === undefined) {
      dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });
      return;
    }
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: first, pickedUids: multiSelected });
  };

  const handlePick = (uid: string): void => {
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: uid });
  };
  const handleSkip = (): void => {
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });
  };

  /**
   * User 指摘 (BUG-077 後): 裏向き証拠の cardId/名前が EffectPickerModal で
   * 見えてしまう問題。証拠 candidate (uid='evidence:<side>:<idx>') について
   * gameState から faceUp を確認し、裏向きなら「(非公開)」表示にする。
   */
  const candDisplayName = (c: { uid: string; cardId: string }): string => {
    const evMatch = c.uid.match(/^evidence:(self|opp):(\d+)$/);
    if (evMatch && gameState) {
      const evPlayer = evMatch[1] as 'self' | 'opp';
      const evIdx = parseInt(evMatch[2]!, 10);
      const evCard = gameState.players[evPlayer]?.evidence?.[evIdx];
      if (evCard && !evCard.faceUp) return '(非公開)';
    }
    return readDef.card(c.cardId)?.names?.[0] ?? c.cardId;
  };

  return (
    <>
    <div
      className="effect-picker-overlay"
      role="dialog"
      aria-labelledby="effect-picker-title"
      aria-modal="true"
      data-testid="effect-picker-modal"
    >
      <div className="effect-picker-modal">
        <div className="effect-picker-header">
          <h2 id="effect-picker-title">効果対象を選択</h2>
          <p className="effect-picker-sub">
            {isMulti
              ? `${sourceName}: 対象を選んでください (${multiSelected.length}/${effMax}${typeof pending.perSideMax === 'number' ? `、各陣営${pending.perSideMax}枚まで` : ''}${typeof pending.aggregateLevelMax === 'number' ? `、合計レベル${selectedLevel}/${pending.aggregateLevelMax}` : ''})`
              : `${sourceName}: 対象を選んでください`}
          </p>
        </div>
        <ul className="effect-picker-list">
          {pending.candidates.map((c, index) => {
            const name = candDisplayName(c);
            // 同名カード識別のためカード画像を表示 (Recognition over Recall)。
            // 裏向き証拠 ('(非公開)') は実画像を出さず placeholder にフォールバックさせる。
            const hidden = name === '(非公開)';
            // W2b (P50/r27): forced が居るとき forced 以外は選択不可 (「必ず選ぶ」)
            const forcedBlocked = forced.length > 0 && !forced.includes(c.uid);
            // 夜間 W0: multi mode は quota (effMax / perSideMax) 到達で未選択候補を不可化
            const quotaBlocked = isMulti && multiBlocked(c);
            const selected = isMulti && multiSelected.includes(c.uid);
            return (
              <li key={c.uid}>
                <div className="effect-picker-cand-row">
                <button
                  type="button"
                  className={`effect-picker-cand${forcedBlocked ? ' effect-picker-cand--blocked' : ''}${selected ? ' effect-picker-cand--selected' : ''}`}
                  disabled={forcedBlocked || quotaBlocked}
                  title={forcedBlocked ? '必ず選ぶキャラが優先されます' : quotaBlocked ? '選択上限に達しています (各陣営の枚数制限)' : undefined}
                  onClick={() => (isMulti ? toggleMulti(c.uid) : handlePick(c.uid))}
                  onContextMenu={hidden ? undefined : (event) => {
                    event.preventDefault();
                    expandModal.open(c.cardId);
                  }}
                  data-testid={`effect-pick-cand-${c.uid}`}
                  aria-pressed={isMulti ? selected : undefined}
                >
                  <CardArt cardId={hidden ? null : c.cardId} alt={name} className="cand-art" />
                  <span className="cand-name">{name}</span>
                  <span className="cand-side">{c.player === 'self' ? '自' : '相'}</span>
                  {selected && <span className="cand-selected-mark">✓</span>}
                </button>
                {!hidden && (
                  <button
                    type="button"
                    className="effect-picker-detail"
                    data-testid={`effect-pick-detail-${c.uid}`}
                    aria-label={`${name}（${index + 1}枚目）の詳細を表示`}
                    onClick={() => expandModal.open(c.cardId)}
                  >
                    Details
                  </button>
                )}
                </div>
              </li>
            );
          })}
        </ul>
        {isMulti && (
          <div className="effect-picker-actions">
            <button
              type="button"
              className="effect-picker-confirm"
              disabled={!multiConfirmOk}
              onClick={handleMultiConfirm}
              data-testid="effect-picker-confirm"
            >
              {`確定 (${multiSelected.length}枚)`}
            </button>
          </div>
        )}
        {canSkip && !isMulti && (
          <div className="effect-picker-actions">
            <button
              type="button"
              className="effect-picker-skip"
              onClick={handleSkip}
              data-testid="effect-picker-skip"
            >
              対象を選ばない (任意効果)
            </button>
          </div>
        )}
      </div>
    </div>
    <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </>
  );
}
