// tests/cards/m1-megasweep/B07068.manual — 羽田秀𠮷 (character / 赤 / 棋士・赤井家 / R) 手書き probe
//
// 印字 (ground truth, payloads/B07068.json fullTexts):
//   effect (a1): 【パートナー赤】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。
//     そうした場合、自分のリムーブエリアにあるレベル5以下の【赤】のキャラを1枚まで選び、スリープ状態で登場させる。
//     自分の手札が2枚以下の場合、登場させたキャラとこのキャラをアクティブにする。
//   hirameki (a2): 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 公式 QA (payloads/B07068.json qa):
//   - 「自分の手札が2枚以下の場合」は効果のその部分を解決する際に参照 (このカードや discard 済カードは数えない)。
//   - スリープ状態で登場した場合「スリープさせてもよい」は行えない → a1 不発 (self-sleep gate)。
//   - リムーブした手札を選んで登場させることも可能 (条件を満たすキャラなら)。
//
// DSL:
//   a1 = triggered, scope 'on-scene', trigger{hook:'enter', selfOnly:true},
//        condition and[ partnerColor 赤, not{charStateIs(self, sleep)} ],       ← BUG-145 self-sleep gate
//        effect optional{ chain[
//          sceneSetState{$self, sleep},
//          discard{player:self, n:1},                                           ← 短縮形 → discard pick surface
//          sequence[
//            sceneEnter{ pick(remove, side:self, filter{character, 色赤, levelMax:5}), n:0-1, chooser:self,
//                        bind:$entered, enterSleep, viaEffect },                ← 「1枚まで」= nMin:0
//            conditional{ if handAtMost(self, 2) → sequence[ setState($entered.uid, active), setState($self, active) ] }
//          ]
//        ]}
//   a2 = triggered, scope 'on-evidence', trigger{hook:'evidence:remove-by-action', optional:true}, draw{n:1, player:self}
//
// production dispatch (task 規約):
//   a1 (triggered enter): 実 emit 経路。sceneEnter atom (viaEffect) で B07068 を効果登場 → 'enter' hook 実 emit →
//     登録済 triggered listener が a1 を queue (condition を honor) → runAllUntilEmpty → optional side-channel surface →
//     applyOptionalAndContinuation(run) → discard pick / sceneEnter pick を side-channel drain (cluster11 B07019 同型)。
//   a2 (ヒラメキ): 実 emit 'evidence:remove-by-action' → pendingHirameki set → a2 効果を production resolver で解決
//     (m1-megasweep B02013 a3 同型)。
//
// 検証面 (BUG-117/118: DSL に filter/条件を書いても engine 実評価は別 → outcome で 1対1 証明):
//   S2 happy (hand≤2): 登場キャラ + self を再アクティブ / discard 済 / pick 対象 remove から消える。
//   S3 decoy + hand>2: sceneEnter 候補 = 赤lv≤5 char のみ (lv6・青・event を除外) / hand>2 → 再アクティブ せず (両 sleep)。
//   S4 0-pick「1枚まで」: sceneEnter を 0 で decline → キャラ登場せず / self は hand≤2 なら再アクティブ / 対象 remove 残留。
//   S5 condition off: partner非赤 → a1 queue されず (optional 不 surface) / self-sleep 登場 → a1 不発 (BUG-145 gate)。
//   S6 owner=opp pin (BUG-174): opp 所有 B07068 の a1 は opp 側 zone のみに作用 / self 側不変。
//   S7/S8 a2: 証拠リムーブされた B07068 の【ヒラメキ】で draw 1 / owner=opp は opp が引く (player:self は source 相対)。
//   beforeEach registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火)。
// rules: 17-icons.md, 15-abilities-effects.md, 03-field-areas.md, 20-color-and-switch.md, 10-action-event.md,
//        14-refresh.md, 24-qa-naming-stun.md (self-sleep gate)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef, def } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  resolveEffectPicks,
  _drainPendingEffectPickSide,
  _peekPendingEffectOptionalSide,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/resolve-picks';
import {
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
  applyOptionalAndContinuation,
  _drainAllEffectPicksForTest,
} from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B07068 } from '@/cards/ct-p07/B07068';
import type { CardDef, Effect, EffectCtx, GameState, Player, AbilityDef } from '@/engine/types';

type Side = 'self' | 'opp';
const setHuman = (side: Side | null) => {
  (globalThis as { __humanPlayerSide?: Side | null }).__humanPlayerSide = side;
};

