// BUG-114: B03034 稲尾一久 カットイン実装 (engine変更0 — $contact.targetUid(BUG-104) + charSetCard opp-deck で stale gap 解消)。
// 【カットイン】AP＋1000、相手の現場にいるコンタクト中のキャラを1枚まで選び、
//   相手のデッキのカードを上から1枚裏向きでセットする
// $contact.targetUid = コンタクト中の相手キャラ (ガード時はガードキャラ)。
// charSetCard{player:'opp', fromDeckTop, faceUp:false} = 相手デッキ上端を相手キャラに裏向きセット。
// rules: 09-cutin-disguise.md, 16-card-set.md
import { describe, it, expect, beforeAll } from 'vitest';
import { B03034 } from '@/cards/ct-p03/B03034';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { char as charRead } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { EffectCtx, GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';


describe('B03034 稲尾一久 — カットイン (AP+1000 + 相手デッキ上端を相手コンタクトキャラに裏向きセット)', () => {
  beforeAll(() => registerAll());

  it('shape: cutin (effect:declared optional, sequence)', () => {
    expect(B03034.abilities.length).toBe(1);
    const a = B03034.abilities[0]!;
    expect(a.trigger?.hook).toBe('effect:declared');
    expect(a.trigger?.optional).toBe(true);
    expect(a.scope).toBe('on-hand');
  });

  it('runtime: atk AP+1000 + def に相手デッキ上端(DECK1)を裏向きセット + 相手デッキから除去', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [sceneChar('D11013', 'atk')]; // printed AP 1000
    s.players.opp.scene = [sceneChar('D11013', 'def')];
    s.players.opp.deck = ['DECK1', 'DECK2'];
    const ctx: EffectCtx = {
      source: { player: 'self', cardId: 'B03034', abilityId: 'a1' },
      bindings: { contact: [{ byUid: 'atk', targetUid: 'def', attackerSide: 'self' }] },
    } as unknown as EffectCtx;
    runEffect(s, B03034.abilities[0]!.effect!, ctx);
    runAllUntilEmpty(s);
    expect(charRead.ap(s, 'atk')).toBe(2000); // 1000 + 1000
    expect(s.players.opp.scene[0]!.setCards).toEqual([{ cardId: 'DECK1', faceUp: false }]);
    expect(s.players.opp.deck).toEqual(['DECK2']); // DECK1 が deck から除去
  });

  it('runtime: コンタクト相手キャラ不在 (targetUid 無) → セットは no-op、AP+1000 のみ', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [sceneChar('D11013', 'atk')];
    s.players.opp.deck = ['DECK1'];
    const ctx: EffectCtx = {
      source: { player: 'self', cardId: 'B03034', abilityId: 'a1' },
      bindings: { contact: [{ byUid: 'atk', attackerSide: 'self' }] }, // targetUid 無
    } as unknown as EffectCtx;
    runEffect(s, B03034.abilities[0]!.effect!, ctx);
    runAllUntilEmpty(s);
    expect(charRead.ap(s, 'atk')).toBe(2000);
    expect(s.players.opp.deck).toEqual(['DECK1']); // 除去されない
  });
});
