// spec: .claude/specs/meta-ui/16-tutorial-real-board.md
// Phase 17-C': RealMatchView と TutorialBoardSnapshot の表示 resolver。
// 対戦に使える全カードと同じ ALL_CARDS 由来カタログを参照する。

import type { CaseMeta, HandCardMeta } from '@/ui/services/cardResolvers';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';
import { CARD_POOL } from '../data/cardPool';

const CARD_BY_NUM = new Map(CARD_POOL.map((card) => [card.num, card]));

export function resolveCard(cardId: string): ResolvedCardMeta {
  const card = CARD_BY_NUM.get(cardId);
  if (!card) return { name: '???', color: 'blue', ap: 0, lp: 0, lv: 0 };
  return {
    name: card.name,
    color: card.color,
    ap: card.ap ?? 0,
    lp: card.lp ?? 0,
    lv: card.level ?? card.cost ?? 0,
  };
}

export function resolveHandCard(cardId: string): HandCardMeta {
  const card = CARD_BY_NUM.get(cardId);
  if (!card) {
    return { cardId, name: '???', color: 'blue', type: 'キャラ', cost: 0, ap: null, lp: null, lv: 0 };
  }
  return {
    cardId,
    name: card.name,
    color: card.color,
    type: card.type === 'event' ? 'イベント' : 'キャラ',
    cost: card.cost ?? 0,
    ap: card.ap ?? null,
    lp: card.lp ?? null,
    lv: card.level ?? card.cost ?? 0,
  };
}

export function resolveCase(cardId: string): CaseMeta {
  const card = CARD_BY_NUM.get(cardId);
  if (!card || card.type !== 'case') return { title: cardId, color: 'blue', level: 0 };
  return {
    title: card.name,
    color: card.color,
    level: card.level ?? 0,
    orientation: undefined,
  };
}
