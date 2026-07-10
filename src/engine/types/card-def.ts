// CardDef 型定義
// rules: 02-deck-construction.md, 06-card-types.md, 13-keywords.md, 19-special-rules.md
// spec: .claude/specs/engine-api-card-shape.md, engine-api-card-abilities.md

import type { GameState, SceneCharacter } from './game-state.js';
import type { Effect, Condition, Cost, TargetFilter } from './effect.js';
import type { HookName } from './hooks.js';

// ---------- AbilityType ----------
// rules: 15-abilities-effects.md, 21-declared-ability-cost.md, 25-qa-effects-resolution.md

export type AbilityType =
  | 'continuous'      // 「〜の場合 〜限り、AP+X」 常時有効 (rules/24, 25)
  | 'triggered'       // 「〜したとき」 条件発動
  | 'declared'        // 【宣言】 宣言能力 (rules/21)
  | 'icon-disguise'   // 変装 (rules/09)
  | 'icon-misread';   // ミスリード (rules/13) — Phase 8 完全クローズ Commit 3b 追加
  // 2026-05-27 Option C: 'icon-flash' 廃止。ヒラメキは type:'triggered' + trigger:{hook:'evidence:remove-by-action', optional:true}
  // に統合 (src/engine/listeners/triggered.ts handleEvidenceRemovedHook が処理)。
  // 2026-05-27 Option C: 'icon-cutin' 廃止。カットインは type:'triggered' + scope:'on-hand'
  // + trigger:{hook:'effect:declared', optional:true} に統合 (flow.contact.cutIn() が
  // emit→discard 順で発火し、triggered listener が hand-area scope で effect を queue)。

// ---------- AbilityScope ----------

export type AbilityScope =
  | 'on-scene'           // 現場にいる間 (デフォルト)
  | 'on-partner-area'    // パートナーエリアでも (MR系 rules/18)
  | 'on-hand'            // 手札時 (例: 一部カットイン)
  | 'on-evidence'        // 証拠時 (ヒラメキ rules/10)
  // engine additive (2026-06-29c): 装備イベント等が「セットされているキャラ」(host) に付与するライダー能力。
  // セットカード def 上に書かれるが、効果対象は **セット先の host キャラ**。faceUp でセットされている間のみ有効
  // (rules/16: 裏向きセットは情報を持たない / セット先が現場を離れたらリムーブ → 自動失効)。
  //   continuous (apDelta/lpDelta/lvlDelta/grantKeywords) → read.char.* が faceUp set card を走査し host に合算。
  //   triggered → listeners.triggered.handleHook が host (card.uid) の能力として発火 (selfOnly は host uid 照合)。
  // B02013 ターボエンジン付きスケートボード (〚突撃〛付与) / B06063 せんぷう剣 (【自分ターン中】AP+2000) /
  // B05117 コンコン (triggered 付与) 等、14 rider + 8 conferred-ability の最大未実装クラスタの **read 半分** を担う。
  // ⚠ 本 scope は READ 側 infra (host が rider を読む) のみ。以下は **未対応 = 後続 gate** (DEFERRED-INDEX §on-set-host):
  //   (1) WRITE 側: 使用イベントを host.setCards へ faceUp で載せる verb が未実装 (hand-use はイベントを必ず remove へ送る。
  //       かつ event 効果は remove 着地 **後** に解決 → 「set-from-remove」型 verb が要)。これが無いと rider カードは end-to-end 不可。
  //   (2) leave:to-remove conferral: host が splice **後** に leave:to-remove emit されるため、conferred leave trigger は不発
  //       (B05117 等)。handleLeaveToRemoveSelf が removedChar snapshot の setCards を走査する追加修正が要。
  //   (3) aura (apDeltaAura*/auraFilter*) / opponentRestrict を rider で付与する形は未 honor (read.char.auraDelta/restrictsOpponent は
  //       setCards を走査しない) → silent no-op。現リダーカードは全て self-buff ゆえ未踏。
  //   (4) authoring hazard: rider triggered の limit{turn} は (hostUid, ability.id) でキー。host 印字能力や同名 rider 2枚と
  //       id 衝突するとカウンタ共有。rider ability.id は card-unique に命名すること (例 'set_t1')。
  | 'on-set-host'        // セットされているキャラ (host) に付与 (rules/16, 装備イベント) — READ 側 infra のみ
  // engine additive A2 (2026-07-11, B02084 安室の愛車): セットカード **自身** が、host からリムーブ
  // エリアへ置かれたときに反応する triggered 用 (「キャラにセットされていたこのイベントがリムーブ
  // エリアに置かれたとき」)。セットカードは離場後 collectCardsInPlay に出ないため handleHook では
  // 拾えない → handleSetcardLeaveSelf (virtual-location handler、handleLeaveToRemoveSelf 同型) が
  // payload.setCardId から def を引き本 scope の setcard:leave ability を発火。faceUp のみ (rules/16
  // 裏向きセットは情報を持たない / B02084 Q&A)。on-set-host (host へ conferral) とは別軸 = 自己反応。
  | 'on-set-self'
  | 'always';            // どこでも (デバッグ用)

