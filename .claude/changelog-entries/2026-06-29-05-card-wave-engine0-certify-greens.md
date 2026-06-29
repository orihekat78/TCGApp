## feat(cards): wave engine0 0629 — certify greens 7枚 + P-clone 9枚 = 16枚 (engine変更0)

ENGINE0 まとめ追加 wave。未実装 150 候補を certify (grounding→opus 敵対 verify) で篩い、verified-green のみ出荷。
15 base certify = 6 verified-green / 2 refuted / 7 yellow (歩留り ~40%、calibration 通り)。

**出荷 16枚** (engine変更0):

| base | カード | 主構成 |
|------|--------|--------|
| B06021/P | 石川五右衛門 | innate 突撃[事件] + evidence:gain selfOnly draw + ヒラメキ draw |
| B02057/P | (赤) | phase:end:start + 【パートナー赤】自ターン + conditional(self sleep/stun)→AP8000以下 remove |
| B06004/P | 工藤新一 | 【絆毛利蘭】【相手ターン中】毛利蘭 AP+1000 aura + 宣言[sleep+毛利蘭公開]→opp Lv7以下 deck下 |
| B06077/P | (赤) | 【パートナー赤】突撃[キャラ] + 【FILE6】action終了時 自己remove→手札FBI登場 |
| B09056/P | 赤井秀一 | 【事件赤&黒】【登場時】自sleep→Lv8以下remove→痕跡分岐(発見済=黒Lv3 revive / 未発見=opp mill) |
| B03062/P | (白) | 白イベント使用 reaction → deck4公開 Lv8登場 |
| B04085/P | (白) | 白イベント使用 reaction → 警察stun + remove + draw |
| B03088P | 松田陣平 | 出荷済 base のパラレル (no/rarity/imageUrl のみ差) |
| B07047P | 中森銀三 | 同上 |

- B06004 = `revealFromHand` cost / `apDeltaAura` の初の実カード利用 (engine 既出荷の primitive)。
- B09056 continuation (optional→sequence→declinable sceneRemove→conditional sceneEnter pick) は B07104 既出荷パターン + BUG-161 binding-aware gate で安全。
- 副次: `taskA-validate-specs.cjs` の continuousModifier 許可キーが `apDelta/lpDelta` のみで stale → pure-JSON aura 群 (`apDeltaAura`/`auraFilter`/`auraExcludeSelf`/`apDeltaAuraOpp` 等) を追加 (tooling、engine変更0)。

engine変更0。tsc0 / vitest 3405 pass (+35 decoy) / smoke winsA=498 不変 / 8lint errors=0。
却下 9枚は DEFERRED-INDEX へ (effect-controller attribution / play-event-from-effect / turn-end→手札 / reveal-window 反復登場 / opp-as-chooser / 自個体 resurrection)。
