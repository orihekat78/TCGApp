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
  // engine additive (2026-06-27 session62): 事件の色 NEGATION 「持つ」side (「事件が【X】以外の色を持つ場合」)。
  // 公式 B08079 裁定で some説確定: caseColors.some(c => c∉notSet) (X以外の色を1つ以上持つ)。
  // mono-X→false / 2色{X,Y}→true / 空→false。⚠ 素の not(caseColor X) (= Xを持たない、none説) とは 2色で非対称。
  // 「持たない」side (= 事件 ⊆ {X}) は既存 _shared `caseMonoColor` (= not(caseColorNot(X)) と等価)。
  // honor: cond/eval.ts case 'caseColorNot' + CONDITION_KIND_MAP + validate-specs CONDS。
  | { kind: 'caseColorNot'; color: string | string[] }
  | { kind: 'caseTrait'; trait: string }
  | { kind: 'fileAtLeast'; n: number }
  | { kind: 'caseStatus'; status: '事件編' | '解決編' }
  | { kind: 'bond'; cardName: string | string[] }
  | { kind: 'sceneHas'; query: TargetQuery; nMin?: number }
  | { kind: 'apAtLeast'; ref: TargetingRef; n: number }
  | { kind: 'lpAtLeast'; ref: TargetingRef; n: number }
  // engine additive wave (2026-06-29d): 現場キャラの LP **合計** を min/max 比較 (B06003 a2
  // 「自分の現場にキャラが3枚以上いて、全員のLPの合計が2以下の場合」= and[sceneHas{nMin:3}, sceneLpSum{max:2}])。
  // lpAtLeast(per-char .some)/sceneHas(枚数) では合算不可。負 LP も合計対象 (公式Q&A B06003、charRead.lp が honor)。
  // query は candidates() で列挙 (side/filter/state)。min/max いずれか/両方で範囲指定。honor: cond/eval.ts case + MAP + CONDS。
  | { kind: 'sceneLpSum'; query: TargetQuery; min?: number; max?: number }
  | { kind: 'evidenceAtLeast'; player: 'self' | 'opp'; n: number }
  // engine additive wave (2026-06-30): 証拠枚数の **差** で分岐 (B05103「籌を帷幄の中に運らし…」
  // 「相手の証拠が自分の証拠より2つ以上多い場合」= player:'opp', other:'self', n:2 →
  // players[opp].evidence − players[self].evidence >= n)。evidenceAtLeast(片側閾値)では差を表現できない。
  // player/other は resolvePlayer 規約 ('self'=カード所有者)。honor: cond/eval.ts case + MAP + CONDS。
  | { kind: 'evidenceDiff'; player: 'self' | 'opp'; other: 'self' | 'opp'; n: number }
  // engine E3 P53 (2026-07-03): 証拠エリアの特徴計数 (B09107「自分の証拠に〚特徴［犯人］〛のカードが8枚以上ある場合」)。
  // players[player].evidence を lookupCardDef で特徴解決し、trait (単一 or 配列 any-match) 一致枚数 >= n。
  // faceUp/faceDown 問わず全証拠を計数 (evidenceFlip all で全表向き化した後に評価する運用だが計数自体は状態非依存)。
  // state 直読み (ctx 非依存) → removeTraitAtLeast と同型。honor: cond/eval.ts case + MAP + CONDS。
  | { kind: 'evidenceTraitAtLeast'; player: 'self' | 'opp'; trait: string | string[]; n: number }
  // Task D E1 (2026-06-12): 手札枚数条件。player は resolvePlayer 規約 ('self'=カード所有者)。
  // handAtMost を not(handAtLeast n+1) に畳まないのは公式テキスト「N枚以下」と 1:1 対応させるため。
  // rules: 15-abilities-effects.md (「〜の場合」は effect 内 conditional で解決時評価),
  //        21-declared-ability-cost.md (宣言ゲートは AbilityDef.condition)
  | { kind: 'handAtLeast'; player: 'self' | 'opp'; n: number }
  | { kind: 'handAtMost'; player: 'self' | 'opp'; n: number }
  // 「player の手札枚数 >= 反対側の手札枚数」(B07067「相手の手札が自分の手札の枚数以上」= player:'opp')
  | { kind: 'handCountAtLeastOther'; player: 'self' | 'opp' }
  // engine additive wave (2026-06-30): 自他 **現場キャラ枚数** の比較 (B05081 威嚇射撃「自分の現場に
  // いるキャラが相手の現場にいるキャラより少ない場合」= player:'self', other:'opp', cmp:'lt')。
  // handCountAtLeastOther の scene 版だが cmp で 5 比較子 (lt/le/gt/ge/eq) を一般化。
  // .scene.length = キャラ枚数 ($self.oppSceneCount と同流儀、rules/03 §現場=scene)。player/other は resolvePlayer 規約。
  | { kind: 'sceneCountCompare'; player: 'self' | 'opp'; other: 'self' | 'opp'; cmp: 'lt' | 'le' | 'gt' | 'ge' | 'eq' }
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
  // engine additive wave (2026-06-30): cardKind を追加し色 AND **カード種別** で計数 (B08004 江戸川コナン
  // 「リムーブエリアに【黒】の**キャラ**が3枚以上ある場合」= 黒イベントを数えない)。cardKind 省略時は
  // 従来通り全種別計数 (回帰0)。field 名は discriminant `kind` と衝突するため cardKind (TargetFilter.kind 同値)。
  | { kind: 'removeColorAtLeast'; player: 'self' | 'opp'; color: string | string[]; n: number; cardKind?: 'character' | 'event' }
  | { kind: 'removeTraitAtLeast'; player: 'self' | 'opp'; trait: string | string[]; n: number }
  | { kind: 'removeNameAtLeast'; player: 'self' | 'opp'; cardName: string | string[]; n: number }
  // engine additive: removeCountAtLeast — リムーブエリアの **総枚数** (filter 無し) が n 以上か (B03104
  // 「リムーブエリアにカードが15枚以上ある場合」)。removeColor/Trait/NameAtLeast の unfiltered 版。
  | { kind: 'removeCountAtLeast'; player: 'self' | 'opp'; n: number }
  // engine additive wave (2026-06-29d): 直前に支払った **コストによって除去されたカード** の素性で分岐
  // (B03003/B04077/B06078「この【宣言】能力のコストによって〚X〛がリムーブされた場合」)。remove*AtLeast は
  // リムーブエリア全体を読むため per-cost スコープでは誤り。removeDeckTop コストが除去 cardId を ctx.costPaid
  // ['removeDeckTop'].ids に記録し、本 cond が matchOneFilter(c=null = 印字値、除去済で盤面不在) で判定。
  // n=必要一致数 (既定1)。cost 未払い時 ids 不在 → false。honor: cost/pay.ts removeDeckTop + cond/eval.ts case + MAP + CONDS。
  // ⚠ filter は単一 TargetFilter = AND セマンティクス。OR が要るカード (B03003「〚阿笠博士〛か〚少年探偵団〛」) は
  //   Condition-level `or[costRemovedMatches{cardName:阿笠博士}, costRemovedMatches{trait:少年探偵団}]` で合成すること。
  //   B04077(警察)/B06078(赤井家) は単一 trait ゆえそのまま可。
  | { kind: 'costRemovedMatches'; filter: TargetFilter; n?: number }
  // engine additive (2026-06-29, B09089 刑事だらけの店): 「このターン中、自分の現場にキャラが
  // 登場していない場合」= turnState[p].enterCountThisTurn が n 以下か。player は resolvePlayer 規約
  // ('self'=カード所有者)。enterCountThisTurn は mutate/scene.ts enter() のみが increment、turn:start で
  // 0 リセット。未初期化は 0 扱い。リムーブ/推理/アクションは increment しないので effect 解決途中で
  // 読んでも prior-enter 数を正しく反映 (handAtMost/removeCountAtLeast と同じ player-resolved 数値比較)。
  | { kind: 'enterCountAtMost'; player: 'self' | 'opp'; n: number }
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
  // engine additive wave-5 (2026-07-01, G17): boundMatchesFilter は bound[0] のみだが、公開/リムーブ
  // した **N 枚集合のいずれか** が filter に一致するか (PR132「特徴[警察]がリムーブされた場合」/
  // D06013「【緑】と【白】が1枚以上」= and[boundAny{緑}, boundAny{白}])。各要素は matchOneFilter に委譲。
  | { kind: 'boundAnyMatchesFilter'; bindKey: string; filter: TargetFilter }
  // engine additive wave-10 (2026-07-02, G17 残): bound 集合内に「filter 一致 かつ 相互に同じ色を
  // 持たない (色集合の pairwise 交差が空)」カードが n 枚以上存在するか。B07002 江戸川コナン a1
  // 「この効果によってそれぞれ色の異なる（同じ色を持たない）〚特徴［探偵］〛のキャラを2枚リムーブした場合」。
  // 2色カード (rules/20) は色集合全体で交差判定 (1色でも共有 =「同じ色を持つ」= 不成立、公式括弧書き)。
  // 各要素は matchOneFilter(c=null=CardDef 印字値) に委譲 (boundAnyMatchesFilter と同流儀)。
  // honor: cond/eval.ts case + CONDITION_KIND_MAP + validate-specs CONDS。
  | { kind: 'boundDistinctColorCount'; bindKey: string; filter?: TargetFilter; n: number }
  // engine拡張 wave#2 cluster15 (2026-06-16): removal-observer (反撃カード一族)。leave:to-remove
  // payload snapshot {uid,cause,side,byUid} を scene 再取得せず読む (triggerCharMatches は splice 済
  // キャラに使えない、13198)。side=除去キャラ所属 (payload.side===owner→self、全 variant='opp')、
  // cause=除去原因 (省略=方法問わず)、by=除去者(=contact winner aUid): 'self'=このキャラ /
  // {filter,excludeSource}=自分の現場の filter 一致キャラ。spec: engine-cluster15-contact-removal-observer-design.md
  // removedFilter (engine拡張 wave 2026-06-23): 離場キャラ **自身** を色/特徴/レベルで絞る observer
  // (B01075「自分の現場の【赤】がリムーブされたとき」/ B03092「レベル6以上の〚警察〛」)。payload の
  // removedChar snapshot に matchOneFilter。snapshot は char.turnEffects を保持するため effective level (rules/19) が
  // 同期 eval 中は正しい (level mod は c.turnEffects から読むため splice 後も有効)。removedState は離場直前の状態
  // (active/sleep/stun) で絞る (B05059「スリープ状態の〚探偵〛」)。matchOneFilter は state を見ない (TargetFilter に
  // state 無し) ため独立フィールドにする。cluster15 D2/D3 が forward 予約済。
  // ⚠ 既知 latent gap: removedFilter の **apMin/apMax/lpMin/lpMax** 軸は信頼不可。matchOneFilter の AP/LP は
  // continuousDelta/auraDelta を board-scan (state.players[*].scene) で合算するが、離場キャラは splice 済で scan に
  // 出ず continuous/aura 分が 0 化する (静的 apMod_* は turnEffects から正しく読む)。現出荷カードは removed char の
  // AP/LP filter を使わないため未踏。将来 AP/LP 軸の removedFilter を要するカードは snapshot に effective AP/LP を
  // 事前計算して載せる additive 拡張が必要 (DEFER 対象)。
  | { kind: 'removedCharMatches'; side?: 'self' | 'opp' | 'either'; cause?: 'contact-ap' | 'effect' | 'switch' | 'cost'; by?: 'self' | { filter: TargetFilter; excludeSource?: boolean }; removedFilter?: TargetFilter; removedState?: ('active' | 'sleep' | 'stun')[] }
  // 2026-06-06 タスクC: トリガ payload のキャラ (例: reasoning:end の推理キャラ payload.uid) を
  // side + TargetFilter で評価する。「自分/相手の現場にいる〚条件〛のキャラが推理したとき」を
  // matcherCondition で declarative 化。side:'self'=payload.player===source.player (= card 所有者側)。
  // Task D E2 (2026-06-12): excludeSource — payload.uid === ctx.source.uid を除外。
  // 「このキャラ以外の〚X〛が登場したとき」(B09002 a1) で rules/19 分割名の自己一致を防ぐ。
  // Task D E4 (2026-06-12): payloadKey — payload の uid フィールド名を指定 (例: 'guardUid' で
  // 「レベル6以下のキャラによってガードされたとき」B09041。player は scene 走査で導出)。
  | { kind: 'triggerCharMatches'; side?: 'self' | 'opp' | 'either'; filter?: TargetFilter; excludeSource?: boolean; payloadKey?: string }
  // engine additive (2026-06-29): setcard:enter payload の set card を filter 評価。
  // 「このキャラに〚特徴[YAIBA]〛のカードがセットされたとき」(B06046)。matcherCondition として使う。
  // 裏向きセット (faceUp!==true) は情報を持たない (rules/16) → 必ず false。set card は scene char では
  // ないため matchOneFilter の char 引数は null (CardDef の印字属性のみ評価)。
  | { kind: 'setCardMatches'; filter: TargetFilter }
  // engine additive wave-3 (2026-06-30): cutin:used payload の使用カットイン (cardId) を filter 評価。
  // 「(使用した)〚カード名/特徴〛のカットインのとき」(B09086 = [諸伏景光]/[長野県警] で分岐)。setCardMatches と
  // 同式で matchOneFilter の char 引数は null (CardDef 印字属性のみ)。triggerPlayerIs(側) との複合は and で書く。
  | { kind: 'triggerCutinMatches'; filter: TargetFilter }
  // engine additive wave-4 (2026-07-01): remove:exit payload の離脱カードを filter 評価。「自分の
  // リムーブエリアにある〚特徴/種別〛のカードがリムーブエリアから離れたとき」(B05087 諸伏高明 /
  // B05088 大和敢助)。emit 元 = mutate/deck.refresh (リフレッシュ=remove→deck、公式Q&A 発動) +
  // mutate/remove.removeFromHere (効果回収)、離脱カード毎。payload={player(=リムーブエリア所有者), cardId}。
  // removeFilter は離脱カードの cardId→CardDef を matchOneFilter(c=null = 印字値) で評価 (remove-area card は
  // turnEffects 無 = 静的 def、setCardMatches/triggerCutinMatches と同流儀)。side='self'=payload.player===
  // source.player (「自分の」)。side 省略時 'self' (B05087/B05088 は全て自分のリムーブエリア)。
  | { kind: 'removeExitMatches'; side?: 'self' | 'opp' | 'either'; removeFilter?: TargetFilter }
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
  // cluster16: カード名 NEGATION (「〚カード名[X]〛以外」)。positive cardName と対称で、split-name
  // (rules/19) の component いずれかが一致したら **除外**。excludeSelf(uid) と異なり name 単位除外
  // なので同名2枚目も除外する (B09017 が custom closure で実装していた前例の declarative 化)。
  // honor 経路 = matchOneFilter / targetFilterToPredicate / boundMatchesFilter の3 filter-eval サイト。
  cardNameNot?: string | string[];
  trait?: string | string[];
  color?: string | string[];
  // engine additive (2026-06-27): 色 NEGATION (「【X】以外の色を持つ」)。公式 B08079 裁定で some説確定:
  // 「X以外の色を1つ以上持つ」(= colors.some(c => c∉notSet))。mono-X は除外、2色{X,Y} は該当 (Y を持つ)。
  // 等価: 全色が notSet 内のとき除外。⚠ cardNameNot (any-match 除外) とは非対称 — 2色で分岐する。
  // honor 経路 = matchOneFilter / boundMatchesFilter / targetFilterToPredicate の3 filter-eval サイト。
  colorNot?: string | string[];
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
  // engine additive wave-7 (2026-07-02, P17): 「このターン中にアクション[キャラ]した」board char のみ該当。
  // 記録 = flow/action/state-machine.ts declare が action:declare (target.kind==='char') 時に actor へ
  // setTurnEffect('actedCharThisTurn', true)。清掃 = clearTurnEffects('turn') (ターン終了)。読取は
  // matchOneFilter が board char (c 有) の turnEffects flag を honor。c===null (deck/remove/hand の印字
  // candidate) は「アクションした」概念が無い → 必ず不一致 (現場に居ないため)。B08049 ジョディ【宣言】
  // 「このターン中にアクション[キャラ]していた〚特徴[FBI]〛のキャラを…アクティブにする」。
  actedCharThisTurn?: boolean;
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
  // engine拡張 wave (2026-06-23): evidence area の pick を裏向き(未公開)のみに限定する。
  // 「(相手の)裏向きの証拠を1つまで選び、表向きにする」(evidenceFlip pick-form) 用。
  // 既存カードは未使用 (= no-op、smoke baseline 不変)。candidates.ts evidence case が honor。
  faceDown?: boolean;
  // engine拡張 wave (2026-06-23): evidence area の pick を表向き(公開済)のみに限定する (faceDown の逆)。
  // 「自分の表向きの証拠を N つまで選び、裏向きにする」(evidenceFlipDown pick-form, B05013/B06017/B06019) 用。
  // 既存カードは未使用 (= no-op、smoke baseline 不変)。candidates.ts evidence case が honor。
  faceUp?: boolean;
  // engine additive wave-18 (2026-07-03): pick を現コンタクトの参加者に限定する。
  // 「コンタクト中のキャラを1枚まで選び、AP±N」(B04075/PR029 白鳥任三郎, B04092 キャンティ) 用。
  // 参加者 = ctx.contact.{byUid,targetUid,guardUid}。excludeSelf と同型の ctx 依存 char 述語のため
  // matchesQueryForChar (ctx 有) で honor する (matchOneFilter は ctx 無し = filter 側には置けない)。
  // ctx.contact は resolve 時 (entryToCtx, BUG-104) にのみ populate される → pick 実行は必ずコンタクト中。
  // ctx.contact 不在時 (コンタクト外の誤用) は全 char 不一致 = 候補0 (安全側)。既存カード未使用 = baseline 不変。
  inContact?: boolean;
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
  // engine additive wave-4 (2026-07-01): drawUpToHandSize — 「手札が N 枚になるまで引く」(B08047 沖矢昴)。
  // draw(max(0, n − 現手札)) の決定論 verb (atomDraw の薄いラッパー、pick 無し)。手札 ≥ N なら no-op
  // (draw-up 方向のみ)。discard-down (B07076) / 引いた枚数 return (B04048) は別 variant で DEFER。args.player 明示。
  | 'drawUpToHandSize'
  // engine拡張 wave (2026-06-23): evidenceFlipDown — 「自分の表向きの証拠を N つまで選び、裏向きにする」
  // (evidenceFlip=表向き化 の逆 mutate)。PB pick (defaultArea 'evidence', faceUp 候補限定)。
  // rules: 03-field-areas.md §状態 / 15-abilities-effects.md。B05013/B06017/B06019 で使用。
  | 'evidenceGain' | 'evidenceLose' | 'evidenceFlip' | 'evidenceFlipDown' | 'selfToEvidence' | 'evidenceToDeck'
  // engine wave-12 (2026-07-02 G39): 「このカードをパートナーエリアに移す」— ctx.source card を
  // owner の remove から PlayerState.partnerAreaCards へ (selfToEvidence 同型の deterministic self 経路)
  | 'toPartnerArea'
  // engine wave A1 (2026-07-02 G39 継続): PA 一般カード枠から filter 一致カードを N 枚選びリムーブ
  // (「自分のパートナーエリアにある〚特徴[ビッグジュエル]〛のカードを2枚リムーブしてもよい」B07037 /
  // PR263)。PB pick (defaultArea 'partner-area')。atomHandReveal と同型の短縮形 pick + exact-N gate
  // (n:N で PA 候補 < N なら chainStepNoApply→「そうした場合」gate)。resolved cardIds を partnerAreaCards
  // から splice → remove へ (mutate.partner.removeAreaCardsToRemove)。handReveal と違い zone 変化あり。
  | 'partnerAreaRemove'
  | 'evidenceToHand' | 'handAddFromRemove' | 'handAddFromDeck'
  // engine additive (2026-06-29): handAddFromDeckBottom — 「デッキのカードを下から1枚手札に加える」
  // (B03051 怪盗キッド)。handAddFromDeck (上から、bind 解決) の positional 下から版。pick 無しの fixed verb
  // (draw/souza 同型)。最後の1枚を取りデッキ0なら即リフレッシュ (rules/14 / B03051 Q&A)。args.player 明示。
  | 'handAddFromDeckBottom'
  // engine拡張 wave (2026-06-21): handToEvidence — 手札から任意1枚を選び「裏向きで証拠として得る」
  // (evidenceToHand の逆。push=証拠1番上、公式Q&A B06029「手札から裏向きで得る証拠は1番上」)。
  // rules: 01-victory-conditions.md §証拠 / 06-card-types.md §イベント。PB pick (defaultArea 'hand')。
  | 'handToEvidence'
  // engine additive wave (2026-06-28): handReveal — 「手札から filter 一致カードを1枚公開してもよい。
  // そうした場合〜」(B08082 a1 / B07022)。公開は zone 変化なし (公式Q&A: 解決後に手札へ戻してよい)。
  // atomDiscard の clone から mutate.hand.discardToRemove を除去したもの。0枚 reveal で chainStepNoApply を
  // 立て「そうした場合」を gate (mill gate と同型、reveal は他効果ゼロゆえ無条件 gate-on-0)。PB pick (defaultArea 'hand')。
  | 'handReveal'
  // engine additive: discardRandom — 手札からランダムに n 枚リムーブする (B01077「相手は手札を1枚
  // ランダムにリムーブする」)。公式 QA: 相手が選べず確率均等な方法。pick を持たない (ランダム選択 =
  // プレイヤー choice 不要)。ctx.rng で決定的 (smoke 再現性)。既存カードは未使用 → baseline 不変。
  | 'discardRandom'
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
  // engine E3 (2026-07-02): opponentLoses —「相手はゲームに敗北する」alt-lose 勝利ルート
  // (P10/P53 family: B03135/B06105/B05118/B09107)。パートナー【事件解決】固定ルート (partnerSolveCase /
  // mutate.partner.solveCase) とは別に、カード効果から決着させる。winner = 効果所有者 (args.player)、
  // reason='alt-lose'。deck-out 系と同じ first-writer guard (既に gameResult があれば no-op)。
  // rules: 01-victory-conditions.md / 15-abilities-effects.md (即時解決)
  | 'opponentLoses'
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
  // wave use-restrict (2026-06-30): 「このターン中、自分はネクストヒントできない」(B06104/P・B09019/P・B09105/P)。
  // turnState[p].nextHintBanned=true をセットする turn-scoped flag verb。canStartNextHint が gate (ネクストヒント全体)。
  // resetTurnFlags でクリア。rules: 12 (ネクストヒント) / 15 (「〜できない」継続制限)
  | 'setNextHintBan'
  // engine additive wave-10 (2026-07-02): 「このターン中、相手は【カットイン】/【変装】を使用できない」
  // (B07002 江戸川コナン a2)。turnState[p].cutinBanned / disguiseBanned をセットする turn-scoped flag verb
  // (setNextHintBan mirror)。ゲートは flow/contact.ts canCutIn / canDisguise。side-level flag ゆえ
  // 発動キャラ離場後も有効 (公式 Q&A B07002)。resetTurnFlags でクリア。rules: 09 / 15 / 25
  | 'setCutinBan'
  | 'setDisguiseBan'
  | 'setHiramekiSuppress'
  // D11007 v2 Phase 3: action target 拡張仕様を transient side-channel に push
  // (action:pre-target hook の listener が呼ぶ。candidates() が consume)
  | 'expandActionTargets'
  | 'log' | 'noop';