// ---------- AbilityLimit ----------
// rules: 17-icons.md §【ターン①/②】, 24-qa-naming-stun.md

export type AbilityLimit =
  | { kind: 'turn'; n: 1 | 2 }
  | { kind: 'game'; n: number }
  | null;

// ---------- TriggerDef ----------
// rules: 15-abilities-effects.md, 22-qa-action-contact.md

export type TriggerDef = {
  hook: HookName;
  /**
   * 2026-06-06 タスクC: 追加 hook (multi-hook trigger)。`hook` に加えてここに列挙した hook の
   * いずれでも発火する。limit:{kind:'turn'} は ability.id 単位の declaredUseCount で数えるため、
   * 複数 hook を跨いだ **共有【ターンN】** が自動的に成立する (例: D03007「推理かアクションしたとき」
   * 【ターン1】= reasoning:end と action:declare のどちらか 1 回)。selfOnly / matcherCondition は
   * 全 hook に共通適用される (action:declare payload も uid/player を持つよう拡張済)。
   */
  hooks?: HookName[];
  matcher?: (payload: unknown, state: GameState) => boolean;
  /**
   * matcher の declarative 版 (D11007 a3 等で payload 依存判定を inline 関数ではなく
   * Condition kind で表現するため)。listener は matcher / matcherCondition のどちらか
   * (あれば両方) を評価し、false なら trigger を skip する。
   * payload は ctx.triggerPayload に詰めて evalCond に渡す経路。
   */
  matcherCondition?: Condition;
  selfOnly?: boolean;                      // 自分のキャラに対する発火のみ
  ignoreCostInduced?: boolean;             // viaCost: true を無視 (rules/21, 25)
  /**
   * 2026-05-27 (Option C migration): 任意発動。true なら listener は effect を直接 queue せず、
   * pendingHirameki side-channel に push してプレイヤーの fire/skip 選択を待つ (rules/10 §ヒラメキ)。
   * 主に hook='evidence:remove-by-action' (ヒラメキ) で使用。false / 未指定なら従来の
   * 強制発動 (rules/15 §必須効果)。
   */
  optional?: boolean;
};

// ---------- ContinuousModifier ----------
// G23: 常時有効型の selector 計算
// engine.read.char.ap/lp/keywords 等が selector 経由で動的に合算する

// 常時有効型の AP/LP 修正値 (rules/24 §常時有効型: read 時に毎回再計算)。
// dyn 式 {dyn:'...'} (宣言形・推奨) / 定数 / closure (後方互換・最終手段) の3形を許容。
// engine.read.char.ap/lp が走査・合算する (grantKeywords と同じ continuous 経路)。
export type ContinuousDelta =
  | number
  | { dyn: string }
  | ((s: GameState, ctx: { uid: string }) => number);

// engine mega-wave W4 (2026-07-03, r62 G32): filter 付き突撃 grant の 1 entry (B07096「突撃[レベル4以下のキャラ]」)。
export type FilteredAssaultGrant = { targetKind: 'char' | 'case'; filter: TargetFilter };

