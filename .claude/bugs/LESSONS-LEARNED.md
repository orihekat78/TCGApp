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

## 教訓 11: 「修正済」transition の前提条件 — 残課題は別 BUG で同時起票

**該当**: BUG-045 (`9169af4`、2026-05-22) → BUG-065 (`8c2f3e2`、2026-05-23) で本格対応 / BUG-053 (`7b1e86b`) / BUG-054 (`bacc22b`) / BUG-051 / BUG-052 / BUG-060 / BUG-009 (audit 2026-05-23 で発覚、BUG-067〜070 起票)

BUG ファイルに「本格対応は別 BUG で」「次セッションで grep」「別 refactor で」等の deferred 文言を書きつつ、その別 BUG を起票せずに status を「修正済」にしていた。結果:

- BUG-045: 1 日後にユーザーが D08015 a1 不発を報告して BUG-065 緊急対応
- BUG-053 / BUG-054: 同根 (pattern B 未対応、BUG-065 で本格対応)
- BUG-051 / BUG-052 / BUG-060 / BUG-009: audit (2026-05-23) で発覚、BUG-067〜070 として起票

**プロトコル** (新規定):

「修正済」transition の前提条件は以下のいずれか:

(a) 残課題が無い (全部 fix)、または
(b) 残課題が **out-of-scope** と明示され、かつ **新 BUG-ID が同時に起票されてリンクされている** こと

「次セッションで」「別 BUG で対応」「本格対応は別 BUG で」のような **未起票の deferred** は禁止。

claude が 「修正済」と記述する前に必ず verify する 4 点 ([BUG-066](BUG-066.md) + 2026-05-23 D08013 指摘):

0. **カードの公式効果テキストを必ず読む** (BUG-073 D08013 指摘で追加) — カードファイル冒頭コメントの「公式テキスト」全文 + `description` を読み、各 atom がテキストのどの一文に対応するか書き出す。resolve-picks の atom 分類だけで効果を要約しない (step 数や atom 種別が公式テキストの動詞数と一致しないなら、見落としあり)。
1. **関連ファイル現状確認** — 該当 BUG の「関連ファイル」セクションに挙がっているコードを Read で確認、修正内容が実在することを verify
2. **警告語句 grep** — 修正範囲周辺に `暫定` / `TODO` / `FIXME` / `未対応` / `未配線` / `skip` / `本格対応` / `仮対応` / `workaround` が無いか grep、見つかった場合は別 BUG として起票
3. **memory observation 検索** — mem-search で BUG ID と関連キーワード (atom 名 / function 名) を検索、続報・未解決事項を確認

加えて、修正範囲が engine 側関数の場合、その関数の **caller 側コード** も同じ 4 点 verify を適用する (BUG-071 triggered listener skip 漏れの教訓)。

---

## 教訓 → enforcement mapping (Phase 7、能動化)

| 教訓 | enforcement script / mechanism |
| --- | --- |
| 1 side-channel pattern | **`scripts/lint-side-channel.ts`** (能動、4 点配線 check) |
| 2 listener 3 点セット | `scripts/lint-listener-scope.ts` (能動、pre-commit hook) |
| 3 card data resolver test 先行 | `scripts/lint-card-addition.ts` (warn、pre-commit hook) |
| 4 ui-text format/fallback | `(passive doc、教訓のみ)` |
| 5 modal stack interaction E2E | **`scripts/lint-component-testid.ts`** (能動、role="dialog" 必須 data-testid) |
| 6 frontmatter enum 統一 | `scripts/lint-bug-frontmatter.ts` (能動、pre-commit hook) |
| 7 公式 PDF 原文 verify | `.claude/docs/user-request-clarifications.md` (passive doc) |
| 8 ok:false Hook 委譲禁止 | **`scripts/lint-ok-false-pattern.ts`** (能動 heuristic、break/return 単独警告) |
| 9 BUG status 二択厳守 | `scripts/lint-bug-frontmatter.ts` (status 注釈付き禁止) |
| 10 Python re.sub 罠 | `(passive doc、内部 dev 知見)` |
| 11 修正済 transition protocol | `scripts/lint-bug-followup.ts` (defer): deferred 文言が残ったまま status=修正済 になっていないか warn |

追加 enforcement (Phase 8):

- **test coverage threshold**: `npm run test:coverage && npm run check:coverage`
  (line ≥ 70% / branch ≥ 60% / function ≥ 70% / statement ≥ 70%)
- **新規 src/.ts → tests/.test.ts pair**: `scripts/lint-test-pair.ts` (warn)
- **修正済 transition protocol** (audit 2026-05-23 で追加): BUG 内に「本格対応は別 BUG で」「次セッションで」等の deferred 文言が残ったまま status=修正済 になっていないか lint で warn (`scripts/lint-bug-followup.ts` 候補、defer)

月次 audit で metric を tracking: `npm run bug:trend`
smoke baseline: `npm run check:smoke-baseline`

## 関連

- audit report: [AUDIT-2026-05-22.md](AUDIT-2026-05-22.md)
- audit 雛形: [AUDIT-template.md](AUDIT-template.md)
- BUG index: [index.base](index.base)
- 全 BUG-XXX.md 個別ファイル
