# LESSONS-LEARNED — 教訓集（テンプレート）

> 複数バグを横断レビューして抽出した教訓を番号付きで蓄積する。
> **各教訓には必ず「→ enforcement」欄を付ける**（passive doc で終わらせない）。
> 100 行を超えたら LESSONS-LEARNED-2.md に分割し、ここにポインタを残す。

## 更新運用

1. バグ修正時に各 BUG ファイルの「防止策」を即時記入
2. 同種バグ 2 件以上 or セッション完了時に横断教訓を起こす（月次 audit を待たない）
3. 各教訓に enforcement を紐づける（lint script 化 / passive doc / defer を明示）
4. 月次 audit で表を見直し、warn 止まりの lint の error 昇格を判断

---

## 教訓 1: <一行要約>

**該当 BUG**: BUG-XXX / BUG-YYY

<何が起きるか・正しいやり方を 3〜6 行で>

**仕組み化**: `scripts/lint-<topic>.ts`（pre-commit 連結済み）

## 教訓 2: <一行要約>

**該当 BUG**: BUG-ZZZ

<本文>

**仕組み化**: (passive doc、教訓のみ — 再発したら lint 化)

---

## 教訓 → enforcement 対応表

| 教訓 | enforcement |
|------|-------------|
| 1: <要約> | `lint-<topic>.ts`（能動、pre-commit） |
| 2: <要約> | passive doc（lint-<candidate>.ts 候補、defer） |
