# 2026-06-04 残カード実装 pilot (難易度振り分け + 最易から実装)

## 依頼
残カードを実装難易度で振り分け、簡単なものから実装。user 選択 = **pilot 20枚** (品質/規約/検証フロー確認優先)。

## 残カード振り分け (worklist 914 cardId 基準)
- 実装済 173 / **残 741** = reusable 306 / blocked 302 / uncertain 61 / unclassified 72
  (`.tmp/reuse/cls/*.json` の BOM 破損を修復して 850 分類回収; `.tmp/remaining-analysis.json`)
- reusable 306 を難易度 score 化 (`.tmp/reusable-ordered.json`): T1 易100 / T2 中203 / T3 難3
- 物理 num: 残741 cardId = 1215 num; reusable306 = 494 num; T1 100 = 155 num

## ⚠ 最重要発見: 「reusable」分類は超過大評価
最易 30枚を **実コードの frozen engine 能力** と突合 (Explore agent + 直接 read で
condition/atom/hook/cost/dyn を全数確認 → `.claude/specs/card-impl-engine-gates.md` に永続化)。
厳密ゲート検証で **実装可は 30 中 2枚のみ**。残 28 は実 engine ゲートに抵触:
- event→evidence 不可 (0162-0165,0406) / source-level 検出不可 (0010,0011,0017)
- reasoning hook 無 (0436,0037) / leave hook 無 (0823,1007) / continuous 他者buff不可 (0184,0954,1020,0775)
- 手札数・リムーブ総数 condition 無 (0800,0357) / カットイン filter 不可=keywords空 (0717,0382,0829)
- 非KW能力付与 (0972) / optional自己犠牲・discard inspect 参照実装無 (0755,0500) / $entered pick伝播bug (0382) 等

## 実装した 2枚 (catalog-reuse batch, 検証 green)
- **PR174 毛利小五郎** (pr-01): a1 enter chain[手札[毛利探偵事務所]1リムーブ→2draw] (事件編) /
  a2 continuous 自己AP+2000 (解決編&自分T&現場[毛利探偵事務所]≥3)。D08003/D08005 同型。
- **B07045 セリザベス女王** (ct-p07): a1 misreadX(1) / a2 phase:end 自分T,
  パートナーエリア[ビッグジュエル]あれば 自己active。B07021/sceneHas(partner-area) 同型。

## 検証 (セルフレビュー実施済 / 水平展開=engine全能力確認済)
- barrel 再生成 262→264 / typecheck 0 / reuse-validate 0 invalid 0 dup /
  registry-check ALL_CARDS 834→836 0 dup 0 fail / vitest 1719 pass 1 skip(既存BUG-006)
- 未commit (user 指示待ち)

## 追記 (2026-06-05): harness 修復 + 再分類 + パターンギャップ判明

### workflow harness 診断 (3 issue)
1. opus-4-8[1M] が並列 30 agent で rate-limit/unavailable → 全 fail。→ `model:'sonnet'` で回避。
2. claude-mem の Read hook が data file を 1 行に truncate → agent が card data 読めず。→ `Bash cat` で回避。
3. **★並列負荷で API throttle**: sonnet でも ~3 wave(50 agent) 超で agent が hang→StructuredOutput 未呼び。
   14 candidate の implement run は **3 時間 hang し 13/14 fail**。→ **並列 workflow はこの環境で非実用**(script から修復不可、API 側 concurrency 制限)。

### 再分類 (classify-only, 304 中 69 完了で throttle)
- 69 分類 → implementable 14 / defer 55。但し **file 読まない classify は過大評価** (1016 を impl 判定するが file 読む agent は defer)。
- 14 candidate を file 読み+敵対 review pass にかけた → 唯一完走した 0767 は **正しく defer** (deckRevealUntil は OR filter 不可 + cardName が targetFilterToPredicate 未対応)。

