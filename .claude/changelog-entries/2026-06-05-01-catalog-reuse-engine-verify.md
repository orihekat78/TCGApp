## catalog-reuse カード実装 + engine-gate 再分類 + Playwright 実機検証 (ALL_CARDS→856)

**Round/Phase**: 2026-06-05 catalog-reuse 続行 / engine-gate 検証

非MVP catalog-reuse バッチを継続実装し、frozen engine の能力を実コードで全数検証して
「実装可能パターン」と「engine ゲート」を確定。実装カードは全て Playwright (`__game` seam) で実機検証した。

- **ALL_CARDS 834 → 856** (REUSE_CARDS バッチ + 当セッション 14 cardId / 22 num 追加)。
  追加: PR174 毛利小五郎 / PR192・D01010・D02009 (cutin+misread) / B06071±P・B02032 (forEach 全体効果) /
  B07016±P±P2 服部平次 (effect:declared 色matcher) / B03114±P スコッチ・B07101 テキーラ (自己リムーブ) /
  B05089±P±P2 上原由衣 (caseStatus-enter) / B04009 灰原哀 (handAddFromRemove) / B05018±P 円谷光彦 (charModifyAP pick) /
  B04096±P 真実を覆い隠す霧 (draw event) / B07071 アンドレ・キャメル (custom hand-size condition)。
- **engine 能力リファレンス整備**: [`card-impl-engine-gates.md`](../specs/card-impl-engine-gates.md) に
  「実装OK 検証済パターン」と「DEFER ゲート」(leave hook無 / aura不可 / multi-target pick不可 / event→evidence不可 /
  カットインfilter不可 / partner-area未モデル / event特徴データ無 等) を実コード根拠付きで列挙。
- **forEach over:all** primitive を検証 (`tests/engine/effect/foreach-all.test.ts`) — 「全員/すべて」一回効果が可能に。
- **実機検証で B07045 を revert**: a2 (partner-area[ビッグジュエル]) は engine 未モデルで永久発火不能と判明 → defer。
- **engine 拡張計画を策定** ([`engine-extension-plan.md`](../specs/engine-extension-plan.md)): user 承認で骨格凍結を解除し、
  解禁効果順 (leave hook 117枚 / char→hand 96 / deck-reorder 74 / set-card 64 …) に次セッションで追加予定。

検証: tsc clean / reuse-validate 0 invalid・0 dup / registry ALL_CARDS 856 0 fail / vitest **1720 pass / 1 skip** /
e2e `reuse-cards-2026-06-05.spec.ts` **9 pass** (console error 0)。
