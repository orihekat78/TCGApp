# wave-12 (A1): G39 PA 一般カード枠 — partnerAreaCards + toPartnerArea + ビッグジュエル移動4テキスト全出荷

- **新 GameState field `PlayerState.partnerAreaCards?: CardId[]`** (G39、optional additive): 「このカードを
  パートナーエリアに移す」で PA 常駐する一般カードの枠。partner (strict singleton) / partnerAreaMR (MR slot)
  とは別。公式 Q&A「PA に置けるカードの枚数に上限なし」= 配列・cap なし。全出荷カード未使用 → 挙動不変。
- **新 verb `toPartnerArea`** (selfToEvidence 同型の deterministic self 経路): ctx.source card を owner の
  remove から lastIndexOf splice → PA push。不在は no-op (B06026 Q&A 同型 fail-safe)。実装 =
  `mutate.partner.addAreaCardFromRemove` (evidence.gainCard byte 同型 + remove:exit emit)。event 使用
  (hand-use / next-hint 両 site) と【ヒラメキ】(evidence.removeTop) のどちらも「解決時カードは remove 内」
  不変条件が成立するため単一実装で両経路を被覆。
- **candidates.ts partner-area 列挙**: partnerAreaCards を `{kind:'card', area:'partner-area'}` で候補化
  (matchesFiltersByCardId 適用)。既存 query 消費カード 0 件 (実測) → 挙動不変。将来の PA 計数/参照
  (B07037/B07045) の spine。
- **UI**: PartnerArea.tsx に PA カード compact list (`data-testid="pa-cards-<side>"` + data-card-id) +
  Playmat 配線。playwright 実機で render 確認。
- **exemplar 6 printings (移動4テキスト全数)**: B07059/P 赤い涙 (【パートナー白】+ sceneRemove max:1 either
  apMax8000 → toPartnerArea) / B07060/P クリスタル・マザー (draw + sceneEnter levelMax dyn $self.fileCount
  → toPartnerArea) / PR195/196 ブルーサファイア (deckRevealUntil 中森青子 → 必須加入 → bottom → shuffle →
  toPartnerArea)。全カード a2 =【ヒラメキ】optional toPartnerArea (decline 可 = Q&A)。**plain sequence
  必須** (chain だと 0-skip 時に PA 移動 drop = Q&A「その場合でも必ず移す」違反、certify 敵対指摘)。
  traits **ビッグジュエル** は公式 API category1 一次データ確認 (TSV は event category を drop — B07055 運用)。
- **検証**: opus certify workflow (grounding 3 + 敵対 verify 3 + 設計監査、誤訳ゼロ・blockers 0) →
  opus 4-lens review 4/4 SHIP_WITH_NITS 0-blocker (NIT test 6 本 fold-in) → playwright MCP 実機
  (★human 0-skip → toPartnerArea 発火 / pick 経路 apMax8000 境界値 + AP9000 decoy 除外 / PA UI render /
  console err 0)。テスト新規 23 (runAtom 5 / B07059 e2e 5 / hirameki 2 / candidates 3 / refresh 1 /
  B07060 2 / PR195 2 / 構造 3)。tsc 0 / vitest 3675+1skip fail0 / smoke winsA=498 不変 / 8lint err0。
- **latent 記録** (DEFERRED-INDEX wave12 節 + BUG-166): B07060 deck0 draw→refresh が解決中の自身を
  shuffle に巻き込み PA 不達 (rules/26 乖離の顕在化、graceful no-op、F2 で現状 pin) / 白色 UI CardColor
  未対応 (既存 gap) / PA 計数・消費側 (B07037/B07045) は PA-remove verb + PA condition 評価器が別途要。
