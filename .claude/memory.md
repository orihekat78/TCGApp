# 作業ログ — 名探偵コナンTCG プロジェクト

> 当日の詳細 (session①BUG-143/144+cluster8 / ②BUG-145 / ③赤魔術family) は [sessions/2026-06-15.md](sessions/2026-06-15.md)。
> changelog-entries 2026-06-15-01〜04 に各 Phase 記録済。

## 2026-06-15 セッション③ — 赤魔術 trait データ補完 + family 実装 (cards/akamajutsu-trait)

needsManual 5件 closure 起点。4枚(B06101/B08020/B09008/D10011)既出荷=1対1突合で意味等価確認。
B07052 の data-gate は「赤魔術 がデータに無い」という **stale 誤認**で、真因は **TSV 抽出が event/case の
category(=特徴)を全件 drop** (一次 API `_raw` の category が正本、赤魔術 は B07055/B07058/B07062 に実在)。

### 成果 (全 gate green)

- per-card で trait 補完: B07062/P caseTraits:[まじっく快斗,赤魔術] / B07055/P・B07058/P traits:[赤魔術]。
- family 5枚解禁: B07052 (caseTrait突撃 + reveal-until赤魔術+shuffle) / B07055/P (forced-2 set除去+bonus) /
  B07058/P (reanimate→AP+3000・突撃[キャラ]・charSetCard)。ALL_CARDS 1166→**1171**。
- **engine 契約発見**: PA短縮形 pick の強制ちょうどN枚=`n:N`(number)。`n:{min,max}`(object)は無音0枚。
  B07055「合わせて2枚」は n:2 (test で n:{2,2}→0枚を検出し修正)。
- gate: tsc / validate-specs 73-0 (engine変更0) / full vitest **2160**(+12) / smoke winsA=498 baseline不変 /
  playwright 119。専用 test akamajutsu-trait-family.test.ts 12件。
- known-gap (DEFERRED-INDEX 追記): TSV category-drop は他の【事件特徴】/event-trait filter にも波及 latent /
  charRemoveSetCard n:N の候補<N clamp (1枚 opt-in strict 可否は公式未裁定)。

### branch / 残

- branch `cards/akamajutsu-trait` で commit → main ff-merge → push 予定 → CI 確認。
- 次候補: TSV category-drop の systemic fix (要広域確認) / 赤魔術 family 残 (小泉紅子B07031/B07034・中森銀三B07047等
  【事件赤魔術】族) / NEXT-SESSION-PROMPT の候補群 (B07005 action-restriction 等)。
