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
  /** Match one complete printed name component of the owner's current case. */
  | { kind: 'caseName'; name: string }
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
  /** Deck-size gate, evaluated before any reveal. */
  | { kind: 'deckAtLeast'; player: 'self' | 'opp'; n: number }
  // 「player の手札枚数 >= 反対側の手札枚数」(B07067「相手の手札が自分の手札の枚数以上」= player:'opp')
  | { kind: 'handCountAtLeastOther'; player: 'self' | 'opp' }
  // engine additive wave (2026-06-30): 自他 **現場キャラ枚数** の比較 (B05081 威嚇射撃「自分の現場に
  // いるキャラが相手の現場にいるキャラより少ない場合」= player:'self', other:'opp', cmp:'lt')。
  // handCountAtLeastOther の scene 版だが cmp で 5 比較子 (lt/le/gt/ge/eq) を一般化。
  // .scene.length = キャラ枚数 ($self.oppSceneCount と同流儀、rules/03 §現場=scene)。player/other は resolvePlayer 規約。
  | { kind: 'sceneCountCompare'; player: 'self' | 'opp'; other: 'self' | 'opp'; cmp: 'lt' | 'le' | 'gt' | 'ge' | 'eq' }
  // S2 deck cluster (2026-07-10, B08057): bound 集合の要素数比較 (「カードを合わせて3枚移した場合」)。
  // binding 不在/非配列 = 0 として比較 (fail-closed 側)。cmp union は sceneCountCompare と同一。
  | { kind: 'boundCountCompare'; bindKey: string; cmp: 'lt' | 'le' | 'gt' | 'ge' | 'eq'; n: number }
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
  | { kind: 'sourceDeclaredUseCount'; cmp: 'eq' | 'ge'; n: number }
  | { kind: 'bound'; key: string; presence?: 'exists' | 'matched' }
  // Triggered observers can queue before their source leaves.  Resolution-time
  // wording such as 「このキャラが現場にいる場合」 requires a source-uid check.
  | { kind: 'sourceInScene' }
  // B09024: sceneRemove が bind した除去前stateを後続conditionalで読む。
  | { kind: 'boundCharStateIs'; bindKey: string; state: 'active' | 'sleep' | 'stun' }
  // engine additive wave (2026-06-30): cardKind を追加し色 AND **カード種別** で計数 (B08004 江戸川コナン
  // 「リムーブエリアに【黒】の**キャラ**が3枚以上ある場合」= 黒イベントを数えない)。cardKind 省略時は
  // 従来通り全種別計数 (回帰0)。field 名は discriminant `kind` と衝突するため cardKind (TargetFilter.kind 同値)。
  | { kind: 'removeColorAtLeast'; player: 'self' | 'opp'; color: string | string[]; n: number; cardKind?: 'character' | 'event' }
  | { kind: 'removeTraitAtLeast'; player: 'self' | 'opp'; trait: string | string[]; n: number }
  | { kind: 'removeNameAtLeast'; player: 'self' | 'opp'; cardName: string | string[]; n: number }
  // Remove-area count with OR-composed TargetFilters. Each physical card counts at most once,
  // even if it matches several filters (B05062: named Kyogoku OR Suzuki-Zaibatsu character).
  | { kind: 'removeFilterAtLeast'; player: 'self' | 'opp'; filters: TargetFilter[]; n: number }
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
  // key (attribution mini-wave 2026-07-10): 読む costPaid record を選択 (既定 'removeDeckTop' = 後方互換)。
  //   'removeFromHand' (B09060「コストでリムーブしたカードが〚FBI〛の場合」) / 'removeSetCard'
  //   (B08041「リムーブしたカードがキャラ/イベントの場合」)。書込み側 = cost/pay.ts 各 case。
  | { kind: 'costRemovedMatches'; filter: TargetFilter; n?: number; key?: 'removeDeckTop' | 'removeFromHand' | 'removeSetCard' }
  // costRevealedMatches (attribution mini-wave 2026-07-10, B09005): revealFromHand コストで公開した
  // カードの素性で分岐 (「公開したカードが〚江戸川コナン〛か〚工藤新一〛の場合」)。costRemovedMatches と
  // 同型ロジック (ctx.costPaid['revealFromHand'].ids を matchOneFilter(c=null=印字値) で判定、n=必要一致数 既定1)。
  | { kind: 'costRevealedMatches'; filter: TargetFilter; n?: number }
  // engine additive (2026-06-29, B09089 刑事だらけの店): 「このターン中、自分の現場にキャラが
  // 登場していない場合」= turnState[p].enterCountThisTurn が n 以下か。player は resolvePlayer 規約
  // ('self'=カード所有者)。enterCountThisTurn は mutate/scene.ts enter() のみが increment、turn:start で
  // 0 リセット。未初期化は 0 扱い。リムーブ/推理/アクションは increment しないので effect 解決途中で
  // 読んでも prior-enter 数を正しく反映 (handAtMost/removeCountAtLeast と同じ player-resolved 数値比較)。
  | { kind: 'enterCountAtMost'; player: 'self' | 'opp'; n: number }
  | { kind: 'stackedCountAtLeast'; ref: TargetingRef; n: number }
  // B06046: count known (face-up) set cards of a filtered kind on the ability host.
  // Hidden set cards carry no referable information under rules/16.
  | { kind: 'hostSetCardCountAtLeast'; filter: TargetFilter; n: number }
  // PR200/PR206: count physical face-down set cards across one controller's scene.
  // Unlike hostSetCardCountAtLeast, hidden cards are intentionally not inspected.
  | { kind: 'sceneFaceDownSetCardCountAtLeast'; player: 'self' | 'opp'; n: number }
  // B09036: source-inclusive count of own-scene characters that share any
  // effective card-name component with the ability host (turn nameOverride
  // replaces printed names under rules/19).
  | { kind: 'sameNameCountAtLeast'; n: number }
  // BUG-145 (self-state micro-cluster, 2026-06-15): ref が指すキャラの状態 (active/sleep/stun) 判定。
  // 「このキャラをスリープさせ(…)てもよい。そうした場合…」を already-sleep で gate するための条件
  // (公式qAndA PR138/PR144/B04049: 既にスリープなら「スリープさせることができないので行えません」)。
  // ref 解決は apAtLeast/stackedCountAtLeast と同流儀 (resolveCharsForRef)。複数解決時は .some。
  | { kind: 'charStateIs'; ref: TargetingRef; state: 'active' | 'sleep' | 'stun' }
  | { kind: 'charMatches'; ref: TargetingRef; filter: TargetFilter }
  // D11007 a3: contact:start hook 発火時、attacker (aUid) より defender (bUid) の方が AP が高い場合
  // payload は ctx.triggerPayload に詰められ、listener から評価される (TriggerDef.matcherCondition 経由)
  | { kind: 'contactOpponentApHigher' }
  // D11016 a1: action:guarded payload.guardUid === ctx.source.uid (このキャラがガードしたとき、rules/07)
  | { kind: 'guardedBySelf' }
  // engine defer-unlock mini-wave (2026-07-09): コンタクト参加キャラを TargetFilter で評価
  // (B02006/B02080/PR278/D11013)。who は p-相対 (buildContactBindings): byUid=自コンタクトキャラ /
  // targetUid=相手コンタクトキャラ。ctx.contact 優先 + ctx.bindings.contact[0] fallback
  // (matcherCondition queue-time gate 用)。honor: cond/eval.ts case + CONDITION_KIND_MAP + validate-specs CONDS。
  | {
    kind: 'contactCharMatches';
    who: 'byUid' | 'targetUid';
    filter: TargetFilter;
    requireSource?: boolean;
  }
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
  /** Number of bound cards matching a runtime-declared filter. */
  | { kind: 'boundMatchCountAtLeast'; bindKey: string; filter: TargetFilter; n: number; traitBind?: string }
  // engine additive wave-10 (2026-07-02, G17 残): bound 集合内に「filter 一致 かつ 相互に同じ色を
  // 持たない (色集合の pairwise 交差が空)」カードが n 枚以上存在するか。B07002 江戸川コナン a1
  // 「この効果によってそれぞれ色の異なる（同じ色を持たない）〚特徴［探偵］〛のキャラを2枚リムーブした場合」。
  // 2色カード (rules/20) は色集合全体で交差判定 (1色でも共有 =「同じ色を持つ」= 不成立、公式括弧書き)。
  // 各要素は matchOneFilter(c=null=CardDef 印字値) に委譲 (boundAnyMatchesFilter と同流儀)。
  // honor: cond/eval.ts case + CONDITION_KIND_MAP + validate-specs CONDS。
  | { kind: 'boundDistinctColorCount'; bindKey: string; filter?: TargetFilter; n: number }
  // engine mega-wave W6 step1 (2026-07-04, row 53): ctx.bindings[bindKey] の **いずれか** のカード名が
  // ctx.declaredNames[declareKey] (declareName verb の宣言名) と一致するか (「この効果によって指定した
  // カード名のカードがリムーブされた場合」B09108/B09003)。分割名 (rules/19) は component any-match。
  // bindings snapshot 参照 (盤面再照会しない = costRemovedMatches と同 posture、リフレッシュ後も判定不変)。
  // 宣言名 空/未設定・binding 空 → false (「してもよい」skip 経路で throw しない)。
  | { kind: 'boundNameMatchesDeclared'; bindKey: string; declareKey: string }
  // engine mega-wave W6 step1 (2026-07-04, row 999 item1): ctx.bindings[bindKey][0] が MR カードか
  // (「相手の現場にいるMRのキャラを選んだ場合」B06085)。read/def.isMR (rarity 前方一致 + 明示 flag) 委譲。
  | { kind: 'boundIsMr'; bindKey: string }
  // mega-wave W6 step10 (2026-07-04, row9): leave:intercept matcher 用。triggerPayload
  // { uid, cause, byUid, ownerPlayer } を読む (consult-leave-intercept.ts が組み立てる)。
  // leaveCauseIn = 離脱 cause が列挙内 (「相手の能力や効果、コンタクトによって」= contact-ap/effect)。
  // leaveOwnerIs = 離場キャラ owner が ability owner から見て self/opp (「自分の現場にいる〜キャラ」)。
  | { kind: 'leaveCauseIn'; causes: string[] }
  | { kind: 'leaveOwnerIs'; player: 'self' | 'opp' }
  // engine mega-wave W6 step3 (2026-07-04, r63 P19): 「このイベントが能力や効果によって使用されていた場合」
  // (B07026)。effect:declared payload (kind==='event-use') の viaEffect を判定 — true=useEventFromHand 等の
  // 効果起源 / false=手札の使用・ネクストヒント (player-action、emit は viaEffect 無指定=false 扱い)。
  | { kind: 'eventUseSource'; viaEffect: boolean }
  // engine mega-wave W6 step6 (2026-07-04, r79/B08014): 「このターン中にこのキャラが自分のMRの能力に
  // よって選ばれていた」— ctx.source 自身の turnEffects['selectedByOwnMr'] を読む zero-arg leaf。
  // B08014 は {not, c:{selfSelectedByOwnMrThisTurn}} で「選ばれていなかった場合」を表現。
  | { kind: 'selfSelectedByOwnMrThisTurn' }
  // engine mega-wave W6 step6 (2026-07-04, r79/B09047): 「自分のパートナーエリアに色を N つ以上持つ
  // MRのキャラがいる場合」— partnerAreaMR slot の存在 + printed colors 数の pure read
  // (candidates 非関与、BUG-154 #3 targetability と無関係)。
  | { kind: 'paMrColorCountMin'; side: 'self' | 'opp'; min: number }
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
  // byPlayer (attribution mini-wave 2026-07-10): リムーブを起こした効果 owner の帰属判定
  //   ('self'=カード所有者自身の能力/効果、'opp'=相手の)。payload.byPlayer (absolute Player、
  //   mutate/scene.ts emit) と ctx.source.player を比較。payload.byPlayer 未設定 (legacy caller:
  //   turn-end/MR②/switch/cost) は fail-closed = false。既存 `by` field (コンタクト勝者 uid) とは別軸。
  //   DSL authoring 規約: byPlayer 使用時は cause:'effect' を必ず併記 (他 cause 由来 payload の偶然一致防止)。
  | { kind: 'removedCharMatches'; side?: 'self' | 'opp' | 'either'; cause?: 'contact-ap' | 'effect' | 'switch' | 'cost'; by?: 'self' | { filter: TargetFilter; excludeSource?: boolean }; byPlayer?: 'self' | 'opp'; removedFilter?: TargetFilter; removedState?: ('active' | 'sleep' | 'stun')[] }
  // 2026-06-06 タスクC: トリガ payload のキャラ (例: reasoning:end の推理キャラ payload.uid) を
  // side + TargetFilter で評価する。「自分/相手の現場にいる〚条件〛のキャラが推理したとき」を
  // matcherCondition で declarative 化。side:'self'=payload.player===source.player (= card 所有者側)。
  // Task D E2 (2026-06-12): excludeSource — payload.uid === ctx.source.uid を除外。
  // 「このキャラ以外の〚X〛が登場したとき」(B09002 a1) で rules/19 分割名の自己一致を防ぐ。
  // Task D E4 (2026-06-12): payloadKey — payload の uid フィールド名を指定 (例: 'guardUid' で
  // 「レベル6以下のキャラによってガードされたとき」B09041。player は scene 走査で導出)。
  // WB2 (2026-07-11, B01070): requireSource — payload[payloadKey] === ctx.source.uid を要求 (excludeSource の逆)。
  //   「このキャラを指定してアクションしたとき」= action:declare payload.targetUid が source 自身 (同名複数現場の
  //   over-fire を side+cardId filter でなく uid 同定で防ぐ)。
  | { kind: 'triggerCharMatches'; side?: 'self' | 'opp' | 'either'; filter?: TargetFilter; excludeSource?: boolean; requireSource?: boolean; payloadKey?: string }
  // engine additive (2026-06-29): setcard:enter payload の set card を filter 評価。
  // 「このキャラに〚特徴[YAIBA]〛のカードがセットされたとき」(B06046)。matcherCondition として使う。
  // 裏向きセット (faceUp!==true) は情報を持たない (rules/16) → 必ず false。set card は scene char では
  // ないため matchOneFilter の char 引数は null (CardDef の印字属性のみ評価)。
  | { kind: 'setCardMatches'; filter: TargetFilter }
  // engine additive wave-3 (2026-06-30): cutin:used payload の使用カットイン (cardId) を filter 評価。
  // 「(使用した)〚カード名/特徴〛のカットインのとき」(B09086 = [諸伏景光]/[長野県警] で分岐)。setCardMatches と
  // 同式で matchOneFilter の char 引数は null (CardDef 印字属性のみ)。triggerPlayerIs(側) との複合は and で書く。
  | { kind: 'triggerCutinMatches'; filter: TargetFilter }
  // mini-wave #2 (2026-07-10): next-hint 判別 + 使用カード def filter。honor: cond/eval.ts case +
  // CONDITION_KIND_MAP + validate-specs CONDS。
  | { kind: 'triggerViaNextHint' }
  | { kind: 'triggerCardMatches'; filter: TargetFilter }
  // engine additive wave-4 (2026-07-01): remove:exit payload の離脱カードを filter 評価。「自分の
  // リムーブエリアにある〚特徴/種別〛のカードがリムーブエリアから離れたとき」(B05087 諸伏高明 /
  // B05088 大和敢助)。emit 元 = mutate/deck.refresh (リフレッシュ=remove→deck、公式Q&A 発動) +
  // mutate/remove.removeFromHere (効果回収)、離脱カード毎。payload={player(=リムーブエリア所有者), cardId}。
  // removeFilter は離脱カードの cardId→CardDef を matchOneFilter(c=null = 印字値) で評価 (remove-area card は
  // turnEffects 無 = 静的 def、setCardMatches/triggerCutinMatches と同流儀)。side='self'=payload.player===
  // source.player (「自分の」)。side 省略時 'self' (B05087/B05088 は全て自分のリムーブエリア)。
  | { kind: 'removeExitMatches'; side?: 'self' | 'opp' | 'either'; removeFilter?: TargetFilter }
  // engine mega-wave W3 (2026-07-03, r10): disguise:replaced payload の「入れ替わりで出てきた側」
  // (newCardId) を filter 評価。「〚カード名［ベルモット］〛が【変装】によってこのキャラと入れ替わったとき」
  // (B03052)。matchOneFilter char=null = CardDef 印字値 (triggerCutinMatches 同流儀、rules/19 分割名対応)。
  | { kind: 'disguiseReplacedByMatches'; filter: TargetFilter }
  // engine mega-wave W3 (2026-07-03, r51): disguise:into payload.replacedChar (入れ替わりで退場した
  // 元キャラの disguiseInto 直前 snapshot) を filter 評価。「【変装時】LP2以上の【白】のキャラと
  // 入れ替わった場合」(B02047)。snapshot uid は sentinel 化 (`::disguise-replaced` suffix) —
  // scene.byUid が必ず miss し、入替え後の新カード自身の continuous/aura が混入しない
  // (removedCharMatches.removedFilter と同じ既知 limitation: continuous 軸 0 / turnEffects 軸は正確)。
  | { kind: 'disguiseReplacedMatches'; side?: 'self' | 'opp' | 'either'; filter: TargetFilter }
  // engine mega-wave W3 (2026-07-03, r17): hand:removed payload.byPlayer (リムーブを起こした効果の
  // 起動側) を side 判定。「相手の能力や効果によって手札からこのカードをリムーブしたとき」(B05115)。
  // side:'opp' = byPlayer !== ctx.source.player (第三者視点でなくカード所有者視点)。
  | { kind: 'triggerByPlayerIs'; side: 'self' | 'opp' }
  // engine mega-wave W3 (2026-07-03, r18): hand:reveal payload.revealed (公開 CardId[]) の
  // cardName any-match。「手札から〚カード名［工藤新一］〛か〚［毛利蘭］〛を公開したとき」(B09004)。
  // 複数公開のうち 1枚でも一致で true。rules/19 分割名は matchOneFilter cardName 経由で対応。
  | { kind: 'triggerRevealMatches'; side?: 'self' | 'opp' | 'either'; cardName?: string | string[]; byPlayer?: 'self' | 'opp'; cause?: 'effect' | 'cost' }
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
  // WB2 (2026-07-11, B05009/D10022): side — 原因カードの所有側 (enter payload.sourcePlayer) が登場キャラと
  //   同側か。「自分のキャラの能力によって登場した場合」= side:'self' (viaEffect:true と and)。
  | { kind: 'enterSource'; viaEffect?: boolean; sourceFilter?: TargetFilter; side?: 'self' | 'opp' }
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
  /** Every listed effective trait must be present. Empty/unresolved selectors fail closed. */
  traitAll?: string | string[];
  // B04055: deck-reveal only.  Match a revealed card when it shares at least
  // one effective trait with the leave:to-remove payload's removedChar.
  // Missing/non-removal payload fails closed; target pick paths do not have a
  // trigger context and therefore also fail closed.
  traitSharedWithTriggerRemoved?: boolean;
  cardNameAnyBound?: string;
  color?: string | string[];
  // engine additive (2026-06-27): 色 NEGATION (「【X】以外の色を持つ」)。公式 B08079 裁定で some説確定:
  // 「X以外の色を1つ以上持つ」(= colors.some(c => c∉notSet))。mono-X は除外、2色{X,Y} は該当 (Y を持つ)。
  // 等価: 全色が notSet 内のとき除外。⚠ cardNameNot (any-match 除外) とは非対称 — 2色で分岐する。
  // honor 経路 = matchOneFilter / boundMatchesFilter / targetFilterToPredicate の3 filter-eval サイト。
  colorNot?: string | string[];
  /**
   * Printed-card ability presence only.  Original ability disable suppresses
   * text execution but does not change this value; externally granted text
   * does not affect it.  CT-P10 B10074/B10102, official B04018 Q&A.
   */
  hasOriginalAbility?: boolean;
  /**
   * Require every printed ability to be one of these icon abilities. This
   * models "【X】以外の元の能力を持たない" (CT-P10 B10050).
   */
  hasNoOriginalAbilityExceptIcons?: string[];
  keyword?: string | string[];
  /** Exclude a candidate that has any listed effective keyword. */
  keywordNot?: string | string[];
  /**
   * Require a printed keyword or that card's own active condition-icon
   * keyword. Ordinary and external keyword grants do not qualify.
   */
  keywordFromPrintOrConditionIcon?: string | string[];
  // M2後半 (2026-07-10, D06003/D06004/D06021/D06023): カットイン効果内容 filter —
  // 「【カットイン】AP＋」を持つ = cutin ability の印字 description が指定文字列を包含するか。
  // 公式 qAndA (D06003) の判定基準は文字列包含 (ウォッカ B01097 = cutin draw 型は「AP＋」を含まず除外)。
  // keyword:'カットイン' (形状判定のみ) では表現不能。honor = matchOneFilter (defHasCutinTextIncludes 経由、
  // def ベースなので remove-area card candidate でも動く)。
  cutinTextIncludes?: string;
  // BUG-118: カード種別 filter ('character' | 'event')。deckRevealUntil (targetFilterToPredicate) は
  // 元から評価していたが matchOneFilter (target pick 経路) が未評価だったため型に昇格して両経路で honored 化。
  kind?: 'character' | 'event';
  apMin?: number;
  apMax?: number;
  /** Maximum is the resolving source character's effective AP. */
  apMaxSource?: true;
  lpMin?: number;
  lpMax?: number;
  // Cluster WB1 (2026-07-11, B09011「灰原哀」): 「元のLP」= 印字 LP か override 単体 (lpOverride ?? printed)。
  //   lpMin/lpMax が turn/aura/continuous 修整込みの実効 LP なのに対し、baseLp は修整を除いた「元のLP」
  //   (rules/19 §元のLP、公式 Q&A「もともと書かれている LP」)。scene 上のキャラで buff/debuff を無視して
  //   「元のLPが0」を判定するために追加 (matchOneFilter/targetFilterToPredicate 両経路で honored)。
  baseLpMin?: number;
  baseLpMax?: number;
  levelMin?: number;
  levelMax?: number;
  // engine mega-wave W5 (2026-07-03, r47): 実効 level が集合内のキャラのみ。「発見されたカードの
  // いずれかと同じレベル」(B04074) の literal 形。通常 author は levelInBound を書き、candidates()
  // (enumerateByQuery) が bound 集合の printed level へ literalize してから本 field に写す —
  // matchOneFilter は ctx 非依存を維持 (~20 call site 不変)。
  levelIn?: number[];
  // r47 DSL-facing: bound 集合 (souza 等 cardId Candidate) の printed level 集合と一致。
  // 解決は candidates() (enumerateByQuery) のみ — levelIn へ変換して本 field は clone から除去。
  // binding 不在/空 = levelIn:[] = 候補0。未解決のまま matchOneFilter / targetFilterToPredicate に
  // 届いた場合 (filterAny 内等の誤用) は fail-closed で常に不一致 (silent drop しない、W5 review nit)。
  levelInBound?: { bindKey: string };
  /** Maximum is the effective level of the first bound scene character. */
  levelMaxBound?: { bindKey: string };
  /** Minimum is the effective level of the first bound candidate. */
  levelMinBound?: { bindKey: string };
  hasSetCards?: boolean;
  // engine mega-wave W4 (2026-07-03, r82 同梱): 裏向きセット card を持つキャラのみ (B08035 a2
  // 「裏向きでセットされているカードを1枚リムーブ」)。hasSetCards は表裏不問 (B02033 は裏向き限定なし)。
  hasFaceDownSetCards?: boolean;
  // engine additive wave-7 (2026-07-02, P17): 「このターン中にアクション[キャラ]した」board char のみ該当。
  // 記録 = flow/action/state-machine.ts declare が action:declare (target.kind==='char') 時に actor へ
  // setTurnEffect('actedCharThisTurn', true)。清掃 = clearTurnEffects('turn') (ターン終了)。読取は
  // matchOneFilter が board char (c 有) の turnEffects flag を honor。c===null (deck/remove/hand の印字
  // candidate) は「アクションした」概念が無い → 必ず不一致 (現場に居ないため)。B08049 ジョディ【宣言】
  // 「このターン中にアクション[キャラ]していた〚特徴[FBI]〛のキャラを…アクティブにする」。
  actedCharThisTurn?: boolean;
  // mega-wave W6 step4 (2026-07-04, r58): 「このターン中に【疾風】を発動していた」board char のみ該当。
  // 記録 = listeners/triggered.ts の abilityIsShippu 全 gate 通過時 (per-player shippuFiredThisTurn と
  // 同一 gate・同一 timing、発動=解決不能でも発動扱い rules/24)。清掃 = clearTurnEffects('turn')。
  // c===null (deck/remove/hand) は必ず不一致 (actedCharThisTurn と同 posture)。B09070 a3
  // 「自分のターン終了時、このターン中に【疾風】を発動していたすべてのキャラをアクティブにする」。
  shippuFiredCharThisTurn?: boolean;
  custom?: (s: GameState, candidate: Candidate) => boolean;
};

