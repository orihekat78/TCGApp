// tests/cards/hybrid-batch5/manual-probes
// hybrid-batch5 手書き probe: gen-card-probes.cjs が "no supported ability" で扱えなかった 3 枚を
//   **production dispatch 経路** で駆動して検証する (BUG-171 慣行: engine 内部を bypass しない)。
//   engine / src/cards は変更しない (probe のみ)。
//
// 対象 / 駆動:
//   B08062 佐藤美和子＆高木渉 —
//     a1 triggered enter(matcher triggerCharMatches payloadKey:uid, excludeSource)【パートナー黄】【自ターン】【ターン1】
//        → sceneRemove AP8000以下1枚まで (side either)。実 enter emit 経路。
//     a2 continuous apDeltaAura +1000 (自ターン中 + 現場全員が佐藤/高木)。read.char.ap 直読 (継続 modifier)。
//     a3【カットイン】AP+2000 ($contact.byUid)。flow/contact cutIn 経路。
//   B09002 工藤新一&毛利蘭 —
//     a1 triggered enter(matcher triggerCharMatches **payloadKey 無し**, excludeSource)【自ターン】【ターン1】
//        → choice(sceneRemove | sceneToDeck)。★LATENT: 下記 MANUAL-NOTE 参照 (production enter emit に
//        payload.player が無く、payloadKey 未指定の triggerCharMatches が side を導出できず不発火)。
//     a2 triggered phase:end:start【自ターン】→ chain(handReveal 工藤/毛利 → sceneSetState active lv8以上工藤/毛利)。
//        実 phase:end:start emit 経路。
//     a3【カットイン】AP+2000 ($contact.byUid)。B08062 a3 と同型。
//   PR304 松田陣平 —
//     a1 triggered action:pre-target → expandActionTargets (opp lv7以上 active を対象化)。candidates() 経路。
//     a2 partnerColorKeyword【パートナー黄】〚突撃〛 (continuous grant)。read.char.keywords 直読。
//     a3 triggered contact:start(matcher contactOpponentApHigher)【自ターン】【ターン1】
//        → chain(discard max1 → charModifyAP $self +3000 contact)。実 contact:start emit 経路。
//
// 手法: harness の drive kind(declared/enter/event-use/cost-gate)外の hook (継続 modifier / choice /
//   phase:end:start / contact:start / action:pre-target / cutin) を各 hook の production emit / reader を
//   実カードで直接叩く direct engine test。fake emit は production payload 形状を厳密に模倣。
// rules: 03/07/08/09/11/13/15/17/18/19/22/24

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { cutIn, canCutIn } from '@/engine/flow/contact';
import { candidates } from '@/engine/flow/action/target-expander';
import {
  _drainPendingEffectPickSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectChoiceSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import {
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
  applyOptionalAndContinuation,
  applyChoiceAndContinuation,
} from '@/engine/effect/apply-pick';
import { B08062 } from '@/cards/ct-p08/B08062';
import { B09002 } from '@/cards/ct-p09/B09002';
import { PR304 } from '@/cards/pr-01/PR304';
import type { CardDef, GameState, ActionContext } from '@/engine/types';

// ---- fixtures ----
function charDef(id: string, o: { names?: string[]; ap?: number; level?: number; colors?: string[] } = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: o.names ?? [id], colors: o.colors ?? ['赤'],
    level: o.level ?? 1, ap: o.ap ?? 2000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}
function partnerDef(id: string, colors: string[]): CardDef {
  return { id, no: id, kind: 'partner', names: [id], colors, level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

const TAKAGI = charDef('TAKAGI', { names: ['高木渉'], ap: 3000 });         // B08062 a1 trigger char / a2 名一致
const SATO = charDef('SATO', { names: ['佐藤美和子'], ap: 3000 });          // B08062 a2 aura target
const SHINICHI = charDef('SHINICHI', { names: ['工藤新一'], level: 8, ap: 4000 }); // B09002 a1 trigger / a2 reveal
const RAN = charDef('RAN', { names: ['毛利蘭'], level: 8, ap: 4000 });      // B09002 a2 activate target
const RMLOW = charDef('RMLOW', { ap: 5000 });                              // B08062 a1 removable (AP≤8000)
const RMHIGH = charDef('RMHIGH', { ap: 9000 });                           // B08062 a1 decoy (AP>8000)
const MOB = charDef('MOB', { ap: 2000, level: 5 });                       // 汎用 decoy / bystander / discard 弾
const ATK = charDef('ATK', { ap: 2000 });                                 // cutin 中の自コンタクトキャラ (byUid)
const OPPDEF = charDef('OPPDEF', { ap: 7000 });                           // cutin/contact 相手 (defender)
const OPPLV8 = charDef('OPPLV8', { level: 8, ap: 6000 });                 // PR304 a1 拡張対象 (lv7以上 active)
const OPPLV3 = charDef('OPPLV3', { level: 3, ap: 6000 });                 // PR304 a1 decoy (lv7未満 active)
const OPPSLEEP = charDef('OPPSLEEP', { level: 2, ap: 2000 });             // PR304 a1 base 候補 (sleep)
const STRONG = charDef('STRONG', { ap: 8000 });                          // PR304 a3 contact opp (AP高)
const WEAK = charDef('WEAK', { ap: 3000 });                              // PR304 a3 contact opp (AP低, matcher非成立)
const DK = charDef('DK', {});
const PART_Y = partnerDef('PART_Y', ['黄']);
const PART_B = partnerDef('PART_B', ['青']);

const FIXTURES = [TAKAGI, SATO, SHINICHI, RAN, RMLOW, RMHIGH, MOB, ATK, OPPDEF, OPPLV8, OPPLV3, OPPSLEEP, STRONG, WEAK, DK, PART_Y, PART_B];

function setHuman(s: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
}

function base(turn: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK', 'DK', 'DK', 'DK'];
  s.players.opp.deck = ['DK', 'DK', 'DK', 'DK'];
  return s;
}

// pick-first / choice / optional を順に drain し script を 1 対 1 で適用する汎用ループ (harness 慣行)。
type ScriptAction = 'pick:skip' | 'optional:take' | 'optional:decline' | { pickCardId: string } | { pickUid: string } | { choiceIndex: number };
interface Recorded { verb: string; cardIds: string[] }
function drainScript(s: GameState, script: ScriptAction[]): { recorded: Recorded[]; prompts: number } {
  const recorded: Recorded[] = [];
  let i = 0;
  let prompts = 0;
  for (let g = 0; g < 50; g++) {
    const pick = _drainPendingEffectPickSide();
    if (pick) {
      prompts++;
      const cands = (pick.candidates as Array<{ uid: string; cardId: string }>).map((c) => ({ uid: c.uid, cardId: c.cardId }));
      recorded.push({ verb: pick.atomVerb, cardIds: cands.map((c) => c.cardId) });
      const a = script[i++];
      if (a === undefined) throw new Error(`pick "${pick.atomVerb}" surfaced but script exhausted (cands=${cands.map((c) => c.cardId).join(',')})`);
      if (a === 'pick:skip') applyPickSkipAndContinuation(s, pick, false);
      else if (typeof a === 'object' && 'pickCardId' in a) {
        const hit = cands.find((c) => c.cardId === a.pickCardId);
        if (!hit) throw new Error(`pickCardId ${a.pickCardId} not in ${pick.atomVerb} cands: ${cands.map((c) => c.cardId).join(',')}`);
        applyPickAndContinuation(s, pick, hit.uid);
      } else if (typeof a === 'object' && 'pickUid' in a) applyPickAndContinuation(s, pick, a.pickUid);
      else throw new Error(`pick "${pick.atomVerb}" surfaced but script action is ${JSON.stringify(a)}`);
      runAllUntilEmpty(s);
      continue;
    }
    const choice = _drainPendingEffectChoiceSide();
    if (choice) {
      prompts++;
      const a = script[i++];
      if (typeof a !== 'object' || !('choiceIndex' in a)) throw new Error(`choice surfaced but script action is ${JSON.stringify(a)}`);
      applyChoiceAndContinuation(s, choice, a.choiceIndex);
      runAllUntilEmpty(s);
      continue;
    }
    const opt = _drainPendingEffectOptionalSide();
    if (opt) {
      prompts++;
      const a = script[i++];
      if (a === 'optional:take') applyOptionalAndContinuation(s, opt, true);
      else if (a === 'optional:decline') applyOptionalAndContinuation(s, opt, false);
      else throw new Error(`optional surfaced but script action is ${JSON.stringify(a)}`);
      runAllUntilEmpty(s);
      continue;
    }
    break;
  }
  if (i < script.length) throw new Error(`${script.length - i} leftover script action(s) but no more prompts (over-scripted)`);
  return { recorded, prompts };
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B08062); registerCardDef(B09002); registerCardDef(PR304);
  for (const f of FIXTURES) registerCardDef(f);
  registerTriggeredListener();
  setHuman('self');
});

// production enter emit の payload 形 (scene.ts / hand-use-card.ts / next-hint.ts 全て player は source 側)。
function emitEnter(s: GameState, side: 'self' | 'opp', uid: string, cardId: string): void {
  const ch = s.players[side].scene.find((c) => c.uid === uid)!;
  event.emit(s, 'enter', { uid, viaEffect: false, enterOrder: ch.enterOrder, enterOrderThisTurn: ch.enterOrderThisTurn }, { player: side, uid, cardId });
}

// ============================================================================
// B08062 佐藤美和子＆高木渉
// ============================================================================
describe('B08062 a1 enter【パートナー黄】【自ターン】【ターン1】→ AP8000以下1枚 sceneRemove', () => {
  function board(partner: string): GameState {
    const s = base('self');
    s.players.self.partner.cardId = partner;
    mutate.scene.enter(s, 'self', 'B08062', {});
    mutate.scene.enter(s, 'self', 'TAKAGI', {}); // このキャラ以外の[高木渉]が登場 = trigger
    mutate.scene.enter(s, 'opp', 'RMLOW', {});   // 除去対象 (AP5000 ≤ 8000)
    mutate.scene.enter(s, 'opp', 'RMHIGH', {});  // decoy (AP9000 > 8000)
    return s;
  }

  it('positive: 黄P + 高木渉登場 → sceneRemove pick surface (AP9000 decoy は候補外) → RMLOW 除去', () => {
    const s = board('PART_Y');
    const takagiUid = s.players.self.scene.find((c) => c.cardId === 'TAKAGI')!.uid;
    emitEnter(s, 'self', takagiUid, 'TAKAGI');
    runAllUntilEmpty(s);
    const { recorded } = drainScript(s, [{ pickCardId: 'RMLOW' }]);
    expect(recorded[0]?.verb, 'sceneRemove pick surface').toBe('sceneRemove');
    expect(recorded[0]?.cardIds, 'AP9000 RMHIGH は apMax8000 で候補外').not.toContain('RMHIGH');
    expect(recorded[0]?.cardIds, 'AP5000 RMLOW は候補').toContain('RMLOW');
    expect(s.players.opp.scene.some((c) => c.cardId === 'RMLOW'), 'RMLOW 除去済').toBe(false);
    expect(s.players.opp.scene.some((c) => c.cardId === 'RMHIGH'), 'RMHIGH は残存').toBe(true);
  });

  it('negative: 青P → partnerColor黄 不成立 → 不発火 (pick surface なし)', () => {
    const s = board('PART_B');
    const takagiUid = s.players.self.scene.find((c) => c.cardId === 'TAKAGI')!.uid;
    emitEnter(s, 'self', takagiUid, 'TAKAGI');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'partnerColor黄 不成立 → surface なし').toBeNull();
    expect(s.players.opp.scene.length, 'opp 現場は据置').toBe(2);
  });

  it('negative:【ターン1】→ 同ターン2回目の登場は不発火 (pendingEffects 増えない)', () => {
    const s = board('PART_Y');
    const takagiUid = s.players.self.scene.find((c) => c.cardId === 'TAKAGI')!.uid;
    emitEnter(s, 'self', takagiUid, 'TAKAGI');
    expect(s.pendingEffects.length, '1回目 fire').toBe(1);
    _clearPendingEffectPickQueue();
    s.pendingEffects = [];
    emitEnter(s, 'self', takagiUid, 'TAKAGI');
    expect(s.pendingEffects.length, '2回目は【ターン1】で不発').toBe(0);
  });
});

