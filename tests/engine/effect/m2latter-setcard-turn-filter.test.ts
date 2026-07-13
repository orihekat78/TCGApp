// M2 後半 batch (2026-07-10): setcard/turn-end/filter/chooser 小粒 additive 群の TDD probe。
//   P6: atomCharSetCard cardIds branch faceUp honor — 「表向きでセットする」(PR234 毛利蘭 a1)。
//       既定は従来どおり裏向き (B08036 は引数無しで裏向き前提 = byte 互換必須)。
//   P7: atomHandAddFromRemove target の resolveBindRef — 「その中から1枚」= $trigger.setCardId (PR234 a2)。
//   P8: turn.ts toHandOnTurnEnd consume — 「ターン終了時、このキャラを現場から手札に移す」(B05063 rider)。
//       手札移動はリムーブでない → leave:to-remove 不発 (rules/17)。
//   P9: TargetFilter.cutinTextIncludes — 「【カットイン】AP＋」持ち判別 (D06003 服部平次、
//       qAndA ウォッカ B01097 除外 decoy)。
//   P10: ContinuousModifier.lvlDeltaInHandPer — 「〜のキャラ1枚につきレベル-1」(B07008 小嶋元太 a1)。
//   P11: atomDiscard chooser:'source' — 「(自分が)選び、相手はそれをリムーブする」(B07100 コルン)。
// rules: 16 (セット) / 17 (現場リムーブ時) / 15 / 19。grounding = specs/grounding/{PR234,B05063,D06003,B07008,B07100}.md。
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { candidates } from '@/engine/target/candidates';
import { effectiveHandLevel } from '@/engine/flow/main/hand-use-card';
import { endTurn } from '@/engine/flow/turn';
import { event } from '@/engine/event/index';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

const HOST: CardDef = { id: 'HOST', no: 'HOST', kind: 'character', names: ['主'], colors: ['赤'], level: 5, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const EV1: CardDef = { id: 'EV1', no: 'EV1', kind: 'event', names: ['イベ1'], colors: ['赤'], level: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
const EV2: CardDef = { id: 'EV2', no: 'EV2', kind: 'event', names: ['イベ2'], colors: ['赤'], level: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
// cutin AP＋ 持ち (abilityIsCutin 形: triggered + on-hand + effect:declared + optional)
const CUT_AP: CardDef = {
  id: 'CUT_AP', no: 'CUT_AP', kind: 'character', names: ['切札'], colors: ['黒'], level: 4, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'CUT_AP-c', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
    description: '【カットイン】コンタクト中の自分のキャラをAP＋2000する。', ruleRefs: [],
  }],
  ruleRefs: [],
} as unknown as CardDef;
// ウォッカ形 decoy (B01097): cutin だが効果は draw — 「AP＋」を含まない
const CUT_DRAW: CardDef = {
  id: 'CUT_DRAW', no: 'CUT_DRAW', kind: 'character', names: ['ウォッカ形'], colors: ['黒'], level: 4, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'CUT_DRAW-c', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    description: '【カットイン】カードを2枚引き、手札を1枚リムーブする。', ruleRefs: [],
  }],
  ruleRefs: [],
} as unknown as CardDef;
const PLAIN: CardDef = { id: 'PLAIN', no: 'PLAIN', kind: 'character', names: ['無'], colors: ['黒'], level: 3, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
// B07008 形: 手札内 per-count level modifier
const GENTA: CardDef = {
  id: 'GENTA', no: 'GENTA', kind: 'character', names: ['元太形'], colors: ['青'], level: 8, ap: 6000, lp: 2,
  traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'GENTA-a1', type: 'continuous', scope: 'on-hand',
    continuousModifier: { lvlDeltaInHandPer: { delta: -1, filterAny: [{ cardName: '阿笠博士', kind: 'character' }, { trait: '少年探偵団', kind: 'character' }] } },
    description: '手札にあるこのキャラは、自分の現場にいる〚カード名[阿笠博士]〛か特徴[少年探偵団]のキャラ1枚につきレベル-1される。', ruleRefs: [],
  }],
  ruleRefs: [],
} as unknown as CardDef;
const AGASA: CardDef = { id: 'AGASA', no: 'AGASA', kind: 'character', names: ['阿笠博士'], colors: ['青'], level: 3, ap: 1000, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const KID_A: CardDef = { id: 'KID_A', no: 'KID_A', kind: 'character', names: ['少A'], colors: ['青'], level: 2, ap: 1000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
// 阿笠博士 かつ 少年探偵団 (union 二重計上なし検証用)
const AGASA_KID: CardDef = { id: 'AGASA_KID', no: 'AGASA_KID', kind: 'character', names: ['阿笠博士'], colors: ['青'], level: 2, ap: 1000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}
function ctxFor(s: GameState): EffectCtx {
  const c = mutate.scene.enter(s, 'self', 'HOST', {});
  return { source: { player: 'self', uid: c.uid, cardId: 'HOST' }, bindings: {}, dyn: {} } as unknown as EffectCtx;
}
beforeEach(() => {
  resetDefRegistry(); _resetUidCounter(); _clearPendingEffectPickQueue();
  event._resetRegistry();
  for (const d of [HOST, EV1, EV2, CUT_AP, CUT_DRAW, PLAIN, GENTA, AGASA, KID_A, AGASA_KID]) registerCardDef(d);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('P6: charSetCard cardIds branch faceUp honor (PR234 a1)', () => {
  function run(s: GameState, ctx: EffectCtx, extra: Record<string, unknown>): void {
    runAtom(s, 'charSetCard' as never, {
      uid: ctx.source.uid, cardIds: ['EV1'], ...extra,
      target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { kind: 'event' } }, n: { min: 0, max: 1 }, chooser: 'self' },
    }, ctx);
  }
  it('faceUp:true 明示で表向きセット', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.remove = ['EV1'];
    run(s, ctx, { faceUp: true });
    const host = s.players.self.scene[0];
    expect(host.setCards.length).toBe(1);
    expect(host.setCards[0]).toEqual({ cardId: 'EV1', faceUp: true, instanceId: 'set:1' });
  });
  it('faceUp 未指定は従来どおり裏向き (B08036 回帰 0)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.remove = ['EV1'];
    run(s, ctx, {});
    expect(s.players.self.scene[0].setCards[0]).toEqual({ cardId: 'EV1', faceUp: false, instanceId: 'set:1' });
  });
});

