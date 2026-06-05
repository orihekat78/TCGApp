## Engine 拡張 #1: 現場リムーブ時 (leave:to-remove) hook 解禁

**Round/Phase**: 2026-06-05 骨格凍結 解除後の engine 拡張 (engine-extension-plan.md step 1)

骨格凍結原則の解除 (user 承認) を受け、残カードが最も多く必要とする **【現場リムーブ時】**
(`leave:to-remove`) を card-triggerable hook として解禁した。解禁対象は character 117 枚相当。

**判明した計画との差異**: plan は「`leave:to-remove` は internal で発火済 → listener 配線のみ」
と記載していたが、コード調査の結果 **`leave:to-remove` はどこからも emit されていなかった**
(型 union と spec に名前があるのみ)。よって emit の新設が必要。ただし既存カードは未購読
(`trigger.hook:'leave:to-remove'` を持つカード 0 枚) のため **additive・回帰 0** は維持。

- **emit**: `mutate.scene.removeToRemove` (全リムーブ経路の choke point) で発火。
  payload `{ uid, cause }` / source `{ player, uid, cardId }`。
  - rules/17「リムーブ方法は問わない」→ cause = `contact-ap` / `effect` / `switch` / `cost` で発火。
  - rules/30 → 現場6枚超過の修正処置 (`misplay-overflow`) は【現場リムーブ時】不発動 → 除外。
- **listener** (`listeners/triggered.ts`): `TRIGGERED_HOOKS` に追加 + 専用配線。
  - 離場したカード自身は scene から消えるため `collectCardsInPlay` に出ない →
    `handleLeaveToRemoveSelf` が source から **virtual location** を組み立てて自身の
    【現場リムーブ時】を処理 (ヒラメキの `handleEvidenceRemovedHook` と同型)。
  - 在場カードの「キャラがリムーブされたとき」反応は通常 in-play scan (`handleHook`)。

検証: 新規 unit 5 件 green / 全 vitest **1725 pass · 1 skip** (回帰 0) / typecheck clean /
`reuse-cards-2026-06-05.spec.ts` e2e 9/9 pass。水平展開: scene 離場経路は `removeToRemove`
が唯一の真のリムーブ choke (disguise→deck は非リムーブで除外, MR→PA は removeToRemove 経由)。