describe('B08062 a2 continuous【自ターン中】現場全員が佐藤/高木 → 現場全員 AP+1000 (この能力はパートナーエリアでも有効)', () => {
  // MANUAL-NOTE: a2 aura bearer は B08062 (MR)。「この能力はパートナーエリアでも有効」(scope on-partner-area)
  //   のため PA-MR slot 常駐でも aura を放つ (read/char.ts auraDelta の slotMr bearer 経路)。本 describe は
  //   その正規経路 (B08062=PA-MR / 佐藤・高木=現場) を検証する。
  // MANUAL-NOTE(latent): B08062 を **現場** に置いた場合、a2 の条件 not(現場に佐藤/高木以外) が B08062 自身で破綻し
  //   aura が出ない。原因 = B08062.names=['佐藤美和子＆高木渉'] は **全角＆(U+FF06)** だが
  //   card-def-registry.cardNameComponents の分割は **半角& (split('&'))** のみ → B08062 が佐藤美和子/高木渉に
  //   分解されず「佐藤/高木以外のキャラ」= 違反として数えられる (rules/19 分割名が全角＆に未対応)。
  //   cf. B09002.names=['工藤新一&毛利蘭'] は半角&で正しく分割される。engine/card-data 側の不整合 (probe では src 非変更)。
  function paMr(s: GameState): void {
    s.players.self.partnerAreaMR = { cardId: 'B08062', uid: 'partnerMR:self', state: 'active' } as GameState['players']['self']['partnerAreaMR'];
  }

  it('positive: B08062=PA-MR + 現場=[佐藤美和子] → 佐藤美和子 AP 3000+1000 = 4000', () => {
    const s = base('self');
    paMr(s);
    const satoUid = mutate.scene.enter(s, 'self', 'SATO', {}).uid;
    expect(engine.read.char.ap(s, satoUid)).toBe(4000);
  });

  it('negative: 現場に非佐藤/高木(MOB)混在 → 条件不成立 → 佐藤美和子 AP 据置 3000', () => {
    const s = base('self');
    paMr(s);
    const satoUid = mutate.scene.enter(s, 'self', 'SATO', {}).uid;
    mutate.scene.enter(s, 'self', 'MOB', {}); // 佐藤/高木 以外 → 全員一致条件を破る
    expect(engine.read.char.ap(s, satoUid)).toBe(3000);
  });

  it('negative: 相手ターン中 → condition(自ターン中)不成立 → 佐藤美和子 AP 据置 3000', () => {
    const s = base('opp');
    paMr(s);
    const satoUid = mutate.scene.enter(s, 'self', 'SATO', {}).uid;
    expect(engine.read.char.ap(s, satoUid)).toBe(3000);
  });
});