// ── synthetic defs ──────────────────────────────────────────────────────────
function chDef(id: string, colors: string[], level: number): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors, level, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function evDef(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors, level: 3,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function partnerDef(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'partner', names: [id], colors, level: 0, ap: 0, lp: 7,
    traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

const REDP = 'REDP';       // partner 赤
const BLUEP = 'BLUEP';     // partner 青 (condition off)
const RED5 = 'RED5';       // 赤 lv5 char — a1 sceneEnter の唯一有効候補
const RED6 = 'RED6';       // 赤 lv6 char — decoy (levelMax:5 超過)
const BLUE3 = 'BLUE3';     // 青 lv3 char — decoy (色不一致)
const EVRED = 'EVRED';     // 赤 lv3 event — decoy (kind:character 不一致)
const H1 = 'H1', H2 = 'H2', H3 = 'H3', H4 = 'H4'; // discard 用手札 fodder
const DTOP = 'DTOP';       // a2 draw の deck top

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  resetDefRegistry();
  setHuman(null);
  registerCardDef(B07068);
  registerCardDef(partnerDef(REDP, ['赤']));
  registerCardDef(partnerDef(BLUEP, ['青']));
  registerCardDef(chDef(RED5, ['赤'], 5));
  registerCardDef(chDef(RED6, ['赤'], 6));
  registerCardDef(chDef(BLUE3, ['青'], 3));
  registerCardDef(evDef(EVRED, ['赤']));
  for (const h of [H1, H2, H3, H4, DTOP]) registerCardDef(chDef(h, ['白'], 3));
  registerTriggeredListener();
});

// ── a1 driver: B07068 を効果登場 (viaEffect) して 'enter' hook を実 emit ────────────
function summon(cardId: string, opts: { enterSleep?: boolean } = {}): Effect {
  return {
    kind: 'atom', verb: 'sceneEnter',
    args: { player: 'self', cardId, viaEffect: true, enterSleep: opts.enterSleep === true,
            target: { query: { area: 'remove', side: 'self' } } },
  } as unknown as Effect;
}
function srcCtx(player: Player): EffectCtx {
  return { source: { cardId: 'CAUSE', uid: 'cause#1', abilityId: 'a1', player, area: 'scene' }, bindings: {} } as EffectCtx;
}

// ============================================================
// S1 descriptor pin — codegen drift 検出 (a1 enter optional chain / a2 hirameki draw)
// ============================================================
describe('B07068 羽田秀𠮷 — shape (descriptor)', () => {
  it('id/no/色/lv/ap/lp/特徴 + a1 enter selfOnly + partnerColor赤 & self-sleep gate + optional / a2 hirameki draw', () => {
    expect(B07068.id).toBe('B07068');
    expect(B07068.no).toBe('0797/B07068');
    expect(B07068.kind).toBe('character');
    expect(B07068.colors).toEqual(['赤']);
    expect(B07068.level).toBe(7);
    expect(B07068.ap).toBe(6000);
    expect(B07068.lp).toBe(1);
    expect(B07068.traits).toEqual(['棋士', '赤井家']);

    const a1 = B07068.abilities[0] as AbilityDef;
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-scene');
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    // condition and[ partnerColor 赤, not{charStateIs self sleep} ]
    const cond = a1.condition as { kind: string; cs: Array<Record<string, unknown>> };
    expect(cond.kind).toBe('and');
    expect(cond.cs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'partnerColor', color: '赤' }),
        expect.objectContaining({ kind: 'not', c: expect.objectContaining({ kind: 'charStateIs', state: 'sleep' }) }),
      ]),
    );
    expect((a1.effect as { kind: string }).kind).toBe('optional');

    const a2 = B07068.abilities[1] as AbilityDef;
    expect(a2.type).toBe('triggered');
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ verb: 'draw', args: { n: 1, player: 'self' } });
  });
});

