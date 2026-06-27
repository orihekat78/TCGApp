# cards — wave casecolornot-b08079-0627 (engine変更0、caseColorNot 初投入)

**Round/Phase**: 2026-06-27 カード追加 wave (engine変更0)。session62 解禁の **caseColorNot Condition**
(「事件が【X】以外の色を持つ場合」) を production で初投入し、engine 追加を実カードで de-risk。

## 出荷 (printings +0 / 既存カード完成 +2 printings、engine変更0)

| printing | カード | 完成した能力 (a3) |
|----------|--------|---------------|
| B08079 / B08079P | ピンガ (黒 char, 黒ずくめの組織) | a3=【宣言】【スリープ】AP8000以下のキャラを1枚まで選びリムーブ。宣言ゲート=事件が【黒】以外の色を持つ場合 |

- B08079/B08079P は a1 (継続AP+1000) + a2 (【相手ターン中】【現場リムーブ時】draw1+discard1) が既出荷で、
  a3 のみ `// a3: DEFERRED (custom condition: 事件 not 黒)` として保留されていた。
  session62 の caseColorNot により a3 を engine変更0 で完成。

## 機構

- **caseColorNot (some説) を宣言ゲートに初投入**: 「この能力は自分の事件が【黒】以外の色を持つ場合に宣言できる」
  = `condition:{kind:'caseColorNot',color:'黒'}`。`AbilityDef.condition` は declared-ability の使用可否を gate
  (BUG-099, rules/17 §条件未達=能力を持たない扱い)。some説 (公式 B08079 qa: 事件《裏切りの街角》=黒+他色 → 宣言可 /
  mono-黒 → 宣言不可) を evalCond decoy test で 1対1 固定。
- **declared + condition + cost + apMax filter の複合**: 全て出荷済 proven 機能のみ —
  declared+condition+cost は B07048 a2 (session61) 同型 / declared+sleepSelf+sceneRemove は PR274 a2 同型
  (levelMax→apMax 差替のみ) / apMax target filter は 62 printings 出荷済 (BUG-117 silent-drop 修正済、
  effective-AP=combat-AP で判定)。effect=`sceneRemove{side:'either',max:1,cause:'effect',filter:{apMax:8000}}`
  (エリア指定なし=両現場・自己可 rules/15 / 「1枚まで」=max:1 0枚可 / 能力リムーブ=cause:'effect' ヒラメキ不発 rules/22)。
- engine src 変更 0 (caseColorNot/sleepSelf/sceneRemove/apMax は全て既存)。

## 検証ゲート

- tsc0 / 専用 test 15 pass (構造 1対1 + caseColorNot 宣言ゲート evalCond decoy + apMax matchOneFilter 境界/effective-AP +
  sleepSelf canPay active/sleep/stun) / full vitest 3178 pass 0 fail / smoke winsA=498 不変 exceptions=0 (engine変更0 の機械保証) /
  validate-specs B08079P=pass / 8 lints errors=0 / eslint clean。
- **opus 4-lens 敵対 review = 全 ship:true / blocker0** (semantic-equivalence / additivity / dsl-traps / edge-test-adequacy)。
  edge-lens concern (sleepSelf スタン時不可 未 pin) を反映し test 1 ケース追加。self-target (rules/15 自己選択可、
  PR274 a2 / D08003 a1 と同 side:either) は仕様準拠で非ブロッカー。
