## タスク C #2: reasoning hook 非selfOnly 解禁 — triggerCharMatches condition 追加

**Round/Phase**: 2026-06-06 session — C 第2弾。「自分/相手の現場にいる〚条件〛のキャラが推理したとき」を解禁。

### engine 拡張 (additive)

- 新 Condition kind **`triggerCharMatches { side?, filter? }`** を追加 (effect.ts + cond/eval.ts)。
  トリガ payload のキャラ (reasoning:end の推理キャラ payload.uid/player) を side + TargetFilter で評価。
  - `side:'self'` = payload.player === ctx.source.player (= card 所有者と同じ側)。
  - filter は matchOneFilter 再利用 (推理キャラの def + scene char を評価)。
- trigger.matcherCondition で使用 → 非 selfOnly の「自分の現場のキャラが推理したとき」を declarative 化。
  既存カードに該当 condition kind 使用 0 件 → 完全 additive (回帰 0)。

### 対応カード (2 枚)

- **B03102 横溝重悟** (黄Lv5): 自分側の[警察]Lv4以下が推理したとき このキャラ AP+1000 turn
  (matcherCondition `{side:'self', filter:{trait:'警察', levelMax:4}}`)。
- **B05011 雨城瑠璃** (青Lv3): 【ターン1】自分側の[毛利小五郎]が推理したとき 1ドロー
  (matcherCondition `{side:'self', filter:{cardName:'毛利小五郎'}}` + limit turn:1)。

### 検証

- typecheck clean / 全 vitest **1807 pass / 0 fail** (回帰0、batch#2 で 3 case 追加: 自分側発火 /
  非[警察]不発 / 相手側不発 / 毛利小五郎ドロー)。
- e2e: reasoning-hook spec に B03102 追加 (自分側[警察]推理→AP+1000 / 非[警察]→不発 を実機, §7 decoy)。
- lint (eslint/side-channel) errors=0。lint:listener は matcherCondition 使用カードを matcher/selfOnly
  未指定で warn するが意図的 (side-gate は matcherCondition が担う)。

### ALL_CARDS

935 → 937 枚 (+2)。

### 残課題 (reasoning hook 残 ~11)

- B03096 (souza + 発見 conditional) / B05019 (optional self-remove) / B05080 (opp + optional cost +
  reasoner binding) / B05039 (multi-target per-char) / B03038 / B08034 等は別機能ゲートで順次。