export type ContinuousModifier = {
  apDelta?: ContinuousDelta;
  lpDelta?: ContinuousDelta;
  // engine additive wave (2026-06-24): 条件付き継続レベル修正 (「【自分ターン中】レベル+1」B08059 /
  // 「【解決編】レベル+3」B08050)。apDelta/lpDelta と完全対称に read.char.level +
  // candidates.matchOneFilter の2 site が continuousDelta(which:'lvlDelta') で honor する
  // (BUG-117: filter-level==combat-level)。不在時 +0 (既存カードは未宣言 → 回帰0)。
  // self-only (aura 版 lvlDeltaAura は未導入 = YAGNI、対象カードは全て self-buff)。
  lvlDelta?: ContinuousDelta;
  grantKeywords?: (s: GameState, ctx: { uid: string }) => string[];
  // engine mega-wave W4 (2026-07-03, r62 G32): filter 付き突撃の継続付与 —「〚突撃［レベル4以下の
  // キャラ］〛」(B07096 ウォッカ)。plain grantKeywords と違い対象 filter を伴うため、read.char.
  // filteredAssaultKeywords が走査し flow/main/action.ts namedExceptionAllowed が per-target で
  // matchOneFilter 評価する (effective level 込み — 公式Q&A「効果でレベル4以下になったキャラも指定可」)。
  // plain data (JSON シリアライズ可能維持)。targetKind:'case' 側 consumer は未出現 = namedException の
  // case 側 filter dispatch は未実装 (DEFERRED-INDEX 参照、「対応済」と誤記しないこと)。
  grantFilteredAssault?: FilteredAssaultGrant[];
  // engine additive wave-6 (2026-07-01, P37): 継続的な特徴/カード名の付与 (self-scope continuous)。
  //   「現場にいるこのキャラは〚特徴[探偵]〛を持つ」(B08063 長野県警 / B05012 探偵) /
  //   「現場にいるこのキャラは〚カード名[怪盗キッド]〛としても扱う」(B07053 / B05012 毛利小五郎)。
  // grantKeywords と完全対称の continuous 経路: read.char.traits/names + candidates.matchOneFilter
  //   (trait/cardName/cardNameNot) + cond/eval bond が effective 集合 = 印字 ∪ granted を honor する
  //   (BUG-117 原則: filter 値 == board 値)。付与は **現場の board char (uid 既知) のみ** — deck/remove の
  //   同 cardId には及ばない (公式 Q&A「現場にいなければ有効でない」B07053/B08063) → matchOneFilter は
  //   c?.uid 既知時のみ granted を合流し、c===null (hand/deck/remove/bound=cardId) は印字のまま。
  //   ability.condition (【自分ターン中】等) 成立中のみ有効 (rules/24 §常時有効型)。grantNames は
  //   rules/19 の分割名展開 (cardNameComponents) を経て component 単位で照合される。
  // 不在時 no-op (既存カードは未宣言 → grantWalk 空集合 → 印字のみ、smoke baseline 不変)。
  // aura 版 (全自軍付与 B06095) / removeTraits (「失う」B05101 の permanent applied 変更) は別 primitive で DEFER。
  grantTraits?: string[];
  grantNames?: string[];
  customSelectorPatch?: (s: GameState, uid: string, base: SceneCharacter) => Partial<SceneCharacter>;
  // engine拡張 wave#2 cluster5 (2026-06-14): 相手への使用制限 aura (rules/09 §カットイン/変装, rules/24 §常時有効型)。
  //   'cutin'          = 「相手は【カットイン】を使用できない」(B02063/B04034/B09017)。
  //                      flow.contact.canCutIn が cut-in する側の相手盤面を read.char.restrictsOpponent で走査。
  //   'disguiseTrigger'= 「相手のキャラの【変装時】は発動しない」(B04034)。
  //                      flow.contact.disguise が disguise:into emit を抑止 (変装 swap 自体は成立)。
  // ability.condition と併用し条件成立中のみ aura 有効。不在時 no-op (既存カードは未宣言 → restrictsOpponent=false)。
  //   'refreshEvidence' = 「相手はリフレッシュによって証拠を得られない」(B05097、W2 2026-07-03)。
  //                      mutate.deck.refresh が **リフレッシュ実行側 p** の盤面 aura を restrictsOpponent(s,p,..)
  //                      で走査し、成立時は相手への penalty 証拠 push のみ抑止 (reshuffle/痕跡/remove:exit は不変、rules/14)。
  //   'hirameki'       = 「相手は【ヒラメキ】を発動できない」(B05079、W2 2026-07-03)。
  //                      listeners/triggered.handleEvidenceRemovedHook が発火前に aura gate (rules/10、
  //                      証拠リムーブ自体は継続・ヒラメキ効果のみ不発 = 公式Q&A)。
  // engine mega-wave W4 (2026-07-03, r1 P01 protection rider): 'remove'|'sleep'|'stun' = 保持キャラ自身の
  // 対キャラ保護 (「相手の能力や効果によってリムーブされず、スリープされず、スタンされない」B05041)。
  // 適用は cause==='effect' の atom 経路 (atomSceneRemove/atomSceneSetState) の **相手発** のみ —
  // contact-ap 除去・switch・cost・自分の効果・デッキ下移動等は対象外 (公式Q&A B05041)。読取は
  // read.char.charProtectedFrom (per-target: 自身の abilities + faceUp setCards の on-set-host rider)。
  // 既存 4 token (cutin 等) は player-level 制限で restrictsOpponent (board-wide) が読む — 別経路。
  // engine mega-wave W6 step5 (2026-07-04, r74/B03046): 'stunAutoActivate' = 「相手の現場にいる
  //   スタン状態のキャラはオートフェイズにアクティブにならない」(パートナー印字 continuous)。
  //   read.char.restrictsOpponent (partner-bearer 拡張済) が読み、flow/auto-phase.ts ステップ2 が
  //   stun キャラの tryActivate を丸ごと skip (rules/03 の stun→sleep 変換も起きない = 公式Q&A
  //   「アクティブになる代わりにスリープになることもありません」)。
  opponentRestrict?: ('cutin' | 'disguiseTrigger' | 'refreshEvidence' | 'hirameki' | 'remove' | 'sleep' | 'stun' | 'stunAutoActivate')[];
  // engine mega-wave W2 (2026-07-03, P07/r24): 継続アクション制限 token 群 (bearer 自身に係る)。
  //   read.char.selfContinuousFlag(s, uid, token) が bearer の continuous ability を walk
  //   (condition honor、restrictsOpponent と同流儀) して boolean を返す。不在時 false = 挙動不変。
  //   untargetableByAction    = 「相手の現場にいるキャラはこのキャラを指定してアクションできない」(B03057
  //                             「スリープ状態の場合」等は ability.condition で gate)。
  //                             target-expander.candidates() の負 filter で除外 (全消費者単一配線)。
  //   caseActionBan           = 「このキャラはアクション[事件]できない」(B05051)。canActionAgainstCase gate。
  //   selfActionBan           = 「このキャラはアクションできない」(B07005)。_canAction gate。
  //   selfCutinBanInContact   = 「このキャラのコンタクト中、自分は【カットイン】を使用できない」(B07005)。
  //                             canCutIn が p 側コンタクト参加キャラの flag を gate。
  untargetableByAction?: boolean;
  // engine mega-wave W6 step5 (2026-07-04, r50/B04072): 「相手は自分の現場にいる[filter]のキャラを
  //   指定してアクションできない」— bearer (現場/PA-MR) が **同 side の他キャラ群** を filter 越しに
  //   対象除外へ投影する aura 版 (untargetableByAction = 自身 bool とは別フィールド、混同注意)。
  //   ability.condition (charStateIs self sleep 等) で成立 gate。読取 = read.char.auraUntargetableByAction
  //   (auraDelta 同型 board-scan)、配線 = target-expander.candidates() の負 filter (ガードは非対象 =
  //   公式Q&A B04072「ガードは可能」、guard 経路は candidates() 非経由で自動整合)。
  untargetableByActionAura?: TargetFilter;
  caseActionBan?: boolean;
  selfActionBan?: boolean;
  selfCutinBanInContact?: boolean;
  // engine mega-wave W2b (2026-07-03, P50/r27): 「相手はイベントの効果によってこのキャラを選べる場合、
  //   必ず選ぶ」(B08087 吞口重彦)。G28 mustBeTargeted (action-target 強制) の effect-pick 版。
  //   reader = read.char.selfContinuousFlag (同 union)。enforce = effect-pick の selection 境界 3 site
  //   (resolve-picks.forcedInclusionUids: human push が pending.forcedUids に載せ UI が lock、
  //   AI 同期 walk は picked/greedy へ強制合流、apply-pick.chooseAiPick は pending.forcedUids honor)。
  //   gate = イベント使用の自効果のみ (ctx.triggerPayload kind==='event-use' + cardId 一致。
  //   キャラ能力/カットイン/ヒラメキ/第三者 reaction の pick は非該当、公式Q&A「相手が使用した
  //   イベントの効果で」) + 候補集合在中 (「選べる場合」) + c.player !== chooser (「相手は」の方向)。
  //   forced > nMax は min(forced, nMax) 枚に clamp (公式Q&A「1枚まで×2枚→どちらか1枚」)。
  mustBeSelectedByOppEvent?: boolean;
  // engine mega-wave W2 (2026-07-03, P09/r26): 「手札から使用する場合、このキャラは事件カードの色を
  //   無視できる」(B03126 犯人。ネクストヒントも「手札から使用」に含む — 印字括弧書き)。
  //   hand-use-card.handUseColorIgnoreAllowed (単一ソース helper) が hand 在中カード自身の def を walk。
  //   色 subset 判定が失敗した時のみ委譲 = 通常カードはゼロコスト。効果登場/カットイン/ヒラメキは元々
  //   色制限外 (rules/20) のため対象外。
  colorIgnoreOnHandUse?: boolean;
  // engine A3 wave (2026-07-11, B02087 キール): 「ネクストヒントで手札から使用する場合、このキャラは
  //   事件カードの色を無視できる」— NH 経路**限定**の色無視 (colorIgnoreOnHandUse は手札の使用 + NH の
  //   両経路で over-wide、B02087 の公式Q&A は「ネクストヒントで手札から使用する場合のみ」)。
  //   consumer = next-hint.ts colorAllowed / flows.ts toCandidate のみ (nextHintColorIgnoreAllowed 経由)。
  //   手札の使用経路 (hand-use-card colorAllowed / handUseReason) は本 token を**見ない** = NH 限定を担保。
  colorIgnoreOnNextHint?: boolean;
  // engine mini-wave #4 (2026-07-10, cluster ⑧): hand 内 continuous level modifier
  //   「手札にあるこのキャラはレベル4になる」(B01009) / 「手札にある間レベル-2」(B09095)。
  //   flow.main.hand-use-card.effectiveHandLevel (単一ソース helper) が hand 在中カード**自身**の def を
  //   walk (colorIgnoreOnHandUse と同流儀、ability.condition honor)。consumer = 手札の使用 levelAllowed /
  //   ネクストヒント step2 level gate / UI flows.toCandidate / handUseReason (全 4 site 同 helper 経由)。
  //   合成は rules/19 流儀の二段 (override を先に確定 → delta を加算、ability 記載順に依存しない)。
  //   下限なし (rules/19 §レベルに下限はない — 負値も FILE 比較にそのまま使う)。
  //   ⚠ hand gate 専用 — scene/その他エリアの level 読み (candidates levelMax 等) は不変
  //   (公式 QA: 「手札にある間だけ。現場では元のレベル」)。不在時 no-op (baseline 不変)。
  lvlOverrideInHand?: number;
  lvlDeltaInHand?: number;
  // M2後半 (2026-07-10, B07008): hand 内 per-count level modifier —
  //   「自分の現場にいる〚カード名[X]〛か特徴[Y]のキャラ1枚につきレベル-1」。
  //   filterAny (OR、per-char 判定 = 両該当でも 1 枚は 1 で二重計上なし) に一致する自現場キャラ数 × delta を
  //   effectiveHandLevel が加算する (honor site は同 helper 1 箇所で閉じる — scene 側 level 読みは不変)。
  lvlDeltaInHandPer?: { delta: number; filterAny: TargetFilter[] };
  // engine拡張 wave#2 cluster13 (2026-06-15): 他キャラへの AP/LP buff aura (rules/15, 17 §【自分ターン中】, 24 §常時有効型)。
  // 「【自分ターン中】自分の現場にいる [auraFilter] のキャラを AP±N」型。bearer の **同一 side の現場**の各キャラに対し、
  //   auraFilter (matchOneFilter で 有効値=turnEffects 反映レベル を判定) が一致すれば apDeltaAura/lpDeltaAura を加算する。
  //   auraExcludeSelf=true で「このキャラ以外」(bearer 自身を除外)。ability.condition (【自分ターン中】等) 成立中のみ有効。
  // engine.read.char.ap/lp + candidates.matchOneFilter が auraDeltaSafe (再帰 guard 経由) で合算する
  //   (filter-AP と combat-AP を一致させる — BUG-117 原則)。不在時 no-op (既存カードは未宣言 → auraDelta=0、smoke baseline 不変)。
  apDeltaAura?: number;
  lpDeltaAura?: number;
  auraFilter?: TargetFilter;
  auraExcludeSelf?: boolean;
  // engine additive (2026-06-29): cross-side 数値 aura (「【自分ターン中】相手の現場にいる [auraFilterOpp] の
  // キャラを AP±N」B03033 遠山和葉)。apDeltaAura/lpDeltaAura (同 side bearer→同 side target) と対称だが、bearer の
  //   **反対 side の現場**の各キャラに対し auraFilterOpp が一致すれば apDeltaAuraOpp/lpDeltaAuraOpp を加算する。
  //   cluster13 aura は同 side 限定で相手盤面に届かなかった (「相手の現場の…を AP-1000」型が未対応だった)。
  // read.char.auraDelta が同一呼出内で反対 side bearer も走査する (honor 経路は apDeltaAura と共有 =
  //   read.char.ap/lp + candidates.matchOneFilter、新 honor site 無し)。ability.condition (【自分ターン中】等) 成立中のみ有効。
  //   auraExcludeSelf は cross-side では無意味 (bearer≠target が常に成立) ゆえ非適用。不在時 no-op
  //   (既存カードは未宣言 → 反対 side 走査の加算 0、smoke baseline 不変)。
  apDeltaAuraOpp?: number;
  lpDeltaAuraOpp?: number;
  auraFilterOpp?: TargetFilter;
  // engine additive wave-5 (2026-07-01, P05): case card 継続能力「自分は [handUseRestrictFilter] 以外の
  //   キャラを手札から使用できない」(B05120 特徴[探偵] / B06109 特徴[高校生])。allow-filter = 使用を
  //   許可する character の TargetFilter。flow.main.hand-use-card.handUseCharRestrictAllows が自分の case
  //   card def の abilities[].continuousModifier.handUseRestrictFilter を走査し、手札の使用 (canHandUseCard/
  //   Switch) + ネクストヒント (runNextHint) の両経路で character のみ gate する (event/効果登場/カットイン/
  //   変装/ヒラメキ は対象外 — 公式 Q&A)。不在時 no-op (既存 case は未宣言 → 全 character 許可、baseline 不変)。
  handUseRestrictFilter?: TargetFilter;
  // engine E3 P11 (2026-07-02): case card 継続能力「自分の現場に置けるキャラの枚数は〚最大N枚まで〛になる」
  //   (PR067 探偵の目、5→4)。read.sceneCap が自 case def の abilities[].continuousModifier.sceneCapOverride を
  //   走査し (type==='continuous' + ability.condition honor)、現場**登場ゲート** (mutate.scene.enter throw /
  //   effect sceneEnter の switch 判定 / canHandUseCard/Switch) の閾値を override する。不在時 5 (baseline 不変)。
  //   ⚠ 登場閾値のみ変更 — 絶対 invariant (sceneAtMost5) は 5 のまま (既存 5 枚 + cap4 でも強制リムーブしない、
  //   rules/19 §下限なし に準じた非強制解釈。公式は 5→4 で既存超過時の裁定を明示せず → 保守的に非除去)。
  sceneCapOverride?: number;
  // engine E3 P11 (2026-07-02): case card 継続能力「自分のパートナーの色は【青】…【黒】になる」
  //   (PR067 探偵の目、全6色化)。cond/eval.ts partnerColor が自 case def の
  //   abilities[].continuousModifier.partnerColorsOverride を走査 (type==='continuous' + ability.condition honor)
  //   し、パートナー印字色の**代わりに**この色集合で【パートナー(色)】条件を評価する。不在時は印字色 (baseline 不変)。
  //   ⚠ authoring footgun (latent、現 frozen card では不発): (a) この ability の condition.kind に
  //   'partnerColor' を使うと partnerColor→partnerColorsOverride→evalCond(partnerColor) で無限再帰 (stack overflow) →
  //   partnerColorsOverride ability の condition には partnerColor を使わないこと。(b) condition が ctx.bindings を
  //   読む kind (boundMatchesFilter 等) は caseCtx.bindings={} で undefined になり得る (case 継続能力は bindings 非依存 kind のみ想定)。
  //   PR067 は unconditional ゆえ両者非該当。consumer 拡張時に guard 追加を検討。
  partnerColorsOverride?: string[];
  // engine E3 P53 (2026-07-03): 自 case card の継続能力「自分は【事件解決】できない」(B09107 犯人たちの犯行)。
  //   read.game.cannotSolveCase が自 case def の abilities[].continuousModifier.cannotSolveCase を走査
  //   (type==='continuous' + ability.condition honor)。canWin / ai.canSolveCase / ui.canSolveCaseForUi が gate。
  //   通常勝利ルート (【事件解決】) を封鎖し alt-lose (opponentLoses) のみ残す設計 (E3 分解 spec P53)。
  //   不在時 false (既存 case は未宣言 → baseline 不変)。sceneCapOverride と同流儀。
  cannotSolveCase?: boolean;
  // engine E3 P10 (2026-07-03): 自 case card の継続能力「自分の【黒】のパートナーの【事件解決】能力を
  //   〚【解決編】【証拠隠滅】【スリープ】証拠を事件レベルの数だけリムーブ：相手はゲームに敗北する〛に書き換える」
  //   (B03135/B05118/B06105)。partnerColor 黒 gate は ability.condition ({kind:'partnerColor',color:'黒'}) で表現。
  //   read.game.partnerSolveOverride が cannotSolveCase と同流儀で走査。有効時、mutate.partner.solveCase は
  //   通常勝利 (reason:'evidence') の代わりに 証拠を requiredEvidence(=事件レベル) 数リムーブ + alt-lose 決着へ差し替える。
  //   前提条件 (解決編/active partner/evidence>=required/!assisted) は通常 solve と同一 → canWin/AI/UI 列挙は不変。
  //   【証拠隠滅】keyword は display-only (参照 consumer 0) → engine repr なし。不在時 no-op (baseline 不変)。
  partnerSolveOverride?: boolean;
};

