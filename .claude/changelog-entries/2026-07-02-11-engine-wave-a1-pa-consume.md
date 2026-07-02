## engine wave A1 (G39 PA 計数・消費) — partnerAreaRemove verb + PA-read + UI pick 配線

**種別**: feat(engine) — Track A1 structural / wave-12 (G39 PA 一般カード枠) の直接継続

### 新 primitive
- **`partnerAreaRemove` atom verb** — PA 一般カード枠 (`partnerAreaCards`, wave-12) から filter 一致カードを
  N 枚選びリムーブ (`mutate.partner.removeAreaCardsToRemove`)。`atomHandReveal` の clone に実 zone 変化を追加
  (short-form pick + exact-N gate + gate-on-0 + bind)。PB pick / `defaultArea='partner-area'` /
  `ATOM_PICK_SPEC` + `validate.ts` + `taskA-validate-specs.cjs` 登録。exact-N (`n:N`) = all-or-nothing:
  PA 候補 < N なら `chainStepNoApply` で「そうした場合」chain break (mill `gate` / B07055 / B03094 同型)。
- **PA-read = engine 変更0**: 既存 `sceneHas` が `candidates(query area:'partner-area')` 経由で PA を列挙
  → `{kind:'sceneHas', query:{area:'partner-area', ...}}` で「PA に〚特徴[X]〛のカードがある場合」を評価。

### UI 配線 (A1、CardListModal multi-pick 流用)
- `CardListKind += 'partner-area'` (TITLE/HINT/PICK_BANNER)。Playmat auto-open が `partnerAreaRemove` を
  `kind='partner-area'` の CardListModal で開く (`charStackCard` の area multi-pick と同一 generic 経路 =
  `onPickMulti → effectPickResolve{pickedUids}`、BUG-165 wave-10 fix 済)。card source = `partnerAreaCards`。

### exemplar カード (同梱)
- **B07037 黒羽快斗** — 【登場時】`optional{chain[partnerAreaRemove n:2 (ビッグジュエル), sceneEnter from:remove
  (中森青子 Lv6以下 sleep)]}`。新 verb の live consumer。
- **B07045 セリザベス女王** — engine0: ミスリード1 + ターン終了時 PA に[ビッグジュエル]あれば自身 active
  (`conditional{sceneHas area:'partner-area'}`)。PA-read の live consumer (pick UI 不要)。

### ゲート
- tsc 両config 0 / vitest **3722 pass +1 skip** (+19、baseline 3703) / smoke:1000 winsA=498 exceptions=0 (不変) /
  8 lint err=0 (eslint 既存 warn のみ)。
- opus 2-lens 敵対 review (semantic + edge-test、T2) = 両 **CLEAN・0 blocker**。NIT (B07045 stun→sleep /
  opp-turn no-fire) は G3/G4 test 追加で対処。
- ★engine 3経路 (runAtom 直接 / drain / exact-N gate) + >2 jewel (E3 = BUG-165 collapse なし exactly-2) 検証。
  B07037 human 2-pick の live playwright は B07037 が deck-builder で選択可能になった時に1回踏む (wave-10 B07002 同様)。

DEFER: PR263 (PA jewel 計数 AP+1000 aura = count-dyn ×1000 別 primitive + PA→remove n:1 + remove-target)。
rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md
