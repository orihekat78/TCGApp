# cards — decklook wave 登録漏れ修正 (orphaned card files → REUSE_CARDS)

**Round/Phase**: 2026-06-24 (main 直 FF push、commit 3613efb1)。

## 問題

wave decklook-remove-discard (commit c6e31c27) が **カードファイル4枚を出荷したが `_reuse/index.ts` の
REUSE_CARDS 登録を欠いた**。結果、main 5352c470 上で B03036/B03036P/B03115/B03115P (越水七槻・ラム) は
ファイル存在するが **どの index.ts にも未登録 = ゲームにロードされない死蔵** 状態だった。

## 修正

`src/cards/_reuse/index.ts` に4枚の import + REUSE_CARDS 配列エントリを追加 (+6行)。

- 検証: typecheck0 / pre-commit lint 8本 green / 登録は main の index.ts blob base に一致しクリーン適用。
- main へ rebase → FF push (3613efb1) → CI green (3m50s)。

## 教訓

codegen/register パイプラインを経由しない手編集 wave では、カードファイル生成と `_reuse` 登録が
分離コミットされ得る。**出荷前に「ファイル存在 ∧ REUSE_CARDS 登録」両方を確認**すること
(register 漏れの silent 死蔵を防ぐ)。
