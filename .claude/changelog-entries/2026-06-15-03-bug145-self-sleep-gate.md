## BUG-145 — self-sleep optional gate (`charStateIs` 条件 + 11 能力)

- **engine**: `Condition` union に `charStateIs{ref:TargetingRef, state:'active'|'sleep'|'stun'}` を追加
  (effect.ts union + cond/eval.ts case + CONDITION_KIND_MAP + taskA-validate-specs.cjs CONDS の 4点同期)。
  `ref` 解決は apAtLeast/stackedCountAtLeast と同流儀 (resolveCharsForRef → charRead.state、複数解決は .some)。
- **修正対象**: 「このキャラをスリープさせ(…)てもよい。そうした場合、X」型の能力は、解決時に self が既に
  スリープなら optional 自体を行えない (公式qAndA PR138/PR144/B04049「スリープさせることができないので行えません」、一般裁定)。
  各能力に ability.condition `not{charStateIs(ref:self, state:'sleep')}` を AND する。triggered.ts は
  condition=false なら effect を walk する前に continue するため、self が sleep のとき能力は非所持扱い (rules/17) で
  optional surface も出ない (effect 側 `conditional` ラップでは optional prompt が surface してしまうため不採用)。
- **水平展開**: BUG-145 起票時は PR138 1枚のみだったが、同構造 (self-sleep が optional の先頭 gating clause) を
  全 24 self-sleep カードから機械抽出 → **11 能力** を gate:
  - enter: PR138・PR144 (黒ずくめ reanimate, qAndA 明示) / B04049 (FBI remove, qAndA 明示) /
    B09058・B09058P (赤井家 reanimate) / B09057 (黒 summon) / B08058・B08058P (FILE8 deck-bottom)
  - ターン終了時 (self が既にスリープの到達性高): B06102 (キャンティ active) / B09065 (FBI active)
  - action:declare【ターン1】: B09013 a2 (毛利小五郎/AP8000 reanimate)
  既存 condition (partnerColor/turn/fileAtLeast) は and:[既存, gate] にマージし維持。
- **裁定の精度**: gate は `sleep` のみを対象 (Q&A が禁ずるのは already-sleep のみ)。`active` で gate する案
  (DEFERRED 当初案) は stun を不当に巻き込むため不採用。stun での登場は現プールに存在せず実害差なし。
- **gate**: tsc / validate-specs 73-0 / sync-whitelists / full vitest **2148**(+35 専用 test) /
  smoke:1000 = baseline 不変 (winsA=498、already-sleep は random play 不到達の証跡) / playwright 119。
- 専用 test `tests/cards/bug-145-self-sleep-gate.test.ts` (35件): charStateIs プリミティブ / 11 能力の
  self-sleep→condition=false (gate closed) ・active→true (gate open) / AND-merge 非破壊 / 実パイプライン
  (enter hook emit で sleep→pendingEffects 空, active→queue)。
