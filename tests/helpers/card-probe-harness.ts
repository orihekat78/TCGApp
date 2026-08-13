// tests/helpers/card-probe-harness.ts — 汎用 probe scenario runner ("probe compiler" MVP)
//
// 目的: カード ability JSON から機械導出した ProbeScenario を、**production dispatch 経路のみ**で実行し
//   (BUG-171 慣行: engine 内部を bypass しない)、宣言的アサーションを評価する。
//   scripts/gen-card-probes.cjs が生成する thin .test.ts はこの runCardScenario を呼ぶだけ。
//
// 対応 drive:
//   - declared   : activateDeclaredAbility + runAllUntilEmpty (B07032 慣行)
//   - enter      : event.emit('enter', …) + runAllUntilEmpty (B07036 の登場 hook payload shape)
//   - event-use  : handUseCard + runAllUntilEmpty (B09089 慣行)
//   - cost-gate  : public declared activation gate (state/queue unchanged を pin)
//
// pick / optional は 2 本の別 queue に surface する (pending-state)。harness は毎反復
//   「pick 先・無ければ optional」順で drain し (B07032/B07036/B09089 実測順)、script を 1 対 1 で適用する。
//   surface した pick 毎に候補 (uid+cardId) を記録し、candidatesExclude で decoy 除外を実証する。

import { expect } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canActivateDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  _drainPendingEffectPickSide,
  _drainPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import {
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
  applyOptionalAndContinuation,
  applyDeckReorderAndContinuation,
} from '@/engine/effect/apply-pick';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import type { GameState, CardDef, SceneCharacter } from '@/engine/types';
import type { AbilityCostParams } from '@/engine/flow/main/ability-activate';

type Side = 'self' | 'opp';
type CharState = 'active' | 'sleep' | 'stun';

export interface ProbeSceneChar {
  cardId: string;
  uid: string;
  state?: CharState;
  setCards?: Array<{ cardId: string; faceUp: boolean; instanceId: string }>;
  stackedCards?: Array<{ cardId: string; instanceId: string }>;
}

export interface ProbeSetup {
  caseStatus?: '事件編' | '解決編';
  caseColors?: string[];
  caseTraits?: string[];
  partnerColors?: string[];
  turn?: Side;
  selfScene?: ProbeSceneChar[];
  oppScene?: ProbeSceneChar[];
  hand?: string[];
  deckSize?: number;
  oppDeckSize?: number;
  remove?: string[];
  partnerAreaCards?: string[];
  fileCount?: number;
  /** デッキ最上部に明示 cardId を積む (removeDeckTop cost / deckRevealUntil の内容依存シナリオ用) */
  deckTop?: string[];
  /** 相手デッキ最上部に明示 cardId を積む (souza 等の相手デッキ公開シナリオ用、S2 B02072) */
  oppDeckTop?: string[];
  /** self 証拠エリア (flipFaceUpEvidence cost 等) */
  evidence?: { cardId: string; faceUp?: boolean }[];
  /** 【ヒラメキ】発動不能中に、別能力による効果invokeが貫通する契約用。 */
  hiramekiSuppressed?: boolean;
}

export type ProbeDrive =
  | { kind: 'declared'; uid: string; abilityId: string; costParams?: AbilityCostParams }
  | { kind: 'enter'; cardId: string; uid: string; side?: Side }
  | { kind: 'event-use'; cardId: string }
  | { kind: 'cost-gate'; uid: string; abilityId: string; expectCanPay: boolean; costParams?: AbilityCostParams };

export type ProbeScriptAction =
  | 'optional:take'
  | 'optional:decline'
  | 'pick:skip'
  | { pickUid: string }
  | { pickCardId: string }
  // S2 B01022 (2026-07-10): multi-pick (nMax>1) を 1 prompt で複数解決する。cardId 指定で
  // 候補 pool から先頭一致を 1 つずつ消費 (同 cardId 重複も別候補に割当)。
  | { pickCardIds: string[] };

