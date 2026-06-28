# cards — wave engine0-triage-0628 (engine変更0、未certify候補の triage→敵対verify 刈り取り)

**Round/Phase**: 2026-06-28 カード追加 wave (engine変更0)。catalog-survey の **未 certify 候補 70 枚** を
triage(9 GREEN/61 YELLOW)→ 敵対 verify(6 CONFIRMED + 2 NEEDS_FIX + 1 REFUTED)→ 実装の3段で刈り取り。
engine src 変更 0 (既存 primitive のみ)。

## 出荷 (10 printings、engine変更0)

| printing | カード | 主能力 |
|----------|--------|--------|
| B03023 | 脇田兼則 (青 char) | 毛利探偵事務所 enter 観測 → 相手 deck-top 公開(log no-op) + ヒラメキ draw |
| B06057 | ゲロ田ゲロ左エ門 (白 char) | 自分が【白】〚YAIBA〛イベント使用時 draw + ヒラメキ draw |
| B08071 | 佐藤正義 (黄 char) | 宣言〚リムーブエリアに移す〛: deck-look 佐藤美和子 / カットイン AP+1000 + 佐藤美和子 で draw |
| B08091 | マッドサイエンティスト (黒 char) | 【事件青&黒】登場時 黒以外色キャラ在で 現場リムーブ時 Lv6以下 を sleep 登場 / 相手ターン現場リムーブ時 証拠裏返し |
| B09080 | 高木渉 (黄 char) | 【絆佐藤美和子】突撃 / 相手ターン中 佐藤美和子 を AP+1000 (aura) |
| PR264 / PR270 | 宮野明美 (赤 char) | 印字〚突撃[キャラ]〛 / 解決編 Lv+2 / 登場時 現場 Lv7×3 で 突撃[事件] (★自己計数 latch) |
| B07104 / B07104P | ミステリーコースター (黒 event) | sceneRemove + 突撃 付与 + 両現場キャラ1枚につき deck 2枚 mill |
| B03020 | 毛利蘭 (青 char) | アクション時 deck上3枚 blind-mill → 妃英理/工藤新一/毛利探偵事務所 で AP+1000 |

## プロセス (3段刈り取り、全 opus)

- **Triage** (5並列 opus): 70 候補を frozen-engine capability + 公式テキスト + rules で classify。
  9 GREEN (shipped 全 primitive + twin 証拠付き) / 61 YELLOW (gate 明示)。
- **敵対 Verify** (opus, human 経路 node probe): GREEN 9 を「engine変更0 を反証せよ」で精査。
  6 CONFIRMED / 2 NEEDS_FIX (修正 DSL 付き) / 1 REFUTED。
  - REFUTED = **B08059 諸星大**: 公式Q&A が「自身を Lv7 に数える」self-count latch を要求するが、
    lvlDelta の gate が sceneHas(level) ゆえ continuousDelta 再入 guard が self を 0 計数 → 反証 (engine 必要、DEFER 維持)。
  - NEEDS_FIX = **B07104** (clause2 を charGrantKeyword 短縮形に変更 = BUG-158 human 経路 pick 順逆転回避) /
    **B03020** (boundToRemove を $matched にも適用 = 3枚 mill 担保)。
- **実装後 敵対 review** (opus 4 lens: semantic/additivity/dsl-traps/edge-test): card semantic は全 ship。
  PR264 self-count latch は engine 実測で成立確認 (lvlDelta gate=caseStatus で level 非参照 → 再入 guard 非作動、B08059 と対照)。

## ★ PR264 self-count latch (B08059 との対照)

- 宮野明美は base Lv5、解決編で a1 lvlDelta+2 → effective Lv7。登場時 a2「現場に Lv7 が3枚以上」に **自身も数える** (公式Q&A)。
- B08059 (REFUTED) は lvlDelta の gate 自体が sceneHas(Lv7) で level を再読み → continuousDelta 再入 guard が self を 0 計数。
- PR264 は lvlDelta の gate が caseStatus(解決編) で **level 非参照** → 再入 guard 非作動 → self が effective Lv7 で計数成立。
- 専用 test で 解決編=3枚 true / 事件編=2枚 false / Lv8 decoy(levelMax7境界)除外 を evalCond+continuousDelta 実測。

## ⚠ KNOWN-EDGE (shipped-with-DEFER、敵対 review CONCERN)

- **B07104/P**: clause3 forEach+mill は、ループ途中で deck 枯渇 → refresh 後も後続キャラ分を mill し過剰。
  公式Q&A は「合計を一括 mill→中途 refresh で停止」。通常域 (deck ≥ キャラ数×2) は正、divergence は late-game deck 枯渇時のみ。
  faithful 化には mill-total-with-refresh-stop primitive (engine additive) が必要 → 将来 wave で修正。
- **B03020**: deck<3 + opt-in 時、公式Q&A は「3枚 mill 不能なら全不発」を要求するが、deckRevealUntil は可能分のみ実行。
  「してもよい」ゆえプレイヤー選択で回避可。deckRevealUntil 全 twin 共通の極端 edge (engine変更0 範囲外)。

## 検証ゲート

- tsc 0 / 専用 test `wave-engine0-triage-0628.test.ts` 28 pass (構造1対1 + evalCond/matchOneFilter/canPay/matcher decoy + PR264 self-count 実測) /
  full vitest 0 fail / smoke:1000 winsA=498 不変・exceptions=0 (engine変更0 機械保証) / eslint + 8lint err0 / engine diff 0。