describe('B08062 a3【カットイン】AP+2000 ($contact.byUid)', () => {
  it('positive: コンタクト中に自身をカットイン → 自コンタクトキャラ AP 2000+2000 = 4000 (傍観/相手は据置)', () => {
    setHuman(null); // cutin own-effect は human 非依存で自動適用 (tequila 慣行)
    const s = base('self');
    const atk = mutate.scene.enter(s, 'self', 'ATK', {}).uid;    // 自コンタクトキャラ (byUid)
    const bys = mutate.scene.enter(s, 'self', 'MOB', {}).uid;    // decoy: 非参加の傍観キャラ
    const dft = mutate.scene.enter(s, 'opp', 'OPPDEF', {}).uid;  // decoy: コンタクト相手 (defender)
    s.players.self.hand = ['B08062'];
    const ax: ActionContext = {
      id: 'ax', byUid: atk, byPlayer: 'self', target: { kind: 'char', uid: dft },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: atk, aAP: 2000, bUid: dft, bAP: 7000 }, contactImmune: false,
    };
    expect(canCutIn(s, ax, 'self', 'B08062')).toBe(true);
    cutIn(s, ax, 'self', 'B08062');
    runAllUntilEmpty(s);
    expect(engine.read.char.ap(s, atk), '自コンタクトキャラ +2000').toBe(4000);
    expect(engine.read.char.ap(s, bys), '非参加の傍観キャラは据置').toBe(2000);
    expect(engine.read.char.ap(s, dft), 'コンタクト相手は据置').toBe(7000);
  });
});