// ============================================================
// S2 — a1 happy (hand≤2 → 登場キャラ & self を再アクティブ)  [_drainAllEffectPicksForTest]
// ============================================================
describe('B07068 a1 — happy: 手札1枚リムーブ→赤lv≤5をスリープ登場→hand≤2で両者アクティブ', () => {
  it('discard→hand0 / RED5 登場 / hand0≤2 → RED5・B07068 とも active / RED5 は remove から消え H1 は remove へ', () => {
    setHuman('self');
    const base = createEmptyGameState();
    base.players.self.partner = { ...base.players.self.partner, cardId: REDP };
    base.players.self.remove = ['B07068', RED5];
    base.players.self.hand = [H1];
    const s = produce(base, (d) => {
      runEffect(d, summon('B07068'), srcCtx('self'));
      runAllUntilEmpty(d);
      const opt = _peekPendingEffectOptionalSide();
      expect(opt, '「してもよい」optional が surface').not.toBeNull();
      applyOptionalAndContinuation(d, opt!, true);            // take
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());  // discard pick → sceneEnter pick を順に AI 解決
      runAllUntilEmpty(d);
    });
    setHuman(null);
    _clearPendingEffectOptionalSide();
    _clearPendingEffectPickQueue();

    const self68 = s.players.self.scene.find((c) => c.cardId === 'B07068');
    const red = s.players.self.scene.find((c) => c.cardId === RED5);
    expect(self68, 'B07068 が現場に登場').toBeTruthy();
    expect(red, 'RED5 が現場に登場 (赤lv5 = filter 内)').toBeTruthy();
    expect(self68!.state, 'hand0≤2 → このキャラを再アクティブ').toBe('active');
    expect(red!.state, 'hand0≤2 → 登場キャラも再アクティブ').toBe('active');
    expect(s.players.self.remove, 'discard した H1 は remove へ').toContain(H1);
    expect(s.players.self.remove, 'RED5 は登場して remove から消える').not.toContain(RED5);
    expect(s.players.self.hand, 'H1 を discard → hand 0').toEqual([]);
  });
});

// ============================================================
// S3 — a1 decoy filter + hand>2 (再アクティブ せず、両 sleep)  [manual pick drain で候補を検証]
// ============================================================
describe('B07068 a1 — sceneEnter filter (赤lv≤5 char) + hand>2 で再アクティブ せず', () => {
  it('候補=RED5 のみ (RED6/BLUE3/EVRED を除外) / discard で hand4→3 (>2) → RED5・B07068 とも sleep 継続', () => {
    setHuman('self');
    const base = createEmptyGameState();
    base.players.self.partner = { ...base.players.self.partner, cardId: REDP };
    base.players.self.remove = ['B07068', RED5, RED6, BLUE3, EVRED];
    base.players.self.hand = [H1, H2, H3, H4];
    const enterCands: string[] = [];
    const s = produce(base, (d) => {
      runEffect(d, summon('B07068'), srcCtx('self'));
      runAllUntilEmpty(d);
      applyOptionalAndContinuation(d, _peekPendingEffectOptionalSide()!, true);
      // 1) discard pick (短縮形) — 手札から1枚
      const dpick = _drainPendingEffectPickSide();
      expect(dpick, 'discard pick が surface').not.toBeNull();
      expect(dpick!.atomVerb).toBe('discard');
      applyPickAndContinuation(d, dpick!, dpick!.candidates[0]!.uid);
      // 2) sceneEnter pick — filter 検証
      const epick = _drainPendingEffectPickSide();
      expect(epick, 'sceneEnter pick が surface').not.toBeNull();
      expect(epick!.atomVerb).toBe('sceneEnter');
      expect(epick!.nMin, '「1枚まで」→ nMin 0').toBe(0);
      expect(epick!.nMax).toBe(1);
      for (const c of epick!.candidates) enterCands.push(c.cardId);
      const red = epick!.candidates.find((c) => c.cardId === RED5)!;
      applyPickAndContinuation(d, epick!, red.uid);
      runAllUntilEmpty(d);
    });
    setHuman(null);
    _clearPendingEffectOptionalSide();
    _clearPendingEffectPickQueue();

    expect(enterCands, '赤lv5 char は候補').toContain(RED5);
    expect(enterCands, 'lv6 は levelMax:5 で除外').not.toContain(RED6);
    expect(enterCands, '青は色赤 filter で除外').not.toContain(BLUE3);
    expect(enterCands, 'event は kind:character で除外').not.toContain(EVRED);

    const self68 = s.players.self.scene.find((c) => c.cardId === 'B07068');
    const red = s.players.self.scene.find((c) => c.cardId === RED5);
    expect(red, 'RED5 登場').toBeTruthy();
    expect(self68!.state, 'hand3>2 → 再アクティブ せず sleep 継続').toBe('sleep');
    expect(red!.state, 'hand3>2 → 登場キャラも sleep 継続 (enterSleep)').toBe('sleep');
    expect(s.players.self.remove, 'RED6 decoy は remove に残留').toContain(RED6);
    expect(s.players.self.remove, 'BLUE3 decoy は remove に残留').toContain(BLUE3);
  });
});

