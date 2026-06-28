---
date: 2026-06-28
category: cards
title: certify wave 0628 — B03035 大滝悟郎 / B04037 鈴木園子 出荷 (engine変更0)
---

Task A green候補の certify wave (15枚 grounding→敵対verify, opus) から verified-green 2枚を出荷。

- **B03035 大滝悟郎** (緑/L3): 【宣言】【スリープ】〚現場のキャラにセットされたカードを1枚リムーブ〛→カード1枚引く + 【ヒラメキ】引く。declared cost `pay[sleepSelf, removeSetCard]` (B07048 同型) + draw。
- **B04037 鈴木園子** (白/L5): 【相手ターン中】【ターン1】自分の〚京極真〛がコンタクトしたとき手札の〚鈴木園子〛を1枚リムーブしてもよい→そのキャラはコンタクトでリムーブされない + 【ヒラメキ】リムーブの〚京極真〛1枚まで手札へ。third-party `contact:start` trigger (triggerCharMatches payloadKey:'bUid') + chain-gate `[discard, charSetTurnEffect contactImmune_action]`。

検証: 全15枚 certify (green=2/yellow=13/refuted=0)。gate5 behavioral probe で B04037 a1 の contactImmune が `read.char.hasTextAbility` で読めること + 鈴木園子不在時の chain-break (over-fire防止) を実 engine で実証。vitest 3263 pass / tsc0 / smoke:1000 winsA=498=baseline exc=0 / Playwright full-match + opp-turn-contact (console error 0)。

残 13枚は yellow (engine gate: set-card→証拠 / random-discard / turn-scope base-override / 遅延one-shot trigger / target==self gate / relative-color filter 等) で DEFER。
