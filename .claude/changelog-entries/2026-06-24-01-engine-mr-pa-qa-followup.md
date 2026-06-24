# engine — MR partner-area 公式Q&A 照会 反映 (#5 auto-phase 活性 修正)

**Round/Phase**: 2026-06-24 engine/mr-partner-area-qa-followup。MR Phase1 core (bef3adad, PR#3) の暫定保守解 5件を
公式 Q&A (commmune 事務局 talk002) で照会した結果反映。deep-research workflow + firecrawl で commmune 事務局
(@DCCG_admin_bk) の裁定を直接確認。

## 照会結果 (BUG-154 更新)

- **#1 MR① 中間状態 = 公式裁定あり** ([post/2099836](https://conan-tcg.commmune.com/view/post/0/2099836)、事務局 2025-10-08):
  「リムーブによって発動する能力は MR のリムーブによっても発動。MR能力で PA へ移動するが、**リムーブエリアへ一度置かれてから
  PA へ移動**」+「【現場リムーブ時】を持つキャラがデッキ下に移された場合は発動しない」。→ 実装 (removeToRemove のみ
  leave:to-remove emit、toDeck/toHand/toDeckBottom は非発火) **= 公式通り、変更不要**。
- **#3 PA-MR targetability = 公式裁定あり** ([post/1690545](https://conan-tcg.commmune.com/view/post/0/1690545)、事務局 2025-05-23):
  「パートナーエリアにある MR の状態を変更したり (MR能力以外で) PA から移動させる方法は存在しない」。→ 実装
  (candidates.ts 未変更、PA-MR 非対象) **= 公式通り、変更不要**。
- **#2** 直接裁定なしだが #1 の原則 (【現場リムーブ時】= 現場→リムーブエリアのみ) で整合。
- **#4 MR②×switch** 公式裁定なし → provisional 据え置き (実カード遭遇時に再照会)。

## #5 修正: PA-MR は auto-phase で活性化しない (1 file 挙動変更)

当初実装は auto-phase で PA-MR を活性化していた (推測補完)。公式裁定は無いが、rules/05① の活性化対象は
「パートナー + 現場キャラ」のみ + 事務局裁定 (post/1690545) で「PA-MR の状態は変更不可 (sticky)」が明言された
ため、**auto-phase の PA-MR 活性化ブロックを削除** (CLAUDE.md「推測でルール補完しない」準拠)。PA-MR は MR①
移動時の snapshot 状態を保持する。

- 変更: `src/engine/flow/auto-phase.ts` (PA-MR 活性化分岐を削除)。
- test: `pa-mr-readers.test.ts` の auto-phase describe を「状態 unchanged (sleep/stun/active 各保持)」へ更新 +
  現場キャラ活性化の回帰確認 test 追加。

## 回帰

非MR byte-identical (PA-MR 活性化ブロックは slot!=null 時のみ動作 = MVP デッキ不在 → smoke 不変)。
tsc0 / vitest (MR+auto-phase 45 pass) / smoke winsA=498 / e2e 123+1skip / eslint 0err。
