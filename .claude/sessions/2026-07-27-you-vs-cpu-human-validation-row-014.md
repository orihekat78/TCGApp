# Row 014: police vs blue-green

## Result

- YOU: `sample-d11` (警察・標準); CPU: `deck-1784115417710` (青緑)
- Desktop Meta UI. CPU win, T12, evidence YOU 1/7 and CPU 9/6.
- Console errors: 0. No pointer interception or simultaneous modal observed.

## Public decisions and results

1. T1: six cards were above FILE; no legal main action. Ended turn.
2. T2: played 千速 Lv2/AP1000. CPU public board added 工藤新一 Lv2/AP1000.
3. T3: played 大江忍 Lv3/AP3000. CPU later removed that 大江 through a public effect.
4. T4 mandatory discard: removed lowest public hand card, 大江 Lv3/AP3000. Played 横溝重悟 Lv7/AP6000. Its optional target effect showed neither source nor effect text, so chose `選ばない`. Action: 大江 AP3000 -> 工藤新一 AP1000; no cut-in candidate, passed. Result: YOU LP decreased 3 -> 2.
5. CPU T4: 毛利蘭 AP6000 attacked 大江 AP3000. Guarded with 横溝 AP6000; cut-in 0, passed. Resolution removed own 千速/横溝 and later reduced LP to 1 while 大江 remained.
6. T5: played another 横溝 Lv7/AP6000. Same opaque optional target prompt: `選ばない`. Action 大江 AP3000 -> 毛利蘭 AP6000, cut-in 0, passed. Declared ability dialog disclosed 横溝 source and text: sleep plus remove one hand card to enter a Lv5-or-lower police card from remove. Removed duplicate 千速 Lv8; public remove candidates included 佐藤美和子 Lv2/AP1000 with cut-in AP+2000, so entered 佐藤.
7. CPU T5: guarded 大江 with 佐藤 (唯一の公開候補); cut-in 0, passed. Result removed 佐藤 and 大江; 横溝 remained.
8. T6: FILE11 allowed 千速 Lv8/AP8000; played it. Its declared ability dialog: sleep to remove one AP6000-or-lower character. Removed 毛利蘭 AP6000. Checked action: 横溝 AP6000 had only 工藤新一&服部平次 AP8000 as legal target, then cancelled at confirmation as unfavorable. Kept partner rather than assist it to FILE, retaining defense.
9. CPU next turn completed its evidence condition. Result screen: CPU required-evidence victory.

## Context and UI review

- Resolutions observed through public UI/log status: `effect:discard`, `effect:sceneEnter`, `effect:sceneRemove`, `contact:detail`; choices were YOU-owned and targets public scene cards.
- Good: guard dialog identifies attacker, defender, AP/LP; hand disabled reasons and cut-in count are clear; action confirmation names source and target.
- UI issue (review, not confirmed rules bug): the optional post-play target prompt says only `現場のキャラを1枚選んで効果を適用してください`. It omits source, ability, owner/chooser, target rule and changed side. Card detail modal exposes an image/name but no accessible rules text. This prevented an explainable target choice twice.
- UI issue (review): declared ability text appears only after selecting a source; action/guard status is clear, but optional-effect context is not.