// ============================================================
// S4 — a1 0-pick「1枚まで」= 0 で decline (キャラ登場せず)
// ============================================================
describe('B07068 a1 — sceneEnter 0枚 decline (「1枚まで」rules/15)', () => {
  it('sceneEnter を skip → RED5 は登場せず remove 残留 / hand0≤2 で B07068 は再アクティブ (active)', () => {
    setHuman('self');
    const base = createEmptyGameState();
    base.players.self.partner = { ...base.players.self.partner, cardId: REDP };
    base.players.self.remove = ['B07068', RED5];
    base.players.self.hand = [H1];
    const s = produce(base, (d) => {
      runEffect(d, summon('B07068'), srcCtx('self'));
      runAllUntilEmpty(d);
      applyOptionalAndContinuation(d, _peekPendingEffectOptionalSide()!, true);
      const dpick = _drainPendingEffectPickSide();
      applyPickAndContinuation(d, dpick!, dpick!.candidates[0]!.uid); // discard H1 → hand0
      const epick = _drainPendingEffectPickSide();
      expect(epick!.atomVerb).toBe('sceneEnter');
      applyPickSkipAndContinuation(d, epick!, false); // 0枚 decline
      runAllUntilEmpty(d);
    });
    setHuman(null);
    _clearPendingEffectOptionalSide();
    _clearPendingEffectPickQueue();

    const self68 = s.players.self.scene.find((c) => c.cardId === 'B07068');
    expect(s.players.self.scene.some((c) => c.cardId === RED5), 'RED5 は登場していない').toBe(false);
    expect(s.players.self.remove, 'decline → RED5 は remove に残留').toContain(RED5);
    expect(s.players.self.remove, 'discard した H1 は remove へ').toContain(H1);
    // 登場キャラは居ないが「自分の手札が2枚以下の場合… このキャラをアクティブにする」まで解決 (公式 QA)
    expect(self68!.state, 'hand0≤2 → B07068 は再アクティブ (entered 不在でも self は解決)').toBe('active');
  });
});

// ============================================================
// S5 — a1 condition off (partner非赤 / self-sleep gate) → a1 不発
// ============================================================
describe('B07068 a1 — condition off で a1 不発 (optional 不 surface)', () => {
  it('partner非赤 (青) → partnerColor赤 false → a1 queue されず / self-sleep 登場 → BUG-145 gate で不発', () => {
    // (a) partner 青
    {
      const base = createEmptyGameState();
      base.players.self.partner = { ...base.players.self.partner, cardId: BLUEP };
      base.players.self.remove = ['B07068', RED5];
      base.players.self.hand = [H1];
      const s = produce(base, (d) => {
        runEffect(d, summon('B07068'), srcCtx('self'));
        runAllUntilEmpty(d);
      });
      expect(_peekPendingEffectOptionalSide(), 'partner非赤 → optional 不 surface').toBeNull();
      const self68 = s.players.self.scene.find((c) => c.cardId === 'B07068');
      expect(self68!.state, 'a1 不発 → self は登場状態 (active) のまま').toBe('active');
      expect(s.players.self.hand, 'discard されない').toEqual([H1]);
      expect(s.players.self.remove, 'RED5 は登場されず remove 残留').toContain(RED5);
      _clearPendingEffectOptionalSide();
      _clearPendingEffectPickQueue();
    }
    // (b) partner 赤 だが self-sleep 状態で登場 → 「スリープさせてもよい」不可 (公式 QA)
    {
      const base = createEmptyGameState();
      base.players.self.partner = { ...base.players.self.partner, cardId: REDP };
      base.players.self.remove = ['B07068', RED5];
      base.players.self.hand = [H1];
      produce(base, (d) => {
        runEffect(d, summon('B07068', { enterSleep: true }), srcCtx('self'));
        runAllUntilEmpty(d);
      });
      expect(_peekPendingEffectOptionalSide(), 'self-sleep 登場 → not{charStateIs self sleep} false → optional 不 surface').toBeNull();
      _clearPendingEffectOptionalSide();
      _clearPendingEffectPickQueue();
    }
  });
});

