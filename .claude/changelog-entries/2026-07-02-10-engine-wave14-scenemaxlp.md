### engine additive wave-14 (A2 lane) — `$self.sceneMaxLp` dyn + 手のこんだ悪巧み (B08043/B08043P)

- **primitive**: `src/engine/dyn/eval.ts` resolveSelf に `$self.sceneMaxLp` case 追加 — `ctx.source.player`
  の現場キャラの **実効 LP 最大値** (`charRead.lp`、override?base + lpMod各scope + continuous + aura)。
  player ベース (uid 不要、oppSceneCount/sceneColorNot と同じ pre-switch 分岐 → イベントから利用可)。
  現場 0 枚 = max of ∅ = `-Infinity` (公式 Q&A: 自分の現場にキャラがいない場合リムーブ不可 → `lpMax:-Infinity`
  が matchOneFilter で全候補除外)。G16 残の relative-LP filter 足場 (G15 相対AP `$self.ap` と同経路)。
- **exemplar**: B08043 / B08043P「手のこんだ悪巧み」(イベント・白・Lv5) 初 consumer —
  「相手の現場のキャラが自分の現場で LP がもっとも高いキャラの LP 以下の場合リムーブ」=
  sceneRemove 短縮形 `{side:'opp', max:1, cause:'effect', filter:{lpMax:{dyn:'$self.sceneMaxLp'}}}`。
  engine 変更は dyn case 追加のみ (filter dyn 解決は resolveFilterDynObj が field-agnostic に既対応)。
- **gates**: tsc0 / vitest 3696 pass +1 skip (新 probe 8 件) / smoke:1000 winsA=498 不変 / 8 lint green。
- tier T1 (pure-additive evaluator + 出荷済 G15 パターンの clone)。
