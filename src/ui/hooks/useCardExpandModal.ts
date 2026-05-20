// Round 4l (BUG-001): カード拡大 modal の state 管理 hook
//
// 使い方:
//   const { expandedCard, open, close } = useCardExpandModal();
//   <CardExpandModal cardId={expandedCard} onClose={close} />
//   <PartnerArea onExpand={() => open(partnerCardId)} ... />

import { useCallback, useState } from 'react';
import type { CardId } from '@/engine/types';

export function useCardExpandModal(): {
  expandedCard: CardId | null;
  open: (cardId: CardId) => void;
  close: () => void;
} {
  const [expandedCard, setExpandedCard] = useState<CardId | null>(null);
  const open = useCallback((cardId: CardId) => setExpandedCard(cardId), []);
  const close = useCallback(() => setExpandedCard(null), []);
  return { expandedCard, open, close };
}