// ============================================================================
// B09002 工藤新一&毛利蘭
// ============================================================================
describe('B09002 a1 enter【自ターン】【ターン1】→ choice(sceneRemove | sceneToDeck)', () => {
  // 発見時 LATENT だった: matcherCondition に payloadKey 未指定 → tcmPlayer = triggerPayload['player']
  // を要求するが production enter emit は payload に player を含めず常に不発 (probe 実測、2026-07-10)。
  // → card DSL に payloadKey:'uid' を追加して解消 (B08062 a1 同型)。本 describe は修正後の発火を pin。
  it('positive: 工藤新一 登場 → choice が surface する (payloadKey uid 経由で side 解決)', () => {
    const s = base('self');
    mutate.scene.enter(s, 'self', 'B09002', {});
    const shinUid = mutate.scene.enter(s, 'self', 'SHINICHI', {}).uid; // このキャラ以外の[工藤新一]登場
    mutate.scene.enter(s, 'opp', 'OPPLV3', {}); // lv3 (lv9以下) = 除去候補
    emitEnter(s, 'self', shinUid, 'SHINICHI');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectChoiceSide(), 'choice が surface する').not.toBeNull();
  });
  it('negative: 工藤/毛利 以外 (MOB) 登場 → choice は surface しない (filter 不一致)', () => {
    const s = base('self');
    mutate.scene.enter(s, 'self', 'B09002', {});
    const mobUid = mutate.scene.enter(s, 'self', 'MOB', {}).uid;
    mutate.scene.enter(s, 'opp', 'OPPLV3', {});
    emitEnter(s, 'self', mobUid, 'MOB');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectChoiceSide(), 'choice は surface しない').toBeNull();
    expect(s.players.opp.scene.some((c) => c.cardId === 'OPPLV3'), 'opp 対象は残存').toBe(true);
  });
});