// ---------- Cost ----------

export type Cost =
  | { kind: 'sleepSelf' }
  | { kind: 'sleepChar'; target: TargetingRef }
  // engine additive wave (2026-06-24): 〚アクティブ状態の[X]を1枚スタンさせる〛コスト (B08004)。
  // sleepChar と対称。canPay は active 候補存在を要求、pay は mutate.scene.setState(stun) で active のみスタン化。
  | { kind: 'stunChar'; target: TargetingRef }
  | { kind: 'removeFromHand'; target: TargetingRef; n: number }
  // engine additive wave (2026-06-28): 〚手札から filter 一致カードを n 枚公開する〛コスト (B08093 a1)。
  // removeFromHand と同型の canPay (candidates ≥ n) だが pay() は no-op = presence-check cost
  // (公開のみ、リムーブしない)。公式Q&A (B08093): コスト支払い完了→効果解決時に手札へ戻してよい。
  // rules: 21 (コスト「自分の」省略 → query.side:'self' / 全部行えなければ使用不可)。
  | { kind: 'revealFromHand'; target: TargetingRef; n: number }
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
  // engine additive wave (2026-06-24): 〚現場にいるキャラに裏向きでセットされているカードを合わせて n 枚
  //   リムーブする〛コスト (B08033 工藤有希子 a2)。count-based の self-pool コスト (TargetingRef 不使用 —
  //   candidates() は set card を Candidate 列挙しない sub-entity ゆえ。discardEvidence/removeDeckTop と同型)。
  // rules: 16 (set/離場時表向きリムーブ), 21 (コスト「自分の」省略 → self-only / 全部行えなければ不可)。
  //   公式Q&A (B08033): 相手カード不可・host 自身も数える・「裏向き」(faceUp:false) のみ対象・分割可。
  | { kind: 'removeSetCard'; n: number }
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