// ---------- AbilityDef ----------
// spec: engine-api-card-abilities.md

export type AbilityDef = {
  id: string;                              // カード内一意 ("a1", "a2")
  name?: string;                           // 表示名
  type: AbilityType;                       // 6種
  condition?: Condition;                   // 条件アイコン (rules/17)
  cost?: Cost;                             // 宣言能力時のみ (rules/21)
  trigger?: TriggerDef;                    // type='triggered' 時
  scope?: AbilityScope;                    // 「いつ有効か」
  limit?: AbilityLimit;                    // 【ターン①】等
  effect?: Effect;                         // Descriptor (DSL) — continuous 以外
  continuousModifier?: ContinuousModifier; // type='continuous' 時のみ (G23)
  description: string;                     // 公式テキスト (エラッタ後)
  ruleRefs?: string[];
};

// ---------- CardDef ----------
// 単一型として保持 (kind 判別子で識別)。
// kind 別の必須フィールド整合は engine.cards.validate で検証する。

export type CardDef = {
  id: string;                              // 例: "B08004" / "D08003"
  no: string;                              // 例: "0001/B08004"
  kind: 'character' | 'event' | 'partner' | 'case';
  names: string[];                         // 複数名カードは複数 (rules/19)
  colors: string[];                        // 1〜2色 (rules/20)
  level?: number;                          // event/character (パートナー除く)
  ap?: number;                             // character のみ
  lp?: number;                             // character/partner
  traits: string[];                        // 特徴 (例: [警察], [少年探偵団])
  rarity: string;                          // R/SR/MR/PR ...
  isMR?: boolean;                          // MR フラグ (rules/18)
  flavor?: string;
  imageUrl: string;                        // ローカル運用 (rules: 法務スタンス)
  abilities: AbilityDef[];                 // 能力定義 (Phase 5 で TSV+merge)
  ruleRefs: string[];                      // 例: ["rules/11-reasoning.md §LP≤0"]

  // kind-specific optional fields
  caseLevel?: number;                      // kind:'case' — 事件レベル (rules/01)
  caseTraits?: string[];                   // kind:'case' — 例: ["古城", "婚活"]
  keywords?: string[];                     // kind:'character' — 迅速/突撃[X]等 (rules/13)
};
