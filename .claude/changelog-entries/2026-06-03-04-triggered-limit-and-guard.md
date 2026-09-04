---
date: 2026-06-03
title: triggered ability の limit enforcement + D11016 a1 ガード自己判定 (BUG-096/097)
type: fix
scope: engine
---

## MVP 監査で確定した triggered ability 2バグの修正

> 2026-08-26訂正: B06091公式Q&Aにより、D11016は「自身がガード」ではなく
> 「自身を指定したアクションがガードされたとき」と判明。以下のBUG-097記述は当時の解釈であり、
> D11016/B06091は`triggerCharMatches(payloadKey:'targetUid')`へ修正済み。
> `guardedBySelf`自体はB09014の「このキャラがガードしたとき」に使用する。

6レンズ MVP デッドコード監査で確定:

- **BUG-096 (デッドコード)**: triggered ability の `limit:{kind:'turn',n}` (【ターン①】) が engine 未 enforcement。
  declared フローでしか limit を読まず、triggered 発火経路は無制限に発火していた。影響 D11016 a1 / D11007 a3。
  → [triggered.ts](../src/engine/listeners/triggered.ts) で declared と同じ `declaredUseCount` を流用し
  `limit?.kind==='turn'` を enforcement (queue 前に check、queue 後に increment)。
- **BUG-097 (broken)**: D11016 a1 が「このキャラがガードしたとき」ではなく「任意のガード」で発火 (matcher が
  card.uid を参照できず selfOnly でも絞れない)。
  → Condition kind `guardedBySelf` (`payload.guardUid === ctx.source.uid`) を追加し、D11016 a1 を
  closure matcher から `matcherCondition:{kind:'guardedBySelf'}` へ。

## 監査結果 (クリーンだった次元)

atom verb (18種) / trigger hook (9種、登録+emit) / cost kind (3種) / condition kind / dyn 式 は
全件コード照合でクリーン。bare-string dyn 残存ゼロ。

## 検証

- tsc clean / vitest **1662 PASS** (+4 behavioral: 自分ガード1回発火 / 同ターン2回目 skip / 別キャラ不発火 / reset 後再発火) /
  smoke 1000 例外0 (502/498 不変)。
- 別途検出: D11007 a3 の `contactOpponentApHigher` も自己照合欠落の疑い → 別 issue で対応予定。
