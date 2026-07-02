### card-authoring wave15 — 怪盗キッド B03051 出荷 (stale-DEFER 解禁、engine 変更 0)

- **card**: B03051 怪盗キッド (キャラ・白・Lv7・AP6000・LP1・特徴[怪盗]、ct-p03 非MVP)。
  「【パートナー白】【登場時】自分のデッキのカードを下から1枚手札に加える。」+「【変装】【事件白】【FILE6】」。
- **stale-DEFER 解禁**: sole gate だった `handAddFromDeckBottom` verb は 2026-06-29 の engine additive で
  本カード専用に出荷済だが、consumer カードが未登録のまま残っていた (dormant primitive)。
  今回 card session で初 consumer として出荷 (DEFERRED-INDEX line 686 の「card session で出荷可」を消化)。
- **句マッピング** (全 primitive 出荷済、engine 変更 0):
  - a1 = triggered `enter`(selfOnly) + condition `partnerColor:白` + atom `handAddFromDeckBottom{player:self}`
    (verb が take 前後の deck0 refresh を内蔵、rules/14・26、B03051 Q&A「残1枚→手札→リフレッシュ」)。
  - a2 = `icon-disguise` + condition `and[caseColor:白, fileAtLeast:6]` (B02038 a3 の完全 clone、n のみ FILE4→6)。
  - Q&A: 【変装】は登場でないため a1(hook enter) は変装で二重発火しない (a2 は enter を emit しない)。
- **検証**: 新 test `tests/cards/b03051-kid-deck-bottom.test.ts` (3件) — 実 enter hook を end-to-end 駆動し、
  §1 partner=白→デッキ「下」(末尾) 1枚が手札 (DECOY: 上=先頭は取らない)、§2 partner=青→partnerColor gate で不発、
  §3 a2 構造。BUG-117/118 教訓 (DSL に書けても engine 評価保証なし) を実 hook 駆動で担保。
- **gates**: tsc0 / vitest 3706 pass +1 skip (新 3 件) / smoke:1000 winsA=498 exceptions=0 不変 (engine 変更 0 証跡) /
  eslint + listener lint errors=0。playwright は非MVP (MVP デッキ非搭載) ゆえ統合 test の decoy 駆動で代替。
- tier T1 (既存 primitive のみ、verb は runAtom test 済 = deck-bottom-to-hand.test.ts。本 wave は配線検証)。
