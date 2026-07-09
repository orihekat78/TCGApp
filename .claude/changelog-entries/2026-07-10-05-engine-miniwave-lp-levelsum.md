### engine mini-wave: lpOverride_turn + $bound levelSum — 3 printings + BUG-179 (shipped 4枚水平修正)

- **engine 2 primitive (additive、AP 側の完全鏡写し)**: `charOverrideLP scope:'turn'`
  (turnEffects lpOverride_turn、「ターン終了時まで元のLPを X にする」) + `$bound.<key>.levelSum` dyn
  (bound 集合のレベル合計)。TDD probe RED→GREEN 4 test。
- **consumer 3 printings**: B01045 / B01054 / B04063 (DEFERRED cluster ①② 解禁分)。B09011 は
  追加 gap で DEFER 継続。
- **★BUG-179**: filter 無し triggerCharMatches が**パートナーの推理/アクションでも誤発火** — B01045 の
  verify lens が同型を棄却 → 水平 grep で shipped 4 枚 (B05080/B03096/B08034/D04007) を検出、
  `filter:{}` (scene 走査強制) で一括修正 + partner-negative 回帰 4 test (反証実験で non-vacuous 確認)。
- opus 敵対 review = SHIP_WITH_NITS (misread×override 共存 latent 等 → DEFERRED-INDEX 記録) /
  sonnet 意味等価 lens 3 枚。compiler re-mine + exceptions +6 (mine skip 集合と test 全数照合の差分)。
- gates: tsc 0 / vitest 4525→**4549** pass +1 skip / smoke winsA=472 不変 exc0 / 8 lint err0。
