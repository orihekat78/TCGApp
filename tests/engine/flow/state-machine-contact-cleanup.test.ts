// BUG-143: contact-scope 修正値 (apMod_contact 等) は contact-end → action-end 遷移で清掃される
// rules: 08-contact.md §6 (カットインによる効果はコンタクト終了時に切れる), 23-qa-disguise-cutin.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { advance } from '@/engine/flow/action/state-machine';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState, ActionContext } from '@/engine/types';

function makeCard(id: string, ap = 2000): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['赤'],
    level: 1,
    ap,
    lp: 1000,
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

describe('BUG-143: contact-scope cleanup at contact-end', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('apMod_contact は contact-end→action-end 遷移で清掃され、同ターン後続コンタクトに漏出しない', () => {
    registerCardDef(makeCard('Atk'));
    registerCardDef(makeCard('Def', 1000));
    let aUid = '';
    let bUid = '';
    const s0: GameState = produce(createEmptyGameState(), draft => {
      aUid = mutate.scene.enter(draft, 'self', 'Atk', {}).uid;
      bUid = mutate.scene.enter(draft, 'opp', 'Def', {}).uid;
      // カットイン由来の contact-scope AP+ を疑似的に積む (コンタクト中に発生する修正)
      mutate.char.modifyAP(draft, aUid, 3000, 'contact');
    });
    // 積んだ直後は残っている (前提確認)
    expect(s0.players.self.scene.find(c => c.uid === aUid)!.turnEffects['apMod_contact']).toBe(3000);

    const ax: ActionContext = {
      id: 'ax-bug143',
      byUid: aUid,
      byPlayer: 'self',
      target: { kind: 'char', uid: bUid },
      phase: 'judge',
      cutInUsed: {},
      startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid, aAP: 2000, bUid, bAP: 1000 },
      contactImmune: false,
    };
    const s1: GameState = produce(s0, draft => {
      advance(draft, ax); // judge → contact-end (emit contact:end)
      advance(draft, ax); // contact-end → action-end (清掃)
    });

    const atk = s1.players.self.scene.find(c => c.uid === aUid)!;
    expect(atk.turnEffects['apMod_contact']).toBeUndefined();
  });
});
