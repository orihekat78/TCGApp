// tests/cards/ct-d08/D08007
// spec: .claude/specs/cards-analysis/D08007.md

import { describe, it, expect } from 'vitest';
import { D08007 } from '@/cards/ct-d08/D08007';
import { D08008 } from '@/cards/ct-d08/D08008';
import { engine } from '@/engine';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type { EffectCtx, SceneCharacter } from '@/engine/types';

function mkChar(uid: string, cardId: string): SceneCharacter {
  return { cardId, uid, state: 'active', isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} };
}

describe('D08007 吉田歩美 (character, cutin trait scaling AP)', () => {
  it('shape: id, kind, level=2, ap=1000, lp=1', () => {
    expect(D08007.id).toBe('D08007');
    expect(D08007.no).toBe('0491/D08007');
    expect(D08007.kind).toBe('character');
    expect(D08007.names).toEqual(['吉田歩美']);
    expect(D08007.colors).toEqual(['青']);
    expect(D08007.level).toBe(2);
    expect(D08007.ap).toBe(1000);
    expect(D08007.lp).toBe(1);
    expect(D08007.abilities.length).toBe(1);
  });

  it('a1: icon-cutin, 自分ターン中, delta via $dyn expression', () => {
    const a1 = D08007.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('effect:declared');
    expect(a1.trigger?.optional).toBe(true);
    expect(a1.condition).toEqual({ kind: 'turn', player: 'self' });
    const eff = a1.effect as { kind: string; verb: string; args: { delta: { dyn: string } } };
    expect(eff.kind).toBe('atom');
    expect(eff.verb).toBe('charModifyAP');
    // object dyn 形 {dyn} (旧 bare string は resolveDynArgs が評価せず AP 文字列化していた → 修正)
    expect(typeof eff.args.delta).toBe('object');
    expect(eff.args.delta.dyn).toMatch(/\$self\.sceneTrait/);
  });

  it('D08008 variant shares abilities with D08007', () => {
    expect(D08008.abilities).toBe(D08007.abilities);
    expect(D08008.id).toBe('D08008');
    expect(D08008.imageUrl).not.toBe(D08007.imageUrl);
  });

  // runtime オラクル (従来 shape のみで動作未検証だったため bug を見逃していた)
  it('runtime: cutin が 自陣現場の[少年探偵団]数 × 1000 を コンタクト中キャラに AP+ する', () => {
    _resetRegistry();
    registerCardDef(D08007); // traits ['少年探偵団']
    registerCardDef({ ...D08007, id: 'ATK', no: 'ATK', traits: [] }); // 非[少年探偵団] の攻撃キャラ
    const s = createEmptyGameState();
    s.players.self.scene = [mkChar('atk', 'ATK'), mkChar('s1', 'D08007'), mkChar('s2', 'D08007')]; // 少年探偵団 2枚
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'hand', cardId: 'D08007', abilityId: 'a1' },
      bindings: { contact: [{ byUid: 'atk', byPlayer: 'self', attackerSide: 'self' }] as never },
    };
    const resolved = resolveEffectPicks(s, D08007.abilities[0].effect as never, ctx);
    engine.effect.run(s, resolved as never, ctx);
    const atk = s.players.self.scene.find((c) => c.uid === 'atk')!;
    expect(atk.turnEffects['apMod_contact']).toBe(2000); // 2 × 1000、文字列化しない (number)
  });
});
