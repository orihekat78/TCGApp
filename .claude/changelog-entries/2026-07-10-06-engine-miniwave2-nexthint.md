### engine mini-wave #2: next-hint 判別 — 3 printings (cluster ④ 解禁)

- **engine 3 primitive (additive)**: next-hint の effect:declared payload に `viaNextHint:true`
  (通常手札使用と判別、既存 matcher 未読で挙動不変) + cond `triggerViaNextHint` / `triggerCardMatches`
  (使用カード CardDef filter 照合、triggerCutinMatches 同型) + dyn `$trigger.cardLevel` (元のレベル参照、QA4)。
- **consumer 3 printings**: B01005 江戸川コナン / B03002 / B05005 (「ネクストヒントで手札を使用したとき」family)。
  B02087 (NH 限定色無視) は別機構につき DEFER 継続。
- probe 16 test green (engine 4 + consumer 12、viaNextHint 判別の hand-use negative 回帰込)。
- gates: tsc 0 / vitest 4549→**4565** pass +1 skip / smoke winsA=472 不変 exc0 / 8 lint err0。
