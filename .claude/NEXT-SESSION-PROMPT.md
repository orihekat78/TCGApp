# 次セッション再開プロンプト (2026-06-21 — handToEvidence cluster 出荷済 / 次は B/C 強推奨)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-21、セッション㉙ — branch cards/wave-hand-to-evidence、main 取込み済 commit 44a1e69f)
engine拡張 micro-cluster「handToEvidence」(手札→裏向き証拠 verb 1つ、evidence⇔hand swap、2刷) を出荷。
- 開始時に `gh run list -L1` で CI green 確認。
詳細: memory.md ㉙ / .claude/changelog-entries/2026-06-21-03-*.md / DEFERRED-INDEX「handToEvidence cluster」。

## wave サマリ (検証済: tsc0 / vitest 2731pass1skip0fail / decoy 12pass / smoke exc=0・baseline不変(avg10.998/winsA498) /
   playwright 123pass1skip(spectator-speed 1fail→単独3/3=flaky) / 敵対verify opus OVERALL SHIP・refute0)
engine 変更 = AtomVerb に handToEvidence 1つ追加 (atom-handlers PB pick + union/ATOM_PICK_SPEC/validate/cjs 4点同期、
純 additive)。evidence→hand は既存 evidenceToHand で充足 (handoff の「2 verb」は誤り、実 1 verb)。手札在庫ガード +
faceUp既定false + push=証拠1番上(公式Q&A)。chain[evidenceToHand max:1, handToEvidence n:1] = 「そうした場合」(exemplar D08003)。
出荷 (ALL_CARDS 1366→1368): B06029/B06029P ヘビ男 (緑L3 YAIBA)。

## ⚠ 重要 — カード追加 (A) は engine変更0 完全枯渇 + 単一 cluster の clean yield は 1-base 級が現実
㉘ (distinct-name-count=2base) → ㉙ (handToEvidence=1base) と、engine拡張 micro-cluster の clean yield は逓減。
着手前の決定論 yield scan に加え「実テキスト全句 grounding で真の clean yield を確定」してから scope を絞ること
(handToEvidence は scan ~3base 見積り → grounding で 1base と判明、残3は各々別 engine 変更)。**B/C のほうが ROI 高い (強推奨)**。
次弾 A 候補 (DEFERRED-INDEX): continuous levelDelta (effort大) / evidence-top→hand fromTop (B03077) /
evidence-self→hand hirameki (B06033) — いずれも別 engine 変更で 1-2 base。

## 次にやること (要ユーザー選択)
A) カード追加継続 = engine拡張 micro-cluster (上記候補、骨格解凍=別判断、clean yield 1-2base)。非推奨だが可能。
B) デザイン刷新 (memory: project-design-redesign-2026-06-19、再開=.claude/design/RESUME.md、frontend-design skill)。
C) bug 対応 (.claude/bugs/index.base) / refactor-plan フェーズ (engine 解凍 cluster 含む)。
→ 開始時にユーザーへ方向確認。A 選択時は「engine変更0 完全枯渇・単一 cluster clean yield 1base 級」を明示。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正 or 公式ルール変更 or engine拡張 cluster (明示判断) のみ。通常は AI/UI/カード層。TDD・1 task=1 commit=セッション境界。
- engine拡張 cluster でも「同一 engine パターン 1つに絞る (混ぜない)」「決定論 yield scan + 全句 grounding で実数確認してから着手」。
- Read hook が file を line1 で切る → Bash cat で読む。Write/Edit は Read 1回で登録後に使える。
- pre-commit = docs:check + 規約 lint。新 src/test/spec で structure/mapping 変わる → npm run docs 同期後 commit。
- git add は wave ファイルのみ明示 stage (.gitignore/.claude/design/.claude/reports/smoke-* は pre-existing noise、除外)。
- カード wave: **certify/敵対verify GREEN でも codegen 前に shipped exemplar と全句突合必須**。
  decoy で filter/gate を実 engine 経路で1対1検証 (非MVP は decoy unit test が唯一の engine 駆動証跡。境界 case 必須=不在/0枚)。
- 「既知 fix」(DEFER note 等) は hint であって保証でない。shipped twin 突合で最終確認。
```

handToEvidence cluster (1base/2刷) commit 44a1e69f → main 取込み済。次タスク未確定 — 開始時にユーザー確認 (A=engine変更0 完全枯渇・clean yield 1base級で非推奨、B/C 推奨)。`/clear` 後の新セッション推奨。