### ★パターンギャップ (本質的ブロッカー)
14 candidate を engine で精査 → **proven pattern で確実に実装できるものが無い**:
- pick して **2 効果** (AP+ と キーワード付与) を同一 pick に → **player-pick の bind 再利用が無い** (deckRevealUntil の bind のみ存在)。0177/0429 不可。
- **multi-target** 「N枚まで選び各 AP±」 → charModifyAP 短縮形は single uid resolve、multi は `forEach` kind 必要だが **カード使用例ゼロ=未検証**。0191 不可。
- effect:declared で **他カードのイベント使用に反応** + matcher (使用カードの色/特徴) → 非 selfOnly の参照実装ゼロ。0678/0748 未検証。
- evidenceFlip は literal idx のみ (pick 不可) → 1016/0642。contact-remove/$entered/mass-remove → 0935/0391/0359 未検証。
→ 単純 proven-pattern カードは**過去バッチで枯渇済み**。残 reusable は新 tested パターン確立 or gate。

### 逐次手実装 (user choice ②, 2026-06-05) — 実装 6枚 + forEach 解禁
proven-pattern スキャン (`.tmp/reuse/find-proven.cjs` → `proven-candidates.json`, 46候補) で
真に proven パターンへ写るカードのみ手実装:
- **PR192 キャンティ** (cutin AP+2000, D02012 同型) — 純カットイン。
- **B06071/B06071P 「閃光弾!?」** + **B02032 「立てや坂田ァ!!」** — 「すべて/全員」全体効果。
  → **forEach over:{kind:'all'} + `$each.uid`** を新規検証 (`tests/engine/effect/foreach-all.test.ts`)。
  `$each` 単体は不可・`$each.uid` で candidate→uid 解決。validate.ts も forEach 対応済 (line100)。
  これで「全体スリープ/スタン等」一回効果カテゴリが解禁 (継続 aura は不可のまま)。

### Playwright 実機検証 (2026-06-05, user 必須要求) → B07045 を revert
dev server (vite 5173) + `__game.setGameState` seam (bug-091 同型) で非MVPカードを注入し、`__game.read.char.ap`/dispatch で1枚ずつ検証:
- **PR174 a2**: read.char.ap で 解決編+現場[毛利探偵事務所]3枚→6000 / 1枚→4000 / 事件編→4000 ✓。a1 登場時 enter trigger 発火 (optional discard で pause=正)。
- **PR192**: UI が cutin として pickable 認識 → click で消費(hand→remove) → contact 解決 (opp-2 除去) ✓。effect は D08017 と同一。
- **B06071/B06071P**: handUseCard → 両者現場のスリープ全員→stun, active 不変 ✓ (**forEach over:all を実機検証**)。色制限 (白event vs 青case) も正しく弾く事を確認。
- **B02032**: 解決編&絆服部平次→相手全員sleep ✓ / 事件編・服部平次なし→無効 ✓。
- console error は favicon 404 のみ (実エラー0)。
- ⚠ **B07045 セリザベス女王 を revert (defer)**: a2「パートナーエリアに[ビッグジュエル]」が **永久に発火不能** と判明 — ビッグジュエルは trait を持つカードが存在せず、engine の partner-area candidate は単一 `partner.cardId` しか見ない (GameState に追加 partner-area カード枠なし)。ビッグジュエル-in-partner-area subsystem 未モデル → engine gate。
- 新規 durable test: `tests/e2e/reuse-cards-2026-06-05.spec.ts` (3 pass), `tests/engine/effect/foreach-all.test.ts`。

### 検証 (全 green, 未commit)
barrel 262→**267**, tsc 0, reuse-validate 0 invalid/0 dup, registry ALL_CARDS 834→**839** 0 fail,
**vitest green**, e2e 3 pass。本セッション計 **5枚** (PR174,PR192,B06071,B06071P,B02032) — B07045 は engine gate で defer。

### 残りの所感 / next
- 14 classify候補 + 46 proven候補を精査: 大半は gate (aura-buff-others=継続/optional自己犠牲/leave-hook/
  reasoning-hook/カットインfilter=keywords空/evidenceFlip-pick/trait-grant/ネクストヒントflag/同名2効果pick) で実装不可。
- まだ未検証で潜在的に解禁できるパターン: **effect:declared 他カードのイベント反応+matcher** (0678,0748),
  **declared+self-remove-cost+pick単効果** (0363,0828), **multi-target forEach-over-bound** (player pick→forEach)。
  各々テストで1つずつ検証すれば対応カテゴリが増える。
- mass 自動化 (並列 workflow) は API throttle で非実用 → 逐次 (本方式) で継続。
