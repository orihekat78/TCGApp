# カード追加 wave — deck-look → 手札 + 残りデッキ下 (engine 変更 0、4枚)

**Round/Phase**: 2026-06-19 カード追加 wave。standing certify queue 枯渇後、残 backlog を再調査して
「上から N枚見て条件のキャラを 1枚まで手札に加え、残りを好きな順番でデッキの下に移す」族から
engine 変更 0 で実装可能な 2 rep (+P) を出荷。

## 経緯: 「hand→deck-bottom verb 無」note は stale だった

sweep landscape (Jun15) はこの族を yellow「hand→deck-bottom verb 無 (B04048)」と分類していたが、
**実際は wave1 (2026-06-10) が `deckToBottomBound` + `deckRevealUntil{maxN,chooseMatch:'upTo'}` を
追加済**で、B04024 / B03007 等が同型を既に出荷していた。よって本族は新 verb 不要 = engine 変更 0。
(同様に named-next の contact-removal-by-self 族も 28/39 出荷済で gate は cluster15 で閉鎖済と判明。)

## 追加カード (4枚、ALL_CARDS 1033 → 1037)

- **B05078 / B05078P 世良真純** (赤 L4 AP4000 LP1 探偵|高校生|赤井家):
  - a1【登場時】上から4枚見て (赤井家|探偵) のキャラを1枚まで手札→残りデッキ下→加えたら手札1リムーブ。
    `deckRevealUntil{maxN:4, chooseMatch:'upTo', filterAny:[{trait:赤井家,kind:character},{trait:探偵,kind:character}]}`
    → `conditional[$matched]{handAddFromDeck→discard}` → `deckToBottomBound`。B03007 同型 + filterAny。
  - a2【ヒラメキ】カードを1枚引く (`evidence:remove-by-action` optional → draw)。
- **B03056 / B03056P 千間降代** (白 L6 AP4000 LP1 探偵):
  - a1【登場時】上から1枚見て探偵のキャラを1枚まで手札→残りデッキ下 (B04024 同型、discard 無)。
  - a2 自分のターン終了時、自分の現場に探偵のスリープ状態が3枚以上いる場合、このキャラをリムーブして
    もよい。そうした場合、証拠を1つ得る。`condition: and[turn:self, sceneHas{trait:探偵,state:[sleep],nMin:3}]`
    + `optional{sequence[sceneRemove uid:$self, evidenceGain]}` (B06081/B08027 同型 self-remove idiom)。

## 検証

- engine 変更 0 (git diff = カード 4 + `_reuse/index.ts` + テストのみ)。tsc clean。
- 新規 `tests/cards/wave-decklook-bottom.test.ts` 15 件: filterAny の OR + kind:character を decoy
  (赤井家 char / 探偵 char / 赤井家 *event* = kind 違反で非該当 / 警察 char = 非該当) で 1対1 実証。
  B03056 a2 の condition (探偵 sleep≥3 のみ・active/他特徴/相手ターンは非成立) を `evalCond` 直接 +
  effect の opt-in (self-remove + 証拠+1) / opt-out (無変化) を実 engine で検証。
- full vitest 2673 (+15、回帰 0)。smoke:1000 exceptions=0 / baseline 不変 (avg=10.998 winsA=498)。
- e2e 回帰 120 passed (1 flake = `ERR_NO_BUFFER_SPACE` 環境起因、単独再実行で pass)。
- 敵対的 verify (opus): 0 blockers。両カードの全句↔公式テキスト等価・全 metadata 一致を独立確認。

## 既知の限界 (DEFER / engine 規約)

- B03056 a2 公式Q&A②「解決前にこのキャラが現場を離れた場合は証拠を得られない」は厳密には満たさない。
  `sceneRemove uid:$self` は char 不在時 no-op だが `__chainStepNoApply` を立てない (chain でも同) ため、
  opt-in 後に同時 turn-end 効果で自身が消える極稀ケースで証拠が発火しうる。**全 uid:$self self-remove
  カード共通の frozen-engine 既知限界** (B08027/B05019/B06081/B07072/B09084)。骨格凍結下で本カード固有でない
  ため許容。将来の self-remove-chain engine 修正時に一括対応 (DEFERRED-INDEX 記載)。
- 同族の残 rep は別 gate で DEFER: B03042 (look-5 2-pick 相対色 + shuffle)、PR265 (登場時 mill-by-level 動的)、
  B07066/PR194/B08075 (declared+cost / multi-select-3 = 次 wave 候補)。
