# cards — wave novel-tail-0627 (green候補 6枚、engine変更0)

**Round/Phase**: 2026-06-27 カード追加 wave (engine変更0)。残 green候補 novel-tail を
certify → opus 敵対 verify の 2 層で仕分け、verified-ok のみ codegen 品質で出荷。

## パイプライン

- 残 unshipped green候補 154 を機構別に分類 → clean homogeneous クラスタは枯渇 (易 deck-look 系は出荷済) を確認。
- single-mechanism 候補 **16 rep** を certify+adversarial-verify (wf-certify.mjs, opus, SUB=5):
  **green 6 / verify-ok 5 / refuted 1 / yellow 10**。yellow 10 は全て真の engine gap
  (misread hook / opp-evidence-removal observer / deck-bottom verb / hand-reveal verb / evidence-transient
  self-reenter / colorNot filter 等) → DEFERRED-INDEX 記録。
- refuted 1 (D02005) は a2 ヒラメキ sceneSetState が `uid:'$pick'` 欠落 (BUG-140、短縮形は hiramekiResolve
  auto-resolve で no-op) → explicit form に補修 → 再 verify ok。clone PR036 同梱。

## 出荷 (ALL_CARDS +6、engine変更0)

| rep | カード | 要点マッピング |
|-----|--------|---------------|
| D07018 | ジン (黒 char) | a1=【自分ターン中】contact:start(selfOnly, bUid Lv6以下)→sceneRemove / a2=ヒラメキ draw1 |
| B02008 | 阿笠博士 (青 char) | a1=【ターン1】少年探偵団 enter(side:self)→キャラ1枚まで AP-1000(turn) / a2=ヒラメキ remove少年探偵団→hand |
| B07024 | ハチ (緑 char) | a1=【相手ターン中】opp Lv8 enter→optional{chain[draw1→discard1]} / a2=ヒラメキ remove高校生→hand |
| B02073 | 上原由衣 (黄 char) | a1=【宣言】cost[sleepSelf+removeSelf]→長野県警1枚まで迅速付与(turn) / a2=ヒラメキ draw1 |
| D02005 | 遠山和葉 (緑 char) | a1=【ターン1】このキャラ/服部平次 enter→キャラ1枚まで sleep(短縮形) / a2=ヒラメキ sleep(uid:$pick explicit, BUG-140 補修) |
| PR036 | 遠山和葉 (緑 char) | D02005 と byte-identical clone |

- codegen (taskA-codegen、grounding コメント付) → register。touched = src/cards のみ。
- wave test `tests/cards/wave-novel-tail-0627.test.ts` (9 pass): 構造 1対1 全6枚 + B02008 enter trigger
  gating の decoy 1対1 (trait filter / side:self gate)。

## DEFER (DEFERRED-INDEX 「wave novel-tail-0627 由来」参照)

- yellow 10 + 自己review DEFER 1 (B06058: certify-ok だが optional gate 喪失 + 短縮形 side hardcode 疑い)。
- set-card 一族 直 grounding: **B07048 白馬探 = READY 未出荷** (a2 cost=removeSetCard n2 解禁済、初実装候補、手author要)。
  B08033 は登場時 forEach-setCard gate / B08041 は cost-removed-kind 分岐 gate で継続 DEFER。

## 検証

tsc 0 / wave test 9 pass / smoke winsA=498 ex=0 baseline不変 (engine変更0) / 8 lint errors=0 /
playwright app-load console error 0 (favicon404 のみ cosmetic)。非MVPカードゆえ decoy 1対1 は unit test で決定論カバー。