export type TargetQuery = {
  // M2後半 (2026-07-10, PR234 a1): 配列 = zone union (「手札かリムーブエリアにある」を 1 pick で横断)。
  // enumerateByQuery が area ごとに列挙して連結する。既存カードは単一 string = byte 互換。
  area?: 'scene' | 'set-card' | 'partner-area' | 'hand' | 'deck' | 'remove' | 'evidence' | 'file' | 'case'
    | Array<'scene' | 'set-card' | 'partner-area' | 'hand' | 'deck' | 'remove' | 'evidence' | 'file' | 'case'>;
  side?: 'self' | 'opp' | 'either' | 'owner' | 'opp-of-owner';
  /**
   * Partner-area queries normally retain their historical mixed candidate set.
   * Consumers that target only general PA cards should opt in explicitly and
   * exclude the real partner separately.
   */
  includePartnerAreaCards?: boolean;
  /** Include the real partner singleton in a partner-area query (default: true). */
  includePartner?: boolean;
  filter?: TargetFilter;
  filterAny?: TargetFilter[];
  excludeSelf?: boolean;
  /** Exclude scene characters whose uid appears in this effect binding. */
  excludeBound?: string;
  state?: ('active' | 'sleep' | 'stun')[];
  named?: boolean;
  distinctNames?: boolean;
  // Cluster WB1 (2026-07-11, B09105「キッ」): distinctNames のレベル軸版 —「それぞれレベルの異なる」
  //   (2つの pick が同一 (印字) レベルを共有できない)。distinctNames と同型 3経路 enforcement
  //   (resolve validate / chooseAiPick greedy / UI disabled)。card/char 候補は lookupCardDef(cardId).level で判定。
  distinctLevel?: boolean;
  // B03042: selected characters must not share any printed color. A multicolor
  // card occupies every one of its colors.
  distinctColors?: boolean;
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
  // engine mega-wave W4 (2026-07-03, r83 G34): pick 母集合を ctx.bindings[fromGroup] の uid 集合に限定。
  // enter:group hook の '$enterGroup' 相当 (「同時に登場したキャラの中から1枚」B01012)。binding 不在/空 = 候補0。
  fromGroup?: string;
  // S2 deck cluster (2026-07-10, B01022): pick 母集合を ctx.bindings[key] の card 集合 (player+area+index
  // 一致) に限定する fromGroup の card-kind 並列版 (fromGroup は uid ベース = scene char 専用のため独立 field)。
  // 「デッキ上から6枚見て、その中から〜を2枚まで登場」の window 制限。binding 不在/空/entry index 欠落 = 候補0
  // (fail-closed)。index は deckRevealUntil bind が reveal 時点の deck 位置を同梱する (重複 cardId 区別)。
  fromGroupCards?: string;
  /**
   * Restrict card candidates to exact remove occurrences produced by a paid
   * cost.  The cost record carries the post-payment remove indexes, preserving
   * identity when the remove area also contains duplicate card IDs.
   */
  fromCostPaidCards?: string;
  // engine mega-wave W4 (2026-07-03, r84 G38): side 毎の選択上限 quota (「自分と相手で1枚ずつ」B08019 a2)。
  // distinctNames と同型の 3経路 enforcement (resolve validate / chooseAiPick greedy / UI disabled)。
  // partner candidate (player 概念が side でない) では使用不可。
  perSideMax?: number;
  /** Combined printed level ceiling for a multi-pick (B04042/B04084). */
  aggregateLevelMax?: number | { dyn: string };
};

