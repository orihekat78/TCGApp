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
  // Task D E1 (2026-06-12): 手札枚数条件。player は resolvePlayer 規約 ('self'=カード所有者)。
  // handAtMost を not(handAtLeast n+1) に畳まないのは公式テキスト「N枚以下」と 1:1 対応させるため。
  // rules: 15-abilities-effects.md (「〜の場合」は effect 内 conditional で解決時評価),
  //        21-declared-ability-cost.md (宣言ゲートは AbilityDef.condition)
  | { kind: 'handAtLeast'; player: 'self' | 'opp'; n: number }
  | { kind: 'handAtMost'; player: 'self' | 'opp'; n: number }
  // 「player の手札枚数 >= 反対側の手札枚数」(B07067「相手の手札が自分の手札の枚数以上」= player:'opp')
  | { kind: 'handCountAtLeastOther'; player: 'self' | 'opp' }
  | { kind: 'fileTopType'; type: 'card-back' | 'assisted-partner' }
  // Task D E3 (2026-06-12): FILE 最上位の非 assisted-partner カードを TargetFilter で評価
  // (「FILEエリアにある1番上のカードがキャラの場合」B09021。fileFlipTop が公開した札と同一参照)
  | { kind: 'fileTopMatches'; side?: 'self' | 'opp'; filter?: TargetFilter }
  // Task D E3 (2026-06-12): トリガ payload.player と source.player の側一致 (file:pop 等
  // キャラ uid を持たない hook 用。triggerCharMatches は payload.uid 必須で不適合)
  | { kind: 'triggerPlayerIs'; side: 'self' | 'opp' }
  | { kind: 'scratchTrace'; player: 'self' | 'opp'; v: '発見済' | '未発見' }
  | { kind: 'flag'; player: 'self' | 'opp'; key: keyof TurnScopedFlags; v: boolean }
  | { kind: 'declaredUseUnder'; uid: string; abilityId: string; max: number }
  | { kind: 'bound'; key: string; presence?: 'exists' | 'matched' }
  | { kind: 'removeColorAtLeast'; player: 'self' | 'opp'; color: string | string[]; n: number }
  | { kind: 'removeTraitAtLeast'; player: 'self' | 'opp'; trait: string | string[]; n: number }
  | { kind: 'removeNameAtLeast'; player: 'self' | 'opp'; cardName: string | string[]; n: number }
  | { kind: 'stackedCountAtLeast'; ref: TargetingRef; n: number }
  // BUG-145 (self-state micro-cluster, 2026-06-15): ref が指すキャラの状態 (active/sleep/stun) 判定。
  // 「このキャラをスリープさせ(…)てもよい。そうした場合…」を already-sleep で gate するための条件
  // (公式qAndA PR138/PR144/B04049: 既にスリープなら「スリープさせることができないので行えません」)。
  // ref 解決は apAtLeast/stackedCountAtLeast と同流儀 (resolveCharsForRef)。複数解決時は .some。
  | { kind: 'charStateIs'; ref: TargetingRef; state: 'active' | 'sleep' | 'stun' }
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
  // engine拡張 wave#2 cluster15 (2026-06-16): removal-observer (反撃カード一族)。leave:to-remove
  // payload snapshot {uid,cause,side,byUid} を scene 再取得せず読む (triggerCharMatches は splice 済
  // キャラに使えない、13198)。side=除去キャラ所属 (payload.side===owner→self、全 variant='opp')、
  // cause=除去原因 (省略=方法問わず)、by=除去者(=contact winner aUid): 'self'=このキャラ /
  // {filter,excludeSource}=自分の現場の filter 一致キャラ。spec: engine-cluster15-contact-removal-observer-design.md
  | { kind: 'removedCharMatches'; side?: 'self' | 'opp' | 'either'; cause?: 'contact-ap' | 'effect' | 'switch' | 'cost'; by?: 'self' | { filter: TargetFilter; excludeSource?: boolean } }
  // 2026-06-06 タスクC: トリガ payload のキャラ (例: reasoning:end の推理キャラ payload.uid) を
  // side + TargetFilter で評価する。「自分/相手の現場にいる〚条件〛のキャラが推理したとき」を
  // matcherCondition で declarative 化。side:'self'=payload.player===source.player (= card 所有者側)。
  // Task D E2 (2026-06-12): excludeSource — payload.uid === ctx.source.uid を除外。
  // 「このキャラ以外の〚X〛が登場したとき」(B09002 a1) で rules/19 分割名の自己一致を防ぐ。
  // Task D E4 (2026-06-12): payloadKey — payload の uid フィールド名を指定 (例: 'guardUid' で
  // 「レベル6以下のキャラによってガードされたとき」B09041。player は scene 走査で導出)。
  | { kind: 'triggerCharMatches'; side?: 'self' | 'opp' | 'either'; filter?: TargetFilter; excludeSource?: boolean; payloadKey?: string }
  // engine拡張 wave#2 cluster3 (2026-06-13): action:declare payload の target.kind を読む。
  // 「アクション[キャラ]したとき」(v:'char') / 「アクション[事件]したとき」(v:'case') の subtype gate を
  // declarative 化 (matcher closure は granted descriptor で禁止 = validate.ts のため JSON cond が必須。
  // B01036/B01068/B02068/B03097/B08048/D04005)。triggerCharMatches との複合は and で書く。
  | { kind: 'triggerActionKind'; v: 'char' | 'case' }
  // Task D E4 (2026-06-12): ctx.source キャラ自身の turnEffects flag を読む
  // (「この能力は、このターン中にこのキャラのアクションがガードされていた場合に宣言できる」B09041 a3)
  | { kind: 'charTurnEffect'; key: string }
  // engine拡張 wave#2 cluster11 (2026-06-15, BUG-146 coupled): 効果/能力による登場の「原因カード」を評価する。
  // enter payload.viaEffect (効果登場か) + payload.sourceCardId (登場を起こした能力/効果の所有カード cardId) を読み、
  // sourceFilter を CardDef-static (matchOneFilter c=null = 印字値、原因カードが盤面を離れていても可) で判定する。
  // rules/17「【登場時】能力/効果による登場でも発動」。「レベル3以上のキャラの能力やレベル3以上のイベントの効果で
  // 登場した場合」(B01014/15/21 = or([{kind:character,levelMin:3},{kind:event,levelMin:3}])) /
  // 「【緑】のイベントの効果で登場した場合」(B07019 = {kind:event,color:緑})。sourceCardId 不在/non-effect は不一致。
  | { kind: 'enterSource'; viaEffect?: boolean; sourceFilter?: TargetFilter }
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
  // Task D E3 (2026-06-12): fileRemoveTop (FILE 上から n 枚を所有者 remove へ、アシストパートナー除外) /
  // fileFlipTop (FILE 最上位の非パートナーを表向き化、既に表向きなら no-op)
  | 'draw' | 'discard' | 'mill' | 'fileAdd' | 'filePopToHand' | 'fileRemoveTop' | 'fileFlipTop'
  | 'evidenceGain' | 'evidenceLose' | 'evidenceFlip' | 'selfToEvidence' | 'evidenceToDeck'
  | 'evidenceToHand' | 'handAddFromRemove' | 'handAddFromDeck'
  | 'sceneEnter' | 'sceneSwitch' | 'sceneRemove' | 'sceneSetState' | 'sceneDisguise' | 'sceneToHand'
  // Task D E2 (2026-06-12): 現場キャラを所有者のデッキ下/上へ移す (sceneToHand 同型 PA 短縮形)。
  // rules: 09/23 (デッキ下移動はリムーブでない=現場リムーブ時不発動), 16 (set/stacked はリムーブ)
  | 'sceneToDeck'
  | 'charModifyAP' | 'charModifyLP' | 'charModifyLevel' | 'charSetAP' | 'charSetLP'
  | 'charOverrideAP' | 'charOverrideLP'
  | 'charGrantKeyword' | 'charRevokeKeyword' | 'charDisableOriginal'
  | 'charSetTurnEffect' | 'charSetCard' | 'charStackCard' | 'charRemoveSetCard'
  // Task D E4 (2026-06-12): triggered ability の動的付与 (turnEffects.grantedAbilities へ JSON descriptor)。
  // 「そのキャラに『このキャラがアクションしたとき、カードを1枚引く。』を与える」(B02014) 等。
  | 'charGrantAbility'
  | 'partnerAssist' | 'partnerSetState' | 'partnerSolveCase'
  | 'caseToResolved'
  | 'startContact' | 'endActionEarly'
  | 'deckRevealUntil' | 'deckToBottomBound' | 'boundToRemove' | 'deckShuffle' | 'souza'
  // engine拡張 wave#2 cluster4 (2026-06-14): 自分と相手はリムーブエリアの「すべて」のカードを各自の
  // デッキの下に移し、両者のデッキをシャッフルする (B08027【登場時】)。pick を持たない fixed verb。
  // rules: 14/26 (デッキが増えるのみ → これは「リフレッシュ」ではない=証拠を得る手順なし、公式Q&A),
  //   09/23 (リムーブでない=現場リムーブ時不発動)。
  | 'removeAreaAllToDeckBottom'
  // engine拡張 wave#2 cluster6 (2026-06-14): 「このターン中、自分はイベントを使用できない」
  // (B09034/B09034P)。turnState[p].eventUseBanned=true をセットする turn-scoped flag verb。
  // 手札の使用・ネクストヒントの event のみゲート (公式 Q&A: カットイン/ヒラメキは制限外)。
  // rules: 25 (公式 Q&A) / 12 (ネクストヒント) / 06 (イベント使い切り)
  | 'setEventUseBan'
  | 'setHiramekiSuppress'
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
  // Task D E2 (2026-06-12): 〚現場にいる…を n 枚デッキの下に移す〛コスト (B04011/B07080/B08076)。
  // rules: 21 (全部行えなければ使用不可), 09/23 (リムーブでない)
  | { kind: 'sceneToDeckBottom'; target: TargetingRef; n: number }
  // engine拡張 wave#2 cluster4 (2026-06-14): 〚リムーブエリアにある…を n 枚デッキの下に移す〛コスト
  //   (B08051【宣言】/ B08066【宣言】/ B03059【宣言】)。sceneToDeckBottom の area:'remove' 版。
  // rules: 21 (全部行えなければ使用不可 / 「自分の」省略 → query.side:'self' / 公式Q&A「相手のカードは移せない」),
  //   09/23 (デッキ下移動はリムーブでない=現場リムーブ時不発動), 14/26 (デッキが増えるのみ → refresh は起きない)
  | { kind: 'removeAreaToDeckBottom'; target: TargetingRef; n: number }
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
