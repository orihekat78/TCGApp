// Effect DSL 型定義
// rules: 15-abilities-effects.md, 07-action-flow.md, 08-contact.md, 09-cutin-disguise.md
// rules: 11-reasoning.md, 13-keywords.md, 14-refresh.md, 21-declared-ability-cost.md

import type { GameState, TurnScopedFlags } from './game-state.js';
import type { EffectCtx } from './effect-ctx.js';

// ---------- Condition ----------

export type Condition =
  | { kind: 'true' }
  | { kind: 'false' }
  | { kind: 'not'; c: Condition }
  | { kind: 'and'; cs: Condition[] }
  | { kind: 'or'; cs: Condition[] }
  | { kind: 'turn'; player: 'self' | 'opp' }
  | { kind: 'partnerColor'; color: string | string[] }
  | { kind: 'caseColor'; color: string | string[]; combine?: 'or' | 'and' }
  | { kind: 'caseTrait'; trait: string }
  | { kind: 'fileAtLeast'; n: number }
  | { kind: 'caseStatus'; status: '事件編' | '解決編' }
  | { kind: 'bond'; cardName: string | string[] }
  | { kind: 'sceneHas'; query: TargetQuery; nMin?: number }
  | { kind: 'apAtLeast'; ref: TargetingRef; n: number }
  | { kind: 'lpAtLeast'; ref: TargetingRef; n: number }
  | { kind: 'evidenceAtLeast'; player: 'self' | 'opp'; n: number }
  | { kind: 'fileTopType'; type: 'card-back' | 'assisted-partner' }
  | { kind: 'scratchTrace'; player: 'self' | 'opp'; v: '発見済' | '未発見' }
  | { kind: 'flag'; player: 'self' | 'opp'; key: keyof TurnScopedFlags; v: boolean }
  | { kind: 'declaredUseUnder'; uid: string; abilityId: string; max: number }
  | { kind: 'bound'; key: string; presence?: 'exists' | 'matched' }
  | { kind: 'removeColorAtLeast'; player: 'self' | 'opp'; color: string | string[]; n: number }
  | { kind: 'removeTraitAtLeast'; player: 'self' | 'opp'; trait: string | string[]; n: number }
  | { kind: 'removeNameAtLeast'; player: 'self' | 'opp'; cardName: string | string[]; n: number }
  | { kind: 'stackedCountAtLeast'; ref: TargetingRef; n: number }
  // D11007 a3: contact:start hook 発火時、attacker (aUid) より defender (bUid) の方が AP が高い場合
  // payload は ctx.triggerPayload に詰められ、listener から評価される (TriggerDef.matcherCondition 経由)
  | { kind: 'contactOpponentApHigher' }
  // D11016 a1: action:guarded payload.guardUid === ctx.source.uid (このキャラがガードしたとき、rules/07)
  | { kind: 'guardedBySelf' }
  // D11014 a1 / D11003 / D11009 driver: enter hook の payload.enterOrder が n と一致するか
  // (【疾風 N】 = ターン N 番目に登場で発火、matcher → matcherCondition declarative 化)
  | { kind: 'enterOrderEquals'; n: number }
  // D11014 a2 driver: ctx.bindings[bindKey][0] の cardId を TargetFilter で評価
  // (「〚カード名[X]〛を登場させた場合」を declarative 化、matchOneFilter 再利用)
  | { kind: 'boundMatchesFilter'; bindKey: string; filter: TargetFilter }
  // 2026-06-06 タスクC: トリガ payload のキャラ (例: reasoning:end の推理キャラ payload.uid) を
  // side + TargetFilter で評価する。「自分/相手の現場にいる〚条件〛のキャラが推理したとき」を
  // matcherCondition で declarative 化。side:'self'=payload.player===source.player (= card 所有者側)。
  | { kind: 'triggerCharMatches'; side?: 'self' | 'opp' | 'either'; filter?: TargetFilter }
  | { kind: 'custom'; check: (s: GameState, ctx: EffectCtx) => boolean };

// ---------- TargetFilter / TargetQuery / TargetingRef ----------

import type { Candidate } from './candidate.js';

export type TargetFilter = {
  cardId?: string | string[];
  cardName?: string | string[];
  trait?: string | string[];
  color?: string | string[];
  keyword?: string | string[];
  // BUG-118: カード種別 filter ('character' | 'event')。deckRevealUntil (targetFilterToPredicate) は
  // 元から評価していたが matchOneFilter (target pick 経路) が未評価だったため型に昇格して両経路で honored 化。
  kind?: 'character' | 'event';
  apMin?: number;
  apMax?: number;
  lpMin?: number;
  lpMax?: number;
  levelMin?: number;
  levelMax?: number;
  hasSetCards?: boolean;
  custom?: (s: GameState, candidate: Candidate) => boolean;
};

