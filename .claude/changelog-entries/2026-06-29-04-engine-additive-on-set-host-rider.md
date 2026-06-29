# engine additive wave (on-set-host scope) — set-card rider 継続付与 + triggered conferral の READ 側 infra

**Round/Phase**: 2026-06-29c engine 拡張 wave (engine/bulk-additive-0629c)。ユーザー指示「エンジン拡張をできるだけ多く」。
全 561 未実装の意味分類 ([engine0-vs-extension-2026-06-29.tsv]) で **最大の単一クラスタ** =「イベント自己セット継続rider付与」14 枚 +
「set-card付与能力 (conferred ability)」8 枚 = 計 **22 枚** が依存する基盤機構。装備イベント (B02013 ターボエンジン付きスケートボード /
B06063 せんぷう剣 / B05117 コンコン 等)「このイベントを…キャラ1枚にセットする。セットされているキャラは〚突撃〛/「【自分ターン中】AP+2000」/
「…したとき…」を持つ。」型。origin/main (1a304d59) ソース直読で再採寸 (DEFERRED-INDEX L378「set-event host-continuous 機構が engine 不在」が一次裏付け)。

⚠ **本 wave は READ 側 infra のみ** (host が rider を読む)。敵対 review edge-test lens の指摘どおり **単独では実カード 0 枚**を解禁する
infra 投資 (write 側 verb が別 gate)。下記 DEFER 参照。

## engine 拡張: 新 AbilityScope `'on-set-host'` (新 symbol = 既存カード未宣言 → 挙動不変)

セットカード def 上に書かれるが効果対象は **セット先の host キャラ**。faceUp でセットされている間のみ有効
(rules/16: 裏向きセット=情報なし → 除外 / host が現場を離れたら set card リムーブ → 自動失効)。3 honor site:

1. **継続ライダー** ([read/char.ts](../../src/engine/read/char.ts)) — `continuousDelta` が host の faceUp setCards def を走査し
   `scope:'on-set-host'` の continuous (`apDelta`/`lpDelta`/`lvlDelta`) を host に合算。`keywords()` は同走査で `grantKeywords` を
   `fromSetHost` として付与。**rider keyword は他カード由来の外部 grant 扱い** → `disabledOriginal` でも残し (rules/19 §他カード付与は
   無効化されない、semantic lens 確認)、`revoked` (「失う」効果) の減算対象外。ctx は host uid で構築 → rider の dyn/condition
   (【自分ターン中】等) は host を参照。**candidates.matchOneFilter は registered continuousDelta 経由で rider AP/LP/level を自動反映**
   (BUG-117 filter-AP==combat-AP、新 honor site 無し)。再帰安全 = `continuousDeltaSafe` の `_inContinuousDelta` guard 配下。
2. **triggered conferral** ([listeners/triggered.ts](../../src/engine/listeners/triggered.ts)) — `handleHook` が scene char の faceUp
   setCards def の `scope:'on-set-host'` triggered を `riderAbilities` として host (`card.uid`) の能力に合算。`scopeAllowsArea('on-set-host','scene')=true`。
   selfOnly は host uid 照合。granted-ability 不在 + rider 不在時は従来の `def.abilities` fast-path = 不変。**in-scene hook** (reasoning:end /
   action:declare / phase:end:start / contact:start 等) で発火 (leave:to-remove は下記 DEFER)。
3. **lint contract** ([scripts/lint-listener-scope.ts](../../scripts/lint-listener-scope.ts)) — `ALLOWED_SCOPE` に `'on-set-host'` を追加
   (honor-completeness lens 指摘: 未追加だと最初の rider カードで CI lint:listener が red)。

## 検証 (セルフレビュー + 水平展開 + 4-lens 敵対 review)

- tsc 0 / vitest **0 fail** (新規 13: 継続 AP/LP/level rider + faceDown 除外 + keyword rider + conditional(【自分ターン中】) +
  複数 stack + matchOneFilter parity (BUG-117) + on-scene decoy 漏れ防止 + disabledOriginal/revoked で rider keyword 残存 +
  triggered conferral faceUp/faceDown/selfOnly/on-scene-decoy)。既存 fixture が setCards 未定義のケースを `?? []` で guard。
- smoke:1000 **winsA=498 / avgTurns 11.00 / timeouts=exceptions=0** = baseline 全項目一致 (on-set-host カード 0 枚 → パス不変)。
- 8 規約 lint OK + eslint (changed files) 0-error。opus 4-lens 敵対 review (semantic=ship / additivity=ship / honor-completeness=concern /
  edge-test=concern)。concern は全て **後続 gate の文書化** で解消 (下記)、READ 側 infra 自体の correctness/additivity は全 lens 一致で健全。

## DEFER (後続 engine / card-wave へ — DEFERRED-INDEX §on-set-host に記録)

- **WRITE 側 verb (最重要 next gate)**: 使用イベントを host.setCards へ faceUp 載せる verb が未実装。hand-use はイベントを必ず remove へ送り、
  かつ event 効果は remove 着地 **後** に解決 → 「set-from-remove」型 verb (event 自身を remove から host へ移し faceUp set) が要。
  これが揃うと継続 rider 14 枚 (B02013/B06063 等) が end-to-end author 可能になる。
- **leave:to-remove conferral**: host splice 後に leave:to-remove emit → conferred leave trigger 不発 (B05117)。
  `handleLeaveToRemoveSelf` が `removedChar` snapshot の setCards を走査する追加修正が要。
- **aura/restrictsOpponent rider**: `apDeltaAura*`/`opponentRestrict` を set card から付与する形は未 honor (silent no-op)。現リダー全て self-buff ゆえ未踏。
- **rider triggered limit collision**: limit{turn} は (hostUid, ability.id) キー。rider ability.id は card-unique 命名で回避 (card-addition 注意)。
- **rules/17 by-print keyword filter**: `{keyword:X}` 対象 filter は `defHasKeyword` (静的) で rider 付与キーワードを見ない (0 枚で未踏)。
