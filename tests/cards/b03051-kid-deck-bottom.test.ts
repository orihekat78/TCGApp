// B03051 怪盗キッド — カード配線統合テスト (card-authoring wave15, 2026-07-02)
//   verb 単体 (deck-bottom-to-hand.test.ts) は runAtom 直叩き。本テストは【登場時】trigger + 【パートナー白】
//   condition gate が enter hook 経由で verb を実際に fire するかを end-to-end 検証 (BUG-117/118 教訓:
//   DSL に書けても engine が評価する保証はない → 実 hook 駆動で踏む)。
//   §1 partner=白 + enter → デッキ「下」1枚 (末尾) が手札へ (DECOY: 上=先頭は取らない)。
//   §2 partner≠白 → partnerColor gate で不発 (手札・デッキ不変)。
//   §3 a2 = icon-disguise + and[caseColor白, fileAtLeast6] 構造 (B02038 a3 clone)。
// rules: 12-next-hint.md, 14-refresh.md, 17-icons.md, 09-cutin-disguise.md, 26-qa-deck-refresh.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { B03051 } from '@/cards/ct-p03/B03051';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const PWHITE = 'PWHITE_SYN';
const PBLUE = 'PBLUE_SYN';
function partner(id: string, color: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'partner', names: [id], colors: [color], level: 0, ap: 0, lp: 2,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll();
  registerCardDef(partner(PWHITE, '白'));
  registerCardDef(partner(PBLUE, '青'));
  registerTriggeredListener();
});

function fireEnter(deck: string[], partnerId: string) {
  const s0 = produce(createEmptyGameState(), (d) => {
    d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    d.players.self.partner.cardId = partnerId;
    d.players.self.scene = [sceneChar('B03051', 'kid0', { state: 'active' })];
    d.players.self.deck = [...deck];
  });
  return produce(s0, (d) => {
    event.emit(d, 'enter', { uid: 'kid0', player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B03051', uid: 'kid0' });
    runAllUntilEmpty(d);
  });
}

describe('B03051 怪盗キッド — 【登場時】配線 + 【パートナー白】gate', () => {
  it('§1 partner=白: enter で「下」(末尾) 1枚が手札へ、上は残る', () => {
    const after = fireEnter(['TOP', 'MID', 'BOT'], PWHITE);
    expect(after.players.self.hand).toContain('BOT');        // デッキの下
    expect(after.players.self.hand).not.toContain('TOP');    // DECOY: top-take なら fail
    expect(after.players.self.deck).toEqual(['TOP', 'MID']); // 残りの上順不変
  });

  it('§2 partner=青: partnerColor gate 未充足 → 不発 (手札0・デッキ不変)', () => {
    const after = fireEnter(['TOP', 'MID', 'BOT'], PBLUE);
    expect(after.players.self.hand).toEqual([]);
    expect(after.players.self.deck).toEqual(['TOP', 'MID', 'BOT']);
  });

  it('§3 a2 icon-disguise 構造 = and[caseColor白, fileAtLeast6] (B02038 a3 clone)', () => {
    const a2 = B03051.abilities.find((a) => a.id === 'a2')!;
    expect(a2.type).toBe('icon-disguise');
    expect(a2.condition).toEqual({
      kind: 'and',
      cs: [{ kind: 'caseColor', color: '白' }, { kind: 'fileAtLeast', n: 6 }],
    });
  });
});
