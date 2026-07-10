// tests/cards/night-wA1/trait-grant-revoke — engine A1 wave verb probe: charGrantTrait / charRevokeTrait
//   B05101 毛利小五郎「〚特徴[警察]〛と〚[警視庁]〛を失い、〚特徴[探偵]〛を持つ（ターン終了時に切れない）」の
//   trait-flip プリミティブ。B05101 カード全体は self-revival-by-cardId idiom gap で DEFER。
//   本 probe は verb を production dispatch (activateDeclaredAbility) + mutate 直呼びで検証:
//     ① grant/revoke が read.char.traits に反映 (印字 − revoke + grant)
//     ② matchOneFilter (candidate/pick filter) が applied override を honor (両 honor site 一致)
//     ③ scope permanent は clearTurnEffects('turn') で切れない / scope turn は切れる
//     ④ 変装 (disguiseInto は cardId のみ差替) で override 自動引継ぎ (rules/23)
// rules: 09/23 (変装引継ぎ) / 17 (特徴) / 19 (特徴変更)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { char as charRead } from '@/engine/read/char';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';

// 合成 consumer: 【宣言】 特徴[警察]と[警視庁]を失い、特徴[探偵]を持つ (permanent) — B05101 の trait-flip 句。
const flipAbility: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'charRevokeTrait', args: { uid: '$self', trait: '警察' } },
      { kind: 'atom', verb: 'charRevokeTrait', args: { uid: '$self', trait: '警視庁' } },
      { kind: 'atom', verb: 'charGrantTrait', args: { uid: '$self', trait: '探偵' } },
    ],
  },
  description: 'このキャラは〚特徴[警察]〛と〚[警視庁]〛を失い、〚特徴[探偵]〛を持つ。',
  ruleRefs: ['rules/17-icons.md', 'rules/19-special-rules.md'],
};
const KOGORO: CardDef = {
  id: 'KOGORO', no: 'KOGORO', kind: 'character', names: ['毛利小五郎'], colors: ['黄'],
  level: 6, ap: 6000, lp: 1, traits: ['警察', '警視庁'], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [flipAbility], ruleRefs: [],
};
// pick-filter honor 検証用: 【宣言】特徴[探偵]のキャラを1枚まで選びリムーブ (両現場)。
const HUNTER: CardDef = {
  id: 'HUNTER', no: 'HUNTER', kind: 'character', names: ['ハンター'], colors: ['黄'],
  level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { trait: '探偵' } } },
    description: '特徴[探偵]のキャラを1枚まで選びリムーブ。', ruleRefs: [],
  }],
  ruleRefs: [],
};
const NEWNAME: CardDef = { id: 'NEWCID', no: 'NEWCID', kind: 'character', names: ['変装後'], colors: ['黄'], level: 4, ap: 4000, lp: 1, traits: ['怪盗'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = v; };

beforeEach(() => {
  resetDefRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  [KOGORO, HUNTER, NEWNAME].forEach(registerCardDef);
  registerTriggeredListener();
  setHuman('self');
});

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

describe('charGrantTrait/charRevokeTrait — read.char.traits honor (production dispatch)', () => {
  it('宣言で 警察/警視庁 を失い 探偵 を得る → traits = [探偵]', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'KOGORO', {});
    expect(charRead.traits(s, me.uid), '初期は印字 [警察,警視庁]').toEqual(['警察', '警視庁']);
    activateDeclaredAbility(s, me.uid, 'a1');
    runAllUntilEmpty(s);
    const t = charRead.traits(s, me.uid);
    expect(t, '警察/警視庁 除去').not.toContain('警察');
    expect(t).not.toContain('警視庁');
    expect(t, '探偵 付与').toContain('探偵');
  });
});

describe('matchOneFilter honor — trait filter は applied override を見る (第2 honor site)', () => {
  it('flip 後は trait:探偵 の pick 候補に入り、trait:警察 の候補には入らない', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'KOGORO', {});
    // flip 適用
    mutate.char.revokeTrait(s, me.uid, '警察');
    mutate.char.revokeTrait(s, me.uid, '警視庁');
    mutate.char.grantTrait(s, me.uid, '探偵');
    // HUNTER の 【宣言】(trait:探偵 pick) で KOGORO が候補化されるか
    const hunter = mutate.scene.enter(s, 'self', 'HUNTER', {});
    activateDeclaredAbility(s, hunter.uid, 'a1');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'trait:探偵 pick surface').toBeTruthy();
    const cands = (pick!.candidates as Array<{ uid: string }>).map(c => c.uid);
    expect(cands, 'flip 後 KOGORO は 探偵 として候補化').toContain(me.uid);
  });

  it('flip 前 (印字 警察) は trait:探偵 の候補に入らない (回帰/対照)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'KOGORO', {});
    const hunter = mutate.scene.enter(s, 'self', 'HUNTER', {});
    activateDeclaredAbility(s, hunter.uid, 'a1');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    // KOGORO は 探偵 を持たない → 候補ゼロ (HUNTER 自身も 探偵 なし) → pick が出ない or 候補に me 無し
    const cands = pick ? (pick.candidates as Array<{ uid: string }>).map(c => c.uid) : [];
    expect(cands, 'flip 前は 探偵 非該当').not.toContain(me.uid);
  });
});

describe('scope 永続性 — permanent は turn 終了で切れない / turn は切れる', () => {
  it('permanent grant/revoke は clearTurnEffects(turn) 後も保持 (「ターン終了時に切れない」)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'KOGORO', {});
    mutate.char.revokeTrait(s, me.uid, '警察');
    mutate.char.grantTrait(s, me.uid, '探偵');
    mutate.char.clearTurnEffects(s, me.uid, 'turn'); // ターン終了処理
    const t = charRead.traits(s, me.uid);
    expect(t, 'permanent revoke 保持').not.toContain('警察');
    expect(t, 'permanent grant 保持').toContain('探偵');
  });

  it('scope:turn grant/revoke は clearTurnEffects(turn) で失効', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'KOGORO', {});
    mutate.char.revokeTrait(s, me.uid, '警察', 'turn');
    mutate.char.grantTrait(s, me.uid, '探偵', 'turn');
    expect(charRead.traits(s, me.uid)).toEqual(['警視庁', '探偵']); // turn 中は反映
    mutate.char.clearTurnEffects(s, me.uid, 'turn');
    expect(charRead.traits(s, me.uid), 'turn scope は失効 → 印字へ戻る').toEqual(['警察', '警視庁']);
  });
});

describe('変装引継ぎ — disguiseInto は cardId のみ差替 → override 自動保持 (rules/23)', () => {
  it('flip 済キャラが変装 → 新カード名でも 探偵 保持 (印字 怪盗 に union、警察 は revoke 済で非該当)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'KOGORO', {});
    mutate.char.revokeTrait(s, me.uid, '警察');
    mutate.char.revokeTrait(s, me.uid, '警視庁');
    mutate.char.grantTrait(s, me.uid, '探偵');
    mutate.char.disguiseInto(s, me.uid, 'NEWCID'); // 変装 (cardId 差替のみ)
    const t = charRead.traits(s, me.uid);
    expect(t, '新カードの印字 怪盗').toContain('怪盗');
    expect(t, 'applied grant 探偵 引継ぎ (rules/23)').toContain('探偵');
    // 新カードは 警察 を印字しないので revoke は自然 no-op (集合的に非該当)
    expect(t).not.toContain('警察');
  });
});
