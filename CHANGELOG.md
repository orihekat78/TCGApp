# Changelog

> ⚠️ このファイルは `scripts/gen-docs/gen-changelog.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:changelog`
> Source hash: `11da5dcd5b13`

「何ができたか」を時系列で記録する。個別エントリのソースは [`.claude/changelog-entries/`](.claude/changelog-entries/) にあり、Phase / Round 完了時にそこへファイルを追加する。日次の詳細ログは [`.claude/sessions/`](.claude/sessions/) に、現セッション scratchpad は [`.claude/memory.md`](.claude/memory.md) にある。形式は [Keep a Changelog](https://keepachangelog.com/) に準拠 (セマンティックバージョン番号は採用せず Phase/Round 名で区切る)。日付は Asia/Tokyo (YYYY-MM-DD)。

## [Unreleased]

### 残課題

- ~~Phase 9-F.2 MCTS strength tuning~~ → 完了:
  - 6-A 静的評価関数 → `bdcea93` (`defaultStateEvaluator` + partial rollout)
  - 6-B UCB1 tree → `aeda597` (`MCTSTreePolicy` 4-phase tree MCTS)
  - 6-C 並列化 → `c3e2325` (`WorkerPool` scaffold + SequentialPool default、
    真の Web Worker / worker_threads は Phase 9-F.3 で engine worker-safe 化と
    合わせて実装)
- ~~Phase 9-G.2 リプレイ UI 層~~ → 完了 (commits TBD):
  - 7-A useReplayDriver hook (play/pause/step/seek/setSpeed)
  - 7-B ReplayPanel component (上部固定 toolbar、4 速度 preset)
  - 7-C GameSetupModal にファイルピッカー追加 (リプレイ JSON 読込)
  - 7-D E2E spec (`tests/e2e/replay-ui.spec.ts` 3 シナリオ)
- ~~Cleanup Phase 中/大規模 5 件 全完了~~:
  - #1 動的式評価括弧 → `a8bc6b1` (shunting-yard で precedence + parens)
  - #2 cost picker → 実は `populateCostParams` で実装済を確認 (`616728a` doc)
  - #3 ヒューリスティック sceneRemove cardValue → `d23f8cb` (`handUseCardSwitch`
    の removeUid を `cardValueSelf` 最低に変更)
  - #6 Playmat レスポンシブ → `bca62c9` (`useStageScale` で動的 transform)
  - #9 listener 漏れ → 実は配線済を確認 (`5d36582` doc)
