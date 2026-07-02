## engine wave-14 (A2) — $self.sceneMaxLp dyn + exemplar B08043 相対LPリムーブ

- **新 dyn `$self.sceneMaxLp`** ([src/engine/dyn/eval.ts](../../src/engine/dyn/eval.ts)) — `ctx.source.player`
  の現場キャラの **実効 LP 最大値** (`charRead.lp`)。現場0枚 → `-Infinity`。player ベース (uid 不要 =
  イベントから使用可、uid null-check より前に分岐)。G15 の `apMin/apMax:{dyn:'$self.ap'}` と同経路の相対 LP 版。
- **exemplar B08043 / B08043P 手のこんだ悪巧み** (event, lv5, 白) — 初 consumer。
  「相手の現場にいるキャラを1枚まで選ぶ。そのキャラが自分の現場にいるLPがもっとも高いキャラのLP以下のLPの場合、リムーブする」
  = `sceneRemove {player:self, max:1, side:opp, cause:effect, filter:{lpMax:{dyn:'$self.sceneMaxLp'}}}`。
  `resolveFilterDynObj` が pick 列挙前に literalize → `matchOneFilter` が対象の実効 LP と突合
  (`candidates.ts` L409 `lp > lpMax` で「LP以下」= keep)。
  現場0枚 → `lpMax:-Infinity` で全候補除外 (公式 Q&A「自分の現場にキャラがいない場合はリムーブ不可」と整合)。
- **純 additive** (dyn case 追加のみ、engine 挙動不変)。tier T1。opus 1-lens 3/3 CLEAN (collapse 先例 B09096)。
- gates: tsc 両config 0 / vitest 3703 pass +1 skip (+8) / smoke winsA=498 exceptions=0 不変 / 8 lint err=0。
