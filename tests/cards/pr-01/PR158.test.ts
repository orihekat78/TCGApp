// tests/cards/pr-01/PR158 犯人 (character, cutin remove-name scaling AP)
// spec: engine additive wave A2 (2026-07-02) — $self.removeNameCount dyn exemplar

import { describe, it, expect } from 'vitest';
import { PR158 } from '@/cards/pr-01/PR158';
import { PR164 } from '@/cards/pr-01/PR164';
import { engine } from '@/engine';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type { EffectCtx, SceneCharacter } from '@/engine/types';

function mkChar(uid: string, cardId: string): SceneCharacter {
  return { cardId, uid, state: 'active', isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} };
}

describe('PR158 犯人 (character, cutin remove-name scaling AP)', () => {
  it('shape: id, kind, level=2, ap=1000, lp=1, 犯人 trait, single cutin ability', () => {
    expect(PR158.id).toBe('PR158');
    expect(PR158.no).toBe('0627/PR158');
    expect(PR158.kind).toBe('character');
    expect(PR158.names).toEqual(['犯人']);
    expect(PR158.colors).toEqual(['黒']);
    expect(PR158.level).toBe(2);
    expect(PR158.ap).toBe(1000);
    expect(PR158.lp).toBe(1);
    expect(PR158.traits).toEqual(['犯人']);
    expect(PR158.deckLimit).toBe('unlimited');
    // 「デッキに何枚でも入れられる」はデッキ構築ルール → AbilityDef 非表現。カットイン a1 のみ。
    expect(PR158.abilities.length).toBe(1);
  });

  it('a1: on-hand cutin, 自分ターン中, delta via $self.removeNameCount dyn', () => {
    const a1 = PR158.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-hand');
    expect(a1.trigger?.hook).toBe('effect:declared');
    expect(a1.trigger?.optional).toBe(true);
    expect(a1.condition).toEqual({ kind: 'turn', player: 'self' });
    const eff = a1.effect as { kind: string; verb: string; args: { delta: { dyn: string }; scope: string } };
    expect(eff.verb).toBe('charModifyAP');
    expect(typeof eff.args.delta).toBe('object');
    expect(eff.args.delta.dyn).toMatch(/\$self\.removeNameCount\.犯人/);
    expect(eff.args.scope).toBe('contact');
  });

  it('PR164 variant: same text, different art (imageUrl), same 0627 name', () => {
    expect(PR164.id).toBe('PR164');
    expect(PR164.names).toEqual(['犯人']);
    expect(PR164.deckLimit).toBe('unlimited');
    expect(PR164.imageUrl).not.toBe(PR158.imageUrl);
    expect((PR164.abilities[0].effect as { args: { delta: { dyn: string } } }).args.delta.dyn)
      .toBe((PR158.abilities[0].effect as { args: { delta: { dyn: string } } }).args.delta.dyn);
  });

  // runtime オラクル: リムーブエリアの犯人数 × 2000 を コンタクト中キャラに AP+ (自身も remove 内 → 計数、decoy 除外)
  it('runtime: cutin が リムーブの[犯人]数 × 2000 を コンタクト中キャラに AP+ する (decoy 非計数)', () => {
    _resetRegistry();
    registerCardDef(PR158);
    registerCardDef(PR164);
    registerCardDef({ ...PR158, id: 'ATK', no: 'ATK', names: ['攻撃'], traits: [] }); // 非[犯人] の攻撃キャラ
    registerCardDef({ ...PR158, id: 'DECOY', no: 'DECOY', names: ['灰原哀'], traits: [] }); // 非[犯人] の decoy
    const s = createEmptyGameState();
    s.players.self.scene = [mkChar('atk', 'ATK')];
    // リムーブに 犯人 ×2 (PR158/PR164、使用中カットイン自身が remove 内を含む) + decoy ×1 (数えない)
    s.players.self.remove = ['PR158', 'DECOY', 'PR164'];
    s.players.opp.remove = ['PR158', 'PR158']; // 相手の remove は 自分の限定 ゆえ 数えない
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'hand', cardId: 'PR158', abilityId: 'a1' },
      bindings: { contact: [{ byUid: 'atk', byPlayer: 'self', attackerSide: 'self' }] as never },
    };
    const resolved = resolveEffectPicks(s, PR158.abilities[0].effect as never, ctx);
    engine.effect.run(s, resolved as never, ctx);
    const atk = s.players.self.scene.find((c) => c.uid === 'atk')!;
    expect(atk.turnEffects['apMod_contact']).toBe(4000); // 犯人 2 × 2000 (decoy/相手 remove 除外), number
  });
});