describe('P7: handAddFromRemove target resolveBindRef (PR234 a2)', () => {
  it('$trigger.setCardId を解決して remove から手札へ', () => {
    const s = base(); const ctx = ctxFor(s);
    (ctx as { triggerPayload?: Record<string, unknown> }).triggerPayload = { setCardId: 'EV1' };
    s.players.self.remove = ['EV2', 'EV1'];
    runAtom(s, 'handAddFromRemove' as never, { player: 'self', target: '$trigger.setCardId' }, ctx);
    expect(s.players.self.hand).toContain('EV1');
    expect(s.players.self.remove).toEqual(['EV2']);
  });
});

describe('P8: toHandOnTurnEnd consume (B05063 rider)', () => {
  it('ターン終了時に現場→手札 (リムーブでない、leave:to-remove 不発)', () => {
    const s = base();
    const c = mutate.scene.enter(s, 'self', 'PLAIN', {});
    (s.players.self.scene[0].turnEffects as Record<string, unknown>)['toHandOnTurnEnd'] = true;
    let leaveFired = 0;
    event.on('leave:to-remove', () => { leaveFired++; });
    endTurn(s, 'self');
    expect(s.players.self.scene.find(x => x.uid === c.uid)).toBeUndefined();
    expect(s.players.self.hand).toContain('PLAIN');
    expect(s.players.self.remove).not.toContain('PLAIN');
    expect(leaveFired).toBe(0);
  });
  it('flag 無しキャラは現場に残る (従来 byte 互換)', () => {
    const s = base();
    const c = mutate.scene.enter(s, 'self', 'PLAIN', {});
    endTurn(s, 'self');
    expect(s.players.self.scene.some(x => x.uid === c.uid)).toBe(true);
  });
});

