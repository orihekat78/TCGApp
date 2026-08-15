## BUG-145 — self-sleep optional gate (`charStateIs`、45印刷)

- **engine**: `Condition` union に `charStateIs{ref:TargetingRef, state:'active'|'sleep'|'stun'}` を追加
  (effect.ts union + cond/eval.ts case + CONDITION_KIND_MAP + taskA-validate-specs.cjs CONDS の 4点同期)。
  `ref` 解決は apAtLeast/stackedCountAtLeast と同流儀 (resolveCharsForRef → charRead.state、複数解決は .some)。
- **修正対象**: 「このキャラをスリープさせ(…)てもよい。そうした場合、X」型は必ず発動し、解決時に
  self が active の場合だけ optional を行える。現行実装は
  `conditional if charStateIs(self,active) then optional(...)` とし、sleep/stunでもtriggerをqueueする。
  BUG-161前の旧ability.condition方式は発動自体を落としていたため廃止した。
- **水平展開**: BUG-145 起票時は PR138 1枚のみ。全CardDefの実行時構造走査で同構造を **45印刷** へ拡張:
  - enter: PR138・PR144 (黒ずくめ reanimate, qAndA 明示) / B04049 (FBI remove, qAndA 明示) /
    B09058・B09058P (赤井家 reanimate) / B09057 (黒 summon) / B08058・B08058P (FILE8 deck-bottom)
  - ターン終了時 (self が既にスリープの到達性高): B06102 (キャンティ active) / B09065 (FBI active)
  - enter/contact/効果登場/remove observer: B04089/P・B04092・B04093・B06090/P・B07019・B07068/P・
    B09056/P・B10070/P・D10005・D10006
  - 追加横断: B05007/P・B07008・B08064・B09038/P・B09040/P・B10005/P・B10023/P・B10029・B10079
  既存 condition (partnerColor/turn/fileAtLeast) は listener-time condition として維持。
- **裁定の精度**: sleep/stunはいずれもselfをsleepへ実移動できないためoptional不可。
  「sleep中のselfをstunにする」別効果の裁定とは区別する。
- **gate**: tsc / validate-specs 73-0 / sync-whitelists / full vitest **2148**(+34 専用 test) /
  smoke:1000 = baseline 不変 (winsA=498、already-sleep は random play 不到達の証跡) / playwright 119。
- 専用 test `tests/cards/bug-145-self-sleep-gate.test.ts`: charStateIs primitive / 45印刷の完全なeffect-time active gate集合 /
  sleep・stunでもqueue / 解決前state遷移 / sequence tail抑止 / printed condition非破壊。