export type TargetingRef =
  | { kind: 'self' }
  | { kind: 'pick'; query: TargetQuery; n: { min: number; max: number }; chooser: 'owner' | 'opp' | 'self' | 'opp-of-owner' }
  | { kind: 'all'; query: TargetQuery }
  | { kind: 'fromBound'; bindKey: string };

/** Arguments unique to the bounded deck-reveal primitive. */
export type DeckRevealUntilArgs = {
  player: 'self' | 'opp';
  maxN?: number;
  /** Stop at the first matching card; otherwise a maxN reveal scans its full window. */
  stopAtFirstMatch?: boolean;
  filter?: TargetFilter;
  bind?: string;
  bindMatch?: string;
  fromBottom?: boolean;
  chooseMatch?: 'upTo';
};

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
  | 'discardDownTo'
  // engine拡張 wave (2026-06-23): evidenceFlipDown — 「自分の表向きの証拠を N つまで選び、裏向きにする」
  // (evidenceFlip=表向き化 の逆 mutate)。PB pick (defaultArea 'evidence', faceUp 候補限定)。
  // rules: 03-field-areas.md §状態 / 15-abilities-effects.md。B05013/B06017/B06019 で使用。
  | 'evidenceGain' | 'evidenceLose' | 'evidenceFlip' | 'evidenceFlipDown' | 'selfToEvidence' | 'evidenceToDeck'
  // engine additive A2 (2026-07-11, B03040 和田進一): peekOwnEvidence — 「自分の証拠を上から1つ見る。
  // （裏向きの証拠を見た場合、その後、元に戻す）」= zone/faceUp 不変の私的閲覧 (evidenceFlip の
  // 「表向きに固定」とは意味が正反対)。UI へ private 通知するのみ (log entry)。args.player 既定 self。
  | 'peekOwnEvidence'
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
  | 'handReveal' | 'publicHandRevealScopeEnd'
  // engine additive: discardRandom — 手札からランダムに n 枚リムーブする (B01077「相手は手札を1枚
  // ランダムにリムーブする」)。公式 QA: 相手が選べず確率均等な方法。pick を持たない (ランダム選択 =
  // プレイヤー choice 不要)。ctx.rng で決定的 (smoke 再現性)。既存カードは未使用 → baseline 不変。
  | 'discardRandom'
  // engine mega-wave W4 (2026-07-03, r82 G33): bindPick — 状態変化なしの pick-only atom。選択を
  // ctx.bindings[args.bind] へ蓄積するだけ (書込は runAtom の pick-bind writeback preamble)。後続の
  // conditional{charStateIs fromBound} 等が同一 pick を排他分岐で共有する (B08035「そのキャラが
  // スリープ状態の場合スタン/アクティブ状態の場合スリープ」)。PA 短縮形 (sceneSetState 同型、state 不要)。
  | 'bindPick' | 'stackedCardPick' | 'charTransferStackedCards'
  // engine mega-wave W6 step1 (2026-07-04, rows 49/53/999 統合): declareName — プレイヤーが任意の
  // カード名 (自由文字列) を1つ宣言し ctx.declaredNames[args.bind] へ書く (「カード名を1つ指定し」
  // B09112/B09108/B09003)。名前の供給は ctx.dyn.declaredName (UI= DeclareCardNameModal → AbilityCostParams
  // .declaredName → costParamsToDyn / AI= 未供給なら空文字 fallback で条件 false に落ちる、smoke 安全)。
  // engine は名前の実在性を検証しない (公式Q&A: 曖昧/誤記は対人ルール領域 — UI オートコンプリートで実務担保)。
  // 消費: cond boundNameMatchesDeclared / dyn $declared.<key>[.sceneNameCount] / (step2) charSetTurnEffect
  // nameOverride。状態変化なし (bindPick 同様 pick-only 系、zone/char 不変)。
  | 'declareName'
  | 'sceneEnter' | 'sceneSwitch' | 'sceneRemove' | 'sceneSetState' | 'sceneDisguise' | 'sceneToHand'
  // Task D E2 (2026-06-12): 現場キャラを所有者のデッキ下/上へ移す (sceneToHand 同型 PA 短縮形)。
  // rules: 09/23 (デッキ下移動はリムーブでない=現場リムーブ時不発動), 16 (set/stacked はリムーブ)
  | 'sceneToDeck'
  // engine mega-wave W1 (2026-07-03, P38): 現場キャラを **所有者の** 証拠へ移す (「相手はそのカードを
  // 表向きのまま証拠として得る」B03084)。sceneToDeck 同型 PA 短縮形。リムーブではない (rules/17 不発動)。
  // set/stacked は離場時リムーブ (rules/16)。MR① redirect は toDeck/toHand と parity (rules/18)。
  | 'sceneToEvidence'
  // engine mega-wave W1 (2026-07-03, P41): 手札1枚を FILE の1番下に **表向き** で移す (B05045 a2
  // 「手札を1枚FILEエリアにあるカードの1番下に表向きで移す」)。handToEvidence 同型 PB pick (defaultArea 'hand')。
  // FILE 1番下 = 配列先頭 unshift (rules/05: push=末尾=最上部)。
  | 'handToFileBottom'
  // engine mega-wave W1 (2026-07-03, B03084 a1 前段): 証拠を pick して **持ち主の** デッキの下へ移す
  // (「相手の証拠を1つまで選び、デッキの下に移す」)。evidenceToHand 同型 PB pick (defaultArea 'evidence')。
  // 公式Q&A (B03084): どの位置の証拠でも選べる / 裏向き証拠は確認できず裏向きのままデッキ下へ。
  | 'evidenceToDeckBottom'
  | 'charModifyAP' | 'charModifyLP' | 'charModifyLevel' | 'charSetAP' | 'charSetLP'
  | 'charOverrideAP' | 'charOverrideLP'
  | 'charGrantKeyword' | 'charRevokeKeyword' | 'charGrantTrait' | 'charRevokeTrait' | 'charGrantTraitAllAreasTurn' | 'charDisableOriginal'
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
  | 'deckRevealUntil' | 'deckToBottomBound' | 'deckPlaceSplitBound' | 'deckBottomReorderBound' | 'boundToRemove' | 'deckShuffle' | 'souza'
  // engine拡張 wave#2 cluster4 (2026-06-14): 自分と相手はリムーブエリアの「すべて」のカードを各自の
  // デッキの下に移し、両者のデッキをシャッフルする (B08027【登場時】)。pick を持たない fixed verb。
  // rules: 14/26 (デッキが増えるのみ → これは「リフレッシュ」ではない=証拠を得る手順なし、公式Q&A),
  //   09/23 (リムーブでない=現場リムーブ時不発動)。
  | 'removeAreaAllToDeckBottom'
  // mega-wave W6 step11 (2026-07-04, row999 item4 / P42): 「自分のリムーブエリアにあるキャラを
  // 1枚まで選び、デッキの上に移す」(B07014 rider)。PB pick (handAddFromRemove 同型)、dest=deck top。
  // ⚠ removeAreaAllToDeckBottom (全件・bottom 固定) と紛らわしい — pick 型・top はこちら。
  | 'removeAreaToDeckTop'
  | 'handToDeckBottom'
  // engine拡張 wave#2 cluster6 (2026-06-14): 「このターン中、自分はイベントを使用できない」
  // (B09034/B09034P)。turnState[p].eventUseBanned=true をセットする turn-scoped flag verb。
  // 手札の使用・ネクストヒントの event のみゲート (公式 Q&A: カットイン/ヒラメキは制限外)。
  // rules: 25 (公式 Q&A) / 12 (ネクストヒント) / 06 (イベント使い切り)
  // engine mega-wave W6 step3 (2026-07-04, r63 P18): 効果内から手札のイベントを filter 一致で pick
  // (0..1) して**即時使用**する (「手札からレベル6以下のイベントを1枚まで使用する」B08026/D10005/B05042)。
  // hand-use-card.ts の event 分岐と同順序 (effect:declared emit → hand.remove → remove.add、emit が
  // 先 = on-hand scope がまだ手札に居るカードを見つける契約)。payload に viaEffect:true を付与
  // (eventUseSource cond の判別根拠、公式Q&A: FILE 枚数・事件色制限をバイパス)。
  // eventUseBanned 中は防御的 no-op (B09034「能力や効果によっても使用できない」)。
  | 'useEventFromHand'
  // engine mega-wave W6 step4 (2026-07-04, B09090/P16): 「このターン中、次に自分の現場に登場した
  // キャラは【疾風】の条件を無視できる」— turnState[p].shippuWaiveArmed=true をセットする turn-scoped
  // flag verb (setNextHintBan mirror)。消費は enter 時に triggered.ts が行う (次登場 1 体、疾風有無不問)。
  | 'setShippuWaive'
  | 'setEventUseBan'
  // wave use-restrict (2026-06-30): 「このターン中、自分はネクストヒントできない」(B06104/P・B09019/P・B09105/P)。
  // turnState[p].nextHintBanned=true をセットする turn-scoped flag verb。canStartNextHint が gate (ネクストヒント全体)。
  // resetTurnFlags でクリア。rules: 12 (ネクストヒント) / 15 (「〜できない」継続制限)
  | 'setNextHintBan'
  | 'setUseEnterBanCardName'
  // engine additive wave-10 (2026-07-02): 「このターン中、相手は【カットイン】/【変装】を使用できない」
  // (B07002 江戸川コナン a2)。turnState[p].cutinBanned / disguiseBanned をセットする turn-scoped flag verb
  // (setNextHintBan mirror)。ゲートは flow/contact.ts canCutIn / canDisguise。side-level flag ゆえ
  // 発動キャラ離場後も有効 (公式 Q&A B07002)。resetTurnFlags でクリア。rules: 09 / 15 / 25
  | 'setCutinBan'
  | 'setActionCutinBanFilter' // engine A3 wave (2026-07-11, B05007): 「〜がアクションしたとき相手カットイン不可」turn-scoped filter を arm
  | 'setDisguiseBan'
  | 'setHiramekiSuppress'
  // mega-wave W6 step7 (2026-07-04, row70): 「相手はこのアクションによって証拠を得られない」
  // (B02088/B03126 ヒラメキ)。turnState[p].evidenceGainSuppressed をセットし、gainSelfEvidence が
  // consume-on-read で単発消費 (獲得も evidence:gain emit も行わない = 依存 trigger も不発、公式Q&A)。
  | 'setEvidenceGainSuppress'
  // mega-wave W6 step8 (2026-07-04, row75): 離場後予約 — args { hook, mode:'turn-end'|'next-match',
  // effect: Effect (nested JSON descriptor、charGrantAbility 前例), condition?: Condition } を
  // GameState.reservedEffects に積む。発火は listeners/reserved-effects.ts (B08069/B01058)。
  | 'reserveEffect'
  // mega-wave W6 step10 (2026-07-04, row9): leave:intercept ability の宣言的 destination marker
  // (args.destination: 'hand' | 'kept-in-scene')。runAtom 経由では実行されない (no-op) —
  // consult-leave-intercept.ts が def 走査時に args.destination を読み、redirect 適用は
  // mutate/scene.removeToRemove が行う (B01092/B01039)。
  | 'leaveInterceptRedirect'
  // D11007 v2 Phase 3: action target 拡張仕様を transient side-channel に push
  // (action:pre-target hook の listener が呼ぶ。candidates() が consume)
  | 'expandActionTargets'
  // B02022: action:pre-target の同期 read で一度だけ強制対象にする marker。
  // 消費は候補列挙でなく action.declare の確定時。
  | 'mustTargetSelfOnce'
  // engine mega-wave W3 (2026-07-03, r12): リムーブエリア在中カードの【現場リムーブ時】selfOnly 効果を
  // 明示発動させる (B08078 a2「この効果によってリムーブしたカードの【現場リムーブ時】の効果を発動させてもよい」)。
  // event.emit('leave:to-remove') は使わない — 盤面 observer (第三者反応) が誤発火するため、対象 CardDef の
  // abilities を直接走査して queue する (effect/invoke-leave-to-remove.ts leaf)。
  | 'invokeLeaveToRemoveOfCard'
  // 別カードの【ヒラメキ】effect を明示発動 (証拠を表向きにした結果 → その【ヒラメキ】を発動、
  // effect/invoke-hirameki.ts leaf)。cardId|cardIds|trait|player args。B06023/B06034。
  | 'invokeHiramekiOfCard'
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
  // n: {min,max} (attribution mini-wave 2026-07-10): B08068「好きな枚数公開」= min:0 可変枚数。
  //   canPay は min 基準 (min:0 なら常に支払可、rules/15「〜まで」=0可)。number は従来挙動不変。
  | { kind: 'revealFromHand'; target: TargetingRef; n: number | { min: number; max: number } }
  // engine mega-wave W1 (2026-07-03, P29): 〚手札から filter 一致カードを n 枚公開してデッキの上に移す〛
  // コスト (B05049 a1)。canPay = removeFromHand/revealFromHand と同型 (candidates ≥ n)。pay = 手札から
  // 抜いてデッキ上へ (公式Q&A B05049: 裏向きでデッキの上に移す = deck は CardId[] で不可視)。
  // rules: 21 (「自分の」省略 → query.side:'self' / 全部行えなければ使用不可)。
  | { kind: 'revealHandToDeckTop'; target: TargetingRef; n: number }
  | { kind: 'removeFromScene'; target: TargetingRef; n: number }
  // engine mega-wave W5 (2026-07-03, r37): n は number | {dyn} (B04088「相手の現場にいるキャラ1枚に
  // つき、デッキのカードを上から2枚リムーブ」= {dyn:'$self.oppSceneCount*2'})。player:'self' 固定は
  // 公式Q&A「コストでは自分のカードしか使えない (相手デッキはリムーブ不可)」の型レベル担保 —
  // cross-side 化しないこと。canPay/pay が resolveDynNumber (dyn/eval.ts) で dispatch 時に解決。
  // 他 Cost kind への {dyn} 展開は consumer 出現時に個別判断 (YAGNI)。JSON シリアライズ可能維持。
  | { kind: 'removeDeckTop'; player: 'self'; n: number | { dyn: string } }
  // engine A3 wave (2026-07-11, B09107 犯人たちの犯行): 〚デッキのカードをすべてリムーブする〛コスト。
  //   n 固定でない全部リムーブ (removeDeckTop の n=deck.length を宣言時に評価できないため専用 kind)。
  //   canPay = 恒真 (0 枚でも宣言可、公式Q&A「決めた枚数の残りはリムーブしない」の全部版)。
  //   公式Q&Aに従い、全除去直後・能力効果の解決前に即時 refresh する。
  | { kind: 'removeDeckAll'; player: 'self' }
  | { kind: 'discardEvidence'; n: number }
  | { kind: 'selfToDeckBottom' }
  | { kind: 'selfToRemove' }
  | { kind: 'selfToPartnerArea' }
  // Task D E2 (2026-06-12): 〚現場にいる…を n 枚デッキの下に移す〛コスト (B04011/B07080/B08076)。
  // rules: 21 (全部行えなければ使用不可), 09/23 (リムーブでない)
  | { kind: 'sceneToDeckBottom'; target: TargetingRef; n: number }
  // engine拡張 wave#2 cluster4 (2026-06-14): 〚リムーブエリアにある…を n 枚デッキの下に移す〛コスト
  //   (B08051【宣言】/ B08066【宣言】/ B03059【宣言】)。sceneToDeckBottom の area:'remove' 版。
  // rules: 21 (全部行えなければ使用不可 / 「自分の」省略 → query.side:'self' / 公式Q&A「相手のカードは移せない」),
  //   09/23 (デッキ下移動はリムーブでない=現場リムーブ時不発動), 14/26 (デッキが増えるのみ → refresh は起きない)
  | { kind: 'removeAreaToDeckBottom'; target: TargetingRef; n: number }
  // engine defer-unlock mini-wave (2026-07-09): 〚パートナーエリアにある…のカードを n 枚リムーブする〛
  //   コスト (B07039 アン王女【宣言】)。removeAreaToDeckBottom と同型 (canPay = candidates ≥ n /
  //   pay = costParams 優先 + pickCandidates fallback → mutate.partner.removeAreaCardsToRemove)。
  //   cost.target は query.area:'partner-area' + side:'self' (rules/21「自分の」省略、公式Q&A B07039:
  //   コストでは自分のカードしか使えない)。atom verb 'partnerAreaRemove' (effect 側) と同名だが別 union。
  | { kind: 'partnerAreaRemove'; target: TargetingRef; n: number }
  // engine additive wave (2026-06-24): 〚現場にいるキャラに裏向きでセットされているカードを合わせて n 枚
  //   リムーブする〛コスト (B08033 工藤有希子 a2)。count-based の self-pool コスト (TargetingRef 不使用 —
  //   candidates() は set card を Candidate 列挙しない sub-entity ゆえ。discardEvidence/removeDeckTop と同型)。
  // rules: 16 (set/離場時表向きリムーブ), 21 (コスト「自分の」省略 → self-only / 全部行えなければ不可)。
  //   公式Q&A (B08033): 相手カード不可・host 自身も数える・「裏向き」(faceUp:false) のみ対象・分割可。
  //   hostSelf (attribution mini-wave 2026-07-10, B08041「**このキャラに**裏向きでセットされている
  //   カードを1枚リムーブする」): true で host を能力使用キャラ自身 (ctx.source.uid) に限定。
  //   未指定 = 従来通り自陣全キャラ (B08033「現場にいるキャラに〜」)。
  //   anyFace (夜間 W0 2026-07-11, B05052「現場にいるキャラにセットされているカードを1枚リムーブする」—
  //   裏向き限定句なし): true で表裏不問に計数/除去。未指定 = 従来通り裏向きのみ (B08033/B09027 挙動不変)。
  | {
    kind: 'removeSetCard'; n: number; hostSelf?: boolean; anyFace?: boolean;
    /** Explicit face selector. Omitted retains legacy anyFace/down behavior. */
    face?: 'down' | 'up' | 'any';
    /** Evaluated only after the face gate; face-down identity never reaches this filter. */
    filter?: TargetFilter;
    /** Restrict eligible self scene hosts. */
    hostQuery?: TargetQuery;
  }
  | { kind: 'removeStackedCards'; n: number }
  // M2後半 (2026-07-10, B06003 a1): 〚ターン終了時までLP-2する〛— 自身への turn-scope LP デルタ cost。
  //   canPay 恒真 (LP 下限なし rules/19、公式Q&A: LP1以下でも支払可・負値可)。pay = lpMod_turn 書込
  //   (mutate.char.modifyLP scope:'turn'、clearTurnEffects で失効)。emit なし — rules/21 コストで
  //   行ったことは「効果によって〜したとき」条件を満たさない。
  | { kind: 'selfLpDeltaTurn'; delta: number }
  // M2後半 (2026-07-10, B08047 a2): 〚手札が n 枚になるまで手札をリムーブする〛— down-to 可変枚数 cost。
  //   canPay 恒真 (公式Q&A B08047: 手札2枚以下でも宣言可、その場合このコストは実質支払なし)。
  //   pay = max(0, hand-n) 枚を viaCost で discardToRemove (hand:removed 非 emit、rules/21)。
  //   どの札を残すかは head-fixed (全 target-pick cost 共通の既存制約 pay.ts:54 と同 posture)。
  | { kind: 'removeFromHandDownTo'; n: number }
  // engine mega-wave W4 (2026-07-03, r6): 〚現場にいる…のキャラを n 枚このキャラの下に重ねる〛コスト
  //   (B09048 中森銀三 a2)。mutate.scene.toStack (非リムーブ離場、rules/16 情報喪失・cascade) を
  //   cost 経路から呼ぶ。host = 能力使用キャラ自身 (ctx.source.uid)。
  // rules: 16 (重ねる — state 前提なし、stun/sleep も可), 21 (「自分の」省略 → query.side:'self')。
  //   公式Q&A (B09048): MR を重ねても MR能力は有効でない (PA redirect なし)。
  | { kind: 'sceneStackUnderSelf'; target: TargetingRef; n: number }
  // engine mega-wave W4 (2026-07-03, r7): 〚手札から…のキャラを1枚公開し、現場にいる…のキャラ1枚の
  //   下に重ねる〛コスト (B08006 小嶋元太 a1)。cardTarget = hand pick / hostTarget = own-scene pick。
  //   公開 = hand:reveal emit (移動前、revealHandToDeckTop と同契約) → 手札から抜き host.stackedCards+1。
  // rules: 16 (重ねる), 21。公式Q&A (B08006): コストで公開したカードを自身の下に重ねることも可。
  | { kind: 'handStackUnder'; cardTarget: TargetingRef; hostTarget: TargetingRef }
  | { kind: 'pay'; items: Cost[] }
  | { kind: 'choice'; items: Cost[] }
  | { kind: 'fileFrom'; n: number }
  | { kind: 'flipFaceUpEvidence'; n: { min: number; max: number } }
  | { kind: 'custom'; check: (s: GameState, ctx: EffectCtx) => boolean; pay: (s: GameState, ctx: EffectCtx) => void };