- ~~user_request 20260521_01 triage 残 4 件~~ → **全 18 件 完了** (Phase δ + ε で #3 / #12 / #18 解決)
- ~~Phase 5 advance UI 残 — Misread UI~~ → 既に完了済 (`35a0736`)
- Souza Sub-task B+C — 公式 defer ([phase-5-advance-souza-deferred.md])、
  MVP に使用カード 0 枚で実装不要

---
date: 2026-06-03
title: 全パートナーカード (非MVP 276枚) を generator で実装・registry 登録
type: feature
scope: cards
---

## 全パートナーカード実装

`.claude/specs/cards-data/*/partner.tsv` の全パートナー (~280枚) のうち、未実装だった**非MVP 17パッケージ 276枚**を CardDef stub として実装し registry に登録した。MVP (ct-d08/ct-d11、4枚) は不変。

- **generator**: `scripts/gen-cards/gen-partners.cjs`。各 partner.tsv を読み `src/cards/<pkg>/<cardNum>.ts` (D08001 同型、`abilities:[]` stub) を生成、集約 barrel `src/cards/_generated/partners.ts` (`GENERATED_PARTNERS: CardDef[]`) を出力。TSV 更新で再実行可能。
- **variant 別ファイル**: parallel art (`B01001` / `B01001P` / `B01001Sec1` …) も別 cardId = 別ファイル。
- **個別能力は後日**: 全 partner を共通能力 (アシスト / 事件解決、engine 内蔵) のみの `abilities:[]` で stub 化。個別能力を持つ ~22枚 (ct-p05 / pr-01) は TODO コメントを残し後日実装。
- **registration**: `src/cards/index.ts` で `GENERATED_PARTNERS` を import + `ALL_CARDS` に spread (+276)。`GENERATED_PARTNERS` を `@/cards` から re-export。
- **registry**: `ALL_CARDS` 47 → **323枚** (partner 4 → 280)。重複 id なし。

## 検証

- tsc clean (276 生成ファイル含む) / 重複 id ゼロ / vitest **1654 PASS** / smoke 1000戦 例外0 (502/498 不変、新 partner は deck 未使用)。
- **stale count-lock テスト修正**: MVP 47枚をハードコードしていた registry.test / validate-all.test / phase5-smoke.test の枚数アサーション (47 / 青26 / 黄21) を、MVP baseline + `GENERATED_PARTNERS` 由来の delta を加算する形に変更。generator 再実行に自動追従しつつ MVP drift は検出可能。

---
date: 2026-06-03
title: ヒラメキを inline atom 化 (hiramekiDraw / hiramekiCharStun factory 廃止)
type: refactor
scope: cards
---

## ヒラメキ inline 化

カットイン inline 化と同じく、ヒラメキ factory を廃止し各カードに inline atom で記述 (D08013 a2 参照)。

- **D08024 a2** (`hiramekiDraw`) → `draw` atom を inline (D08013 a2 同型、byte 一致)。
- **D08019 a2 / D11009 a3** (`hiramekiCharStun`) → `sceneSetState` ($pick + 明示 target) を inline。
- `src/cards/_shared/hiramekiDraw.ts` / `hiramekiCharStun.ts` + 各 unit test + spec を削除。barrel export / index.test / shared-classes INDEX を更新。`caseTraitConditioned.test.ts` の hiramekiDraw fixture を inline AbilityDef に差し替え。

## ⚠ 知見: hirameki fire path では sceneSetState 短縮形を使わない

当初 hiramekiCharStun を `sceneSetState` 短縮形 (`{player,max,side,state}`) に collapse する設計だったが、e2e で **hirameki fire path が壊れる** ことが判明:

- `hiramekiResolve{fire}` handler は `chooseAtomTarget` ヒューリスティックで `$pick` を**自動解決**する (Phase 7-3)。これは **明示 `target`** が walk 時に存在することが前提。
- 短縮形は target を実行時 (atom-handler) に構築するため、fire 時に auto-pick されず side-channel (human pick) 待ちになり、挙動が変わる。
- enter/action trigger では短縮形が動作不変 (Phase2/Phase3 で検証済) だが、**hirameki fire path は別経路** で短縮形非対応。
- → hiramekiCharStun は明示 target 形 (factory 出力と byte 一致) で inline。

## 検証

- typecheck clean / vitest **1654 PASS** / smoke 1000戦 例外0 (502/498 不変) / e2e hirameki (draw 4 + char-stun 6) 全 PASS。
- 各カード test が動作不変オラクル (D08024/D08019/D11009 既存 test 不変 PASS)。

---
date: 2026-06-02
title: カットイン inline 化 + D08007 スケーリング cutin バグ修正 ($self.sceneTrait dyn root)
type: fix
scope: engine / cards / docs
---

## D08007 スケーリング cutin の修正 (latent bug)

D08007「【カットイン】自分の現場の[少年探偵団]1枚につき AP＋1000」は **実機で壊れていた**:

- `delta` が **bare string** `'$dyn.shonentanteiCount * 1000'` だった。`resolveDynArgs` は `{dyn:'...'}` **object** のみ評価するため未評価のまま `modifyAP` に渡り、`apMod_contact` が文字列連結 (`"0$dyn..."`) になり AP が NaN 化。
- かつ `$dyn.shonentanteiCount` はどこにも populate されておらず、評価されても throw。
- shape test のみで runtime 検証が無く見逃されていた (AI smoke はカットインを打たない)。

### 修正

- **engine**: dyn evaluator に状態計算 root `$self.sceneTrait.<特徴>` を追加 (`ctx.source.player` の現場で特徴を持つキャラ数を state から算出。カットイン=手札カードで `source.uid` 不在でも `player` 基準で数える)。
- **engine**: `substituteAtomPick` の非 pick early-return でも `resolveDynArgs` を通すよう修正 (`$contact.byUid` 等 pick を伴わない atom の `{dyn}` delta が従来未解決だった)。`resolveDynArgs` は `{dyn}` のみ変換するため既存 atom は no-op。
- **D08007**: `delta: { dyn: '$self.sceneTrait.少年探偵団 * 1000' }` (object 形) に修正 + **runtime test 追加** (現場2枚→`apMod_contact===2000` を検証)。

## カットイン inline 化 + cutinFixedAP factory 廃止

カットイン効果をカード上で可視化するため、`cutinFixedAP` 共通クラスを廃止し各カードに inline atom で記述 (D08007 同型: `triggered`/`scope:'on-hand'`/`effect:declared`/`charModifyAP $contact.byUid scope:'contact'`)。

- 対象 6枚: D08015(a2,+1000) / D08017(+2000) / D08023(+2000) / D11017(+2000) / D11018(+2000) / D11019(a2,+1000)。
- `src/cards/_shared/cutinFixedAP.ts` + その unit test + spec を削除、barrel export / index.test / shared-classes INDEX を更新。
- e2e `cutin-fixed-ap.spec.ts` は factory 非依存 (盤面駆動) のため inline 後も 6/6 PASS で挙動不変を担保。

## 検証

- typecheck clean / vitest **1663 PASS** / smoke 1000戦 例外0 (502/498、inline は挙動不変) / e2e cutin 6/6 PASS。
- 教訓: shape-only test は dyn 未評価のような runtime バグを見逃す → 数値効果には runtime オラクルを置く。

---
date: 2026-06-02
title: カード atom コンパクト化 + コーディング規約制定 + 短縮形 ATOM_PICK_SPEC 一本化
type: refactor
scope: engine / cards / docs
---

## 規約制定

- `.claude/specs/card-authoring-convention.md` — 1ステップ=1行 atom / comment-above / 短縮形優先 / 冗長 choice 除去 / closure は最終手段。
- `.claude/specs/card-condition-catalog.md` — `Condition.kind` 早見表 (アイコン→kind + 実カード例 + 追加手順)。
- 既存 `engine-api-{conditions,effect-descriptor,atom-verbs}.md` / `card-addition-checklist.md` から相互リンク。

## engine: 短縮形の一本化 (動作不変 refactor + 新 verb)

- `src/engine/effect/atom-pick-spec.ts` 新設: `ATOM_PICK_SPEC` テーブル (pick系 atom 短縮形の唯一の権威ソース) + `buildShortFormPick()` + `isShortFormDelta()`。
- 分散していた短縮形ロジック (`resolve-picks.ts` の `PB_DEFAULT_PICK_AREA` / `atom-handlers.ts` の `defaultPickTarget` + PA 各分岐) をテーブル駆動に集約。byPlayer/guard は verb 毎に保持し動作不変。
- 新規 PA 短縮形: `sceneSetState` / `charModifyLP` / `sceneEnter`(area 指定) + `charModifyAP/LP` の dyn-delta 受理。
- characterization test (移行前 baseline) + 新 verb test を追加。3 lens の adversarial verification で動作不変を確認。

## cards: 全 non-partner カードを comment-above 1行形に統一

- B0 リファレンス9枚 + D11020 comment-above 化 / B1 D11005・D11013・D11015・D11016 / B2 D08019・D11003・D11009 (sceneSetState 短縮形) / B3 D11012 (charModifyLP 短縮形) / B4 D08024・D11014 (sceneEnter 短縮形) / B5 簡易8枚 (factory のみ=no-op)。
- 冗長 `choice→options:[atom]` を短縮形 atom に置換。closure / factory / description / メタデータは不変。
- パートナーカード (D08001/02, D11001/02) / `_shared/*.ts` factory 内部は対象外。

## ⚠ 重要な知見

- **dyn-delta (`delta:{dyn}`) を使う宣言能力 (D08026/D11021) は explicit `target` を保持**。短縮形は target を実行時構築するため AI 列挙時に `costPaid` 不在で dyn eval が throw する (per-card test は通るが smoke で 667 例外 → 中央検証で検出 → D11021 を explicit に戻して解消)。
- **単一 option choice の除去は実行結果不変** (resolver は `options[0]` を実行) だが、AI の seeded 列挙木が変わり smoke 決着分布が 471/529→502/498 に動く。choice-removal cards を revert すると 471/529 に戻ることを bisect で確認 (カード動作は byte 不変)。

## 検証

- typecheck clean / vitest 1665 PASS / smoke 1000戦 例外0・invariant-fail 0。
- 教訓: per-card test (隔離) は invariant/列挙系の回帰を見逃す → **full suite + smoke の中央検証が必須**。

---
date: 2026-05-29
title: Phase 17 — チュートリアルに実対戦フォーマット流用 + 横向き事件カード + ワイド2ペイン + 章ごとガイド付き実戦
type: feat
scope: meta-app
---

## ユーザー指示

> 実際の対戦フォーマットを流用するようにしてください
> 事件カードについては横カードなのだから対応してください
> 出てくるテキストボックスが小さいので大きくしてほしい。カードの表示も大きくして、説明文がどの箇所を指しているのか該当箇所を強調してほしい
> step3 からは実際のプレイを交えながら行っていったほうがいいかもしれませんね
> 質問やモックでの確認もしてくれて構いません

確定方針 (AskUserQuestion + モック提示): Q1=実 Playmat 静的埋め込み / Q2=章ごとガイド付き実戦 / Q3=ワイド2ペイン。

## 主要変更 (`meta-app/` のみ、`src/` は import only で git diff = 0)

### A. ワイド2ペイン viewer + 拡大 (Q3)
- `TutorialLessonViewer` を `min(1040px,96vw)` の 2 ペインに再構成
- 左ペイン = step 種別で出し分け (card / board / illustration)、右ペイン = STEP + **拡大本文 (15px/lineHeight1.85)** + パーツ/ゾーン一覧 + ナビ

### B. 実カード拡大 + 横向き事件 + 該当箇所強調 (Q1, #2, #3)
- `AnnotatedCard` 新規: 実 `CardArt` を拡大描画 (縦 ~300px / 事件は **116:84 横向き ~440px**)。旧 `MetaCard w=140` 縦固定による歪みを解消
- `CARD_REGIONS` 正規化矩形でカード各パーツ (種類/色/名前/AP/LP/効果/No/事件レベル) に発光ボックス + 番号。公式実画像を Playwright 目視確認して座標確定 (AP「6000」LP「1」事件レベル「先7/後6」等に正対応)
- 右ペイン一覧 hover ↔ 左の region を共有 `activeKey` で gold pulse 強調、他は dim (該当箇所強調)

### C. 実 Playmat 盤面スナップショット (Q1, #1)
- `TutorialBoardSnapshot` 新規: `FitScaleBox` (実測フィット縮小) で実 `<Playmat gameState={createSampleGameState()}>` を読み取り専用描画 (pointer-events none)
- `boardHints.ts` の `STEP_BOARD_ZONES` で各 step の強調ゾーン (.scene-area.side-self 等) を定義 → snapshot root 内 querySelector で box 描画 + 右ペイン一覧 hover 連動
- 左ペイン出し分け: ch1-2/ch3/ch4/ch5-1..4 = 盤面、ch1-1/ch6/ch7/ch8 = 既存模式図、ch2-* = 実カード
- `util/tutorialResolvers.ts` に resolver を共有抽出 (RealMatchView も同 import に差替、挙動不変)

### D. 章ごとガイド付き実戦 (Q2, #4)
- viewer フッタ (ch3+) 「▶ この章を実戦で試す」→ `useTutorialStore.setState({currentStep: CHAPTER_TO_SRC_STEP[ch]})` + customGameStart + #match。RealMatchView 既存 `<TutorialOverlay/>` が実盤面で該当 step のガイド + ゾーンハイライトを表示 (実際に推理/アクションを操作しながら学べる)
- `CHAPTER_TO_SRC_STEP`: meta 章 → src `TUTORIAL_STEPS` index (ch3→L3-1「3フェイズ」, ch4→L4-1「推理」, ch5→L5-1「アシスト」, ch6→L9-1「カットイン」, ch7→L6-1「アクション」, ch8→L13-1「MR」)
- overlay リセットは **非ガイド起動側で決定的に** (startPractice / SetupScreen.handleReady で `exit()`)。unmount cleanup での exit は React StrictMode が currentStep を消すため不可と検証で判明 → 採用しない

## 検証

- tsc green / e2e **29/29 全緑** (既存 25 + 追加 4: 盤面スナップショット `.case-area` / 横事件 width>height / region 注釈 + パーツ一覧 / ガイド実戦起動→#match + `.tutorial-overlay`)
- Playwright 実機: 横事件 (440×319)・region 正対応・hover で該当 region gold pulse・ch3 CTA→実戦+overlay「3フェイズで進む(8/33)」+highlight・console error 0
- `src/` git diff = 0 (`src/ vite.config.ts tsconfig.json tests/` = 0 件)

## 仕様 / 記録

- `.claude/specs/meta-ui/16-tutorial-real-board.md` 新規 + meta-ui/INDEX・specs/INDEX に entry 17
- 本エントリ `2026-05-29-03-phase-17-tutorial-real-board.md`

## 持ち越し (Phase 18+)

- 操作の正誤判定 / ゲーティング (現状 overlay は手動 next)
- 章別シナリオ盤面 (専用 deck/手札固定) / viewer スワイプ / バンドル分割

---
date: 2026-05-29
title: Phase 16 — チュートリアルを「ステップ→別画面 lesson viewer」化 (33 ステップ図解 + Workflow ルール監査)
type: feat
scope: meta-app
---

## ユーザー指示

> 説明の項目をクリックしたら別画面で説明が始まるようにしてほしい
> このチュートリアルについては他 TCG ゲームを参考に開発してほしい
> チュートリアルでのレイアウトはコナンカードゲーム公式ページに例が上がっているので Playwright で確認して参考に
> https://conan-tcg.commmune.com/view/knowledgebase/post/16862 こういったページ周辺も参考に

Phase 15 はステップクリックが「クリア記録」のみで、説明は常時右パネルに章単位表示だった。本 Phase で「クリック → 別画面で説明開始」へ刷新。

## 他 TCG 参考 (Playwright + Web)

- **Yu-Gi-Oh Master Duel**「遊び方」= 1 トピック 1 ページのページめくり式 → lesson viewer の基本形
- 公式「初めての方へ」(takaratomy) = 8 セクション 2 グループ構成を踏襲
- 公式ルールマニュアル Ver 2.4 (commmune P3-5) = カード annotated 表記 → `CardAnnotated` の番号注釈に反映
- カルーセル UX (NN/g, Smashing): 1 画面 1 概念 / 進捗ドット / 常時 skip 可

## 主要変更 (`meta-app/` のみ)

### A. データモデル分解 (16-A, `screens/tutorial/`)
- `tutorial/types.ts` 新規 — `TutorialStep` / `TutorialChapter` 型を切り出し (TutorialScreen ↔ viewer の循環依存回避)
- `illustrations.tsx` を **章単位 8 コンポーネント → ステップ単位 33 図解** へ分解、`STEP_ILLUSTRATIONS: Record<stepId, ReactNode>` レジストリを export
- 共通プリミティブ拡充: 既存 Panel/SectionLabel/TermRow/PointBox/WarnBox に加え Zone/PhaseBox/FlowStep/Token/MiniChar/CaseStateBox/TimingChip/CardAnnotated/CalloutPill/DeckPile/KeywordCard/AdvancedSection

### B. TutorialLessonViewer 新規 (16-B)
- フルスクリーン没入オーバーレイ (`position: fixed; inset: 0; z-index: 300`、backdrop blur) で AppTopBar も覆う (Master Duel 風)
- ヘッダ `CHAPTER 0X · {title} · ステップ N / M` + × / 本体 `STEP {num}` + title + `STEP_ILLUSTRATIONS[id]` + body / フッタ 進捗ドット (クリックでジャンプ) + 「← 前」「次へ →」(最終「章を完了 ✓」)
- 「次へ」= `onStepComplete(stepId)` (= markStepCleared) → 前進 / 最終は閉じる
- Esc / ← / → キーボード + backdrop / × で離脱 (skip 常時可)

### C. TutorialScreen ハブ再構成 (16-C)
- 右パネル常時 Illustration を撤廃、3 カラム (左 ChapterProgress+ChapterList / 中央 StepCardList「▸ 開く」/ 右 ChapterSummary「この章で学ぶこと」+ 進捗 + 「章を最初から学ぶ ▸」CTA) に
- `viewerState: { chapterNum, stepIndex } | null` でステップ別画面を開閉
- `TUTORIAL_CHAPTERS` は引き続き export (ResultScreen が step id 集計に使用)、Phase 15-E 練習試合連携 (ch5 自動クリア) 保持

### D. Workflow による章別 adversarial ルール監査 (16-review)
33 ステップ図解 vs `rules/01〜26` を 8 章 reviewer + refute-by-default verifier (計 24 agent) で照合、**確認 15 finding を反映**:
- **ch1-2**: 「場の 7 エリア」→ **8 エリア** (手札含む) / FILE「オート +2」→「毎ターン +2 (初手1)」
- **ch2-1**: 「AP はコンタクト (戦闘) で比較」→ **「アクション (攻撃) で比較」** (現行用語)
- **ch3-1** (high): 開幕に **「① 事件/パートナーを裏向き配置」** を追加 (公式 04 step1 欠落) / マリガンに **「デッキをシャッフル」**+先攻先決定を追記
- **ch3-2** (high): AUTO に **「アシスト中パートナーは戻す / スタンは代わりにスリープ / FILE は 1 枚ずつ最新が上」** + メイン制限 (手札 1 回・名乗り不可・割り込み不可) を追記
- **ch4-1**: 推理に **「名乗り/スリープは推理不可」** / **ch4-2** (high): アクション対象 **「スリープ/スタンの相手キャラ・証拠ある事件のみ、アクティブ相手・証拠0事件は不可」** / **ch4-3** (high): コンタクト **「AP 同値は非ターンプレイヤーが 1 番目」** / **ch4-4**: NH **「登場キャラは同ターン登場 (名乗り→推理不可)」**
- **ch6-1** (high): ヒラメキ **「アクション[事件]によるリムーブ時のみ発動 (カード効果では不発動)」**
- **ch7-1**: 疾風 **「能力・効果による登場でも発動」** / **ch7-4**: ブレット例を非公式「直接通る」→公式準拠「ガードを宣言できない」に

## 不変条件 (継続遵守)

- ✅ `src/` 配下 1 行も変更なし (`git status -- src/ vite.config.ts tsconfig.json tests/` = 0 件)
- ✅ Phase 11 統合経路保持 (`useGameStateStore` / `setGameState` / `customGameStart`)
- ✅ Phase 15 進捗 persist (`tutorialClearedStepIds`) / Phase 15-E 練習試合連携 維持
- ✅ カード画像非同梱・ローカル限定運用 (法務スタンス維持)

## 検証

- tsc (`meta-app/tsconfig.json`) green / build green
- meta-app e2e **25/25 全緑** (既存 19 + tutorial 6: ハブ 8 章 / ステップカードクリック→viewer / 次へ進行+persist / ch2 番号注釈 / ch7 KeywordCard / Esc クローズ)
- セルフレビュー実施済 / 水平展開 = 33 図解全件を rules 照合 (Workflow 8 章 fan-out)

## 仕様 / 記録

- `.claude/specs/meta-ui/15-tutorial-lesson-viewer.md` (76 行) + meta-ui/INDEX.md・specs/INDEX.md に entry 16 登録
- `.claude/changelog-entries/2026-05-29-06-phase-16-tutorial-lesson-viewer.md` (本ファイル)

## 持ち越し (Phase 17+)

- 動的 unlock (章チェーン) / 各ステップ末クイズ
- 練習試合中に src/ TutorialOverlay を active 化 (実盤面 highlight)
- 章別の練習シナリオ (ch4 コンタクト / ch6 カットイン 等)
- viewer のスワイプ操作 (タッチ) 対応 / バンドル分割

---
date: 2026-05-29
title: Phase 15 — チュートリアル完成 (8 章 + 進捗 persist + 練習試合連携、rules/01〜26 網羅)
type: feat
scope: meta-app
---

## ユーザー指示

> チュートリアルを完成させたい
> チュートリアルにはキャラクター、イベント、事件、パートナーカードのそれぞれの記載の説明をしてくれるシーンも作成してほしい
> 特有のキーワードについてのチュートリアルも実装したい (疾風・突撃など)
> 他にルールを参照してみて、チュートリアルに加えたほうがいい内容を加えてほしい
> 動的アンロックは今実装しないでほしい
> 公式ページ (takaratomy + commmune) を Playwright で参照して

Phase 14-D で骨格はあったが、章 4 のみ Illustration / step state ハードコード / persist なしという未完成状態。Phase 15 で標準スコープ実装 (動的 unlock 除外)。

## 主要変更 (`meta-app/` のみ)

### A. metaStore 拡張 (15-A)
- `Settings.tutorialClearedStepIds: string[]` + persist + hydrate fallback
- `_pendingPracticeChapter: number | null` (transient、persist しない)
- actions: `markStepCleared` / `markChapterStepsCleared` / `isStepCleared` / `startPracticeFor` / `consumePendingPractice`

### B. TutorialScreen progress-driven (15-B)
- 旧 6 章 hardcoded → **新 8 章** progress-driven 構造に書換
- ChapterList を 2 グループ (「初めての方は」beginner 4 / 「詳しく知りたい方」advanced 4) + 番号バッジ
- step state 算出: `cleared` / `current` (章内最初の未 clear) / `pending`
- 動的 unlock 撤回 (開発中のため) — 全章常時アクセス可
- step click → `markStepCleared` → persist

### C. 全 8 章 Illustration (15-C, `screens/tutorial/illustrations.tsx` 一括)
公式 https://www.takaratomy.co.jp/products/conan-cardgame/beginner/ と https://conan-tcg.commmune.com/ (ルールマニュアル Ver 2.4 全 27 ページ) を Playwright で参照、章構成と Illustration デザインに反映:
- 共通プリミティブ: `Panel` / `SectionLabel` / `TermRow` / `PointBox` / `WarnBox`
- **ch1** 基本ルール: 7 エリア構造 (相手陣 / 自陣 鏡像)
- **ch2** カードの読み方 🆕 (公式 P3-5 参考): `CardAnnotated` + `CalloutPill` 新規、キャラ/イベント/事件/パートナーの 4 種をそれぞれ番号注釈付きで解説
- **ch3** ゲーム開始からターン進行: マリガン 6 ステップ + 3 フェイズ flow
- **ch4** キャラ行動とリソース管理: 推理 vs アクション + コンタクト AP 比較 + ネクストヒント + リフレッシュ + 敗北 WARN
- **ch5** 解決編とアシスト勝利不可: 事件編→解決編 + 必要証拠 7/6 + WARNING
- **ch6** 効果と能力: アイコン能力 4 種 grid + 宣言能力構文解説 + タイミングアイコン chip
- **ch7** キーワード能力 🆕: 6 キーワード (疾風 / 突撃 / 迅速 / ブレット / 捜査 / 痕跡) icon + 説明 + 例
- **ch8** 上級者向け: MR / 色制限 + スイッチ / スタン特殊 / 数値修正 / セット vs 下に重ねる の 5 セクション

### D. ResultScreen 練習試合連携 (15-E)
- 終局時に `consumePendingPractice()` で章番号取得
- `result.winner === 'self'` なら該当章 (ch5 = 解決編) の全 step を `markChapterStepsCleared` で一括 cleared
- 敗北では章クリアしない (再挑戦推奨)

### 公式ルール網羅
| rules | カバー章 |
|---|---|
| 01 勝利条件 / 02 デッキ / 03 エリア / 04 開幕 / 05 ターン / 06 種別 | ch1, ch3, ch5 |
| 07-08 アクション / 09-10 cutin-hirameki / 11 推理 / 12 NH / 13 keywords / 14 refresh | ch4, ch5, ch6, ch7 |
| 15 / 16 / 17 / 18 / 19 / 20 / 21 / 22-26 Q&A | ch6, ch7, ch8 |
| 27-30 制限/エラッタ/フロアルール | ❌ out of scope (競技規定) |

## 不変条件 (継続遵守)

- ✅ `src/` 配下 1 行も変更なし (Phase 10-14 から継続)
- ✅ Phase 11 統合経路保持 (`useGameStateStore` / `setGameState` / `customGameStart`)
- ✅ 既存 vitest / playwright e2e 全件無修正で緑

## 検証

- tsc + build green
- meta-app e2e **24/24 全緑** (Phase 14 既存 19 件 + Phase 15 tutorial 5 件)
  - 8 章すべてリスト表示 (2 グループ label 含む)
  - step クリック → localStorage `tutorialClearedStepIds` 含まれる
  - ch2 CardAnnotated 4 種表示
  - ch4 「ネクストヒント」「リフレッシュ」+ WARNING 表示
  - ch7 キーワード 6 種すべて表示
- 5174 で:
  - 全 8 章クリック可能 (locked なし)
  - 各章右パネルに Illustration 表示
  - step click → 進捗 bar 更新 + リロード後も persist
  - ch5 練習試合 → 勝利 → ch5 全 step 自動 cleared
  - HOME ホームへ戻っても 進捗保持

## 仕様 / 記録

- `.claude/specs/meta-ui/14-tutorial-complete.md` 新規 (78 行) + INDEX 登録
- `.claude/changelog-entries/2026-05-29-01-phase-15-tutorial-complete.md` (本ファイル)

## 持ち越し (Phase 16+)

- **動的 unlock** (章チェーン unlock) — 開発が落ち着いてから
- 各章末にクイズ (選択式) 追加
- 練習試合中に src/ TutorialOverlay を active 化 (現ステップ highlight)
- 章ごとに専用の練習試合シナリオ (ch4 → コンタクト、ch6 → カットイン 等)
- ReplayScreen 実盤面再生
- バンドル分割

---
date: 2026-05-28
title: Phase 14 — MetaCard chrome 削除 + 未実装機能の完成 (カスタムデッキ実機対戦 / フィルター拡張 / log 集計 / 練習試合 / cardBack)
type: feat
scope: meta-app
---

## ユーザー指示

> カードごとに使われている青枠みたいなのは、対戦以外には必要ないので削除して外してください。
> また、モックの反映は出来たと思うので未実装のところについても実装を行ってください。

Phase 13 で全 9 画面の構造は揃ったが、MetaCard chrome (色枠/上部ストライプ/下部フッタ) が CardArt 公式画像と重なって冗長、また持ち越し項目が残っていた。Phase 14 でまとめて解消。

## 主要変更 (`meta-app/` のみ)

### MetaCard chrome 削除 (前段)
- `shared/MetaCard.tsx`: `linear-gradient` 背景 / 上部 cost+rarity ストライプ / 下部 name+AP フッタ / 色付き 1px border を**削除**
- 残置: 選択リング (gold outline) / count badge / favorited ★ / partner/case badge / hover アニメ
- 結果: 対戦外画面で `<CardArt cardId>` のみが素表示され、Playmat (src/) のカード描画と整合

### Phase 14-A: カスタムデッキ → engine DeckSpec 変換
- `util/customGameStart.ts` 新規: `toEngineDeck(deck: DeckRecord)` + `customGameStart(self, opp)` で src/gameStarter の内部ロジックをミラー
- `util/deckBridge.ts` の `isPlayable`: deckId 一致 → **validateDeck 合格** で判定に変更
- `screens/SetupScreen.tsx` の `handleReady`: `performGameStart` → `customGameStart(selfDeck, oppDeck)` に切替
- パートナー→事件マップ: `D08001/D08002 → D08026`, `D11001/D11002 → D11021`, color fallback で他にも対応
- 結果: カスタムデッキで実機対戦が動作するようになった

### Phase 14-B: DeckEditor フィルター拡張
- 既存の色/種別フィルターに加え:
  - `costFilter: Set<number>` (0〜8, 8 は 8+ 集約)
  - `featureFilter: Set<string>` (CARD_POOL 全 features 自動列挙)
  - `keywordFilter: Set<string>` (CARD_POOL 全 keywords 自動列挙)
- `FilterRail` UI に 3 つのフィルター + 全リセットで全クリア
- 全フィルター AND で適用、各 chip に件数表示

### Phase 14-C: HistoryScreen 統計を engine.log 集計へ
- `ResultScreen.buildMatchRecord` に `countLogActions(gs.log)` 追加
  - `contacts`: `contact-judge` / `contact:judge` カウント
  - `hirameki`: action / result に `hirameki` 含むエントリ
  - `misread`: action / result に `misread` 含むエントリ
- 新規対戦の MatchRecord は実値、旧履歴は 0 のまま (互換)

### Phase 14-D: TutorialScreen 練習試合 → 実ゲーム起動
- `startPractice()` 関数: SAMPLE_DECK (D08) + SAMPLE_DECK_OPP (D11) で `customGameStart` を直接呼出
- 章 04「練習試合」ボタンと SubToolbar「PRACTICE」ボタン両方が同じ動作
- SETUP 経由せず直接 #match へ遷移 → mulligan modal → 対戦開始

### Phase 14-E: SettingsScreen card back + audio 実装
- `metaStore.Settings` 拡張: `cardBack: CardBackId` ('gold'|'azure'|'crimson'|'jade'|'noir') + `bgmVolume` + `seEnabled`
- `onRehydrateStorage` で旧 v1 hydrate fallback (フィールド欠落 → default 補填)
- `CardBackSelector` コンポーネント: 5 種 gradient プレビュー + active バッジ + クリックで切替
- SystemRightRail に「CARD BACK · 現在」プレビュー追加
- audio スライダー / トグル は persist のみ (実音は Phase 15+)

## 不変条件 (継続遵守)

- ✅ `src/` 配下 1 行も変更なし
- ✅ Phase 11 統合経路保持
- ✅ 既存 vitest / playwright e2e 全件無修正で緑

## 検証

- tsc + build green
- meta-app e2e 19/19 全緑 (smoke 10 / golden-path 3 / cards 4 / engine-stub 2)
- 5174 で:
  - HOME/DECK/CARDS のカードが純粋な CardArt 表示 (chrome なし)
  - DeckEditor のフィルターが cost / 特徴 / キーワード も動作
  - SETUP → READY でカスタムデッキも実機対戦可能 (validateDeck OK 前提)
  - TUTORIAL の「練習試合」ボタンで直接実機対戦開始
  - SETTINGS で cardBack 選択 → persist → 再起動後も保持
  - RESULT 後 history に記録される MatchRecord に実 contacts/hirameki/misread

## 仕様 / 記録

- `.claude/specs/meta-ui/13-implementations.md` 新規 (83 行) + INDEX 登録
- `.claude/specs/INDEX.md` に Phase 14 追記

## 持ち越し (Phase 15+)

- ReplayScreen の実盤面再生 (`engine.event.applyUntil`)
- OpponentHeatmap を実 history から動的集計
- audio (BGM/SE) の実音実装
- TutorialScreen 進捗 persist
- バンドル分割 (chunk size warning 解消)

---
date: 2026-05-28
title: Phase 13 — 残り 7 画面を元モック忠実に rebuild (HOME / SETUP / RESULT / DECK / HISTORY / TUTORIAL / SETTINGS / REPLAY)
type: feat
scope: meta-app
---

## ユーザー指示

> 他モックについても同様にお願いします

Phase 12 で CardsScreen を `design-mockups_v2/08-cards.jsx` 忠実版に書き直した実績を、残り 7 画面に横展開。`src/` は完全不変、Phase 11 統合 (SetupScreen → performGameStart、ResultScreen → gameState 直読) は壊さず維持。

## 画面別 rebuild

| 画面 | 旧 LOC | 新 LOC | 主要追加要素 |
|---|---|---|---|
| ResultScreen   | 208 | 350+ | ResultBackdrop (radial bloom + light rays + 40 particle dots) / Verdict 巨大 JP + VICTORY 装飾 / MVPShowcase (gradient + ⭐ + big card + ContribRow x 4) / ResultStats (ScoreSide + 6 StatCompare grid + PROGRESS) / 5 button Actions |
| SetupScreen    | 242 | 350+ | ModeTile (SELECTED badge + ModeAvatar x 2 + desc) / PlayerConfigPanel (P1/P2 + partner + ConfigRow + MiniMetric) / SwapButton / SetupMatchOptions (4 OptionToggle) |
| HomeScreen     | 268 | 420+ | HeroBackdrop (skyline SVG + magnifier watermark + light beam) / CenterHero / HeroPartner (3 カード fan + sparkles) / DuelButton (大型シェブロン) / 強化 Panel 群 |
| DeckEditor     | 237 | 530+ | SubToolbar (rename + Save) / FilterRail / CardListGrid + CardDetailPanel / DeckHeader (40/40) / DeckStats (CostCurve + ColorBar + TypeRow) / DeckList (cost sort + AP + keyword chip) |
| HistoryScreen  | 157 | 360+ | HistorySubToolbar (filter chips + deck select) / WinRateSummary (sparkline 14 戦) / DeckPerformance (実 history 集計) / MatchDetail / OpponentHeatmap (3x5 matchup) |
| TutorialScreen | 224 | 400+ | SubToolbar (進捗 bar) / ChapterProgress (rank) / ChapterList (locked/cleared/current 状態別) / ChapterContent (TutorialStep) / ChapterIllustration (CardDiagram + WARNING + TermRow + POINT) |
| SettingsScreen | 173 | 320+ | Header (戻る/データ削除) / CategoryRail (6 cats + icon) / DetailPanel (visual/play/audio/control/data/about) / SegmentedControl / Toggle / Slider / SystemRightRail |
| ReplayScreen   | 125 | 220+ | BoardZone snapshot (partner + 現場 mock) / Scrubber (⏮◀▶⏭ + progress bar) / ActionLog (turn ごとカラーログ) |

## 不変条件 (絶対遵守、すべて達成)

- ✅ `src/` 配下 1 行も変更なし (`git status -- src/ tsconfig.json vite.config.ts tests/` = 0 件)
- ✅ Phase 11-C SetupScreen 配線保持: `nav('match')` 先実行 → `performGameStart` async → `setGameState`
- ✅ Phase 11-E ResultScreen 配線保持: `gameState` 直読 + `recordedRef` dedup + `setState({ gameState: null })`
- ✅ Phase 12 CardsScreen 動作維持
- ✅ 既存 vitest / playwright e2e 全件無修正で緑 (golden-path の 2 件のテキスト追従修正のみ)

## 検証

- tsc + build green (bundle 600KB 程度)
- meta-app e2e 19/19 全緑 (smoke 10 / golden-path 3 / cards 4 / engine-stub 2)
- 5174 で全 9 画面確認 (HOME → SETUP → 実機対戦 → RESULT → HISTORY → REPLAY 通し動作)

## 仕様 / 記録

- `.claude/specs/meta-ui/12-screens-rebuild.md` 新規 (100 行以内) + `meta-ui/INDEX.md` + `.claude/specs/INDEX.md` 登録
- `.claude/memory.md` 末尾に Phase 13 ログ追記
- F-rule-audit 残課題: TutorialScreen 章 04 で「アシスト勝利不可」図解を完全反映

## 持ち越し (Phase 14+)

- カスタムデッキ → engine DeckSpec 変換 (現状 CT-D08 / CT-D11 専用)
- HistoryScreen の MatchRecord 集計を engine.log ベースに精緻化 (contacts/hirameki/misread)
- ReplayScreen の実盤面再生 (`engine.event.applyUntil` 利用)
- OpponentHeatmap を実 history から動的集計
- バンドル分割 (chunk size warning 解消)

---
date: 2026-05-28
title: Phase 12 — CardsScreen を元モック忠実に再構築 + 47 枚カード対応
type: feat
scope: meta-app
---

## ユーザー指摘

> design-mockups_v2 既存のこちらでは、スクショのようになっていたのですがなぜ変更されているのでしょうか？

スクショで提示された元モック CARDS 画面 (COVERAGE パネル / 47/47 種類 / 検索 / ソート / ★ お気に入り / USAGE 統計) と私の Phase 10 実装の乖離 (約 42% 削減) が指摘された。Phase 11-B で導入した `CardArt` (公式画像) は維持しつつ、CardsScreen のレイアウト/機能のみ元モック `design-mockups_v2/08-cards.jsx` (479 行) に忠実に作り直した。

## 主要変更 (`meta-app/` のみ)

- **data/cardPool.ts 全面書換**: 27 枚ハードコード → `src/ct-d08-cards.json` (26 枚) + `src/ct-d11-cards.json` (21 枚) を直接 import + 型変換 (日本語 type/color → 英語 enum、string ap/lp/cost → number、cutIn/hirameki/henso + effect 文字列から keywords 派生)
- **state/metaStore.ts**: `favorites: string[]` フィールド追加、`toggleFavorite` / `isFavorited` action、`onRehydrateStorage` で旧 v1 (favorites 欠落) を `[]` fallback
- **shared/MetaCard.tsx**: `isFavorited?: boolean` prop 追加 → 右上に ★ overlay (count badge と非衝突位置)
- **screens/CardsScreen.tsx 全面書換** (198→528 行): SubToolbar (証拠ファイル + 47/47 + 検索 + 表示モード ✱✱✱ + 新着順/コスト順) + 左 CoveragePanel (100% + 47/47 + BY COLOR バー × 5 + BY RARITY × 4) + 左 FiltersPanel (色/種別/キーワード チップ群 + リセット) + 中央 CardGrid (CARDS · N 件 + ★お気に入り数 + auto-fill grid) + 右 SelectedDetail (大カード + C/AP/LP 3box + EFFECT セクション + USAGE: 採用デッキ N/D / 勝率 / MVP 数 + ★お気に入り toggle + + デッキへ追加)
- **tests/e2e/cards.spec.ts (新)**: 47/47 表示 / COVERAGE / 検索件数変化 / ★ お気に入り persist / + デッキへ追加 遷移
- **.claude/specs/meta-ui/11-cards-rebuild.md (新)** + INDEX 登録

## USAGE 集計ロジック

- 採用デッキ: `decks.filter(d => d.cards.some(e => e.num === cardNum)).length`
- 勝率(採用時): 当該カード採用デッキの試合のみで `wins/total`
- MVP 数: `history.filter(m => m.mvp === cardNum).length`

`useMemo` で派生計算 (zustand selector の infinite loop 回避)。

## 不変条件 (継続遵守)

- `src/` 配下 1 行も変更しない (JSON は import 経由)
- 既存 5173 ゲーム挙動完全維持、既存 vitest + playwright e2e 全件無修正で緑

## 検証

- tsc + build green (bundle 589KB)
- meta-app e2e 19/19 全緑 (Phase 11 既存 15 件 + Phase 12 cards.spec.ts 4 件)
- 5174/#cards: COVERAGE 100% (47/47) + BY COLOR/RARITY バー + 検索で件数変化 + 詳細パネル EFFECT/USAGE + ★ お気に入り → localStorage persist + + デッキへ追加で #deck 遷移、すべて動作

## 持ち越し (Phase 13+)

- 他画面 (HOME / DECK / HISTORY / TUTORIAL / SETTINGS) も元モック比 30-50% 簡素化されている。CardsScreen と同様 rebuild の余地あり (調査結果より)
- カスタムデッキ → engine DeckSpec 変換 (現状 D08 / D11 専用)

---
date: 2026-05-28
title: Phase 11 — meta-app (5174) を src/ 実機ゲーム機能と統合
type: feat
scope: meta-app
---

## ユーザー要望

> 5173はそのままで5173と提供UIを統合させた5174を作成してほしかったんですよね

Phase 10 で完成した meta-app (port 5174) は完全独立アプリ・engineStub 模擬対戦だったため、ユーザー意図と齟齬。Phase 11 で `src/` を **完全不変** に保ったまま import 経由で実機エンジン・Playmat・モーダル群を 5174 内に取り込み、5173 体験と等価な実機対戦を 5174 上で成立させた。

## 主要変更 (meta-app/ のみ、~12 ファイル)

- **vite.config.meta.ts**: `@/*` → `../src/*` alias 追加 (既存 `@meta/*` 維持)
- **tsconfig.json**: `paths` に `@/*`, `rootDir: ".."`, `types: ["node", "vite/client"]`, `noUncheckedIndexedAccess: false` (src/ に合わせる)
- **main.tsx**: `registerAll()` を module top で呼出 (src/App.tsx と同パターン、bundle 単位で副作用分離)
- **shared/MetaCard.tsx**: 内部の `<CardSilhouette>` を `<CardArt cardId={card.num} />` に置換 → DECK / CARDS / HOME / SETUP / RESULT で公式画像 (or src 既存 fallback) 表示
- **util/deckBridge.ts** (新): meta `DeckRecord.id` → engine `DeckId` ('CT-D08' / 'CT-D11') 変換
- **screens/SetupScreen.tsx**: `engineStub.flow.simulateMatch` → `performGameStart({ selfDeckId, oppDeckId })` + `useGameStateStore.setGameState(gs)` (async, mulligan 経由)
- **screens/RealMatchView.tsx** (新): src/App.tsx (133 行) の Playmat + 14 modals + 4 driver hooks を 5174 内に配置 — `engine.read.game.result` で終局検知し ResultScreen へ自動遷移 (1.8s 遅延で VictoryOverlay を見せる)
- **screens/ResultScreen.tsx**: `useHistoryStore.byId` ベース → `useGameStateStore.gameState` 直読 + engine 統計 (turn / evidence / refresh / scratchTrace) 集計 + historyStore に 1 件記録 (StrictMode dedup)
- **screens/MatchPlaceholder.tsx**: 削除 (RealMatchView に置換)
- **App.tsx**: `case 'match'` を `<RealMatchView onMatchEnd={() => nav('result')} />` に
- **tests/e2e/golden-path.spec.ts**: 模擬経路 → 実機経路 (HOME → SETUP → READY → MulliganModal「引き直しなし」→ Playmat) に書き換え
- **tests/e2e/engine-stub.spec.ts**: simulateMatch 系テスト削除、validateDeck + localStorage 分離テストのみ残置
- **.claude/specs/meta-ui/10-integration-with-src.md** (新) + INDEX 登録

## 不変条件 (絶対遵守)

- `src/` 配下 **1 行も変更しない** (import のみ) — `git status -- src/ vite.config.ts tsconfig.json tests/` で確認
- 既存 5173 ゲーム挙動完全維持、既存 vitest + playwright e2e 全件無修正で緑

## 検証

- tsc + build green (bundle 581 KB)
- meta-app e2e 15/15 緑 (smoke 10 / golden-path 3 / engine-stub 2)
- 5174 で HOME → 「推理開始」 → SETUP → READY → MulliganModal「引き直しなし」 → 本物 Playmat 表示 → 終局 → ResultScreen 自動遷移
- カード画像が公式画像 (or src/cardImage の SVG fallback) になる

## 実装で踏んだ罠 (10-integration-with-src.md に記録)

- `include` で `../src/**/*` 指定は rootDir 違反 → `paths` のみで paths 解決 + `rootDir: ".."` で解消
- node types: `tsv-loader-fs.ts` 経路 → `types: ["node"]` 追加
- `setGameState(null)` は型不可 → `useGameStateStore.setState({ gameState: null })` で直接
- MulliganModal は `useMulliganStore` 経由のため、RealMatchView を pre-mount してから performGameStart 開始する必要あり (SetupScreen で `nav('match')` を先に実行)

## 持ち越し (Phase 12+)

- 任意 DeckRecord → engine DeckSpec 変換 (現状 D08 / D11 専用)
- HistoryScreen の MatchRecord 集計を engine.log ベースに精緻化 (contacts / hirameki / misread)
- ReplayScreen の実盤面再生 (engine.event.applyUntil 利用)

---
date: 2026-05-28
title: ネクストヒント step2 UI 実装 + 反復可能化 + HandZone pick-mode 統合 (BUG-080 / BUG-081)
type: fix
scope: ui
---

## ユーザー指摘

> ネクストヒントはそもそも挙動がおかしいので修正してほしい。

rules/12 を再確認した結果、**engine は正しい** が **UI に 2 つのバグ**:

- **[BUG-080](.claude/bugs/BUG-080.md)** (主因): NH step2 (カード使用) が UI に完全欠落。
  engine `runNextHint(state, p, optionalCardId)` は step1+step2 atomic 対応済だが、UI が
  `optionalCardId` を渡さず step1 (FILE→手札) のみ実行されていた
- **[BUG-081](.claude/bugs/BUG-081.md)**: NH button が初回使用後に永久 disabled。rules/12
  では「制限なし」(同ターン何度でも可、FILE が尽きるまで) だが UI が `nextHintUsed` で塞いでいた

## Option A 採択 (atomic, engine 不変)

骨格凍結原則準拠。engine の atomic 設計を尊重し、UI 側で「FILE-top + 使用可能手札」を
picker で事前提示、選択結果を 1 dispatch で渡す。

## 実装

### Phase 1: bug fix + 専用 modal (commit 9380314)

- **新規** [src/ui/hooks/useNextHintPicker.ts](src/ui/hooks/useNextHintPicker.ts) —
  Zustand store + Promise hook。`ask({fileTopCardId, fileTopName, candidates})` →
  `Promise<{kind:'use';cardId} | {kind:'skip'} | {kind:'cancel'}>` (useConfirmation 同型)
- **書換** [src/ui/hooks/useActionsPanelFlow.ts](src/ui/hooks/useActionsPanelFlow.ts)
  `runNextHintFlow`:
  1. FILE-top cardId 算出 ([mutate/file.ts popTop](src/engine/mutate/file.ts#L37) と同ロジック)
  2. postPopCount = (非アシスト FILE 枚数 - 1)。候補 = `[fileTopCardId, ...hand]` を
     `readDef.card(id)` で `level ≤ postPopCount` かつ 色 ⊆ 事件色 で filter
  3. `await useNextHintPicker().ask({...})` → use/skip/cancel に応じて dispatch 分岐
- **変更** [src/ui/components/ActionsPanel.tsx](src/ui/components/ActionsPanel.tsx) —
  新 prop `canNextHint` を受け `disabled: !canNextHint`。subtitle に「(使用済)」表示
- **変更** [src/ui/components/Playmat.tsx](src/ui/components/Playmat.tsx) —
  `canNextHint={engineFlow.canStartNextHint(gameState, 'self')}` を渡す
- 新 test: [tests/ui/hooks/useNextHintPicker.test.ts](tests/ui/hooks/useNextHintPicker.test.ts) /
  [tests/ui/hooks/useActionsPanelFlow.nextHint.test.ts](tests/ui/hooks/useActionsPanelFlow.nextHint.test.ts)

### Phase 2: UX 改善 — HandZone 統合 (commit db08c74)

ユーザ要望「**手札を拡大した UI で出せるカードを黄色枠でピックアップ選択したい**」反映。
専用 modal (NextHintPickerModal) を廃止し HandZone pick-mode を汎用化して再利用。

- [src/ui/components/HandZone.tsx](src/ui/components/HandZone.tsx) — `pickBannerText` /
  `pickableCardIds` / `pickSkipLabel` / `onPickCancel` / `pickCancelLabel` prop 追加。
  `pickableCardIds` 外は dim + 選択不可、内は黄色枠 (`.hand-card--pickable`)
- [src/ui/components/Playmat.tsx](src/ui/components/Playmat.tsx) — useNextHintPickerStore
  subscribe → NH pick 中は手札自動展開、FILE-top を合成カードとして手札末尾に追加、
  `onPickCard→acceptUse / onPickSkip→acceptSkip / onPickCancel→acceptCancel` に分岐
- `NextHintPickerModal.tsx/.css` 削除

## 検証

- typecheck clean / vitest 1615 PASS
- Playwright 実機 (console error 0):
  - **use** (FILE-top 合成カード選択): scene に 名乗り active 登場、FILE 3→2、
    `nextHintUsed=true`、`handUseUsed=false`
  - **skip**: step1 のみ (FILE-top 手札追加、scene 登場なし)
  - **cancel**: state 不変
  - **反復可能 (BUG-081 fix)**: NH 後も button enabled (FILE 2枚 使用済 表示)
  - **NH 後の通常手札使用 disabled**: 残0回 (rules/12 §Point 維持)
  - レベル/色不適合カード (D08009 Lv5) は dim + 選択不可

## 水平展開

- 既存 discard-pick (`effectPickResolve`) は pickableCardIds 未指定で全カード pickable の
  従来動作を維持、回帰なし
- ActionsPanel 全 button の disable 条件を audit 済、engineFlow.canXxx / state 値ベースで
  独自誤フラグ転用なし (NH のみが過去誤実装)

engine 変更ゼロ (骨格凍結原則準拠)。

---
date: 2026-05-25
title: HandZone pick mode + effectPickResolve 候補再解決 — discard pick が手札拡大表示で完結
type: feat
scope: ui / engine
---

## User 指摘 2 点を解決

1. **step 3 候補に step 2 で追加された card が含まれない** (BUG-078 既知 follow-up)
2. **hand pick も「手札拡大表示から選択」したい** (User vision を hand にも適用)

## 実装

### effectPickResolve cardId 再解決 (`src/ui/hooks/useEngineDispatch.ts`)

`pending.candidates` は queue push 時の snapshot。sequence の先行 step (例: D08013 step 2
evidenceToHand) で当該 area の内容が変化すると stale。`resolveCardIdFromPickUid` を導入:

- `evidence:<side>:<idx>` → 現在の `gameState.players[side].evidence[idx].cardId`
- `<cardId>#<idx>` → uid prefix の cardId をそのまま使用

これにより queue 時に存在しなかった card (step 2 で追加された hand card 等) も pick 可能に。

### HandZone pick mode (`src/ui/components/HandZone.tsx`)

- `pickMode?: boolean` / `onPickCard?: (uid) => void` props 追加
- pick mode 時、expanded view の各 card cell が click → `onPickCard(`<cardId>#<idx>`)`
- 既存 onCardClick (手札使用) は suppress

### Playmat 自動 expand (`src/ui/components/Playmat.tsx`)

- `pendingEffectPick.atomVerb === 'discard'` を `isDiscardPick` で検出
- useEffect で `handExpanded = true` に自動 set
- HandZone に `pickMode={isDiscardPick}` と onPickCard を pass through

### EffectPickerModal: discard も非表示 (`src/ui/components/EffectPickerModal.tsx`)

- `AREA_PICK_VERBS` に 'discard' 追加 → discard pick 時は HandZone 拡大表示に譲る

## 動作確認 (Playwright)

D08013 a1 を実機 play:

1. step 1 evidenceGain (+D08015 to evidence)
2. CardListModal で「(非公開)」click → 証拠 0 / 手札 7 枚 (末尾に D08015 追加)
3. **HandZone 自動 expand**、step 3 discard pick mode active
4. 7 枚目 cell (step 2 で追加された D08015) を click → 手札 6 枚 / リムーブ +D08015 ✓
5. BUG-078 follow-up 解消: queue 時に無かった card も pick 可能

## 検証

- vitest 1578 PASS / 1 skipped
- typecheck clean
- Playwright 実機: D08013 a1 全 3 step 完全動作、step 2 で追加された card も step 3 で選択可能

---
date: 2026-05-25
title: CardListModal pick mode 統合 — evidence pick が証拠エリア展開 UI で完結 (User vision 実現)
type: feat
scope: ui
---

## User vision: CardListModal を pick UI として流用

ユーザー指摘 (BUG-077 後): 効果対象選択モーダル (EffectPickerModal) は裏向き証拠
でも cardId/カード名が見えてしまう。一方、証拠エリアを click した時の展開モーダル
(CardListModal) は「非公開」と正しく扱える。

→ CardListModal を pick UI として流用する設計が望ましい。

## 実装

### CardListModal (`src/ui/components/CardListModal.tsx`)

- `pickCands?: Array<{uid, cardId, player}>` と `onPick?: (uid) => void` props 追加
- pick mode 時、face-down cell (evidence) は `evidence:<side>:<idx>` の uid 一致で
  click 可能な button に変換 → onPick 発火
- face-up cell (remove 等) は `<cardId>#<idx>` 合致 + fallback で uid 解決
- CSS: `.card-list-item--pickable` で 金色 border + hover scale ハイライト

### Playmat (`src/ui/components/Playmat.tsx`)

- `useEffect` で pendingEffectPick.atomVerb を監視:
  - `evidenceToHand` → `areaModal = {kind:'evidence', side:'self'}` を auto-open
  - `handAddFromRemove` → 同 `kind:'remove'`
- pick が消えた (resolve 後) ら auto-close
- CardListModal に pickCands / onPick を pass through

### EffectPickerModal (`src/ui/components/EffectPickerModal.tsx`)

- `AREA_PICK_VERBS = {evidenceToHand, handAddFromRemove}` を skip
  → 該当 pick 時は本 modal を表示しない (CardListModal に譲る)
- scene char / 他のキャラ pick (sceneRemove 等) は引き続き本 modal を使用

## 動作確認 (Playwright)

D08013 a1 を実機 play:

1. 手札使用 → 場登場 → step 1 evidenceGain (+D08015 to evidence)
2. **「自分の証拠エリア (1 枚)」CardListModal が自動 open**、「(非公開)」button が金色ハイライト
3. click → 証拠 0 / 手札 +D08015 ✓
4. step 3: 「効果対象を選択」EffectPickerModal が表示 (hand pick)
5. 円谷光彦 click → 手札 -D08011 / リムーブ +D08011 ✓

## 検証

- vitest 1578 PASS / 1 skipped
- typecheck clean
- Playwright 実機: D08013 a1 全 3 step 完全動作、CardListModal で pick 完結

## 残課題

- discard (hand pick) は EffectPickerModal を使用 → HandZone 直接 click 化は別 task
- card-list-pick-* testid 命名で E2E test 安定化可

---
date: 2026-05-25
title: BUG-078 修正 — side-channel queue 化で multi-PB pick sequence の step 3 modal 表示
type: fix
scope: engine / ui
---

## BUG-078: D08013 a1 step 2 解決後 step 3 modal が出ない問題

D08013 a1 = `[evidenceGain, evidenceToHand, discard]` の 3 step sequence で、step 2
(evidenceToHand) 解決後に step 3 (discard) の modal が出ず、効果が完結しない不具合。

## 採用方針: side-channel の queue 化

従来 `__pendingEffectPickSide` は単一スロット (objet | null)。BUG-075 由来の「上書き
しない」guard により sequence 内で複数の PB pick atom があっても 1 つしか保持できない
設計。**FIFO queue 化** することで複数 awaiting を順次保持・順次消化。

### 変更

`src/engine/effect/resolve-picks.ts`:

- `__pendingEffectPickQueue: PendingEffectPickSide[]` 新設 (legacy `__pendingEffectPickSide`
  は queue[0] を反映する read-only compat property)
- `pushPendingEffectPickSide` (末尾 push) / `_drainPendingEffectPickSide` (FIFO shift)
- BUG-075 由来の「既に set 済みなら上書きしない」guard 削除 (queue 化で再発不能化)
- `_clearPendingEffectPickQueue` / `_peekPendingEffectPickQueueLength` / `_pushPendingEffectPickSideForTest` (テスト用)

`src/ui/hooks/useEngineDispatch.ts`:

- effectPickResolve 時の post-drain: 「current 消化済 → queue 先頭を反映 (空なら null)」

### 検証

- 新規 test Phase H (`bug-077-evidence-to-hand-e2e.test.ts`): D08013 a1 同型 sequence の
  初回 drain で queue に step 2 + step 3 両方が push されることを assert
- 既存 test 更新: BUG-075 不変 (上書きしない) → 「queue 末尾 push」不変に書き換え、
  side-channel 直接 read を `_drainPendingEffectPickSide` 経由に
- vitest 1578 PASS / 1 skipped、typecheck clean、smoke 1000 戦 0 例外
- Playwright 実機: D08013 a1 → step 2 modal → 選択 → **step 3 modal 自動表示** →
  選択 → 完了 (evidence=0、hand=6、remove=[discard 対象])

### 既知の限界 (follow-up)

step 3 discard 候補は **初回 drain 時の hand**。step 2 で hand に追加された evidence card は
step 3 候補に含まれない。実害は薄いので別 task。

### 関連 BUG

BUG-075 (上書きしない不変、queue 化で置換) / BUG-076 (連続 pick の tryRePickFromAtom) /
BUG-077 (step 2 silent skip 修正)

---
date: 2026-05-24
title: Pattern B atom 短縮形対応 — `{player, n}` だけでカードが書けるように (D08013 で実証)
type: feat
scope: engine / cards
---

## 物理動作 atom 短縮形

カード DSL を「公式テキストの動詞列をそのまま atom 呼出列に翻訳するだけ」にするため、Pattern B atom (`evidenceToHand` / `discard` / `handAddFromRemove`) に **target 省略形** を導入。

### Before / After

```typescript
// Before (D08013 a1 step 2): 11 行の冗長な pick query
{
  kind: 'atom', verb: 'evidenceToHand',
  args: { player: 'self', target: {
    kind: 'pick',
    query: { area: 'evidence', side: 'self' },
    n: { min: 1, max: 1 },
    chooser: 'self',
  } },
}

// After: 1 行
{ kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', n: 1 } }
```

D08013.ts 全体: 89 行 → 53 行 (40% 圧縮、`choice` ラップも除去できた)。

### 仕組み

- `src/engine/effect/resolve-picks.ts`:
  `substituteAtomPick` で `target === undefined && typeof n === 'number'` の場合、
  verb 既定 (`PB_DEFAULT_PICK_AREA`: evidenceToHand → 'evidence' / discard → 'hand' /
  handAddFromRemove → 'remove') で pick query を補完。
- `src/engine/effect/atom-handlers.ts`:
  defensive coding として atom-handler 側でも同様の `defaultPickTarget` 補完。
  直接 `runAtom` を呼ばれた場合 (test 等) でも短縮形を受け付ける。
- AI 経路: `picked.kind === 'evidence'` の場合 `state.players[p].evidence[i].cardId` を pickValue に採用 (旧コードは null フォールバックで諦めていた)。
- Human 経路: 既存 BUG-077 fix の挙動を維持 (初期 walk では side-channel set せず、runtime tryRePickFromAtom 経由のみ)。

### 検証

- 新規 test Phase F (`tests/engine/effect/bug-077-evidence-to-hand-e2e.test.ts`):
  短縮形 `{player, n}` で human 経路 runtime に side-channel が evidenceToHand 用に正しく set
- 新規 test Phase G: 短縮形 + AI heuristic 経路で target が cardId 配列に解決
- vitest 1577 PASS / 1 skipped (新規 2 件追加)
- typecheck clean、smoke 1000 戦 0 例外 (winsA=511/winsB=489)
- Playwright 実機: D08013 a1 step 2 で evidence cardId='D08007' が modal 表示、選択後
  evidence=0 / hand に D08007 追加を確認

### 後続

- D08015 等の他 PB 利用カードへの短縮形移行 (人間が実装担当時に随時)
- BUG-078 (step 3 modal) は引き続き未解決、別途対応

---
date: 2026-05-23
title: BUG-077 修正 — Pattern B 初期 walk side-channel 抑止 + 後続 BUG-078 起票
type: fix
scope: engine / bugs
---

## BUG-077: D08013 a1 step 2 evidenceToHand が UI 経路で適用されない問題の本格修正

Playwright 実機 trace で root cause を特定し、`resolveEffectPicks` の Pattern B 初期 walk
ロジックを修正。

### 真の root cause (BUG-077 Phase 2)

`triggered.ts` の `resolveEffectPicks(humanChooser=true)` 初期 walk:

| step | atom | 初期 walk cands | 結果 |
| --- | --- | --- | --- |
| 1 | evidenceGain | n/a (no pick) | execute later |
| 2 | evidenceToHand PB | 0 件 (evidence empty) | side-channel set せず |
| 3 | discard PB | 5 件 (hand) | **side-channel set** |

→ runtime drain で step 2 awaiting-pick の tryRePickFromAtom が globalThis set 済で bail。
UI に表示される modal は step 3 (discard / hand pick) だが、ログは step 2 (evidenceToHand)
も出るので「ログには出るが state 反映されない」状態に。

### 修正内容

`src/engine/effect/resolve-picks.ts`:

- `ResolveEffectPicksOpts._fromAtomHandler` を追加 (default false)。
- `tryRePickFromAtom` は `_fromAtomHandler: true` を渡す。
- `substituteAtomPick` の humanChooser 分岐に Pattern B 抑止条件追加:
  `if (isPatternB && !opts._fromAtomHandler) return atom`
- → 初期 walk では PB の side-channel set を抑止、runtime atom-handler 経由でのみ set。
- → Pattern A は引き続き初期 walk で set (runtime に awaiting-pick path 無いため)。

`tests/engine/effect/bug-077-evidence-to-hand-e2e.test.ts`:

- Phase E test 追加 (sequence [evidenceGain, evidenceToHand PB, discard PB] の初期 walk
  が PB side-channel を set しないこと、runtime drain で step 2 用が set されること)。

`tests/engine/effect/resolve-picks.test.ts` / `pattern-b-cards.test.ts`:

- humanChooser 初期 walk の side-channel set test を新仕様 (`_fromAtomHandler: true` で
  runtime path を test) に update。

### 検証

- vitest 1575 PASS / 1 skipped (新仕様 + Phase E test 追加)
- typecheck clean
- smoke:1000 timeouts=0 exceptions=0 winsA=511 winsB=489
- Playwright 実機 verify: D08013 a1 step 2 で modal に evidence (cardId 'D08007') が
  正しく表示、選択後 evidence=0 / hand に D08007 追加。

### 後続課題 → BUG-078 起票

step 2 解決後、step 3 (discard) modal が表示されない問題は別途 BUG-078 として起票。
原因: `effectPickResolve` dispatch が resolved step 2 atom を単発 queue するだけで、
sequence の残り step を再 queue する仕組みが無い。BUG-076 の tryRePickFromAtom 追加は
step 2/3 modal chain を意図していたが、resolved 後の re-queue 部分が未実装だった。

---
date: 2026-05-23
title: pattern B atom resolver 拡張 + 5 連続 incomplete fix 解消 + BUG-077 RCA
type: fix
scope: engine / ui / bugs
---

## D08015 / D08013 起点の resolve-picks pattern B 系譜 (BUG-065 〜 077)

D08015 (小嶋元太) ワークフロー作成依頼から始まる cascade。最終的に 9 新規 BUG 起票 + 既存 5 件訂正 + 17 commit。

### 修正完了 (engine + UI 修正)

- **BUG-065** (`8c2f3e2`): resolve-picks pattern B (uid なし + target.kind='pick') 対応で D08015 a1 step 2 discard が動作
- **BUG-071** (`37ffb3a`): triggered listener の sequence 全体 queue skip 廃止 → pre-pick step (draw 等) 実行
- **BUG-072** (`6297ed4`): effect log + ACTION_LABEL 30 件追加で動作可視化
- **BUG-073** (`6c6d685`): 全 atom (25 種) に effect log + pattern B カード 5 件水平展開 unit test
- **BUG-074** (`4f72085`): evidenceToHand / handAddFromRemove の target string\|array 両対応
- **BUG-075** (`ac2cfe6`): side-channel 上書き防止 (sequence 内複数 pattern B)
- **BUG-076** (`8d18c4f`): tryRePickFromAtom + evidence kind 対応で連続 modal flow

### 起票 (未着手 / 対応中)

- BUG-067〜070 (未着手): 4 agent audit で発覚した残課題 4 件 (case declared limit / resolveBindRef 拡張 / LogPanel uid 解決 / BUG-009 残 4 項目)
- BUG-077 (対応中、`f022d72`): D08013 a1 step 2 が UI 経路で evidence -1 / hand +1 反映されない (engine logic は 4/4 test PASS、UI trace 要)

### メタ修正

- BUG-066 起票: claude 自己検証漏れの記録、4 点 verify protocol 明文化
- LESSONS-LEARNED 教訓 11 追加: 「修正済」transition の 4 点 verify (公式テキスト必読 / 関連ファイル現状確認 / 警告語句 grep / memory observation 検索)
- BUG-035/045/048/053/054: 「修正済」過大 claim を訂正、BUG-065 で初完全動作を追記
- AUDIT-2026-05-23.md: 全 BUG audit 集約 report
- D08015-workflow.md / D08013-workflow.md: 簡易フローチャート作成
- WORKFLOW-GUIDELINES.md: カード処理ワークフロー図ガイドライン新規

### 検証

- vitest 1573 PASS / 1 skipped (1567 + 6 new BUG-073 + 6 new BUG-074 + 4 new BUG-077)
- typecheck clean
- smoke:1000 timeouts=0 exceptions=0 winsA=511 winsB=489 (バランス維持)

## user_request 20260522_01 — 16 件 + AUDIT 派生 + Phase 5/6 (2026-05-22)

`user_request/20260522_01.txt` の 16 件ユーザー指摘 + AUDIT 派生 + 追加 Phase
を 1 セッションで完了。**新規 BUG ticket 15 件 (BUG-049〜063)** + 既存 12 件
commit hash 補填 + 既存 9 件 status 正規化 + BUG-036 deck-out 配線 + 4
audit/doc 成果物 + 80+ commit を origin/main へ push。

### Tier 1 — engine 整合性バグ (6 件)
- BUG-049 (`4d32418`) — action[事件] ガード時の証拠誤変動 (#8)
- BUG-050 (`cdc0725`) — FILE 7+ で auto-phase 経路から解決編移行 (#4/#16)
- BUG-051 (`d558f8c`) — 事件カード能力 (scope='always' + findCardOnBoard) (#5)
- BUG-052 (`f85edfe`) — D11019「??」 (bind ref $matched.cardId/uid 解決) (#12)
- BUG-053 (`7b1e86b`) — human auto-pick 停止 (#2/#6 基盤)
- BUG-054 (`bacc22b`) — EffectPickerModal + driver + effectPickResolve dispatch

### Tier 2 — UX 改善 (6 件)
- BUG-055 (`4d24567`) — cutin picker に actor カード名 (#7)
- BUG-056 (`761d46a`) — 手札カード 🔍 虫眼鏡 button (#9)
- BUG-057 (`52a2adf`) — リムーブ/FILE/証拠 個別カード拡大 (#11)
- BUG-058 (`ca23f9e`) — SpectatorHUD 5/10秒 preset 拡張 (#14)
- BUG-059 (`094805b`) — CPU 可視化 spec doc 4 案 (#15)
- BUG-060 (`78a93f2`) — LogPanel target を カード名解決 (#3)

### Tier 3 — 調査 / 質問対応 (3 件)
- BUG-001〜060 audit (`2db6bf5`) → AUDIT-2026-05-22.md + LESSONS-LEARNED.md
- user-request-clarifications.md #10 hint Q&A + #13 NH 仕様再確認 (`9fd65f8`)

### Tier 4 — AUDIT 派生 + defer 実装 + 追加
- DeckRevealOverlay (BUG-061 `2894c61`) — D11019 演出 UI
- effect-pick E2E test (`80d91fd`) — BUG-054 regression 防止
- RecentActionToast queue 化 (BUG-062 `5394ee4`) — CPU 可視化 案 1
- commit hash 12 件補填 (`9b36f5f`)
- BUG-template + scripts/lint-bug-frontmatter.ts (`ebeebed`)
- side-channel-pattern.md (`f53598c`) — 4 点 checklist
- category enum migration 29 件 → warns=0 (`bf19605`)
- SpectatorHUD 人間 vs CPU 展開 (BUG-063 `99f6c0c`) — 案 2

### Phase 5: BUG-036 deck-out 敗北条件配線 (`1480465`)
`mutate/deck.ts:draw()` で refresh 失敗時 `gameResult.set(opp, 'deck-out')`
配線。既存 gameResult 上書き gate + test 3 件追加。

### Phase 6: 全 9 BUG status 正規化 (`a68f58b`)
「対応中・見送り・仕様外」9 件を実体確認後 修正済 status に正規化。
**全 62 BUG が 修正済**、lint:bugs errors=0 / warns=0 達成。

### 数値
- vitest 1551 PASS / 1 skipped (1547 → 1551、+4)
- E2E 53 PASS / 1 skipped (51 → 53、+2)
- smoke 1000 戦: avg 10.64 / 0 timeout / 0 exception (baseline 維持)
- lint:bugs: 62 BUG / errors=0 / warns=0
- typecheck clean

### 新規教訓 (LESSONS-LEARNED.md に追加)
- 教訓 8: `ok:false` 戻り値の Hook 委譲は配線漏れを生む (BUG-036)
- 教訓 9: BUG status は二択厳守、注釈付き status 禁止 (lint で error 化)
- 教訓 10: Python re.sub の f-string + `'\\1\n'` は backref が `\x01` に壊れる

## Phase 9-G.2 — リプレイ UI 層 (2026-05-22)

commit (TBD)。Phase 9-G.1 (engine 側 ReplayLog 機構) で完成した record/replay
API に UI 層を追加。

### Added

- `src/ui/hooks/useReplayDriver.ts`: playback hook
  - state: log / currentMoveIndex / isPlaying / speedMs
  - API: loadLog / unloadLog / play / pause / step / seek / setSpeed
  - 各 step で `initialState から moves[0..N] を apply` して GameState を再構築、
    store に書き込み → Playmat が re-render
- `src/ui/components/ReplayPanel.tsx` / `.css`: 上部固定 toolbar
  - play/pause toggle / 1 step button / seek bar (HTML range) / 4 速度 preset
    (200/600/1500/3000ms) / 現在 move 情報 / close button
  - z-index 9100 (OppTurnOverlay より上、Modal より下)
- `src/ui/components/GameSetupModal.tsx`: optional `onLoadReplay` prop +
  `<input type="file">` (JSON ピッカー)
- `src/App.tsx`: useReplayDriver + ReplayPanel mount + GameSetupModal に
  loadLog 配線
- `tests/e2e/replay-ui.spec.ts` (新規 3 tests): GameSetupModal label /
  file event 経由 loadLog / step + speed + close 動作

### 検証

- vitest UI 378 PASS / 1 skipped (regression なし)
- E2E 全 51 PASS / 1 skipped (replay-ui +3)
- typecheck clean

### Out of Scope (defer)

- リプレイ JSON ファイル保存機能 (record→download button) — Phase 9-G.3
- 部分 replay / branching — Phase 9-G.3
- speed slider のスムーズ変化 (現状 4 preset)

## user_request 20260521_01 triage Phase ε — #18 card audit umbrella (2026-05-22)

commit `9f126c7`。#18「カードごとに個別実装した処理がきちんと機能していない
(umbrella)」を audit。

### 結論

**新規 BUG 起票無し**。Phase α/β/γ (BUG-040/041/045 修正) で実質的に解決済
であることを 3 軸で確認。

### Audit 結果

- **vitest tests/cards/**: 46 test files / 176 tests 全 PASS
- **playwright tests/e2e/patterns/**: 35 pattern tests 全 PASS
- **smoke 1000 戦**: avg 10.64 turn / p95 13 / 0 timeout / 0 exception

CT-D08 27 枚 + CT-D11 22 枚を P1 (declared) / P2 (appear) / P3 (contact-effect)
/ P4 (no-test) で分類、Tier 1 (multi-pattern) 7 枚 / Tier 2 (P1 単体) 9 枚 /
Tier 3 (P2 単体) 8 枚 はすべて既存テスト + smoke で機能確認。

P4 (no-test) 13 枚は全て **絵柄違い variant** (`...DXXXXX` で他カードの def
継承) または **能力なし partner** (D08002)。独立テスト不要であることを確認。

詳細は [.claude/specs/cards-analysis/AUDIT-USER-REQUEST-18.md] 参照。

### user_request 20260521_01 全 18 件 完了 🎉

| Phase | 件数 | 内容 |
|-------|------|------|
| α | 6 件 | #2 / #5 / #6 / #10 / #11 / #14 (公式裁定確認 + 運用 doc 整備) |
| β | 6 件 | #1 / #4 / #7 / #8 / #13 / #15 / #16 / #17 (BUG-037〜044) |
| γ | 1 件 | #9 (BUG-045 1 試合通し E2E + spectator stall) |
| δ | 2 件 | #3 (contact UX) / #12 (spectator HUD + heuristic) |
| ε | 1 件 | #18 (card audit umbrella) |

## user_request 20260521_01 triage Phase δ — #3 contact UX + #12 spectator HUD (2026-05-22)

commits `cc3a605` / `98efb82` / `49a7063` / `4b654fd` / `25589ad` / `f1b3ebc`。
#3 contact UI driver と #12 spectator speed / hand-use heuristic を解決。

### #3 相手ターン中の contact 処理 — verify + UX 改善

- BUG-044 (`5ffed7c`) と BUG-045 (`9169af4`) の修正で構造的に動作することを
  Playwright headed + 既存 vitest (useContactFlowDriver.test.ts) で確定
- `OppTurnOverlay` を強化: activeActionId 中は attacker → target (phase 名)
  を具体表示 (cc3a605)
- E2E spec `tests/e2e/opp-turn-contact.spec.ts` を新規 (98efb82): 3 シナリオ
  (guard modal / cutin modal / case ターゲット表示) で回帰防止

### #12 観戦モード speed + AI 手札使用 改善

- `store.aiSpeedMs` + `SpectatorHUD` 新規: 200/400/800/1500/3000ms の
  5 preset + 現在値表示 (49a7063)
- `store.isAiPaused` + `aiStepCounter` + pause/step ボタン: paused 中は AI
  進行停止、step button で 1 cycle (opp + self) 進める (4b654fd)
- `handUseCard` heuristic を sparse-aware 化: scene < 3 で character を
  AP+LP*1.5 score で優先、scene >= 3 で event 優先 (25589ad)
- E2E spec `tests/e2e/spectator-speed.spec.ts` (f1b3ebc): 3 シナリオ

### Metrics

- smoke 1000 戦: avg 11.19 → 10.64 (アグレッシブ化 / max 19→16 で variance 改善)
  winsA 50% → 51.1% (許容範囲)
- ユニット 1522 PASS / 1 skipped (改修前から +9 tests)
- E2E 48 PASS / 1 skipped (改修前 42 から +6 = 3 opp-turn-contact + 3 spectator-speed)

## Round 4l — UI 4 課題一括対応 (2026-05-22)

commit `5716953`。**未着手 BUG ゼロ達成** 🎉

### Added
- BUG-001 カード拡大 modal: `CardExpandModal` + `useCardExpandModal` hook + Playmat onExpand 配線で 3 zone click で拡大表示
- B5 観戦モード: `spectatorMode` store field + `useSpectatorTurnDriver` + GameSetupModal「観戦モード (AI vs AI)」 button
- BUG-010 OppTurnOverlay action 表示 + MAX_MOVES 安全上限 200 手 明示

### Fixed
- BUG-002 edition tag 隙間 (1-line CSS fix)

## user_request 20260521_01 triage Phase γ — 1 試合通し E2E + spectator stall (2026-05-22)

BUG-045 として user_request #9 + 観察「コンタクトでカットインポップアップで
止まる」を一括対応。E2E で更に engine bug 2 件発覚 → 即修正。

### Added
- `tests/e2e/full-match.spec.ts` — spectator mode で mulligan → 終局 (or
  max-turn) まで一貫検証する 1 試合通し E2E。今後の「Playmat 配線漏れ」
  pattern 予防

### Fixed
- BUG-045 spectator AI vs AI で contact 発生時 cutin/guard modal hang →
  `useContactFlowDriver` に `spectatorMode` 委譲を追加、self も AI 判定
- engine `deckRevealUntil` atom: filter object を function として呼んでいた
  `TypeError: filter is not a function` → TargetFilter → predicate 変換 helper
- engine `discard` atom: target pick query を string[] 扱いで
  `TypeError: ids is not iterable` → 防御 skip (本格対応は別 BUG)

### Notes
- Playwright headed: spectator AI vs AI で turn 12 / winner=self / console
  errors 0 で正常完了
- smoke 1000 maintained: avg 11.19 / 0 timeout / 0 exception
- engine 2 bug は smoke では到達しない atom path、E2E が初めて検出

## user_request 20260521_01 triage Phase α + β (2026-05-22)

ユーザー指摘 18 件のうち **13 件解決**。

### Fixed
- `9567c0c` BUG-037 SceneArea.css animation fill-mode (sleep CSS、#1 / #16)
- `152253d` BUG-038 仕様外 close (BUG-037 で間接解決、#7)
- `d823f7f` BUG-040 Playmat.tsx `declaredTargetCount` ハードコーディング修正 (declared ability、#15)
- `a96f900` BUG-041 `canUse` に switch fallback 追加 (hand-use switch、#13)
- `cd2d161` BUG-043 HandZone 右クリック → CardExpandModal (hand expand、#8)
- `5ffed7c` BUG-044 heuristic に reasoning vs case attack スコア比較、「劣勢時 disruption only」(AI case attack、#4)

### Added
- `db0cd9b` BUG-042 GameSetupModal にデッキ選択 dropdown 追加、`buildDeckPair({selfDeckId, oppDeckId})` 新 API (deck select、#17)

### Changed
- `8d33d03` Phase α 6 件 (#2 #5 #6 #10 #11 #14): 公式裁定確認 + 運用 doc 整備
  - `.claude/docs/user-request-clarifications.md` 新設 (#5 解決編 / #6+#14 NH は公式 PDF p.12-13 引用で「現実装が正しい」と確定)
  - `.claude/specs/DEFERRED-INDEX.md` / `.claude/bugs/README.md` 新設
  - CLAUDE.md「効率より精度」方針追加 (#2)

### Notes
- **主要パターン発見**: BUG-040/041/042/043 すべて「engine + flow + picker は完成しているのに Playmat.tsx の prop 配線漏れで UI 側だけ動かない」同一 pattern (4 件)
- 残 5 件は規模大で別セッション (#3 contact UI driver / #9 E2E / #12 AI speed slider / #18 audit umbrella)

## Phase 7-3 — AI policy verb 別ヒューリスティック (2026-05-21)

commit `2b49942`。

### Changed
- AI policy `chooseAtomTarget` を verb 別ヒューリスティックに分割: sceneRemove / sceneSetState / charModifyAP / charModifyLP 別戦術
- unit test +14、E2E 期待更新

## Phase 9-H — パフォーマンス計測 (2026-05-21)

commit `3d6c103`。avg 0.19ms / 100ms target の 200x 余裕。

### Added
- `MatchOpts.profile` + `--profile` smoke オプション
- `npm run benchmark` + per-turn p50/p95/p99 計測

## Phase 9-G.1 — リプレイ機構 engine 側 (2026-05-21)

commit `6e835f8`。

### Added
- `src/ai/replay/recorder.ts` + `player.ts`
- record → replay 完全再現

## Phase 9-F MVP — MCTSPolicy (rollout-based) (2026-05-20)

commit `3836d65`。⚠️ 33% vs 63% で AI 強度低下、Phase 9-F.2 で tuning 予定。

### Added
- `src/ai/policies/mcts.ts`
- MCTS vs Heuristic ベンチマーク

## Phase 7-2 — 汎用 $pick substitution (2026-05-20)

commit `3f50e99`。BUG-035 を汎用化、9 cards 完全カバー。

### Added
- recursive `resolveEffectPicks` utility

### Changed
- triggered.ts / hiramekiResolve を resolveEffectPicks にリファクタ
- unit test +9

## Phase 7-1 — hirameki 経路 $pick 最小修正 (2026-05-20)

commit `4bf79a1`。共通パターン spec 6/6 達成。

### Fixed
- BUG-035 hirameki 経路最小修正: `resolveHiramekiPick` + fire test を sleep 検証に upgrade

## Round 4k — hiramekiCharStun (2026-05-19)

commit `f50028f`。共通パターン spec **6/5 拡張**。

### Added
- `hirameki-char-stun.spec.ts` 7 tests (D08019 a2 / D11009 a3)
- BUG-035 登録 ($pick auto-resolution Phase 7 deferred)

## Round 4j-fix — BUG-034 真因再診断 + spec 拡張 (2026-05-19)

commit `52f2b61`。

### Fixed
- BUG-034 真因 = `useHiramekiFlowDriver` の auto-resolve race → fixture 反転で test-isolation
- hirameki-draw.spec.ts 3 → 7 tests に拡張
- 防御的改善: globalThis 側 side-channel + engine namespace re-export + misread 水平展開

## Round 4j — hiramekiDraw shape + BUG-034 検出 (2026-05-19)

commit `4dd2cd8`。**共通パターン spec 5/5 完了** 🎉

### Added
- `hirameki-draw.spec.ts` 3 tests
- BUG-034 登録

## Round 4i-fix — BUG-032/033 engine 修正 (2026-05-19)

commit `6a372a9`。

### Fixed
- BUG-032 `eventRemoveByAP` factory + D11019/D11020/D08024 a1 に `selfOnly:true` 水平展開
- `selfOnlyMatches` の hand 経路に player 比較追加
- BUG-033 `triggered.ts handleHook` に condition gate (`evalCond`) 追加
- unit/E2E +4

## Round 4i — eventRemoveByAP + BUG-032/033 検出 (2026-05-19)

commit `8d35359`。

### Added
- `event-remove-by-ap.spec.ts` 4 tests (D08025 factory pure / D11020 individual sequence)
- BUG-032 (`eventRemoveByAP` trigger.selfOnly 未設定 → opp 手札の同 cardId が誤発動)
- BUG-033 (triggered.ts handleHook が ability.condition 未評価)

## Round 4h — caseTraitConditioned + BUG-031 (2026-05-19)

commit `08621c0`。

### Added
- `case-trait-conditioned.spec.ts` 4 tests (D11003 a2 / D11005 a1)

### Fixed
- BUG-031 D11021 traits に '婚活' 追加 (engine データ不整合修正)

## Round 4g — BUG-030 engine 修正 (2026-05-19)

commit `3932d04`。**smoke baseline 525/475** (avg turns 10.35 → 9.85)。

### Fixed
- BUG-030 `src/engine/read/char.ts` の `keywords()` に continuous modifier resolver 実装
- unit test +5、E2E spec 4-layer 拡張

## Round 4f Phase 2 — partnerColorKeyword + BUG-030 検出 (2026-05-19)

commit `4eb103a`。

### Added
- `partner-color-keyword.spec.ts` 6 tests、5 カード集約 (D08009/D08022/D11007/D11009/D11011)
- BUG-030 登録 (engine `read.char.keywords` が continuousModifier.grantKeywords を resolve しない、Phase 5 未実装)

## Round 4e Phase 1 — E2E helpers + cutinFixedAP (2026-05-18)

commit `cf3380c`。

### Added
- `tests/e2e/helpers/` 共通基盤 (types/setup/state/assertions/index)
- `cutin-fixed-ap.spec.ts` 6 カード集約 (D08015/D08017/D08023/D11017/D11018/D11019)

## Round 4d — Playwright 可視化 + 履歴移行 + BUG-029 (2026-05-18)

commit `f38268c`。

### Changed
- Playwright **headed default** (`headless: !!process.env.CI`) で「真っ白」問題解消
- Round 2 18 件バグを BUG-011〜BUG-028 に履歴移行

### Fixed
- BUG-029「現場カード sleep 反映なし」を Round 4c で副次解消と確定し Vitest 統合 2 + E2E 2 で回帰防止

## Round 4c — BUG-006 修正 + E2E 基盤 (2026-05-18)

commit `d54e328`。

### Fixed
- BUG-006 store.dispatch で same-reference 時 shallow copy 強制 → ContactFlowDriver useEffect を起動

### Added
- `@playwright/test` 実機 E2E 基盤 (`playwright.config.ts` + `tests/e2e/bug-006.spec.ts` + `window.__game` DEV expose)
- dispatch-to-state.test.ts に BUG-006 2 case

## Round 4b — triggered ability 汎用 listener (2026-05-18)

commit `4c64c79`。

### Added
- triggered ability **汎用 listener** (`src/engine/listeners/triggered.ts` 新規、7 hook 配線)
- emit payload kind 分離 (eventRemoveByAP matcher と整合)

## Round 4a — 重大バグ engine 3 fix + RCA + Obsidian Base 化 (2026-05-18)

commit `e10b3a4`。

### Fixed
- BUG-008 イベントカード手札残留
- BUG-009 FILE 7+ 解決編移行
- next-hint 水平展開

### Added
- リスク・バグ管理を **Obsidian Base** 化 (`.claude/bugs/` + 2 base)
- 再発防止 spec: `card-addition-checklist.md` / `dispatch-to-state.test.ts`
- CLAUDE.md §セルフレビュー追記

## Phase 5 advance — SceneSwitch / Hirameki / Misread / Souza (2026-05-17 〜 18)

### Added
- SceneSwitch: rules/20 §スイッチ engine + AI + UI (`6625283` / `1421772`)
- Hirameki: rules/10 E2E 結合 + listener bug fix (`75fe5f4`)
- Misread: rules/13 §ミスリード E2E (Human defender) + bug fix (`9070556`)
- Souza: rules/13 §捜査X engine atom + AI auto-order (`59183f4`)

### Notes
- Misread UI (`35a0736`) は MVP デッキで dormant
- Souza Sub-task B/C は MVP デッキで souza 使用カード皆無を確認、公式 defer (`a14b62b`)

## Phase 5 advance prep (2026-05-17)

commit `5cdc3bb`。

### Added
- [guardrails spec](.claude/specs/2026-05-17-phase5-advance-guardrails.md) 起草

## Phase 9-E — UI 細部 (2026-05-17 頃)

### Added
- deck low-stock 表示 / FILE progress-7 完了 / opp 手札 mini back 統一

## Phase 9-D — 表示細部 (2026-05-17 頃)

### Added
- case 向き auto-detect / partner 拡大 / hand 色あせ / Remove 画像 / Evidence ↔ FILE swap

## Phase 9-C — カード画像 UI 統合 (2026-05-17 頃)

### Added
- CardArt component + useCardImage hook

## Phase 9-B — engine 4 バグ修正 + Heuristic チューニング (2026-05-17)

### Fixed
- engine 4 バグ + node:fs 分離 hotfix

### Changed
- Heuristic AI チューニング

## Phase 9-A — 1000戦 smoke baseline (2026-05-17)

[smoke-2026-05-17.md](.claude/reports/smoke-2026-05-17.md)。

### Added
- 1000戦 AI vs AI smoke harness ベースライン

## Round 3c — B7 チュートリアル矢印機構 (2026-05-15 頃)

commits `f362175` + `c8118d0`。

### Added
- チュートリアル矢印機構 (border + glow pulse + ▼▲◀▶ + createPortal)
- 全 33 step マッピング (25 target + 8 skip)

## Round 3b — LogPanel HandZone パターン化 (2026-05-15 頃)

commit `ccdd4b5`。

### Changed
- LogPanel を HandZone 同等の fixed overlay + 透明 backdrop click 閉 + scrollbar thin + fade-in + role/aria

## Round 3a — UI 追加修正 12 項目中 9 件 (2026-05-15 頃)

commits `8161efb` + `d15b495`。B3/B6/B9/B11/B12/A8/A1/A10。

### Added
- FileArea + modal
- event カード組込

### Changed
- 事件 stamp 削除 + edition tag 独立
- 手札 scrollbar 完全削除 + grayscale

### Fixed
- next-hint engine bug fix

## Round 2 — Human-vs-CPU UI/UX 修正 18 件 (2026-05-14 頃)

commits `e61bb7f` 〜 `d343fde`。

### Changed
- startTurn 統一
- TopBar 動的
- 引き直し UI
- 手札 UX
- picker glow
- FILE/証拠/リムーブ モーダル
- ログ閉じる + 日本語化
- チュートリアル「次へ」修正

## Phase 8.1-8.10 + 完全クローズ

### Added
- hooks / per-step dispatch / Hirameki / 各種 modal / E2E

## Phase 7 + 7.5 — UI Shell

### Added
- UI Shell (12 components + cardResolvers + App 統合)

## Phase 0-6 — Engine + 47 カード + AI

### Added
- Engine コア (React 非依存、純関数 + Immer + Effect Descriptor DSL)
- 47 カード実装 (CT-D08 / CT-D11)
- AI policies (Random / Heuristic)

---

## 現在のメトリクス (Round 4l 時点)

- **1511 PASS + 1 skipped / 196 Test Files** (Phase 9-G.1 完了時点)
- **E2E 38 pass + 1 skipped** (bug-006 1 + bug-029 2 + cutinFixedAP 6 + partnerColorKeyword 6 + caseTraitConditioned 4 + eventRemoveByAP 5 + hiramekiDraw 7 + hiramekiCharStun 7)
- **1000戦 smoke baseline 525/475 完全維持** (avg 9.85 ターン、Round 4g 以降不変、Round 2-Round 4l 全 34 commit で regression 0)
- `npm run typecheck` 通過 / `npm run docs:check` クリーン
- リスク・バグ管理: [.claude/bugs/index.base](.claude/bugs/index.base) を Obsidian で開いて全バグ集約 view
