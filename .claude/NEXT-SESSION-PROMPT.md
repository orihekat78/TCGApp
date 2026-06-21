# 次セッション再開プロンプト (2026-06-21 — evidence-top→hand cluster 出荷済 / 次は B/C 強推奨)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-21、セッション㉚ — main 取込み済 commit b31af45b、CI green)
engine拡張 micro-cluster「evidence-top→hand」(evidenceToHand に fromTop フラグ1つ、1刷) を出荷。
- 開始時に `gh run list -L1` で CI green 確認。
詳細: memory.md ㉚ / .claude/changelog-entries/2026-06-21-04-*.md / DEFERRED-INDEX「evidence-top→hand cluster」。

## wave サマリ (検証済: tsc0 / vitest 2739pass1skip0fail / decoy 8pass / smoke exc=0・baseline不変(avg10.998/winsA498) /
   playwright 120pass1skip(spectator-speed:79 fail=既知timing flake~40%・非MVPで無関係) / 敵対verify opus OVERALL SHIP 9点ok refute0)
engine 変更 = evidenceToHand に fromTop 分岐1つ (atom-handlers のみ、新 verb なし・args:unknown ゆえ型/whitelist 同期不要、
純 additive)。fromTop=true で pick skip→証拠最上(末尾=removeTop整合)を pop→手札、証拠0で __chainStepNoApply→chain break
(filePopToHand 同型)。「上から」=deterministic top は free pick と別経路。
出荷 (ALL_CARDS 1368→1369、P変種なし): B03077 水無怜奈 (赤L4 アナウンサー)。
a1 = optional{chain[evidenceToHand{fromTop}, handToEvidence{n:1}]} (D09010 a1 twin、optional=してもよい/chain=そうした場合) /
a2 = ヒラメキ draw (D01003 a2 twin)。

## ⚠ 重要 — カード追加 (A) は engine変更0 完全枯渇 + 単一 cluster の clean yield は 1-base 級が現実 (逓減確定)
㉘ distinct-name-count=2base → ㉙ handToEvidence=1base → ㉚ evidence-top→hand=1base。連続 2 wave で 1base。
着手前の決定論 yield scan に加え「実テキスト全句 grounding で真の clean yield を確定」してから scope を絞ること。
**B/C のほうが ROI 高い (強く推奨)**。A は engine拡張 micro-cluster しか残らず yield 1base/wave。
残 A 候補 (DEFERRED-INDEX、各々別 engine 変更):
  - B06033: evidence-self→hand verb (ヒラメキ「このカードを手札に加える」、hirameki redirect)
  - B06016: deck-mill-gated chain (【登場時】デッキ上3枚リムーブしてもよい。そうした場合…)
  - continuous levelDelta: PR264/B08059 ほか (ContinuousModifier.levelDelta + 全 level-read site honor、effort大・yield小)

## 次にやること (要ユーザー選択)
A) カード追加継続 = engine拡張 micro-cluster (上記候補、骨格解凍=別判断、clean yield 1base/wave)。非推奨。
B) デザイン刷新 (memory: project-design-redesign-2026-06-19、再開=.claude/design/RESUME.md、frontend-design skill)。
C) bug 対応 (.claude/bugs/index.base) / refactor-plan フェーズ (engine 解凍 cluster 含む)。
   候補: spectator-speed.spec.ts:79 の timing flake (~40%) 安定化 = 小さく実利ある C タスク。
→ 開始時にユーザーへ方向確認。A 選択時は「engine変更0 完全枯渇・clean yield 1base/wave」を明示。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正 or 公式ルール変更 or engine拡張 cluster (明示判断) のみ。通常は AI/UI/カード層。TDD・1 task=1 commit=セッション境界。
- engine拡張 cluster でも「同一 engine パターン 1つに絞る (混ぜない)」「決定論 yield scan + 全句 grounding で実数確認してから着手」。
- 「上から/上から N枚」(deterministic) と「N枚から選び」(pick) は engine 上別物。前者は pick skip 分岐 + chain-break 明示が要る。
- Read hook が file を line1 で切る → Bash cat で読む。Write/Edit は Read 1回で登録後に使える。
- pre-commit = docs:check + 規約 lint。新 src/test/spec で structure/mapping 変わる → npm run docs 同期後 commit。
- git add は wave ファイル + 再生成 auto docs を stage、除外は .gitignore/.claude/design/.claude/reports/smoke-*/.tmp-* のみ (git add -A → git reset で noise 3種を外す)。
- push to main は classifier が per-session 認可を要求する場合あり (handoff の「許可済」だけでは通らない) → 必要なら user に確認。
- カード wave: **certify/敵対verify GREEN でも codegen 前に shipped exemplar と全句突合必須**。
  decoy で filter/gate を実 engine 経路で1対1検証 (非MVP は decoy unit test が唯一の engine 駆動証跡。境界 case 必須=不在/0枚。「上から」型は両端 decoy で取得端を可視化)。
- 「既知 fix」(DEFER note 等) は hint であって保証でない。shipped twin 突合で最終確認。
```

evidence-top→hand cluster (1base/1刷) commit b31af45b → main 取込み済・CI green。次タスク未確定 — 開始時にユーザー確認 (A=engine変更0 完全枯渇・clean yield 1base/wave で非推奨、B/C 推奨)。`/clear` 後の新セッション推奨。
