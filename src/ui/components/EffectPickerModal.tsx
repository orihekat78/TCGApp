// user_request 20260522_01 #2/#6 BUG-054: human player による effect 対象選択 modal
//
// 役割:
//   - useGameStateStore.pendingEffectPick を subscribe
//   - pending.player === 'self' で表示
//   - 候補から 1 つ選択 → effectPickResolve dispatch
//   - n.min === 0 (任意効果) なら「スキップ」button 表示

import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types.js';
import { def as readDef } from '@/engine/read/def.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { CardArt } from './CardArt.js';
import { CardExpandModal } from './CardExpandModal.js';
import { PublicHandRevealCards } from './PublicHandRevealWindow.js';
import { shouldRenderEffectPicker } from '@/ui/services/effectPickerVisibility.js';
import { effectivePendingPickRange, pendingPickSelectionViolation } from '@/engine/effect/pick-selection.js';
import {
  canRestoreModalFocus,
  isTopmostMatchModalRoot,
  withMatchMenuTrigger,
} from '@/ui/hooks/useMatchModalLayer.js';
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
export function EffectPickerModal(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingEffectPick);
  const publicHandReveal = useGameStateStore((s) => s.pendingPublicHandReveal);
  const gameState = useGameStateStore((s) => s.gameState);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  // 夜間 W0 (2026-07-11, B08019 a2): multi-select mode (nMax>1) の選択集合。
  // pending が入れ替わったら選択をリセット (hook は early-return より前に置く — rules of hooks)。
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const expandModal = useCardExpandModal();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!pending) {
      setMultiSelected([]);
      return;
    }
    const forced = (pending.forcedUids ?? [])
      .filter((uid) => pending.candidates.some((candidate) => candidate.uid === uid));
    const max = effectivePendingPickRange(pending).max;
    setMultiSelected(max > 1 && forced.length > 0 && forced.length <= max ? forced : []);
  }, [pending]);

  // area pick は CardListModal に譲る (Playmat.tsx が auto-open する)
  // A discard of another player's revealed hand cannot use the self HandZone.
  // Keep the finite public candidate list in this modal; it never enumerates
  // any unrevealed opponent-hand cards.
  const shouldRender = shouldRenderEffectPicker(pending, gameState, spectatorMode);

  // Required choices must be a complete keyboard dialog. Escape intentionally
  // does not resolve or dismiss: only the engine-approved actions may do that.
  useEffect(() => {
    if (!shouldRender) {
      const returnFocus = returnFocusRef.current;
      returnFocusRef.current = null;
      if (canRestoreModalFocus(returnFocus)) returnFocus.focus();
      return;
    }
    if (!returnFocusRef.current && document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
    return () => {
      const returnFocus = returnFocusRef.current;
      returnFocusRef.current = null;
      if (canRestoreModalFocus(returnFocus)) returnFocus.focus();
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender || expandModal.expandedCard) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const getFocusable = (): HTMLElement[] => withMatchMenuTrigger(
      dialog,
      Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),
    );
    const focusable = getFocusable();
    if (!dialog.contains(document.activeElement)) focusable[0]?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isTopmostMatchModalRoot(dialog)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = getFocusable();
      if (controls.length === 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        dialog.focus();
        return;
      }
      const activeIndex = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      event.stopImmediatePropagation();
      const nextIndex = event.shiftKey
        ? (activeIndex <= 0 ? controls.length - 1 : activeIndex - 1)
        : (activeIndex === -1 || activeIndex === controls.length - 1 ? 0 : activeIndex + 1);
      controls[nextIndex]?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [expandModal.expandedCard, pending?.decisionId, shouldRender]);

  if (!pending || !shouldRender) return null;

  const linkedPublicHandReveal = publicHandReveal?.lifetime === 'effect'
    && pending.publicHandRevealToken === publicHandReveal.resolutionToken
    ? publicHandReveal
    : null;

  const sourceName = pending.source.cardId
    ? readDef.card(pending.source.cardId)?.names?.[0] ?? pending.source.cardId
    : '効果';
  // W2b (P50/r27): mustBeSelectedByOppEvent forced 集合 — forced 以外は click 不可、skip 封じ。
  const forced = (pending.forcedUids ?? []).filter((u) => pending.candidates.some((c) => c.uid === u));
  const effectiveRange = effectivePendingPickRange(pending);
  const canSkip = effectiveRange.min === 0 && forced.length === 0;

  // 夜間 W0 (2026-07-11, B08019 a2「合わせて2枚 (自分と相手で1枚ずつ)」): nMax>1 = multi-select mode。
  //   - perSideMax: side 別選択数 quota — 到達 side の未選択候補を click 不可化 (engine greedy は AI 経路
  //     のみのため human enforce は本 modal が唯一の層、forcedUids と同 posture)。
  //   - nMin は engine 側で候補数に clamp されない (resolve-picks は printed n をそのまま運ぶ) —
  //     quota 下の実選択可能数 effAvail に clamp して soft-lock を防ぐ (「可能な限り行う」rules/15)。
  const isMulti = effectiveRange.max > 1;
  const effMin = effectiveRange.min;
  const effMax = effectiveRange.max;
  const forcedLockable = isMulti && forced.length > 0 && forced.length <= effMax;
  const selectedLevel = multiSelected.reduce(
    (sum, uid) => sum + (readDef.card(pending.candidates.find((c) => c.uid === uid)?.cardId ?? '')?.level ?? 0),
    0,
  );
  const toggleMulti = (uid: string): void => {
    setMultiSelected((prev) => {
      if (prev.includes(uid)) {
        if (forcedLockable && forced.includes(uid)) return prev;
        return prev.filter((selectedUid) => selectedUid !== uid);
      }
      return [...prev, uid];
    });
  };
  const multiBlocked = (c: { uid: string; cardId: string; player: 'self' | 'opp' }): boolean => {
    if (multiSelected.includes(c.uid)) return false; // 解除は常に可
    if (multiSelected.length >= effMax) return true;
    return pendingPickSelectionViolation(pending, [...multiSelected, c.uid], false) !== null;
  };
  const multiConfirmOk = multiSelected.length >= effMin
    && multiSelected.length <= effMax
    && pendingPickSelectionViolation(pending, multiSelected) === null;
  const handleMultiConfirm = (): void => {
    const first = multiSelected[0];
    if (first === undefined) {
      dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid: null }));
      return;
    }
    dispatchEngineAction(bindPendingDecision(
      pending,
      { type: 'effectPickResolve', pickedUid: first, pickedUids: multiSelected },
    ));
  };

  const handlePick = (uid: string): void => {
    dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid: uid }));
  };
  const handleSkip = (): void => {
    dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid: null }));
  };

  /**
   * User 指摘 (BUG-077 後): 裏向き証拠の cardId/名前が EffectPickerModal で
   * 見えてしまう問題。証拠 candidate (uid='evidence:<side>:<idx>') について
   * gameState から faceUp を確認し、裏向きなら「(非公開)」表示にする。
   */
  const isOpaqueCandidate = (c: { uid: string; hidden?: boolean }): boolean => {
    if (pending.atomVerb === 'stackedCardPick' || c.hidden === true) return true;
    const evMatch = c.uid.match(/^evidence:(self|opp):(\d+)$/);
    if (!evMatch || !gameState) return false;
    const evPlayer = evMatch[1] as 'self' | 'opp';
    const evIdx = parseInt(evMatch[2]!, 10);
    return gameState.players[evPlayer]?.evidence?.[evIdx]?.faceUp === false;
  };
  const candDisplayName = (
    c: { uid: string; cardId: string; hidden?: boolean },
    index: number,
  ): string => {
    if (isOpaqueCandidate(c)) return `非公開カード ${index + 1}`;
    return readDef.card(c.cardId)?.names?.[0] ?? c.cardId;
  };

  return (
    <>
    <div
      ref={dialogRef}
      className="effect-picker-overlay"
      role="dialog"
      data-match-modal-registered="true"
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
        {linkedPublicHandReveal && (
          <PublicHandRevealCards
            pending={linkedPublicHandReveal}
            onOpenCard={expandModal.open}
            embedded
          />
        )}
        <ul className="effect-picker-list">
          {pending.candidates.map((c, index) => {
            const name = candDisplayName(c, index);
            // 同名カード識別のためカード画像を表示 (Recognition over Recall)。
            // 裏向き証拠 ('(非公開)') は実画像を出さず placeholder にフォールバックさせる。
            const hidden = isOpaqueCandidate(c);
            // W2b (P50/r27): forced が居るとき forced 以外は選択不可 (「必ず選ぶ」)
            const forcedBlocked = !forced.includes(c.uid)
              && forced.length > 0
              && (!isMulti || forced.length >= effMax);
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
                  aria-label={hidden
                    ? `${c.player === 'self' ? '自分' : '相手'}の非公開カード ${index + 1}枚目を${selected ? '選択解除' : '選択'}`
                    : undefined}
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
                    <span aria-hidden="true">🔍</span>
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