describe('B09002 a2 phase:end:start【自ターン終了時】→ handReveal(工藤/毛利) → sceneSetState active lv8以上', () => {
  function board(turn: 'self' | 'opp', handCard: string): GameState {
    const s = base(turn);
    mutate.scene.enter(s, 'self', 'B09002', {});
    const ranUid = mutate.scene.enter(s, 'self', 'RAN', {}).uid; // lv8 毛利蘭
    mutate.scene.setState(s, ranUid, 'sleep'); // アクティブ化を観測するため sleep
    s.players.self.hand = [handCard];
    return s;
  }

  it('positive: 自ターン終了 + 手札に工藤新一 公開 → sleep の毛利蘭(lv8)をアクティブ化', () => {
    const s = board('self', 'SHINICHI');
    const ranUid = s.players.self.scene.find((c) => c.cardId === 'RAN')!.uid;
    event.emit(s, 'phase:end:start', { player: 'self' }, undefined);
    runAllUntilEmpty(s);
    // handReveal(工藤/毛利) pick → SHINICHI 公開、続く sceneSetState pick → RAN 選択
    drainScript(s, [{ pickCardId: 'SHINICHI' }, { pickCardId: 'RAN' }]);
    expect(s.players.self.scene.find((c) => c.uid === ranUid)?.state, '毛利蘭 active 化').toBe('active');
  });

  it('negative: 手札に工藤/毛利 なし → handReveal 不可 → 毛利蘭 sleep 据置', () => {
    const s = board('self', 'MOB'); // MOB は工藤/毛利でない
    const ranUid = s.players.self.scene.find((c) => c.cardId === 'RAN')!.uid;
    event.emit(s, 'phase:end:start', { player: 'self' }, undefined);
    runAllUntilEmpty(s);
    drainScript(s, []); // handReveal 候補0 → 後続 sceneSetState も走らない
    expect(s.players.self.scene.find((c) => c.uid === ranUid)?.state, '毛利蘭 sleep 据置').toBe('sleep');
  });

  it('negative: 相手ターン終了 → condition(自ターン)不成立 → 不発火', () => {
    const s = board('opp', 'SHINICHI');
    const ranUid = s.players.self.scene.find((c) => c.cardId === 'RAN')!.uid;
    event.emit(s, 'phase:end:start', { player: 'opp' }, undefined);
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), '相手ターンは不発火').toBeNull();
    expect(s.players.self.scene.find((c) => c.uid === ranUid)?.state, '毛利蘭 sleep 据置').toBe('sleep');
  });
});

