# wave-13 (A2 additive lane): $self.removeNameCount dyn — 犯人 カットイン (PR158/PR164) 出荷

- **新 dyn prop `$self.removeNameCount.<name>[.<name>...]`** (dyn/eval.ts、pure-additive): ctx.source.player の
  リムーブエリアで「指定カード名 (分割名component いずれか一致、rules/19) を持つ」カード数を返す。
  sceneTrait / oppSceneCount / sceneColorNot と同じ **player ベース** (uid 要件より前 — カットインは
  ctx.source.uid を持たない)。名前一致は `allCardNameComponentsForDef` で removeNameAtLeast cond と同式。
  静的 `state.players[side].remove` 読み → ap/lp の continuousDelta 再帰経路 (BUG-156/157) を踏まない。
- **「（このカードも含める）」の自然充足**: カットイン自身は resolve 時点で既に remove エリア内にある
  (flow/contact.ts の `effect:declared` emit → `discardToRemove` → `resolve.runAllUntilEmpty` の **遅延解決** 順、
  contact.ts コメント「push 後の discardToRemove で card が remove に移っても queue 済 effect は動作不変」)。
  よって remove 計数が自身を自然に含み、テキストの追記文言を特別扱いなしで満たす (rules/14 §カットインは
  リムーブエリアにある状態で効果解決、と整合)。
- **exemplar 犯人 PR158/PR164** (同一 ID 0627・別アート printing): カットイン
  「【自分ターン中】自分のリムーブエリアにある〚カード名［犯人］〛1枚につき、AP＋2000（このカードも含める）」=
  D08007 吉田歩美 ($self.sceneTrait dyn カットイン) と同型 (charModifyAP delta {dyn} scope:'contact')。
  「犯人はデッキに何枚でも入れられる」はデッキ構築ルール (rules/02、公式Q&A「ゲーム上は何も起こらない」) の
  ため AbilityDef 非表現 (B09100 犯人 と同運用)。REUSE_CARDS barrel 登録。
- **検証**: TDD probe RED→GREEN (dyn/eval 3 test: 計数・side 相対 + 分割名一致・0件) + card runtime オラクル
  (リムーブ犯人 2×2000=AP+4000、decoy [灰原哀] + 相手 remove 除外)。tsc 0 / vitest 3688+1skip fail0 /
  smoke winsA=498 不変・0 exceptions / 8 CI lint err0。
- **A2 lane 所見**: batch-1 (condition-dyn-absent-group) の additive 残は本 P54 のみ。P32/P35/G11-G13/G18/G19/
  P30/P31/P34 は既出荷 (wave 0630/2/4/6)、P46 aura も apDeltaAuraOpp で出荷済。verb 群 (P38/39/41/42) は
  exemplar が MR / evidence→deck-bottom / set-card-granted-declared 等 structural 前提を要し clean unlock 不可。
  P05/P08/P09/P12/P48 は flow/state-shape/resolver 触りで A1 送り → 詳細は NEXT-SESSION-PROMPT-TRACK-A2。
