# LESSONS LEARNED — コナン TCG プロジェクト

過去 60 件 (BUG-001〜060) を横断 review して抽出した教訓集。
作成日: 2026-05-22 (user_request 20260522_01 #1 対応)

詳細な audit ログは [AUDIT-2026-05-22.md](AUDIT-2026-05-22.md) 参照。

## 教訓 1: side-channel pattern は drain 経路まで配線して初めて完成

**該当 BUG**: BUG-006 / BUG-029 / BUG-034 / BUG-054

新規 `__pendingXxxSide` globalThis 側チャネルを導入する際、UI dispatch の
post-dispatch drain (`_drainPendingXxxSide()` → `store.setPendingXxx()`) と
modal 経路 + resolve action を **同 PR 内で全層配線** する。effect 実行 →
state 反映 → UI 表示まで complete flow を E2E で検証しない限り「実装済」と
言わない。

**仕組み化**: `.claude/specs/side-channel-pattern.md` に「pattern checklist」
を整備推奨 (定義 + drain + dispatch + UI 配線 4 点)。

## 教訓 2: listener trigger 追加時の 3 点セット必須

**該当 BUG**: BUG-032 / BUG-033 / BUG-051

listener handler 追加時は以下 3 点を必ず明示検査:
1. `ability.condition`: gate 評価 logic が listener に到達するか
2. `trigger.selfOnly`: cross-player 発動の意図確認
3. `listener.scope` (=`on-scene`/`on-hand`/etc): 配置 area との整合

BUG-051 (caseResolvedHandRemove の scope='on-scene' で case area の listener
が block された事案) は 3 点中 scope の不整合だった。

## 教訓 3: card data 定義 → resolver test 先行作成

**該当 BUG**: BUG-030 / BUG-031

カードに新 trait / grantKeywords / declared ability を追加する際は、
resolver / engine test case を先に書いてから data を入れる。data だけ先行
すると enum 値と consumer の食い違いが即発覚しない。

**仕組み化**: [.claude/specs/card-addition-checklist.md](../specs/card-addition-checklist.md)
の「kind 分岐網羅 / hook listener 配線 / resolver dispatch 確認」 3 項目を
継続厳守。

## 教訓 4: UI 表示文字列の修正は frontmatter で「format / fallback / i18n」明示

**該当 BUG**: BUG-012 / BUG-017 / BUG-023 / BUG-052 (?? 表示) / BUG-060

「??」「cardId が見える」「uid 直出し」のような UX 劣化は繰返し発生する。
text fix BUG では:
- display format (例: `${name} (${cardId})`)
- fallback rule (resolveCard 失敗時の挙動)
- i18n 余地 (将来英訳時の hook)

を BUG.md 冒頭で明示。

## 教訓 5: modal stack / picker cancel は interaction E2E 必須

**該当 BUG**: BUG-013 / BUG-019 / BUG-024 / BUG-027 / BUG-045

複数 modal が重なる UI フロー (mulligan / picker / confirm / hirameki) は
unit test では検出できない。Playwright headed で「複数 modal open → close 順序」
「onCancel handler の伝播」「button stuck 回避」を smoketest suite に追加。

## 教訓 6: BUG frontmatter は enum 値統一 + commit hash 即時反映

**該当 BUG**: 12 件 commit hash 未反映 / 22 種類 category 乱立

frontmatter の `category` は **8 enum** に統一推奨:
`engine` / `engine-listener` / `ui-feature` / `ui-text` / `ui-ux` /
`ai` / `meta` / `infrastructure`

`status: 修正済` 移行と同 commit で `commit:` 反映を必須化 (pre-commit hook で
catch すれば自動化可能)。

## 教訓 7: ルール解釈で食い違ったら必ず公式 PDF 原文 verify

**該当 BUG**: user_request 20260521_01 #5 / #6 / #14 (BUG ではないが clarifications)

`.claude/rules/` 抜粋だけで判断せず、必ず公式 PDF / Q&A を直接フェッチして
原文引用で裁定。確認結果は
[.claude/docs/user-request-clarifications.md](../docs/user-request-clarifications.md)
に追記。関連 feedback memory: `feedback_rule_rebuttal_pattern`。

## 教訓 8: `ok:false` 戻り値の Hook 委譲は配線漏れを生む

**該当 BUG**: BUG-036 (deck-out 敗北条件配線忘れ)

`mutate/deck.ts:refresh()` が `{ok:false, reason:'remove-empty'}` を返すだけで、
呼出元 `draw()` が `break` のみで `gameResult` を set しない実装が放置されて
いた (「呼出元 Hook 担当」と暗黙委譲)。smoke 1000 戦で deck 使い切らない
ため 6 ヶ月顕在化せず。

**仕組み化**: `ok:false` を返す関数の docstring に「呼出元の責務」を明記、
かつ即近の呼出元で必ず処理 (Hook 経由のような遅延配線は避ける)。

## 教訓 9: BUG status は二択厳守 (注釈付き status 禁止)

**該当**: BUG-005/007 (status 「機構整備済 (要 Playwright 検証)」)、
BUG-053 (「修正済 (partial)」)、BUG-038 (「仕様外」が実は閉)

frontmatter enum (`未着手 / 対応中 / 修正済 / 見送り / 仕様外`) に追加の
注釈 (`(要 Playwright 検証)` 等) を付けると終了判定が曖昧化し、6 ヶ月後の
audit で正規化作業が発生 (本セッション Phase 6)。

**仕組み化**: lint script (`scripts/lint-bug-frontmatter.ts`) が enum 外の
status を error として弾く。「partial」状態は別 BUG (follow-up) として
起票して original を 修正済 化する。

## 教訓 10: Python re.sub の f-string + `\\1\n` は backref が壊れる

**該当**: 本セッション Phase 6 の batch script デバッグ

`f'\\1\n...'` は Python 解釈で `\1<NEWLINE>...` (3 char) になる。re.sub の
replacement string parser はこれを backref として認識せず `\x01` (SOH ASCII)
として展開する罠。

**対処**: raw f-string + 連結 `rf'\1' + '\n' + f'...'` で組み立てるか、
名前付き backref `\g<1>` を使う。

## 関連

- audit report: [AUDIT-2026-05-22.md](AUDIT-2026-05-22.md)
- BUG index: [index.base](index.base)
- 全 BUG-XXX.md 個別ファイル
