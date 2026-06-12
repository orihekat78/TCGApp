# engine拡張 wave#2: BUG-132 GAP-1/2 修正設計 v2 (2026-06-12, 敵対レビュー3lens反映済)

rules: 15 §〜まで/未解決/所有者順, 25 §解決時参照, 24 §発動した扱い, 05 §割り込み禁止, 21, 22, 26
一次根拠: cards-data ct-p08 TSV qAndA (B08020) — 「加えないことは可能」「使用したイベントの効果を先に解決」
レビュー: impl(fable)/rules(fable)/regression(opus) 全 approve-with-fixes、fatal 0。指摘は本 v2 に反映済。

## GAP-1: deckRevealUntil decline channel

**DSL**: optional arg `chooseMatch:'upTo'`。未指定=完全従来動作。付与対象 = TSV 公式文「1枚まで…手札に加え」
38枚 (D01013,D02011,D03009,D04011,D05012,D07019,B01013/P,B01016/P,B01017,B01034/P,B01053,B01055/P,
B01072/P,B01090/P,B03007,B03018,B04024,B05057,B05060,B06088,B07073/P,B08024,B09062,PR061,PR065,
PR084,PR090,PR098,PR104,PR180,PR186) + 再採用 B08020/P a1。
**除外 (従来=正)**: forced 10 (B01048/P,B01050,B04023,B07089 + reveal-until型 B05017,B05094,B06010,PR117,PR118)、
D11019/B03096 (登場/捜査系)、PR135 (handAdd無し)。script は付与/非付与全件出力 + grep で除外8+を機械検証。

**handler** (atom-handlers deckRevealUntil):
1. chooseMatch 無し or owner(ctx.source.player)非human or match0件 → 従来 path 完全不変
2. human & match≥1 (first-run): 全 match を候補に PendingEffectPickSide を handler から直接 push
   (synthetic uid `cardId#deckIdx`, nMin=0, nMax=1, skipResolvesAtom=true 新field,
   atomArgs={...args, __windowIds: revealed})。bind 未書込 → resolver の queue増加検知 (BUG-105/111) が
   remainder [conditional, deckToBottomBound] + 共有 ctx を pick に同梱して walk 停止。
   overlay: __pendingDeckRevealSide を awaitingPick:true (新field) で set — DeckRevealOverlay は
   hold (自動進行しない)。pick 解決の再入時に確定 matched で再 set → 完了演出 (二重再生なし)
3. 再入 take: apply-pick Pattern B 無marker分岐 (target=[cardId]) → __windowIds から $matched=[chosen] /
   $revealed=window−chosen を ctx に bind → remainder 続行 (conditional true → handAdd+discard → bottom)
4. 再入 decline: 新 helper applyPickSkipAndContinuation (apply-pick) — resolved atom args.__declined=true →
   $matched=[] / $revealed=全window → conditional 不発 (handAdd/discard なし) → 全 reveal デッキ下 ✓
   useEngineDispatch effectPickResolve: pickedUid=null && skipResolvesAtom → skip-drop でなく本 helper
5. 防御: deckToBottomBound は「実際に deck から splice できた id のみ」bottom へ (window 侵食 latent対策)

**AI**: 従来 path (先頭 match 自動取得) — 合法手内の固定戦略 (rules/15:37 は権利であり義務でない)。
BUG-132 方針「AI=効果判定」からの意図的縮小 (baseline 安定優先)、将来 heuristic 拡張は別 issue。
**touched**: atom-handlers / resolve-picks (型+push export) / apply-pick / useEngineDispatch /
DeckRevealOverlay (hold 1分岐) / 38 cards (script) / e2e 2 spec 更新 (bug-117-deckreveal-lp-filter,
engine-extensions-2026-06-05 の D01013系8件 — pick 1段解決を挿入) / 新 unit test

## GAP-2: effect:declared 自効果先行 + 反応 pick の解決時確定

emit 後置は不可 (rules/15:45)。発動検出/limit/entry構築は宣言時のまま。変更2点:
1. **同一emit batch 内 pairwise gate** (rules/15:42 所有者任意順を侵さない — レビュー major 反映):
   handleHook (hook='effect:declared') で emit 毎に declaredBatch (連番) を全 entry に付与、
   非 own (own = trig.selfOnly===true、area 不問 — scene rider も own 扱い、レビュー minor 反映) に
   declaredReaction:{abilityId} 付与。stack.next(): flagged entry は「同 batch の非 flagged が pending の間」
   選択不可 (filter gate、sort 不変更 → ownerChosenOrder 自由度温存)。declared-ability 直接 queue 自効果は
   batch 外だが反応カードが event-use のみ (B07016 唯一) のため現状 vacuous — 設計注記
2. **pick/dyn 解決の遅延**: flagged entry は queue 時 resolveEffectPicks を skip し raw effect を queue。
   stack.runOne() で flagged 検知時に substitute (humanSide=globalThis / aiPolicy lazy)。
   stack コアに AI import を入れない: triggered.ts が登録する resolver 注入 (_setDeferredEntryPickResolver)
3. payload に player 追加 ({kind, cardId, player}) — 「自分が」の将来 matcherCondition 用 (additive)。
   B07016/B08020 の「自分が」は turn:self condition による間接実装 — pin test にコメント明記

**victim**: B07016 (177枚中 selfOnly無し唯一、機械確認済) + 再採用 B08020 a2。既存 pin =
reuse-cards-2026-06-05 e2e の発火 count pin (order 非依存、本変更に耐える)。order/候補時点 pin は新設。
**touched**: types/effect-stack / event/registry (buildEntry opts) / triggered / stack / hand-use-card·next-hint
(payload player) / 新 pin test

## エッジケース

1. decline → deck 不変・全 reveal デッキ下 (「残り」membership は公式文/Q&A と整合確認済)
2. 複数 match: identity 選択 surface (まで型のみ)。同一 cardId 複数は実質 count 選択
3. 手札0 discard 不能 / デッキ<maxN clamp / デッキ0 → 従来通り
4. 反応キャラがイベントで除去 → entry は解決される (rules/15:45)、候補は解決時盤面
5. AI vs AI: GAP-1 human 分岐に入らず + pool 内 victim 0 → smoke baseline 不変が回帰証跡
6. 0枚選択でも【ターン1】消費 (TSV Q&A 確認済、engine の queue 時 limit カウントが正)

## 水平展開 / 残課題 (記録 → BUG/DEFER)

- BUG-133 起票: drainAiEffectPicks に player guard 無し — 相手ターン中 trigger の human pick
  (PR084/PR090 等) が CPU drain で自動消化され decline 不達 (現状互換、将来 guard 追加)
- BUG-134 起票: queue 時 pick/dyn 確定は全 hook 共通の構造 (rules/15:44 非整合の可能性)。
  本 wave で hook×pick保持 ability を script 機械列挙し添付、修正は defer
- forced 型の複数 match identity 選択権: 公式明文なし → 従来維持 + **ユーザー確認待ち** (TSV qAndA 要確認)
- deckToBottomBound「好きな順番で」未 surface: 既存非準拠 (D05007 注記あり) — BUG 起票のみ
- mid-sequence skippable PB pick + 必須 remainder の既存 skip-drop: script で実在確認 → 結果次第で起票
- B08020 Q&A 原文を rules/25 に出典付き収載 (TSV qAndA 一次データ)
