import type { JSX } from 'react';
import { useEffect } from 'react';
import { def as readDef } from '@/engine/read/def.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { useGameStateStore } from '@/ui/state/store.js';
import { surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch.js';
import { CardArt } from './CardArt.js';
import { CardExpandModal } from './CardExpandModal.js';
import './PublicHandRevealWindow.css';

/** A public effect window: visible alongside the linked picker, never a modal gate. */
export function PublicHandRevealWindow(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingPublicHandReveal);
  const setPending = useGameStateStore((s) => s.setPendingPublicHandReveal);
  const expandModal = useCardExpandModal();

  useEffect(() => {
    if (!pending || pending.lifetime !== 'presentation') return;
    const timer = setTimeout(() => {
      setPending(null);
      surfacePendingSideChannels();
    }, 1600);
    return () => clearTimeout(timer);
  }, [pending, setPending]);

  if (!pending) return null;
  const owner = pending.owner === 'self' ? '自分' : '相手';
  return (
    <>
      <aside className="public-hand-reveal-window" data-testid="public-hand-reveal-window" aria-live="polite">
        <div className="public-hand-reveal-heading" data-testid="public-hand-reveal-owner">{owner}の手札を公開</div>
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
                  onClick={() => expandModal.open(cardId)}
                >
                  Details
                </button>
              </article>
            );
          })}
        </div>
      </aside>
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </>
  );
}
