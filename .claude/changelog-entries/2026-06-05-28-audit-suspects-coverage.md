## 監査 suspect の Playwright 実機検証 + BUG-121 検出

**Round/Phase**: 2026-06-05 session — audit workflow の suspect (faithful・実機未確認) を runtime 検証

### 背景

audit-engine-extension-batches workflow が「静的には faithful だが既存 e2e 代表と filter 形が
異なり実機未確認」とした suspect を Playwright で検証。novel な filter 組合せの恒久カバレッジを追加。

### 検証結果 (`tests/e2e/audit-suspects-coverage.spec.ts` 3 case)

- **D09014 a2** ✓ faithful: sceneToHand long-form の `levelMax:5 AND state:['sleep']` (side:opp) が
  AND 評価され、相手の「lv5以下 かつ sleep」のみ候補 (lv6/stun/active は除外) を実機確認。
- **B03091** ✓ faithful: leave:to-remove (相手ターン中) → charModifyAP `trait:警察 + side:self` の pick が
  owner(self) に surface、候補は自分の[警察]のみ。opp(AI) の B01063 リムーブ経由で end-to-end 確認。
- **B06007 a2** → **BUG-121 検出**: enter トリガの 3 択 choice が handUseCard フローで surface されず、
  engine が option 0 (突撃付与) に既定化。human は ②bounce / ③draw を選べない。

### BUG-121 (新規・未着手)

複数 option choice は宣言能力では `useActionsPanelFlow:606` が surface するが、enter トリガ
(`runHandUseFlow`) は surface せず、engine も choice で pause しないため option 0 既定化。
影響は **B06007/B06007P の 2 枚のみ** (他の triggered choice は単一 option=構造的 / declared /
ヒラメキで未影響、MVP デッキは全て未影響)。dispatch contract / engine flow に触れる中規模修正のため
方針確認待ち。詳細: [BUG-121](../bugs/BUG-121.md)。B06007 test は現状挙動を固定する characterization。

### 検証

- 全 e2e 95 pass / 1 skip 回帰 0 (suspect spec 3 件追加)。typecheck clean / lint errors=0。
