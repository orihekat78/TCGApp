# 次セッション再開プロンプト (2026-06-21 — evidence-self→hand cluster 出荷済 / 次は B/C 強推奨)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-21、セッション㉛ — main 取込み済 commit ceb9aa83、CI 要確認)
engine拡張 micro-cluster「evidence-self→hand」(handAddFromRemove に fromSelf フラグ1つ、1base/2刷) を出荷。
- 開始時に `gh run list -L1` で CI green 確認。
詳細: memory.md ㉛ / .claude/changelog-entries/2026-06-21-05-*.md / DEFERRED-INDEX「evidence-self→hand cluster」。

## wave サマリ (検証済: tsc0 / vitest 2747pass1skip0fail / decoy 8pass / smoke exc=0・baseline不変(avg10.998/winsA498) /
   playwright 121pass1skip0fail(spectator-speed:79 flaky 今回pass) / 敵対verify opus OVERALL SHIP 8点ok refute0)
engine 変更 = handAddFromRemove に fromSelf 分岐1つ (atom-handlers のみ、新 verb なし・args:unknown ゆえ型/whitelist 同期不要、
純 additive)。fromSelf=true で pick skip→ctx.source.cardId (=リムーブされた証拠カード自身、removeTop が remove 末尾に
push 済) を lastIndexOf で remove→手札。【ヒラメキ】「このカードを手札に加える」= deterministic-self 経路。
出荷 (ALL_CARDS 1369→1371): PR085/PR091 沖矢昴 (赤L4 AP4000 LP1 大学院生、cardId 0481 絵柄違い2刷)。
a1 = 登場時キャラ1枚まで pick→ターン終了まで〚ブレット〛(charGrantKeyword{$pick,turn}) / a2 = hirameki self→hand。

## ⚠ 重要 — A (カード追加) は engine変更0 完全枯渇 + clean yield 1base/wave が確定 (逓減追認)
㉘ distinct-name-count=2base → ㉙ handToEvidence=1base → ㉚ evidence-top→hand=1base → ㉛ evidence-self→hand=1base(2刷)。
連続 3 wave で 1base 級。さらに ㉛ では handoff が想定した base (B06033) が **別 engine 限界 (continuation-nest)** で
DEFER 必須と判明し、別 base (PR085/091) を探し直して出荷した。**着手前の yield scan は実テキスト全句 + main effect の
実装可否まで洗う**こと (DEFER note は hint であって保証でない)。**B/C のほうが ROI 圧倒的に高い (強く推奨)**。
残 A 候補 (DEFERRED-INDEX「evidence-self→hand cluster」表、各々別 engine 変更):
  - B06033/B06033P: continuation-nest (sequence[chain[pausing-pick], step2] の継続上書き、BUG-111 family)
  - B02013/B05041: set-event host-continuous (event「キャラにセット」+ host 継続付与)
  - B05102: continuous levelDelta (ターン終了までレベル-1)
  - B03088: multi-atom-single-pick carrier (4名宣言gate + 1キャラに activate+AP+突撃)

## 次にやること (要ユーザー選択)
A) カード追加継続 = engine拡張 micro-cluster (上記候補、骨格解凍=別判断、clean yield 1base/wave)。非推奨。
B) デザイン刷新 (memory: project-design-redesign-2026-06-19、再開=.claude/design/RESUME.md、frontend-design skill)。
C) bug 対応 (.claude/bugs/index.base) / refactor-plan フェーズ (engine 解凍 cluster 含む)。
   候補1: spectator-speed.spec.ts:79 timing flake 安定化 (実利ある小 C タスク、日により ~40% 失敗)。
   候補2: continuation-nest 修正 (BUG-111 family、B05028/B09056/B06033 を一括解禁する engine 改善)。
→ 開始時にユーザーへ方向確認。A 選択時は「engine変更0 完全枯渇・clean yield 1base/wave・handoff base も外れうる」を明示。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正 or 公式ルール変更 or engine拡張 cluster (明示判断) のみ。通常は AI/UI/カード層。TDD・1 task=1 commit=セッション境界。
- engine拡張 cluster でも「同一 engine パターン 1つに絞る (混ぜない)」「決定論 yield scan + 全句 grounding + main effect 実装可否で実数確認してから着手」。
- 「上から/N枚選び/このカード自身」は engine 上 3 経路: fromTop (deterministic top) / free-pick / fromSelf (deterministic self)。後者2は pick skip 分岐が要る。
- ★pick 駆動の test harness: charGrantKeyword/sceneEnter の $pick は resolveEffectPicks 前処理 (chooseAtomTarget=AI) で surface してから runEffect。evidenceToHand/handToEvidence/handAddFromRemove は runtime self-enqueue (tryRePickFromAtom)。混在する effect は両方必要 (㉛ で runEffect 直呼びが charGrantKeyword pick を出さず躓いた)。
- ★continuation-nest 限界: sequence[chain[pausing-pick], step2] は chain continuation を親 sequence が上書きし chain step2 が脱落。shipped の sequence[chain] は全て chain が最終 step。decoy で swap在/不在 両端を必ず踏む。
- Read hook が file を line1 で切る → Bash cat で読む。Write/Edit は Read 1回で登録後に使える。
- pre-commit = docs:check + 規約 lint。新 src/test/spec + sessions/ rotate で structure/mapping 変わる → npm run docs 同期後 commit (構造変化はファイル追加削除後に最終再生成)。
- git add は wave ファイル + 再生成 auto docs を stage、除外は .gitignore/.claude/design/.claude/reports(smoke含む)/.tmp-* のみ (git add -A → git reset で noise を外す)。★`git reset $(空)` は全 index を unstage するので空引数に注意。
- push to main は classifier が per-session 認可を要求する場合あり (handoff の「許可済」だけでは通らない) → 必要なら user に確認。
- カード wave: **certify/敵対verify GREEN でも codegen 前に shipped exemplar と全句突合必須**。
  decoy で filter/gate を実 engine 経路で1対1検証 (非MVP は decoy unit test が唯一の engine 駆動証跡。境界 case 必須=不在/0枚)。
```

evidence-self→hand cluster (1base/2刷) commit ceb9aa83 → main 取込み済。次タスク未確定 — 開始時にユーザー確認 (A=engine変更0 完全枯渇・clean yield 1base/wave・handoff base も外れうるで非推奨、B/C 推奨)。`/clear` 後の新セッション推奨。