describe('B09002 a3【カットイン】AP+2000 ($contact.byUid)', () => {
  it('positive: コンタクト中に自身をカットイン → 自コンタクトキャラ AP 2000+2000 = 4000 (傍観/相手は据置)', () => {
    setHuman(null);
    const s = base('self');
    const atk = mutate.scene.enter(s, 'self', 'ATK', {}).uid;
    const bys = mutate.scene.enter(s, 'self', 'MOB', {}).uid;
    const dft = mutate.scene.enter(s, 'opp', 'OPPDEF', {}).uid;
    s.players.self.hand = ['B09002'];
    const ax: ActionContext = {
      id: 'ax', byUid: atk, byPlayer: 'self', target: { kind: 'char', uid: dft },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: atk, aAP: 2000, bUid: dft, bAP: 7000 }, contactImmune: false,
    };
    expect(canCutIn(s, ax, 'self', 'B09002')).toBe(true);
    cutIn(s, ax, 'self', 'B09002');
    runAllUntilEmpty(s);
    expect(engine.read.char.ap(s, atk), '自コンタクトキャラ +2000').toBe(4000);
    expect(engine.read.char.ap(s, bys), '傍観キャラは据置').toBe(2000);
    expect(engine.read.char.ap(s, dft), '相手は据置').toBe(7000);
  });
});

// ============================================================================
// PR304 松田陣平
// ============================================================================
describe('PR304 a1 action:pre-target → expandActionTargets (opp lv7以上 active を対象化)', () => {
  function board(): { s: GameState; matsuda: string; lv8: string; lv3: string; sleep: string } {
    const s = base('self');
    const matsuda = mutate.scene.enter(s, 'self', 'PR304', {}).uid;
    const lv8 = mutate.scene.enter(s, 'opp', 'OPPLV8', {}).uid;   // lv8 active → 拡張対象
    const lv3 = mutate.scene.enter(s, 'opp', 'OPPLV3', {}).uid;   // lv3 active → 対象外 (lv<7)
    const sleep = mutate.scene.enter(s, 'opp', 'OPPSLEEP', {}).uid;
    mutate.scene.setState(s, sleep, 'sleep');                     // sleep → base 候補
    return { s, matsuda, lv8, lv3, sleep };
  }

  it('positive: candidates に lv8 active(拡張) + lv2 sleep(base)、lv3 active は候補外', () => {
    const { s, matsuda, lv8, lv3, sleep } = board();
    const cands = candidates(s, matsuda).map((c) => c.uid);
    expect(cands, 'lv8 active は拡張で対象化').toContain(lv8);
    expect(cands, 'lv2 sleep は base 候補').toContain(sleep);
    expect(cands, 'lv3 active は lv7未満で候補外').not.toContain(lv3);
  });

  it('negative: 別キャラ(MOB)攻撃時は selfOnly により拡張されず lv8 active は候補外', () => {
    const { s, lv8, sleep } = board();
    const mobUid = mutate.scene.enter(s, 'self', 'MOB', {}).uid; // PR304 でない攻撃者
    const cands = candidates(s, mobUid).map((c) => c.uid);
    expect(cands, 'sleep は base 候補').toContain(sleep);
    expect(cands, 'lv8 active は非 PR304 攻撃では拡張されない').not.toContain(lv8);
  });
});

