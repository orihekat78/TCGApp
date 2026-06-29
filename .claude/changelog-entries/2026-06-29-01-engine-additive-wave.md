# engine additive wave (5 primitives) — setcard:enter / enterCountAtMost / handAddFromDeckBottom / oppSceneCount dyn / selfToEvidence harden

**Round/Phase**: 2026-06-29 engine 拡張 wave (engine/bulk-additive-0629)。NEXT-PROMPT option-B「certify yellow の engine gate」群を
grounding→敵対verify で再採寸し、純 additive かつ demand-backed な 5 件を **まとめて** 出荷。stale ラベル排除のため各 gate を
現 HEAD (37000546) ソースで再確認 (DEFERRED-INDEX の B09096 relative-AP は session67 で既出荷=対象外、ability-presence は実装済=対象外)。
カード自身は別 card session で出荷 (本 wave は engine 足場 + 専用 unit test のみ、session67 engine-additive-trio と同方針)。

## engine 拡張: 純 additive 5 件 (新 symbol = 既存カード未参照 → 挙動不変)

1. **`setcard:enter` hook + `setCardMatches` cond** — [mutate/char.ts](../../src/engine/mutate/char.ts) `setCard`
   (set-card-add の唯一書込点) が push 後に per-occurrence emit (setcard:leave の対)。host が listener = `selfOnly`
   (source.uid===host.uid)。set card の trait/色 filter は新 cond `setCardMatches{filter}` ([cond/eval.ts](../../src/engine/cond/eval.ts))
   で評価し、**faceUp===true のみ** 通す (rules/16 裏向きは情報を持たない)。→ B02018 (host-self, face-down set) /
   B06046・B06046P (〚特徴YAIBA〛filter, face-up set) を解禁。
2. **`enterCountAtMost` cond** — `turnState[p].enterCountThisTurn ≤ n` の player-resolved 直読 (removeCountAtLeast 同型、
   candidates()/continuous 非経由)。→ B09089「このターン中、自分の現場にキャラが登場していない場合」(sole gate)。
3. **`handAddFromDeckBottom` verb** — デッキ末尾 (=「下」、toBottom が push する側) 1枚を手札へ。take 前後の deck0 で
   即リフレッシュ (rules/14 + B03051 Q&A「残1枚→手札→リフレッシュ」)。→ B03051 (sole gate)。
4. **`$self.oppSceneCount` dyn** — resolveSelf に相手現場枚数 prop (static `scene.length` 読み、continuousDelta 再帰非経由)。
   continuous AP aura が opp 現場数に live スケールする足場。→ B08086 テキーラ (sole gate)。
5. **selfToEvidence `gainCard` idx===-1 harden** — fromArea='remove' で source cardId が解決時に remove を離れていたら
   証拠化せず return (B06026 Q&A / rules/14)。全 shipped selfToEvidence は event=同期解決ゆえ分岐未踏 = 挙動不変。
   → B06026 a2 の必要条件 (char-leave 経路は card session で実機検証)。

## 検証 (セルフレビュー + 水平展開 + 敵対 review)

- tsc 0 (src + scripts) / vitest **3305 → 3326 pass** (新規 21: enterCountAtMost 3 + oppSceneCount 3 + gainCard guard 3 +
  deck-bottom 6 + setcard-enter 6)。各 test に false-green 防止 decoy (host-self gate / opp-only / 裏向き trait / bottom≠top /
  fromArea='none' 不変)。sync-taskA-whitelists (HOOKS/VERBS/CONDS 3way) green。
- smoke:1000 **winsA=498・avgTurns 11.00・timeouts/exceptions 0** = baseline byte-identical (= 既存カードのパス不変の実証)。
  8 project lint OK。
- **opus 7-agent 敵対 review** (5 per-primitive lens + additivity 監査 + rules-fidelity 懐疑) = **7 ship / 0 blocker**。
  指摘の latent 概念 (enterCountAtMost pre-walk / deck+remove=1 二重refresh / setCardMatches c=null / MR PA-redirect /
  oppSceneCount sync非対象) は全て現状 unhit、DEFERRED-INDEX に記録。doc コメント 2件を反映。

## 本 wave で見送り (骨格凍結・収束方針)

- 同名 scene-count dyn ($self.sameNameCount, B09036): 0-card net unlock、かつ B09036 は threshold-branch (condition 要) +
  rename + 【FILE5】の三重 gate。grounding でも「dyn では不足」と判明 → speculative ゆえ DEFER。
