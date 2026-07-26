// tests/cards/engine-mega-w2
// engine mega-wave W2 (2026-07-03): restriction/observer 群の TDD probe。
//   r24 継続アクション制限 4 token (untargetableByAction/caseActionBan/selfActionBan/selfCutinBanInContact)
//   r25 opponentRestrict:'refreshEvidence' (B05097 系、engine-only)
//   r26 colorIgnoreOnHandUse (B03126 系、engine-only)
//   r29 opponentRestrict:'hirameki' (B05079)
//   hook 'ability:declared' (B03057 a2)
// rules: 03/07/10/14/15/20/21/24
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { pendingOwnerOrderGroup, runAllUntilEmpty } from '@/engine/resolve/index';
import { candidates as targetCandidates } from '@/engine/flow/action/target-expander';
import { canAction, canActionAgainstCase } from '@/engine/flow/main/action';
import { canCutIn } from '@/engine/flow/contact';
import { canHandUseCard, handUseColorIgnoreAllowed } from '@/engine/flow/main/hand-use-card';
import { useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { char as readChar } from '@/engine/read/char';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { B05079 } from '@/cards/ct-p05/B05079';
import { B03057 } from '@/cards/ct-p03/B03057';
import { B03057P } from '@/cards/ct-p03/B03057P';
import type { CardDef, AbilityDef, ActionContext } from '@/engine/types';

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const contAb = (id: string, mod: Record<string, unknown>, condition?: unknown): AbilityDef => ({
  id, type: 'continuous', scope: 'on-scene',
  ...(condition ? { condition } : {}),
  continuousModifier: mod as never,
  description: id, ruleRefs: [],
} as AbilityDef);

// 合成 def 群
const UNTGT = mkChar('UNTGT', { abilities: [contAb('a1', { untargetableByAction: true })] });
const UNTGT_SLEEP = mkChar('UNTGT_SLEEP', {
  abilities: [contAb('a1', { untargetableByAction: true }, { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' })],
});
const CASEBAN = mkChar('CASEBAN', { abilities: [contAb('a1', { caseActionBan: true })] });
const ACTBAN = mkChar('ACTBAN', { abilities: [contAb('a1', { selfActionBan: true })] });
const CUTBAN = mkChar('CUTBAN', { abilities: [contAb('a1', { selfCutinBanInContact: true })] });
const REFSUP = mkChar('REFSUP', { abilities: [contAb('a1', { opponentRestrict: ['refreshEvidence'] })] });
const COLIGN = mkChar('COLIGN', { colors: ['黒'], level: 1, abilities: [contAb('a1', { colorIgnoreOnHandUse: true })] });
const BLACK1 = mkChar('BLACK1', { colors: ['黒'], level: 1 });
const CUT: CardDef = {
  id: 'CUT', no: 'CUT', kind: 'event', names: ['CUT'], colors: ['赤'], level: 1, ap: 0, lp: 0,
  traits: [], rarity: 'C', imageUrl: '',
  abilities: [{ id: 'cut', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '', ruleRefs: [] }],
};
// 宣言能力持ち[探偵] (B03057 a2 の trigger 側)
const DET_DECL = mkChar('DET_DECL', {
  traits: ['探偵'],
  abilities: [{ id: 'd1', type: 'declared', scope: 'on-scene', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '', ruleRefs: [] } as AbilityDef],
});
// 非[探偵] 宣言持ち (decoy)
const MOB_DECL = mkChar('MOB_DECL', {
  traits: ['警察'],
  abilities: [{ id: 'd1', type: 'declared', scope: 'on-scene', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '', ruleRefs: [] } as AbilityDef],
});
const HIRA = mkChar('HIRA', {
  abilities: [{ id: 'h1', type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '', ruleRefs: [] } as AbilityDef],
});

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  for (const d of [UNTGT, UNTGT_SLEEP, CASEBAN, ACTBAN, CUTBAN, REFSUP, COLIGN, BLACK1, CUT, DET_DECL, MOB_DECL, HIRA]) registerCardDef(d);
  registerCardDef(B05079); registerCardDef(B03057); registerCardDef(B03057P);
  registerCardDef(mkChar('ATK', { ap: 5000 }));
  registerTriggeredListener();
});

describe('r24 untargetableByAction', () => {
  it('無条件 aura: sleep でも対象候補から除外 / 素キャラは候補に残る', () => {
    const s = createEmptyGameState();
    const atk = mutate.scene.enter(s, 'self', 'ATK', { active: true });
    atk.isNamed = false;
    const u = mutate.scene.enter(s, 'opp', 'UNTGT', {});
    mutate.scene.setState(s, u.uid, 'sleep');
    const plain = mutate.scene.enter(s, 'opp', 'BLACK1', {});
    mutate.scene.setState(s, plain.uid, 'sleep');
    const cands = targetCandidates(s, atk.uid);
    expect(cands.some(c => c.uid === u.uid)).toBe(false); // 除外
    expect(cands.some(c => c.uid === plain.uid)).toBe(true); // 据置
  });

  it('condition{sleep} 付き (B03057 型): sleep 時のみ除外、active 時は…そもそも base 候補外、stun は候補に残る', () => {
    const s = createEmptyGameState();
    const atk = mutate.scene.enter(s, 'self', 'ATK', { active: true });
    atk.isNamed = false;
    const u = mutate.scene.enter(s, 'opp', 'UNTGT_SLEEP', {});
    // sleep → aura 成立 → 除外
    mutate.scene.setState(s, u.uid, 'sleep');
    expect(targetCandidates(s, atk.uid).some(c => c.uid === u.uid)).toBe(false);
    // stun → 「スリープ状態の場合」不成立 (公式Q&A) → 候補に残る
    mutate.scene.setState(s, u.uid, 'stun');
    expect(targetCandidates(s, atk.uid).some(c => c.uid === u.uid)).toBe(true);
  });
});

describe('r24 selfActionBan / caseActionBan', () => {
  it('selfActionBan: canAction=false / 素キャラ true', () => {
    const s = createEmptyGameState();
    const b = mutate.scene.enter(s, 'self', 'ACTBAN', { active: true });
    b.isNamed = false;
    const p = mutate.scene.enter(s, 'self', 'BLACK1', { active: true });
    p.isNamed = false;
    expect(canAction(s, b.uid)).toBe(false);
    expect(canAction(s, p.uid)).toBe(true);
  });

  it('caseActionBan: canActionAgainstCase=false (キャラ対象は不変)', () => {
    const s = createEmptyGameState();
    const b = mutate.scene.enter(s, 'self', 'CASEBAN', { active: true });
    b.isNamed = false;
    s.players.opp.evidence = [{ cardId: 'e1', faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
    expect(canActionAgainstCase(s, b.uid, 'opp')).toBe(false);
    expect(canAction(s, b.uid)).toBe(true); // 全面 ban ではない
  });
});

describe('r24 selfCutinBanInContact', () => {
  const mkAx = (byUid: string): ActionContext => ({
    id: 'ax', byUid, byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: byUid, aAP: 3000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
  });
  it('参加キャラが flag 持ち → 自分は cutin 不可 / 素キャラ参加なら可', () => {
    const s = createEmptyGameState();
    const c = mutate.scene.enter(s, 'self', 'CUTBAN', {});
    const p = mutate.scene.enter(s, 'self', 'BLACK1', {});
    s.players.self.hand = ['CUT'];
    expect(canCutIn(s, mkAx(c.uid), 'self', 'CUT')).toBe(false);
    expect(canCutIn(s, mkAx(p.uid), 'self', 'CUT')).toBe(true);
  });
});

describe('r25 opponentRestrict refreshEvidence', () => {
  it('自分の aura 在場 → 自分の refresh で相手 penalty 証拠なし (reshuffle/痕跡は成立)', () => {
    const after = produce(createEmptyGameState(), (d) => {
      mutate.scene.enter(d, 'self', 'REFSUP', {});
      d.players.self.deck = [];
      d.players.self.remove = ['BLACK1'];
      mutate.deck.refresh(d, 'self');
    });
    expect(after.players.opp.evidence).toHaveLength(0); // penalty 抑止
    expect(after.players.self.deck).toHaveLength(1); // reshuffle 成立
    expect(after.scratchTrace.opp).toBe('発見済'); // 痕跡は依然発見 (rules/13)
  });
  it('aura 無し → penalty 従来通り / 相手側 aura は方向逆で不発', () => {
    const base = produce(createEmptyGameState(), (d) => {
      d.players.self.deck = [];
      d.players.self.remove = ['BLACK1'];
      mutate.deck.refresh(d, 'self');
    });
    expect(base.players.opp.evidence).toHaveLength(1);
    const wrongSide = produce(createEmptyGameState(), (d) => {
      mutate.scene.enter(d, 'opp', 'REFSUP', {}); // 相手の盤面 aura
      d.players.self.deck = [];
      d.players.self.remove = ['BLACK1'];
      mutate.deck.refresh(d, 'self');
    });
    expect(wrongSide.players.opp.evidence).toHaveLength(1); // 逆方向は抑止しない
  });
});

describe('r26 colorIgnoreOnHandUse', () => {
  it('事件=青、黒キャラ: token 持ち → 使用可 / 素の黒 → 不可', () => {
    const s = createEmptyGameState();
    s.players.self.case.colors = ['青'];
    s.players.self.hand = ['COLIGN', 'BLACK1'];
    s.players.self.file = [{ type: 'card-back', cardId: 'f1' }]; // level 1 充足
    expect(handUseColorIgnoreAllowed(s, 'self', 'COLIGN')).toBe(true);
    expect(handUseColorIgnoreAllowed(s, 'self', 'BLACK1')).toBe(false);
    expect(canHandUseCard(s, 'self', 'COLIGN')).toBe(true); // bypass
    expect(canHandUseCard(s, 'self', 'BLACK1')).toBe(false); // 従来 gate (回帰)
  });
});

describe('r29 opponentRestrict hirameki (B05079)', () => {
  it('相手盤面に B05079 → 自分のヒラメキ発火抑止 / 不在なら発火', () => {
    // evidence:remove-by-action handler を実 emit で踏む: 証拠を失う側 = self (ヒラメキ権利者)、
    // 抑止 aura = opp の B05079。optional ヒラメキは pendingHirameki side-channel に載る。
    const run = (withSera: boolean) => {
      _resetPendingHirameki();
      const base = createEmptyGameState();
      base.players.self.evidence = [{ cardId: 'HIRA', faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
      produce(base, (d) => {
        if (withSera) mutate.scene.enter(d, 'opp', 'B05079', {});
        const ev = mutate.evidence.removeTop(d, 'self');
        event.emit(d, 'evidence:remove-by-action', { player: 'self', ev, byUid: 'atk' }, { player: 'self', cardId: ev!.cardId });
      });
      return _drainPendingHirameki();
    };
    expect(run(true)).toBeNull(); // 抑止
    expect(run(false)).not.toBeNull(); // 従来通り発火
  });
});

describe('hook ability:declared (B03057)', () => {
  it('[探偵] の宣言使用 → B03057 発火 (draw+discard) / 非[探偵] 宣言 → 不発 / limit turn1', () => {
    const s = createEmptyGameState();
    mutate.scene.enter(s, 'self', 'B03057', {});
    const det = mutate.scene.enter(s, 'self', 'DET_DECL', { active: true });
    const mob = mutate.scene.enter(s, 'self', 'MOB_DECL', { active: true });
    s.players.self.deck = ['d1', 'd2', 'd3', 'd4'];
    s.players.self.hand = ['h1'];
    // 非[探偵] の宣言 → 不発
    useDeclaredAbility(s, mob.uid, 'd1'); // MOB_DECL 自身の draw 1 のみ
    runAllUntilEmpty(s);
    expect(s.players.self.hand).toHaveLength(2); // h1 + draw1 (B03057 は不発 = discard なし)
    // [探偵] の宣言 → 発火: draw1(宣言) + draw1(B03057) - discard1(B03057)
    const handBefore = s.players.self.hand.length;
    const removeBefore = s.players.self.remove.length;
    useDeclaredAbility(s, det.uid, 'd1');
    runAllUntilEmpty(s);
    expect(s.players.self.remove.length).toBe(removeBefore + 1); // B03057 discard 発火
    expect(s.players.self.hand.length).toBe(handBefore + 1); // +2 draw -1 discard
  });
});

describe('ability:declared 解決順 (W2 review blocker 対応)', () => {
  it('宣言者自身の効果が observer より先に pendingEffects へ載る (公式Q&A: 宣言効果を先に解決)', () => {
    const s = createEmptyGameState();
    mutate.scene.enter(s, 'self', 'B03057', {});
    const det = mutate.scene.enter(s, 'self', 'DET_DECL', { active: true });
    s.players.self.deck = ['d1', 'd2'];
    s.players.self.hand = ['h1'];
    useDeclaredAbility(s, det.uid, 'd1'); // drain せず挿入順を直接検査
    const hooks = (s.pendingEffects ?? []).map(e => e.triggeredBy?.hook ?? '?');
    // 先頭 = 宣言者の効果 (triggeredBy.hook='declaredAbility')、その後 = B03057 observer (hook='ability:declared')
    const declIdx = hooks.findIndex(h => h === 'declaredAbility');
    const obsIdx = hooks.findIndex(h => h === 'ability:declared');
    expect(declIdx).toBeGreaterThanOrEqual(0);
    expect(obsIdx).toBeGreaterThan(declIdx); // observer は必ず後 (公式Q&A / rules/25)
  });

  it('B03057 observer is not selectable before the declared ability effect resolves', () => {
    const s = createEmptyGameState();
    mutate.scene.enter(s, 'self', 'B03057', {});
    const det = mutate.scene.enter(s, 'self', 'DET_DECL', { active: true });
    s.players.self.deck = ['d1', 'd2'];
    s.players.self.hand = ['h1'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    try {
      useDeclaredAbility(s, det.uid, 'd1');

      expect(pendingOwnerOrderGroup(s, 'self')).toEqual([]);

      runAllUntilEmpty(s);
      expect(s.pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
    } finally {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    }
  });
});

describe('selfCutinBanInContact edge: 防御側 target=case (participant undefined)', () => {
  it('p=defender で guardUid 無し + target=case → gate skip (cutin 可、素通し)', () => {
    const s = createEmptyGameState();
    mutate.scene.enter(s, 'self', 'CUTBAN', {}); // flag 持ちが自陣に居ても参加者でなければ無関係
    s.players.self.hand = ['CUT'];
    const ax: ActionContext = {
      id: 'ax', byUid: 'oppAtk', byPlayer: 'opp', target: { kind: 'case', player: 'self' } as never,
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: 'oppAtk', aAP: 3000, bUid: '', bAP: 0 }, contactImmune: false,
    };
    // self は防御側・contactCharUidOf=undefined → 新 gate は skip され従来判定のみ
    expect(canCutIn(s, ax, 'self', 'CUT')).toBe(true);
  });
});

describe('shape (W2 cards)', () => {
  it('B05079 / B03057 / B03057P 骨格', () => {
    expect(B05079.keywords).toEqual(['突撃[事件]']);
    expect(B05079.abilities[0]!.continuousModifier).toMatchObject({ opponentRestrict: ['hirameki'] });
    expect(B05079.abilities[1]!.trigger?.hook).toBe('evidence:remove-by-action');
    expect(B03057.abilities[0]!.continuousModifier).toMatchObject({ untargetableByAction: true });
    expect(B03057.abilities[0]!.condition).toMatchObject({ kind: 'charStateIs', state: 'sleep' });
    expect(B03057.abilities[1]!.trigger?.hook).toBe('ability:declared');
    expect(B03057P).toMatchObject({ id: 'B03057P', no: '0312/B03057P', rarity: 'CP' });
    expect(readChar).toBeTruthy();
  });
});