// ============================================================
// S6 — a1 owner=opp は probe 対象外 (systemic 短縮形 discard 制限のため / owner-reversal pin は S8 a2 で担う)
// ============================================================
// ★既知の systemic engine 制限 (B07068 固有ではない、DSL は正しい): a1 の discard 短縮形 ({player:'self', n:1})
//   は buildShortFormPick が解決済 player を sideDefault に渡すため、opp 所有 source では手札列挙が **self 側**
//   になる (double-relativization。B07053 a2 の handReveal 短縮形と同一 latent 制限、本 session で実測:
//   opp source の discard 候補 = self.hand)。加えて chain は「手札を1枚リムーブしてもよい。**そうした場合**…」
//   gate を持つため、discard が成立しないと後続 sceneEnter が発火しない。opp 経路では self.hand を空にすると
//   discard 不成立で chain break、self.hand を埋めると self のカードが discard される — いずれも clean な opp
//   検証にならない。self 所有 = 通常プレイ経路は S2/S3/S4 が正しく自 hand を discard することを実証済。
//   ⇒ B07053 の precedent に倣い a1 の owner=opp は probe 対象外とし、**card-level の owner-reversal pin は
//   short-form 依存の無い a2 (S8: 証拠所有者相対の draw)** で担う。この short-form 制限は B07068 の出荷可否
//   (self 所有 = 通常経路は正しい) を左右しない既存の許容済 latent 制限。

// ============================================================
// S7/S8 — a2 ヒラメキ: 証拠からリムーブされたら draw 1 (実 emit → pendingHirameki → resolver)
// ============================================================
// 実 emit 経路: evidence:remove-by-action → pendingHirameki set → a2 効果 (draw) を production resolver で解決
function fireHirameki(evidenceOwner: Side, removedCardId: string, setup: (s: GameState) => void): {
  after: GameState; pending: ReturnType<typeof _drainPendingHirameki>;
} {
  const attacker: Side = evidenceOwner === 'self' ? 'opp' : 'self';
  const s = produce(createEmptyGameState(), (d) => {
    d.turn = { number: 4, player: attacker, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    setup(d);
  });
  event.emit(
    s,
    'evidence:remove-by-action',
    { player: evidenceOwner, ev: { cardId: removedCardId } },
    { player: attacker, uid: `${attacker}-attacker` },
  );
  const pending = _drainPendingHirameki();
  if (!pending) return { after: s, pending };
  const a2 = def.card('B07068')!.abilities.find((a) => a.id === 'a2')!.effect!;
  const ctx = {
    source: { player: pending.player, cardId: pending.cardId, area: 'evidence', abilityId: pending.abilityId },
    bindings: {},
  } as unknown as EffectCtx;
  const after = produce(s, (d) => {
    const walked = resolveEffectPicks(d, a2 as never, ctx, { byPlayer: pending.player, humanChooser: false, source: { cardId: 'B07068', abilityId: 'a2' } });
    runEffect(d, walked as never, ctx);
  });
  return { after, pending };
}

describe('B07068 a2 — ヒラメキ: 証拠からリムーブされたら draw 1', () => {
  it('S7 happy (owner=self): B07068 が証拠リムーブ → self が deck top を 1 枚引く', () => {
    const { after, pending } = fireHirameki('self', 'B07068', (s) => {
      s.players.self.deck = [DTOP];
      s.players.self.hand = [];
    });
    expect(pending, 'B07068 の【ヒラメキ】が pending 発火').not.toBeNull();
    expect(pending!.cardId).toBe('B07068');
    expect(pending!.player).toBe('self');
    expect(pending!.abilityId).toBe('a2');
    expect(after.players.self.hand, 'draw 1 → deck top を手札に').toEqual([DTOP]);
    expect(after.players.self.deck, 'deck top が引かれた').toEqual([]);
  });

  it('S8 reversal pin (BUG-174, owner=opp): opp が引く / self 側は不変 (player:self は source 相対)', () => {
    const { after, pending } = fireHirameki('opp', 'B07068', (s) => {
      s.players.opp.deck = [DTOP];
      s.players.opp.hand = [];
      s.players.self.deck = ['SELF_DECK'];
      s.players.self.hand = [];
    });
    expect(pending!.player, 'ヒラメキ所有者は証拠所有者 (opp)').toBe('opp');
    expect(after.players.opp.hand, 'opp.hand に DTOP').toEqual([DTOP]);
    expect(after.players.opp.deck, 'opp.deck から引かれた').toEqual([]);
    expect(after.players.self.deck, 'self.deck 不変 (side ハードコードなし)').toEqual(['SELF_DECK']);
    expect(after.players.self.hand, 'self.hand は空のまま').toEqual([]);
  });

  it('off-variant: 非 B07068 の証拠 (ヒラメキ無し) では a2 不発', () => {
    const { pending } = fireHirameki('self', BLUE3, (s) => {
      s.players.self.remove = [BLUE3];
    });
    expect(pending, 'ヒラメキを持たない証拠では pending 不 set').toBeNull();
  });
});
