# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 = [2026-07-02-track-b.md](sessions/2026-07-02-track-b.md)。
> 再開手順: Track A = `.claude/NEXT-SESSION-PROMPT.md` / Track B = `.claude/NEXT-SESSION-PROMPT-TRACK-B.md`。

## 2026-07-02 Track B session — B3-1 canonical 化 + B3-3 exceptions 監査 (B3 queue 完遂、engine 変更 0)

- **B3-1 conflicts 5→0**: shipped 再編集ゼロの「意味射影正規化」方式 — canonical.cjs に N1-N5 追加
  (engine 直読で結果同値証明済の encoding 揺れのみ吸収、証明脚注は canonical.cjs 冒頭 / unit test +14):
  N1 singleton-choice unwrap / N2 matcherCondition→condition lift (removedCharMatches 限定、
  enterOrderEquals は abilityIsShippu が存在を読むため除外) / N3 charSetCard faceUp:false drop /
  N4 sceneSetState 短縮形展開 (effect-root 限定 — BUG-145/158 の conditional/sequence 内非同値を尊重) /
  N5 icon-disguise 配列位置 stable-move (presence-scan 2箇所のみ・慣行不在 6/19 実測)。
  真の drift は C2 のみ = **B03012 a2 kind:'character' 過剰制約** → card 修正 (挙動不変)。
- **効果**: G1 match 1167→**1244** / exceptions 9→**7** (B03129/P・PR055 が N5 で match 昇格) /
  unshipped unlock = **P printing 2 枚のみ** → **B07031P/B08049P 出荷** (≡base probe green、ALL_CARDS 1515)。
  ★ヒラメキ sleep 10 枚は各々別の新規複雑文で card unlock ゼロ — 初版 ROI「10+5+4 枚」は行/card unlock の混同 (spec 訂正)。
- **B3-3 完了** (opus workflow 7 agent + 敵対 verify): exceptions 7 家系 + align-ambiguous B09041/P =
  **全 FULL_CORRECT (誤訳ゼロ)**。closure/shared-factory/合成 helper による benign 構造逸脱 → 恒久 exception 枠。
  B05030 は配列順 drift (非 disguise 間 = 意味保持のため正規化対象外) の benign exception。
- gate: tsc0 / vitest **3628+1skip** / smoke winsA=498 timeouts=0 / 8lint 0err / eslint 0 / G1 mismatch=0。
  T2 2-lens 敵対 review (opus semantic + edge-test)。main repo 直作業 (Track A は別 worktree 並行)。
