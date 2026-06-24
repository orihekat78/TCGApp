# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 = [2026-06-24.md](sessions/2026-06-24.md) (セッション55〜57)。
> 再開手順は `.claude/NEXT-SESSION-PROMPT.md`。

## 現在地 (2026-06-24 セッション57 完了 — 2 並行 session 合流)

- **main = 8c3001a2** (event-choose3 docs) ← 5c275922 (chore + B08075 cards 混入) ← 542feac5 (BUG-155 sweep)。
  全て engine変更0 (`git diff 877ad627..HEAD -- src/engine` 空)。CI: 5c275922/8c3001a2 とも push 後 in_progress → 開始時 green 確認。
- branch `cards/bug155-pick-filter-kind` = main に一致。
- ⚠ 共有 working tree ハザード継続。別 session の commit/branch切替が HEAD を動かす → 開始時 `git fetch` + branch/HEAD 確認必須。worktree `C:/tmp/conan-cards-w` (branch cards/engine0-wave-0624) も存在。

## event-choose3 wave (engine変更0、本 session の card 追加)

- **B08075/B08075P ブライダルは女が主役** (黄 lv5 event) 出荷。「3つまで選んで(上から順)」= event-use matcher
  → `seq[optional①active, optional②突撃[キャラ], optional③deckRevealUntil→handAdd→bottom]`。③は take-0 でも deck 並替副作用 → optional 必須。
  exemplar: B08029(matcher)/B06060(sceneSetState)/D02013(grantKw)/B08020(deck-look)/B09065(optional)。
- ⚠ cards は shared-index 経由で 5c275922 (BUG-155 chore) に**意図せず混入出荷**。docs(changelog-06+DEFER) は別途 8c3001a2。
- classify workflow が 127 novel rep 仕分け中 **session limit 中断** (5/7 fail = args-blowout の共有budget枯渇)。
  GREEN 9 のうち **engine型直読で 6 reject** → DEFERRED-INDEX 記録 (continuousModifier に level field 無し /
  1pick→2atom carrier-reuse exemplar 0件 BUG-130 / stun-cost kind 無し / partner-area scope 単値)。

## 次やること候補 (要ユーザー選択、詳細は NEXT-SESSION-PROMPT)

A) auto-docs sync (structure.md/mapping 未再生成) / B) MR Phase2-4 / C) カード追加継続 (上記 6 DEFER は engine 解禁要)。