export type ProbeAssertion =
  | { kind: 'zone'; cardId: string; zone: 'remove' | 'hand' | 'scene' | 'deck' | 'partner-area'; side: Side; present: boolean }
  | { kind: 'state'; uid: string; state: CharState }
  | { kind: 'handDelta'; side: Side; n: number }
  | { kind: 'deckDelta'; side: Side; n: number }
  | { kind: 'candidatesExclude'; pickIndex: number; uid?: string; cardId?: string }
  | { kind: 'noPromptSurfaced' }
  | { kind: 'apDelta'; uid: string; n: number }
  | { kind: 'stacked'; hostUid: string; cardId: string; present: boolean };

export interface ProbeScenario {
  name: string;
  setup: ProbeSetup;
  drive: ProbeDrive;
  script?: ProbeScriptAction[];
  expect: ProbeAssertion[];
}

const PARTNER_FIXTURE_ID = '__PROBE_PARTNER__';

function setHuman(s: Side | null): void {
  (globalThis as { __humanPlayerSide?: Side | null }).__humanPlayerSide = s;
}

function mkSceneChar(c: ProbeSceneChar): SceneCharacter {
  return {
    cardId: c.cardId,
    uid: c.uid,
    state: c.state ?? 'active',
    isNamed: false,
    enterOrder: 1,
    enterOrderThisTurn: 1,
    setCards: c.setCards ? c.setCards.map(entry => ({ ...entry })) : [],
    stackedCards: c.stackedCards ? c.stackedCards.map(entry => ({ ...entry })) : 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  } as SceneCharacter;
}

function resetAll(): void {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  const g = globalThis as {
    __pendingEffectOptionalResume?: unknown;
    __pendingEffectOptionalBindings?: unknown;
    __pendingDeckReorderSide?: unknown;
    __pendingDeckPlaceSide?: unknown;
  };
  g.__pendingEffectOptionalResume = null;
  g.__pendingEffectOptionalBindings = null;
  g.__pendingDeckReorderSide = null;
  g.__pendingDeckPlaceSide = null;
  setHuman('self');
}

function buildState(def: CardDef, fixtures: CardDef[], scenario: ProbeScenario): GameState {
  const setup = scenario.setup;
  const s = createEmptyGameState();
  s.turn = {
    number: 5,
    player: setup.turn ?? 'self',
    phase: 'main',
    isFirstPlayerFirstTurn: false,
  } as GameState['turn'];

  // case
  if (setup.caseStatus) s.players.self.case.status = setup.caseStatus;
  if (setup.caseColors) s.players.self.case.colors = [...setup.caseColors];
  if (setup.caseTraits) (s.players.self.case as unknown as { traits?: string[] }).traits = [...setup.caseTraits];

  // partner (色条件用)
  if (setup.partnerColors) {
    s.players.self.partner.cardId = PARTNER_FIXTURE_ID;
  }

  // scenes
  if (setup.selfScene) s.players.self.scene = setup.selfScene.map(mkSceneChar);
  if (setup.oppScene) s.players.opp.scene = setup.oppScene.map(mkSceneChar);

  // hand / deck / remove / PA / file
  if (setup.hand) s.players.self.hand = [...setup.hand];
  s.players.self.deck = Array.from({ length: setup.deckSize ?? 6 }, (_v, i) => `__DECK_S_${i}`);
  s.players.opp.deck = Array.from({ length: setup.oppDeckSize ?? 4 }, (_v, i) => `__DECK_O_${i}`);
  // deckTop: 明示 cardId をデッキ最上部へ (cost removeDeckTop / deckRevealUntil の中身依存シナリオ用)
  if (setup.deckTop) s.players.self.deck = [...setup.deckTop, ...s.players.self.deck];
  // oppDeckTop: 相手デッキ最上部へ (souza 等、S2 B02072)
  if (setup.oppDeckTop) s.players.opp.deck = [...setup.oppDeckTop, ...s.players.opp.deck];
  if (setup.evidence) {
    s.players.self.evidence = setup.evidence.map((e) => ({
      cardId: e.cardId,
      faceUp: e.faceUp ?? false,
      origin: { turn: 1, via: 'effect' as const },
    }));
  }
  if (setup.hiramekiSuppressed !== undefined) {
    s.turnState.self.hiramekiSuppressed = setup.hiramekiSuppressed;
  }
  if (setup.remove) s.players.self.remove = [...setup.remove];
  if (setup.partnerAreaCards) s.players.self.partnerAreaCards = [...setup.partnerAreaCards];
  if (setup.fileCount != null) {
    s.players.self.file = Array.from({ length: setup.fileCount }, () => ({ type: 'card-back' as const, cardId: '__FILE__' }));
  }
  return s;
}

