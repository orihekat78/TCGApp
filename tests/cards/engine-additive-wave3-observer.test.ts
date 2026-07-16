// E1 wave-3 — observer-hook 群 (engine additive, 2026-06-30)
// 新 TRIGGERED_HOOK 3 種 + 1 新 matcher を実機 emit 経路で検証:
//   P23 cutin:used        — flow/contact.cutIn が emit、第三者キャラが観測 (B02080/B09086/B04090)
//   G04 misread:performed — listeners/misread の AI defender 経路が emit、観測 (B05015/B09016)
//   G05 evidence:removed  — mutate/evidence.removeTop/removeAt/toRemove が emit、観測 (B02062)
//   triggerCutinMatches   — 使用カットインの cardName/特徴 で分岐 (B09086)
//
// 設計: 全 hook は in-play observer (handleHook 既存経路) で発火 = 特別 handler 不要。
//        additive: 新 hook は handleHook が登録されるが、既存カードが trigger.hook に宣言しないため
//        handleHook が effect を queue しない (= pendingEffects 不変)。emit 自体は in-play scan を行う。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered, _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { registerMisreadListener, _resetMisreadRegistered, _resetPendingMisread, _drainPendingMisread } from '@/engine/listeners/misread';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { cutIn, canCutIn } from '@/engine/flow/contact';
import { doReasoning } from '@/engine/flow/main/reasoning';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../helpers/fixtures';
import { misreadX } from '@/cards/_shared/misreadX';
import type { GameState, CardDef, AbilityDef, ActionContext, Effect } from '@/engine/types';

function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.id, kind: o.kind ?? 'character', names: o.names ?? [o.id], colors: o.colors ?? ['赤'],
    level: o.level ?? 1, ap: o.ap ?? 1000, lp: o.lp ?? 1000, traits: o.traits ?? [],
    rarity: 'C', imageUrl: '', abilities: o.abilities ?? [], ruleRefs: [], ...o,
  };
}
const DRAW: Effect = { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } };
// 観測キャラが queue した effect を hook + source.uid で検出
function firedBy(after: GameState, hook: string, uid: string): boolean {
  return after.pendingEffects.some((pe) => pe.triggeredBy?.hook === hook && pe.source?.uid === uid);
}

// ============================================================
// P23 — cutin:used observer (flow/contact.cutIn emit)
// ============================================================
describe('wave3 P23 — cutin:used observer', () => {
  // cutin card = type:'triggered' + scope:'on-hand' + trigger:{hook:'effect:declared',optional:true} (rules/09)
  function cutinCard(id: string, names: string[] = [id], traits: string[] = []): CardDef {
    return defOf({
      id, kind: 'event', names, traits,
      abilities: [{
        id: 'cut', type: 'triggered', scope: 'on-hand',
        trigger: { hook: 'effect:declared', optional: true },
        effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000 } },
        description: 'カットイン AP+2000', ruleRefs: [],
      }],
    });
  }
  const OBS_SELF: AbilityDef = {
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'cutin:used' },
    condition: { kind: 'triggerPlayerIs', side: 'self' },
    effect: DRAW, description: '自分がカットインを使用したとき、1枚引く', ruleRefs: [],
  };
  // ax: self 攻撃 (byUid=atk) vs opp dft、self が cutin を使う場面
  function mkAx(): ActionContext {
    return {
      id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: 'atk', aAP: 3000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
    };
  }
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  });

  it('self が cutin 使用 → side:self observer 発火', () => {
    registerCardDef(defOf({ id: 'OBS', abilities: [OBS_SELF] }));
    registerCardDef(cutinCard('CUT'));
    registerTriggeredListener();
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.hand = ['CUT'];
      const ax = mkAx();
      expect(canCutIn(d, ax, 'self', 'CUT')).toBe(true);
      cutIn(d, ax, 'self', 'CUT');
    });
    expect(firedBy(after, 'cutin:used', obsUid), 'self cutin → observer fires').toBe(true);
  });

  it('opp が cutin 使用 → side:self observer 非発火', () => {
    registerCardDef(defOf({ id: 'OBS', abilities: [OBS_SELF] }));
    registerCardDef(cutinCard('CUT'));
    registerTriggeredListener();
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.opp.hand = ['CUT'];
      const ax: ActionContext = { ...mkAx(), byUid: 'oatk', byPlayer: 'opp', target: { kind: 'char', uid: 'atk' } };
      cutIn(d, ax, 'opp', 'CUT');
    });
    expect(firedBy(after, 'cutin:used', obsUid), 'opp cutin → side:self observer silent').toBe(false);
  });

  it('triggerCutinMatches: 使用 cutin の cardName で分岐 (一致のみ発火)', () => {
    const OBS_NAMED: AbilityDef = {
      id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'cutin:used' },
      condition: { kind: 'and', cs: [
        { kind: 'triggerPlayerIs', side: 'self' },
        { kind: 'triggerCutinMatches', filter: { cardName: 'CUT_HIT' } },
      ] },
      effect: DRAW, description: '特定名のカットイン使用時のみ', ruleRefs: [],
    };
    registerCardDef(defOf({ id: 'OBS', abilities: [OBS_NAMED] }));
    registerCardDef(cutinCard('CUT_HIT', ['CUT_HIT']));
    registerCardDef(cutinCard('CUT_MISS', ['CUT_MISS']));
    registerTriggeredListener();
    // 一致
    let obsUid = '';
    const hit = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.hand = ['CUT_HIT'];
      cutIn(d, mkAx(), 'self', 'CUT_HIT');
    });
    expect(firedBy(hit, 'cutin:used', obsUid), 'cardName 一致 → 発火').toBe(true);
    // 不一致
    const miss = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.hand = ['CUT_MISS'];
      cutIn(d, mkAx(), 'self', 'CUT_MISS');
    });
    expect(firedBy(miss, 'cutin:used', obsUid), 'cardName 不一致 → 非発火').toBe(false);
  });
});

