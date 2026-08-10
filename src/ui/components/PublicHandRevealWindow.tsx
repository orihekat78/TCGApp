import type { JSX } from 'react';
import { def as readDef } from '@/engine/read/def.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { useGameStateStore, type PendingPublicHandReveal } from '@/ui/state/store.js';
import { surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch.js';
import { shouldRenderEffectPicker } from '@/ui/services/effectPickerVisibility.js';
import { isHumanDecisionOwner } from '@/ui/services/humanDecisionOwner.js';
import { CardArt } from './CardArt.js';
import { CardExpandModal } from './CardExpandModal.js';
import './PublicHandRevealWindow.css';

type PublicHandRevealCardsProps = {
  pending: PendingPublicHandReveal;
  onOpenCard: (cardId: string) => void;
  embedded?: boolean;
  onClose?: () => void;
};

/** Shared card renderer. Linked effect reveals live inside their owning dialog. */
export function PublicHandRevealCards({
  pending,
  onOpenCard,
  embedded = false,
  onClose,
}: PublicHandRevealCardsProps): JSX.Element {
  const owner = pending.owner === 'self' ? '自分' : '相手';
  return (
    <aside
      className={`public-hand-reveal-window${embedded ? ' public-hand-reveal-window--embedded' : ''}`}
      data-testid="public-hand-reveal-window"
      aria-live="polite"
      onKeyDown={onClose ? (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } : undefined}
    >
        <div className="public-hand-reveal-heading-row">
          <div className="public-hand-reveal-heading" data-testid="public-hand-reveal-owner">{owner}の手札を公開</div>
          {onClose && (
            <button
              type="button"
              className="public-hand-reveal-close"
              data-testid="public-hand-reveal-close"
              aria-label="公開カードを閉じる"
              onClick={onClose}
            >
              閉じる
            </button>
          )}
        </div>
        <div className="public-hand-reveal-cards">
          {pending.cardIds.map((cardId, index) => {
            const name = readDef.card(cardId)?.names[0] ?? cardId;
            const occurrence = `${pending.resolutionToken}:${index}`;
            return (
              <article className="public-hand-reveal-card" data-testid={`public-hand-reveal-card-${index}`} data-occurrence={occurrence} key={occurrence}>
                <CardArt cardId={cardId} alt={name} className="public-hand-reveal-art" />
                <span className="public-hand-reveal-name">{name}</span>
                <span className="public-hand-reveal-occurrence">#{index + 1}</span>
                <button
                  type="button"
                  data-testid={`public-hand-reveal-detail-${index}`}
                  aria-label={`Details for ${name}, occurrence ${index + 1}`}
                  onClick={() => onOpenCard(cardId)}
                >
                  <span aria-hidden="true">🔍</span>
                </button>
              </article>
            );
          })}
        </div>
      </aside>
  );
}

/** Public cards embedded inside the decision that owns their effect lifetime. */
export function LinkedPublicHandReveal({
  resolutionToken,
}: {
  resolutionToken?: string;
}): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingPublicHandReveal);
  const expandModal = useCardExpandModal();
  if (!resolutionToken
    || pending?.lifetime !== 'effect'
    || pending.resolutionToken !== resolutionToken) return null;
  return (
    <>
      <PublicHandRevealCards pending={pending} onOpenCard={expandModal.open} embedded />
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </>
  );
}

/** A public reveal not already owned by the required effect-picker dialog. */
export function PublicHandRevealWindow(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingPublicHandReveal);
  const effectPick = useGameStateStore((s) => s.pendingEffectPick);
  const effectChoice = useGameStateStore((s) => s.pendingEffectChoice);
  const effectOptional = useGameStateStore((s) => s.pendingEffectOptional);
  const chooseIntercept = useGameStateStore((s) => s.pendingChooseIntercept);
  const gameState = useGameStateStore((s) => s.gameState);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const setPending = useGameStateStore((s) => s.setPendingPublicHandReveal);
  const expandModal = useCardExpandModal();

  if (!pending) return null;
  const ownedByEffectPicker = pending.lifetime === 'effect'
    && effectPick?.publicHandRevealToken === pending.resolutionToken
    && shouldRenderEffectPicker(effectPick, gameState, spectatorMode);
  const ownedByDecisionDialog = pending.lifetime === 'effect'
    && [effectChoice, effectOptional, chooseIntercept].some((decision) => (
      decision?.publicHandRevealToken === pending.resolutionToken
      && isHumanDecisionOwner(decision.player, spectatorMode)
    ));
  if (ownedByEffectPicker || ownedByDecisionDialog) return null;

  const close = pending.lifetime === 'presentation'
    ? () => {
        setPending(null);
        surfacePendingSideChannels();
      }
    : undefined;
  return (
    <>
      <PublicHandRevealCards
        pending={pending}
        onOpenCard={expandModal.open}
        onClose={close}
      />
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </>
  );
}