describe('PR304 a2 partnerColorKeyword【パートナー黄】〚突撃〛', () => {
  it('positive: パートナー黄 → 突撃 grant', () => {
    const s = base('self');
    s.players.self.partner.cardId = 'PART_Y';
    const matsuda = mutate.scene.enter(s, 'self', 'PR304', {}).uid;
    expect(engine.read.char.keywords(s, matsuda), 'partner黄 → 突撃').toContain('突撃');
  });

  it('negative: パートナー青 → 突撃 grant されない', () => {
    const s = base('self');
    s.players.self.partner.cardId = 'PART_B';
    const matsuda = mutate.scene.enter(s, 'self', 'PR304', {}).uid;
    expect(engine.read.char.keywords(s, matsuda), 'partner青 → 突撃なし').not.toContain('突撃');
  });
});

describe('PR304 a3 contact:start(matcher contactOpponentApHigher)【自ターン】【ターン1】→ discard + AP+3000', () => {
  // production contact:start emit payload = { aUid, bUid } / source { player: byPlayer, uid: byUid } (state-machine.ts:474)
  function board(turn: 'self' | 'opp', oppCard: string): { s: GameState; matsuda: string; opp: string } {
    const s = base(turn);
    const matsuda = mutate.scene.enter(s, 'self', 'PR304', {}).uid; // AP5000
    const opp = mutate.scene.enter(s, 'opp', oppCard, {}).uid;
    s.players.self.hand = ['MOB']; // discard 弾
    return { s, matsuda, opp };
  }

  it('positive: 自ターン + 相手AP8000 > 松田AP5000 → discard1 + 松田 AP 5000+3000 = 8000', () => {
    const { s, matsuda, opp } = board('self', 'STRONG');
    event.emit(s, 'contact:start', { aUid: matsuda, bUid: opp }, { player: 'self', uid: matsuda });
    runAllUntilEmpty(s);
    drainScript(s, [{ pickCardId: 'MOB' }]); // discard(max1) pick → MOB
    expect(engine.read.char.ap(s, matsuda), 'コンタクト中 AP+3000').toBe(8000);
    expect(s.players.self.hand.length, 'discard で手札 -1').toBe(0);
  });

  it('negative: 相手AP3000 < 松田AP5000 → matcher(相手AP高)不成立 → 不発火 (AP据置5000)', () => {
    const { s, matsuda, opp } = board('self', 'WEAK');
    event.emit(s, 'contact:start', { aUid: matsuda, bUid: opp }, { player: 'self', uid: matsuda });
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'matcher不成立 → discard surface なし').toBeNull();
    expect(engine.read.char.ap(s, matsuda), 'AP据置').toBe(5000);
    expect(s.players.self.hand.length, '手札据置').toBe(1);
  });

  it('negative: 相手ターン中 → condition(自ターン)不成立 → 不発火 (AP据置5000)', () => {
    const { s, matsuda, opp } = board('opp', 'STRONG');
    event.emit(s, 'contact:start', { aUid: matsuda, bUid: opp }, { player: 'self', uid: matsuda });
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), '相手ターンは不発火').toBeNull();
    expect(engine.read.char.ap(s, matsuda), 'AP据置').toBe(5000);
  });
});