export type TargetQuery = {
  area?: 'scene' | 'partner-area' | 'hand' | 'deck' | 'remove' | 'evidence' | 'file' | 'case';
  side?: 'self' | 'opp' | 'either' | 'owner' | 'opp-of-owner';
  filter?: TargetFilter;
  filterAny?: TargetFilter[];
  excludeSelf?: boolean;
  state?: ('active' | 'sleep' | 'stun')[];
  named?: boolean;
  distinctNames?: boolean;
};

export type TargetingRef =
  | { kind: 'self' }
  | { kind: 'pick'; query: TargetQuery; n: { min: number; max: number }; chooser: 'owner' | 'opp' | 'self' | 'opp-of-owner' }
  | { kind: 'all'; query: TargetQuery }
  | { kind: 'fromBound'; bindKey: string };

// ---------- TriggerRef ----------

export type TriggerRef =
  | { on: 'reasoning'; by?: TargetingRef }
  | { on: 'action'; by?: TargetingRef; against?: TargetingRef }
  | { on: 'contact-ap-judge' }
  | { on: 'evidence-remove' }
  | { on: 'enter'; who: TargetingRef }
  | { on: 'leave'; who: TargetingRef }
  | { on: 'refresh'; player: 'self' | 'opp' }
  | { on: 'effect-resolution'; matcher: object };

// ---------- Scope ----------

export type Scope = 'contact' | 'action' | 'turn' | 'opp-turn' | 'permanent' | 'until-leave';

// ---------- AtomVerb ----------

export type AtomVerb =
  | 'draw' | 'discard' | 'mill' | 'fileAdd' | 'filePopToHand'
  | 'evidenceGain' | 'evidenceLose' | 'evidenceFlip'
  | 'evidenceToHand' | 'handAddFromRemove' | 'handAddFromDeck'
  | 'sceneEnter' | 'sceneSwitch' | 'sceneRemove' | 'sceneSetState' | 'sceneDisguise' | 'sceneToHand'
  | 'charModifyAP' | 'charModifyLP' | 'charModifyLevel' | 'charSetAP' | 'charSetLP'
  | 'charOverrideAP' | 'charOverrideLP'
  | 'charGrantKeyword' | 'charRevokeKeyword' | 'charDisableOriginal'
  | 'charSetTurnEffect' | 'charSetCard' | 'charStackCard'
  | 'partnerAssist' | 'partnerSetState' | 'partnerSolveCase'
  | 'caseToResolved'
  | 'startContact' | 'endActionEarly'
  | 'deckRevealUntil' | 'deckToBottomBound' | 'deckShuffle' | 'souza'
  // D11007 v2 Phase 3: action target 拡張仕様を transient side-channel に push
  // (action:pre-target hook の listener が呼ぶ。candidates() が consume)
  | 'expandActionTargets'
  | 'log' | 'noop';

// ---------- Cost ----------

export type Cost =
  | { kind: 'sleepSelf' }
  | { kind: 'sleepChar'; target: TargetingRef }
  | { kind: 'removeFromHand'; target: TargetingRef; n: number }
  | { kind: 'removeFromScene'; target: TargetingRef; n: number }
  | { kind: 'removeDeckTop'; player: 'self'; n: number }
  | { kind: 'discardEvidence'; n: number }
  | { kind: 'selfToDeckBottom' }
  | { kind: 'pay'; items: Cost[] }
  | { kind: 'choice'; items: Cost[] }
  | { kind: 'fileFrom'; n: number }
  | { kind: 'flipFaceUpEvidence'; n: { min: number; max: number } }
  | { kind: 'custom'; check: (s: GameState, ctx: EffectCtx) => boolean; pay: (s: GameState, ctx: EffectCtx) => void };

// ---------- Effect ----------

export type Effect =
  | { kind: 'sequence'; steps: Effect[] }
  | { kind: 'parallel'; steps: Effect[] }
  | { kind: 'choice'; options: Effect[]; chooser: 'self' | 'opp' | 'owner' }
  | { kind: 'optional'; effect: Effect }
  | { kind: 'conditional'; if: Condition; then: Effect; else?: Effect }
  | { kind: 'forEach'; over: TargetingRef; do: Effect }
  | { kind: 'replace'; trigger: TriggerRef; with: Effect }
  | { kind: 'negate'; trigger: TriggerRef }
  | { kind: 'atom'; verb: AtomVerb; args: unknown }
  | { kind: 'custom'; fn: (s: GameState, ctx: EffectCtx) => void }
  // 拡張 5 (D08003 driver): 公式テキスト「そうした場合」 semantics。
  // step N が「実効果あり」のとき N+1 を実行。N が no-op (no candidate) なら以降 skip。
  // pick await 時は chain 継続情報を保存して effectPickResolve 後に再 queue する。
  | { kind: 'chain'; steps: Effect[] };