// ============================================================
// G04 — misread:performed observer (listeners/misread AI defender emit)
// ============================================================
describe('wave3 G04 — misread:performed observer', () => {
  function misreadChar(id: string, x: number, extra: AbilityDef[] = []): CardDef {
    return defOf({ id, abilities: [
      { id: 'm', type: 'icon-misread', effect: { kind: 'atom', verb: 'noop', args: { x } } as never, description: `ミスリード${x}`, ruleRefs: [] },
      ...extra,
    ] });
  }
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); _resetMisreadRegistered(); _resetPendingMisread(); _resetUidCounter(); resetDefRegistry();
  });

  it('opp(AI defender) が misread → self side:opp observer 発火 + 自己観測(selfOnly)発火', () => {
    const SELFOBS: AbilityDef = {
      id: 's', type: 'triggered', scope: 'on-scene', trigger: { hook: 'misread:performed', selfOnly: true },
      effect: DRAW, description: 'このキャラがミスリードしたとき (B09016)', ruleRefs: [],
    };
    const OPPOBS: AbilityDef = {
      id: 'o', type: 'triggered', scope: 'on-scene', trigger: { hook: 'misread:performed' },
      condition: { kind: 'triggerPlayerIs', side: 'opp' },
      effect: DRAW, description: '相手がミスリードしたとき (B05015)', ruleRefs: [],
    };
    registerCardDef(misreadChar('MR', 1000, [SELFOBS])); // opp 側、自身が misread + 自己観測
    registerCardDef(defOf({ id: 'OBS', abilities: [OPPOBS] })); // self 側、相手観測
    registerCardDef(defOf({ id: 'R' })); // self 側、推理キャラ
    registerTriggeredListener();
    registerMisreadListener();
    let mrUid = '', obsUid = '', rUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      mrUid = mutate.scene.enter(d, 'opp', 'MR', {}).uid;
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      rUid = mutate.scene.enter(d, 'self', 'R', {}).uid;
      event.emit(d, 'reasoning:before-add', { uid: rUid, lpUsed: 1000 }, { player: 'self', uid: rUid });
    });
    expect(firedBy(after, 'misread:performed', obsUid), 'self side:opp observer fires').toBe(true);
    expect(firedBy(after, 'misread:performed', mrUid), 'self-observe (selfOnly) fires').toBe(true);
  });
});