// deck filler def (draw/mill が cardId を必要としても解決できるよう登録)
function fillerDefs(): CardDef[] {
  const mk = (id: string): CardDef => ({
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  });
  const defs: CardDef[] = [mk('__FILE__')];
  for (let i = 0; i < 12; i++) { defs.push(mk(`__DECK_S_${i}`)); defs.push(mk(`__DECK_O_${i}`)); }
  return defs;
}

interface RecordedPick { atomVerb: string; candidates: { uid: string; cardId: string }[]; }

function driveAndScript(
  s: GameState,
  scenario: ProbeScenario,
): { recorded: RecordedPick[]; promptCount: number } {
  const recorded: RecordedPick[] = [];
  const script = [...(scenario.script ?? [])];
  let scriptIdx = 0;
  let promptCount = 0;

  const drive = scenario.drive;
  if (drive.kind === 'declared') {
    activateDeclaredAbility(s, drive.uid, drive.abilityId, drive.costParams);
    runAllUntilEmpty(s);
  } else if (drive.kind === 'enter') {
    const side = drive.side ?? 'self';
    const ch = s.players[side].scene.find((c) => c.uid === drive.uid);
    if (!ch) throw new Error(`[harness] enter drive: uid=${drive.uid} not in ${side}.scene (setup mismatch)`);
    event.emit(
      s,
      'enter',
      { uid: drive.uid, viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1, sourceCardId: undefined },
      { player: side, uid: drive.uid, cardId: drive.cardId },
    );
    runAllUntilEmpty(s);
  } else if (drive.kind === 'event-use') {
    handUseCard(s, 'self', drive.cardId);
    runAllUntilEmpty(s);
  }

  // pick-first / optional-second drain loop (実測 surfacing order)
  // 安全弁: 1 scenario で 50 prompt を超えたら暴走とみなす
  for (let guard = 0; guard < 50; guard++) {
    const reorder = _drainPendingDeckReorderSide();
    if (reorder) {
      // Probe scenarios do not assert a particular legal permutation. Confirm
      // identity order without consuming a script action, then continue draining.
      applyDeckReorderAndContinuation(s, reorder, reorder.cardIds);
      continue;
    }
    const pick = _drainPendingEffectPickSide();
    if (pick) {
      promptCount++;
      const cands = (pick.candidates as Array<{ uid: string; cardId: string }>).map((c) => ({ uid: c.uid, cardId: c.cardId }));
      recorded.push({ atomVerb: pick.atomVerb, candidates: cands });
      const action = script[scriptIdx++];
      if (action === undefined) {
        throw new Error(`[harness] pick "${pick.atomVerb}" surfaced but script exhausted (candidates=${cands.map((c) => c.cardId).join(',')})`);
      }
      if (action === 'pick:skip') {
        applyPickSkipAndContinuation(s, pick, false);
      } else if (typeof action === 'object' && 'pickUid' in action) {
        applyPickAndContinuation(s, pick, action.pickUid);
      } else if (typeof action === 'object' && 'pickCardId' in action) {
        const hit = cands.find((c) => c.cardId === action.pickCardId);
        if (!hit) {
          throw new Error(`[harness] pickCardId "${action.pickCardId}" not among candidates of "${pick.atomVerb}" (got: ${cands.map((c) => c.cardId).join(',') || '∅'})`);
        }
        applyPickAndContinuation(s, pick, hit.uid);
      } else if (typeof action === 'object' && 'pickCardIds' in action) {
        // S2 B01022: multi-pick — pool から cardId 一致を 1 件ずつ消費 (重複 cardId は別候補に割当)
        const pool = [...cands];
        const uids: string[] = [];
        for (const cid of action.pickCardIds) {
          const i = pool.findIndex((c) => c.cardId === cid);
          if (i === -1) {
            throw new Error(`[harness] pickCardIds "${cid}" not among remaining candidates of "${pick.atomVerb}" (got: ${pool.map((c) => c.cardId).join(',') || '∅'})`);
          }
          uids.push(pool[i]!.uid);
          pool.splice(i, 1);
        }
        if (uids.length === 0) {
          throw new Error('[harness] pickCardIds must contain at least 1 cardId (use pick:skip for 0)');
        }
        applyPickAndContinuation(s, pick, uids[0]!, uids);
      } else {
        throw new Error(`[harness] pick "${pick.atomVerb}" surfaced but script action is "${String(action)}" (expected pick action)`);
      }
      continue;
    }
    const opt = _drainPendingEffectOptionalSide();
    if (opt) {
      promptCount++;
      const action = script[scriptIdx++];
      if (action === undefined) {
        throw new Error(`[harness] optional surfaced but script exhausted`);
      }
      if (action === 'optional:take') {
        applyOptionalAndContinuation(s, opt, true);
      } else if (action === 'optional:decline') {
        applyOptionalAndContinuation(s, opt, false);
      } else {
        throw new Error(`[harness] optional surfaced but script action is "${JSON.stringify(action)}" (expected optional:take|optional:decline)`);
      }
      continue;
    }
    break;
  }

  if (scriptIdx < script.length) {
    throw new Error(`[harness] script has ${script.length - scriptIdx} leftover action(s) but no more prompts surfaced (over-scripted)`);
  }
  return { recorded, promptCount };
}