// ---------- Effect ----------

/** Actor/target references for an effect-generated contact. */
export type StartContactArgs = {
  targetUid: string;
  /** Omitted means the ability source, preserving B06020/B06042 behavior. */
  actorUid?: string;
};

export type Effect =
  | { kind: 'traitChoice'; bind: string; then: Effect; chooser?: 'owner' }
  | { kind: 'rps'; win: Effect; lose: Effect }
  /** Select one opaque set-card occurrence on a previously selected host. */
  | { kind: 'setCardToEvidence'; hostUid: string }
  /** Move one opaque physical set-card occurrence without exposing its identity before selection. */
  | {
    kind: 'moveSetCard';
    hostUid: string;
    face: 'down' | 'up' | 'any';
    destination: { area: 'evidence'; faceUp: boolean } | { area: 'hand' } | { area: 'scene'; hostUid: string };
  }
  | { kind: 'sequence'; steps: Effect[] }
  | { kind: 'parallel'; steps: Effect[] }
  | { kind: 'choice'; options: Effect[]; chooser: 'self' | 'opp' | 'owner' }
  | { kind: 'optional'; effect: Effect; chooser?: 'owner' | 'opp-of-owner'; else?: Effect; aiRun?: 'if-hand' }
  | { kind: 'conditional'; if: Condition; then: Effect; else?: Effect }
  | { kind: 'forEach'; over: TargetingRef; do: Effect }
  | { kind: 'repeatOptional'; max: number; body: Effect }
  | { kind: 'replace'; trigger: TriggerRef; with: Effect }
  | { kind: 'negate'; trigger: TriggerRef }
  | { kind: 'atom'; verb: 'startContact'; args: StartContactArgs }
  | { kind: 'atom'; verb: 'deckToBottomBound'; args: DeckToBottomBoundArgs }
  | { kind: 'atom'; verb: Exclude<AtomVerb, 'startContact' | 'deckToBottomBound'>; args: unknown }
  | { kind: 'custom'; fn: (s: GameState, ctx: EffectCtx) => void }
  // 拡張 5 (D08003 driver): 公式テキスト「そうした場合」 semantics。
  // step N が「実効果あり」のとき N+1 を実行。N が no-op (no candidate) なら以降 skip。
  // pick await 時は chain 継続情報を保存して effectPickResolve 後に再 queue する。
  | { kind: 'chain'; steps: Effect[] };

/** `order` 未指定は、既存カード互換の arbitrary (プレイヤーが底順を選択) として扱う。 */
export type DeckToBottomBoundArgs = {
  player?: unknown;
  bindKey?: string;
  order?: 'arbitrary' | 'preserve' | 'shuffle';
};