// ============================================================
// G05 — evidence:removed observer (mutate/evidence emit ×3)
// ============================================================
describe('wave3 G05 — evidence:removed observer', () => {
  const OPP_EV_OBS: AbilityDef = {
    id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'evidence:removed' },
    condition: { kind: 'triggerPlayerIs', side: 'opp' },
    effect: DRAW, description: '相手の証拠がリムーブされたとき、1枚引く (B02062)', ruleRefs: [],
  };
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
    registerCardDef(defOf({ id: 'OBS', abilities: [OPP_EV_OBS] }));
    registerTriggeredListener();
  });
  // 証拠は base state (produce 前) に実体で seed する。produce 内で fresh push したオブジェクトは
  // draft 化されず current() が throw するため (テスト artifact、本番は addFromDeck 等経由で実体化)。
  function baseWithEvidence(owner: 'self' | 'opp', n: number): GameState {
    const base = createEmptyGameState();
    base.players[owner].evidence = Array.from({ length: n }, (_, i) => ({
      cardId: `EV${i}`, faceUp: false, origin: { turn: 0, via: 'reasoning' as const },
    }));
    return base;
  }

  it('removeTop: 相手証拠リムーブ → side:opp observer 発火', () => {
    let obsUid = '';
    const after = produce(baseWithEvidence('opp', 2), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      mutate.evidence.removeTop(d, 'opp');
    });
    expect(firedBy(after, 'evidence:removed', obsUid)).toBe(true);
  });

  it('removeAt: 相手証拠 idx リムーブ → 発火', () => {
    let obsUid = '';
    const after = produce(baseWithEvidence('opp', 3), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      mutate.evidence.removeAt(d, 'opp', 1);
    });
    expect(firedBy(after, 'evidence:removed', obsUid)).toBe(true);
  });

  it('toRemove: 相手証拠を remove へ → 発火', () => {
    let obsUid = '';
    const after = produce(baseWithEvidence('opp', 1), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      mutate.evidence.toRemove(d, { cardId: 'EV0', faceUp: false, origin: { turn: 0, via: 'reasoning' } });
    });
    expect(firedBy(after, 'evidence:removed', obsUid)).toBe(true);
  });

  it('pin: 自分の証拠リムーブ → side:opp observer は非発火', () => {
    let obsUid = '';
    const after = produce(baseWithEvidence('self', 2), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      mutate.evidence.removeTop(d, 'self');
    });
    expect(firedBy(after, 'evidence:removed', obsUid), 'own evidence removal → side:opp silent').toBe(false);
  });
});

// ============================================================
// G04 — misread:performed observer: 人間 defender 経路 (UI dispatch) 回帰ガード
//   AI defender 経路 (listeners/misread) と人間 defender 経路 (useEngineDispatch.misreadResolve) の
//   両方で emit しないと観測カードが片側 false-green になる (BUG-117/118 dual-path 教訓)。
//   本ブロックは UI dispatch 経路 (line ~217 の emit) を実機で踏み、misread:performed 発火を保証する。
// ============================================================
describe('wave3 G04 — misread:performed observer (人間 defender / UI dispatch)', () => {
  const SELFOBS: AbilityDef = {
    id: 's', type: 'triggered', scope: 'on-scene', trigger: { hook: 'misread:performed', selfOnly: true },
    effect: DRAW, description: 'このキャラがミスリードしたとき (B09016)', ruleRefs: [],
  };
  const OPPOBS: AbilityDef = {
    id: 'o', type: 'triggered', scope: 'on-scene', trigger: { hook: 'misread:performed' },
    condition: { kind: 'triggerPlayerIs', side: 'opp' },
    effect: DRAW, description: '相手がミスリードしたとき (B05015)', ruleRefs: [],
  };
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); _resetMisreadRegistered(); _resetPendingMisread();
    _setHumanPlayerSide('self');
    _resetUidCounter(); resetDefRegistry();
    // 推理キャラ R(opp) / 相手観測 OBS(opp, side:opp) / misread+自己観測 M(self, selfOnly)
    registerCardDef(defOf({ id: 'R', lp: 1000 }));
    registerCardDef(defOf({ id: 'OBS', abilities: [OPPOBS] }));
    registerCardDef(defOf({ id: 'M', lp: 1000, abilities: [misreadX({ x: 1000, abilityId: 'a_mis' }), SELFOBS] }));
    registerTriggeredListener();
    registerMisreadListener();
    useGameStateStore.setState({ gameState: null, activeActionId: null, pendingHirameki: null, pendingMisread: null });
  });

  it('opp 推理 → self(人間 defender)が misread を UI 解決 → 両観測 (side:opp + selfOnly) 発火', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar({ uid: 'r1', cardId: 'R', state: 'active' }), makeChar({ uid: 'obs1', cardId: 'OBS', state: 'active' })];
    s.players.self.scene = [makeChar({ uid: 'm1', cardId: 'M', state: 'active' })];
    s.players.opp.deck = ['e1', 'e2', 'e3'];

    // opp 推理 → reasoning:before-add → defender=self(人間) なので side-channel に pendingMisread が乗る
    doReasoning(s, 'r1');
    const pending = _drainPendingMisread();
    expect(pending, '人間 defender 経路 = side-channel set').not.toBeNull();

    // store へ転送 → UI dispatch で misread 解決 (ここで misread:performed emit が走る)
    useGameStateStore.setState({ gameState: s, pendingMisread: pending });
    const r = dispatchEngineAction({ type: 'misreadResolve', picks: [{ uid: 'm1', x: 1000 }] });
    expect(r.ok).toBe(true);

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.find((c) => c.uid === 'm1')?.state, 'misread キャラは sleep').toBe('sleep');
    expect(firedBy(after, 'misread:performed', 'obs1'), 'UI 経路でも side:opp observer 発火').toBe(true);
    expect(firedBy(after, 'misread:performed', 'm1'), 'UI 経路でも selfOnly 自己観測 発火').toBe(true);
  });
});