function zoneContains(s: GameState, side: Side, zone: string, cardId: string): boolean {
  const p = s.players[side];
  switch (zone) {
    case 'remove': return p.remove.includes(cardId);
    case 'hand': return p.hand.includes(cardId);
    case 'deck': return p.deck.includes(cardId);
    case 'scene': return p.scene.some((c) => c.cardId === cardId);
    case 'partner-area': return (p.partnerAreaCards ?? []).includes(cardId);
    default: throw new Error(`[harness] unknown zone "${zone}"`);
  }
}

export function runCardScenario(def: CardDef, fixtures: CardDef[], scenario: ProbeScenario): GameState {
  resetAll();
  const allDefs: CardDef[] = [def, ...fixtures, ...fillerDefs()];
  if (scenario.setup.partnerColors) {
    allDefs.push({
      id: PARTNER_FIXTURE_ID, no: PARTNER_FIXTURE_ID, kind: 'partner', names: [PARTNER_FIXTURE_ID],
      colors: [...scenario.setup.partnerColors], level: 0, ap: 0, lp: 3,
      traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    } as CardDef);
  }
  const seen = new Set<string>();
  for (const d of allDefs) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    registerCardDef(d);
  }
  registerTriggeredListener();

  const s = buildState(def, fixtures, scenario);

  // Cost gate must match the public declared-ability boundary. Calling the
  // mutator afterwards also proves an unpayable branch queues no effect.
  if (scenario.drive.kind === 'cost-gate') {
    const drive = scenario.drive;
    const ability = def.abilities.find((a) => a.id === drive.abilityId);
    if (!ability || !ability.cost) throw new Error(`[harness] cost-gate: ability ${drive.abilityId} has no cost`);
    const before = JSON.stringify(s);
    const can = canActivateDeclaredAbility(s, drive.uid, drive.abilityId, drive.costParams);
    expect(can, `[${scenario.name}] public activation expected ${drive.expectCanPay}`).toBe(drive.expectCanPay);
    if (!can) {
      activateDeclaredAbility(s, drive.uid, drive.abilityId, drive.costParams);
      expect(JSON.stringify(s), `[${scenario.name}] rejected activation mutated state`).toBe(before);
      expect(s.pendingEffects, `[${scenario.name}] rejected activation queued effects`).toEqual([]);
    }
    return s;
  }

  // AP baseline (apDelta 用)
  const apBefore = new Map<string, number>();
  for (const a of scenario.expect) {
    if (a.kind === 'apDelta') {
      try { apBefore.set(a.uid, readChar.ap(s, a.uid)); } catch { apBefore.set(a.uid, 0); }
    }
  }
  const handBefore = { self: s.players.self.hand.length, opp: s.players.opp.hand.length };
  const deckBefore = { self: s.players.self.deck.length, opp: s.players.opp.deck.length };

  const { recorded, promptCount } = driveAndScript(s, scenario);

  for (const a of scenario.expect) {
    switch (a.kind) {
      case 'zone': {
        const has = zoneContains(s, a.side, a.zone, a.cardId);
        expect(has, `[${scenario.name}] zone ${a.side}.${a.zone} contains ${a.cardId} → expected present=${a.present}`).toBe(a.present);
        break;
      }
      case 'state': {
        const ch = [...s.players.self.scene, ...s.players.opp.scene].find((c) => c.uid === a.uid);
        expect(ch, `[${scenario.name}] state: uid ${a.uid} not found on any scene`).toBeTruthy();
        expect(ch!.state, `[${scenario.name}] state of ${a.uid}`).toBe(a.state);
        break;
      }
      case 'handDelta': {
        const now = s.players[a.side].hand.length;
        expect(now - handBefore[a.side], `[${scenario.name}] handDelta ${a.side}`).toBe(a.n);
        break;
      }
      case 'deckDelta': {
        const now = s.players[a.side].deck.length;
        expect(now - deckBefore[a.side], `[${scenario.name}] deckDelta ${a.side}`).toBe(a.n);
        break;
      }
      case 'candidatesExclude': {
        const rec = recorded[a.pickIndex];
        expect(rec, `[${scenario.name}] candidatesExclude: no pick recorded at index ${a.pickIndex} (recorded ${recorded.length})`).toBeTruthy();
        const key = a.cardId ?? a.uid;
        const excludedByCard = a.cardId != null && rec!.candidates.some((c) => c.cardId === a.cardId);
        const excludedByUid = a.uid != null && rec!.candidates.some((c) => c.uid === a.uid);
        const present = excludedByCard || excludedByUid;
        expect(present, `[${scenario.name}] decoy ${key} must be EXCLUDED from pick#${a.pickIndex} (${rec!.atomVerb}) candidates: ${rec!.candidates.map((c) => c.cardId).join(',')}`).toBe(false);
        break;
      }
      case 'noPromptSurfaced': {
        expect(promptCount, `[${scenario.name}] expected no prompt to surface`).toBe(0);
        break;
      }
      case 'apDelta': {
        const now = (() => { try { return readChar.ap(s, a.uid); } catch { return 0; } })();
        expect(now - (apBefore.get(a.uid) ?? 0), `[${scenario.name}] apDelta ${a.uid}`).toBe(a.n);
        break;
      }
      case 'stacked': {
        const host = [...s.players.self.scene, ...s.players.opp.scene].find(char => char.uid === a.hostUid);
        const entries = host && Array.isArray(host.stackedCards) ? host.stackedCards : [];
        expect(entries.some(entry => entry.cardId === a.cardId), `[${scenario.name}] ${a.cardId} stacked under ${a.hostUid}`)
          .toBe(a.present);
        break;
      }
    }
  }
  return s;
}
