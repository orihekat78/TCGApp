import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types.js';
import { def as readDef } from '@/engine/read/def.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { publicCardOccurrenceLabel } from '@/ui/services/uidNames.js';
import { CardExpandModal } from './CardExpandModal.js';
import { SelectableCardTile } from './SelectableCardTile.js';
import { isHumanDecisionOwner } from '@/ui/services/humanDecisionOwner.js';
import { useModalFocusTrap } from '@/ui/hooks/useModalFocusTrap.js';
import { LinkedPublicHandReveal } from './PublicHandRevealWindow.js';
import type { DeclaredAbilityHostOrigin } from '@/engine/types';
import './ChoicePickerModal.css';

/** Dedicated responder prompt. This is intentionally separate from generic optional choices. */
export function ChooseInterceptModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingChooseIntercept);
  const gameState = useGameStateStore((s) => s.gameState);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const expandModal = useCardExpandModal();
  const isOpen = Boolean(pending && gameState && isHumanDecisionOwner(pending.player, spectatorMode));
  const dialogRef = useModalFocusTrap({ active: isOpen });
  if (!pending || !isOpen || !gameState) return null;

  if (pending.kind === 'order') {
    const resolveOrder = (
      protectorUid: string,
      targetUid: string,
      setCardInstanceId?: string,
      abilityOrigin?: DeclaredAbilityHostOrigin,
      abilityIndex?: number,
    ): void => {
      dispatchEngineAction(bindPendingDecision(pending, {
        type: 'chooseInterceptOrderResolve',
        protectorUid,
        targetUid,
        ...(abilityOrigin !== undefined ? { abilityOrigin, abilityIndex } : {}),
        ...(setCardInstanceId ? { setCardInstanceId } : {}),
      }));
    };
    return (
      <div
        ref={dialogRef}
        className="cp-overlay"
        role="dialog"
        aria-labelledby="choose-intercept-order-title"
        aria-modal="true"
        tabIndex={-1}
        data-testid="choose-intercept-order-modal"
      >
        <div className="cp-modal">
          <div className="cp-header">
            <h2 id="choose-intercept-order-title">同時に発動した能力の解決順を選んでください</h2>
            <p className="cp-sub">最初に解決する能力を選択します。残りの能力も必ず順に解決します。</p>
          </div>
          <div className="cp-body">
            <ul className="cp-list">
              {pending.choices.map((choice, index) => {
                const setCardInstanceId = choice.protector.setCardInstanceId;
                const abilityOccurrence = choice.protector.abilityOrigin !== undefined
                  ? `${choice.protector.abilityOrigin}:${choice.protector.abilityIndex}`
                  : undefined;
                const occurrenceId = setCardInstanceId
                  ?? (abilityOccurrence ? `${choice.protector.uid}:${abilityOccurrence}` : choice.protector.uid);
                const occurrenceTestId = setCardInstanceId
                  ? `-${setCardInstanceId}`
                  : abilityOccurrence ? `-${abilityOccurrence}` : '';
                return (
                <li key={`${choice.protector.uid}-${choice.targetUid}-${occurrenceId}`}>
                  <SelectableCardTile
                    cardId={choice.protector.cardId}
                    instanceId={occurrenceId}
                    occurrenceLabel={`能力 ${index + 1}`}
                    selectLabelSuffix="を先に解決"
                    selectTestId={`choose-intercept-order-${choice.protector.uid}-${choice.targetUid}${occurrenceTestId}`}
                    onSelect={() => resolveOrder(
                      choice.protector.uid,
                      choice.targetUid,
                      setCardInstanceId,
                      choice.protector.abilityOrigin,
                      choice.protector.abilityIndex,
                    )}
                    onExpand={expandModal.open}
                  />
                </li>
                );
              })}
            </ul>
          </div>
        </div>
        <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
      </div>
    );
  }

  const protector = readDef.card(pending.protector.cardId);
  const name = protector?.names[0] ?? pending.protector.cardId;
  const hand = gameState.players[pending.player].hand;
  const resolve = (discardIndex: number | null): void => {
    dispatchEngineAction(bindPendingDecision(pending, { type: 'chooseInterceptResolve', discardIndex }));
  };

  return (
    <div
      ref={dialogRef}
      className="cp-overlay"
      role="dialog"
      aria-labelledby="choose-intercept-title"
      aria-modal="true"
      tabIndex={-1}
      data-testid="choose-intercept-modal"
    >
      <div className="cp-modal">
        <div className="cp-header">
          <h2 id="choose-intercept-title">手札を1枚リムーブして、選んだ効果を続行しますか？</h2>
          <p className="cp-sub">
            {hand.length > 0
              ? `${name}の能力です。リムーブしない場合、選んだ効果は無効になります。`
              : `${name}の能力です。リムーブできないため、効果は無効になります。`}
          </p>
        </div>
        <div className="cp-body">
          <LinkedPublicHandReveal resolutionToken={pending.publicHandRevealToken} />
          <ul className="cp-list">
            {hand.map((cardId, index) => (
              <li key={`${cardId}-${index}`}>
                <SelectableCardTile
                  cardId={cardId}
                  instanceId={`hand:${pending.player}:${index}`}
                  occurrenceLabel={publicCardOccurrenceLabel(hand, cardId, index)}
                  selectLabelSuffix="をリムーブし、効果を続行"
                  selectTestId={`choose-intercept-discard-${index}`}
                  onSelect={() => resolve(index)}
                  onExpand={expandModal.open}
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="cp-actions">
          <button type="button" className="cp-btn cp-btn-cancel" onClick={() => resolve(null)} data-testid="choose-intercept-decline">
            リムーブしない（効果を無効にする）
          </button>
        </div>
      </div>
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </div>
  );
}