describe('P9: TargetFilter.cutinTextIncludes (D06003)', () => {
  it('「AP＋」包含 cutin のみ候補 (ウォッカ形 decoy / 非 cutin 除外)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.remove = ['CUT_AP', 'CUT_DRAW', 'PLAIN'];
    const out = candidates(s, {
      kind: 'pick', query: { area: 'remove', side: 'self', filter: { cutinTextIncludes: 'AP＋' } },
      n: { min: 0, max: 1 }, chooser: 'self',
    } as never, ctx);
    expect(out.map(c => (c as { cardId?: string }).cardId)).toEqual(['CUT_AP']);
  });
});

describe('P9b: cutinTextIncludes — shipped 実カード pin (edge lens BLOCK 2026-07-10)', () => {
  it('B05045 (旧 半角 AP+2000 → 全角修正済) が「AP＋」filter に一致する', async () => {
    const { B05045 } = await import('@/cards/ct-p05/B05045');
    const { defHasCutinTextIncludes } = await import('@/engine/read/keyword');
    expect(defHasCutinTextIncludes(B05045, 'AP＋')).toBe(true);
  });
});

describe('P10: lvlDeltaInHandPer (B07008 a1)', () => {
  it('該当キャラ1枚につき delta 加算 (阿笠1+少探団2 → 8-3=5)', () => {
    const s = base();
    mutate.scene.enter(s, 'self', 'AGASA', {});
    mutate.scene.enter(s, 'self', 'KID_A', {});
    mutate.scene.enter(s, 'self', 'KID_A', {});
    expect(effectiveHandLevel(s, 'self', 'GENTA')).toBe(5);
  });
  it('union 二重計上なし (名前+特徴 両該当でも1枚は1)', () => {
    const s = base();
    mutate.scene.enter(s, 'self', 'AGASA_KID', {});
    expect(effectiveHandLevel(s, 'self', 'GENTA')).toBe(7);
  });
  it('相手現場は数えない / 該当 0 で印字レベルのまま', () => {
    const s = base();
    mutate.scene.enter(s, 'opp', 'AGASA', {});
    mutate.scene.enter(s, 'self', 'PLAIN', {});
    expect(effectiveHandLevel(s, 'self', 'GENTA')).toBe(8);
  });
});

describe('P11: atomDiscard chooser:source (B07100)', () => {
  it('相手手札から自分が選ぶ — pending.player=self / ownerPlayer=self / 候補=opp 手札', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.opp.hand = ['CUT_AP', 'PLAIN'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runAtom(s, 'discard' as never, { player: 'opp', max: 1, chooser: 'source' }, ctx);
    const p = _drainPendingEffectPickSide();
    expect(p).not.toBeNull();
    expect(p!.player).toBe('self'); // chooser = 能力所有者
    expect(p!.candidates.map(c => c.cardId).sort()).toEqual(['CUT_AP', 'PLAIN']);
    expect(p!.candidates.every(c => c.player === 'opp')).toBe(true);
  });
  it('owner=opp (CPU 所有) + side 明示で候補が正しく human 手札になる (edge lens BLOCK 2026-07-10)', () => {
    // B07100 実装形: source='opp' (CPU 所有)、player:'opp' (相対→絶対 self=human)、side:'opp' 明示。
    // side 未指定だと query.side に絶対 player が流れ owner 相対再解決で CPU 自身の手札に反転する (BUG-181 family)。
    const s = base();
    const oc = mutate.scene.enter(s, 'opp', 'HOST', {});
    const oppCtx = { source: { player: 'opp', uid: oc.uid, cardId: 'HOST' }, bindings: {}, dyn: {} } as unknown as EffectCtx;
    s.players.self.hand = ['CUT_AP', 'PLAIN'];
    s.players.opp.hand = ['EV1'];
    const out = candidates(s, {
      kind: 'pick', query: { area: 'hand', side: 'opp' }, n: { min: 0, max: 1 }, chooser: 'self',
    } as never, oppCtx);
    expect(out.map(c => (c as { cardId?: string }).cardId).sort()).toEqual(['CUT_AP', 'PLAIN']);
    expect(out.every(c => (c as { player?: string }).player === 'self')).toBe(true);
  });
  it('chooser 未指定は従来どおり手札所有者が選ぶ (byte 互換)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.opp.hand = ['CUT_AP'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    runAtom(s, 'discard' as never, { player: 'opp', max: 1 }, ctx);
    const p = _drainPendingEffectPickSide();
    expect(p).not.toBeNull();
    expect(p!.player).toBe('opp');
  });
});
