# engine拡張 wave#2 cluster15 — removal-observer (反撃カード一族) 設計

2026-06-16。骨格凍結例外 = scoped engine-extension wave (13198 の指摘: removeToRemove は普遍 primitive
のため「骨格凍結例外」でなく明示的 wave 判断が要る → ユーザー承認済)。**実装前 opus 3-lens 敵対設計レビュー必須**。

## 1. スコープ (決定論 trigger テキスト分類, 全残カード走査)

「相手の現場にいるキャラが…リムーブされたとき」を trigger に持つ **28 rep / 53 cards (全 yellow)**:

| variant | trigger テキスト | reps/cards | 例 |
|---|---|---|---|
| CONTACT-SELF | 「このキャラとのコンタクトによってリムーブされたとき」 | 22 / **42** | D02008 D10007 B05009 B01007 B01010 B04004 B06031/38/39/51/68/87 B07017/63/84/97 B08010 B09022/23/71 PR136 PR280 |
| CONTACT-FILTER | 「自分の現場の〚特徴X〛のキャラとのコンタクトによって」 | 2 / 4 | D09010 (特徴[警察]) B06067 |
| CONTACT-BARE | 「コンタクトによってリムーブされたとき」(誰でも) | 3 / 5 | B01030 B01031 B09026 |
| ANY-METHOD | 「リムーブされたとき」(方法問わず) | 1 / 2 | B05106 |

effect 側は draw / 手札リムーブ→証拠獲得 / 突撃付与 / リムーブエリアの【カットイン】カード回収 等 = **既存 verb の組合せ**。
(注: 一部カードは secondary ability に別 gate を持つ → certify で per-card green/yellow を確定し partial ship/defer。)

## 2. 現行の構造的破綻 (実コードで確認、13198 を grounding)

- `scene.ts removeToRemove`: scene splice (L153-156) **後**に `leave:to-remove` emit (L163-171)。payload=`{uid, cause}`、
  source=離場キャラ。**14683 (sonnet) の「contact path で leave 不発火」は誤り** (contact→removeToRemove 経由で発火する)。
- payload に **攻撃者uid / 所属side / level / AP が無い** → observer condition が評価不能。
- `eval.ts triggerCharMatches` (L291-328): 除去キャラを `state.players[X].scene` から再取得 → splice 済で常に false。
  かつ payload.player 不在で side 導出不可。**= removal-observer に流用不可**。
- in-play observer は `triggered.ts handleHook('leave:to-remove')` 経路で condition 評価される (離場キャラ自身は
  `handleLeaveToRemoveSelf` 経路、二重発火なし = collectCardsInPlay に splice 済キャラは出ない)。
- `contact.ts judge`: 被除去は常に `bUid` (rules/08「アクションキャラは決してリムーブされない」)、除去者=`aUid`=winner。

## 3. 設計判断 (3 件、13198 の宿題を確定)

### D1. ride-leave:to-remove (採用) vs expose-contact:judge (不採用)
- **採用 = leave:to-remove に attribution を additive 付与 + 専用 condition**。理由: 4 variant 全て (contact 3 + any-method) を
  **1 機構**で被覆。any-method は contact:judge では拾えない (effect/switch/cost 除去)。
- 不採用 = contact:judge を TRIGGERED_HOOKS 追加: contact 限定で any-method 不可、かつ winner/loser だけで filter 不足。

### D2. two-semantic model → 単一 condition `removedCharMatches`
payload snapshot のみ読む (scene 再取得しない)。owner-relative に評価:
- `side`: 'self'|'opp'|'either' (`payload.side === ctx.source.player` → self)。全 variant = 'opp'。
- `cause?`: 'contact-ap' (CONTACT-*) | 省略 (ANY-METHOD = 方法問わず)。
- `by?`: 'self' (CONTACT-SELF: `payload.byUid === ctx.source.uid`) | `{filter}` (CONTACT-FILTER: byUid が
  self現場でfilter一致、winner は生存=現場に居るので再取得可) | 省略 (CONTACT-BARE / ANY-METHOD)。
- `removedFilter?`: 除去キャラ自身を level/ap で絞る用 (payload snapshot から)。現状未使用なら省略可だが forward 用に capture。

### D3. payload snapshot field 命名
`leave:to-remove` payload を `{ uid, cause, side, byUid?, level, ap }` に拡張 (additive)。
`side`/`level`/`ap` は splice 前 capture、`byUid` は caller (contact judge) から。**既存 `{uid, cause}` consumer は無影響** (selfOnly は source 参照)。

## 4. 変更 (file-by-file、すべて additive)

1. **`mutate/scene.ts removeToRemove`**: 署名に optional `byUid?: string` 追加 (default undefined)。
   splice 前に `side=player` (既存 leavingUid/CardId と同所), `level`/`ap` (現在値 = 能力修正後の effective) を capture。
   leave:to-remove payload を `{ uid, cause, side, byUid, level, ap }` に拡張。
2. **`flow/contact.ts judge`**: `removeToRemove(state, bUid, 'contact-ap', aUid)` (aUid=winner=attacker)。他 caller (cost/effect/switch/turn) は不変 (byUid 省略)。
3. **`types/hooks.ts`**: leave:to-remove payload コメントを新形に更新 (型は HookName union のみなので doc のみ)。
4. **`types/effect.ts`**: `Condition` union に `removedCharMatches` 追加。
5. **`cond/eval.ts`**: `removedCharMatches` 実装 (payload-only)。
6. **`effect/validate.ts` + `scripts/taskA-validate-specs.cjs`**: 新 condition kind を whitelist 3点同期 (sync test が gate)。
   `removedFilter` 内 filter は既存 matchOneFilter。

touched engine files = 5 (cluster14 と同等の wave 規模)。新 verb/cost/hook 無し、新 condition 1個のみ。

## 5. rules grounding
- rules/07-08: contact 被除去=bUid、除去者=aUid。AP同値もリムーブ。
- rules/17 §【現場リムーブ時】「リムーブ方法は問わない」: leave:to-remove は全 cause で発火 (misplay-overflow 除く=rules/30)。
- rules/15: triggered 効果は未解決 → 現行動完了後 resolve (event.queue 既存機構)。同時発動は owner 順。
- rules/22: 「リムーブされたとき」は AP判定(removal)時点で発動、effect は action 終了後 resolve。
- rules/18 MR: MR の現場離脱 (→PA移動) でも「リムーブによって発動する能力」は発動 → leave:to-remove 発火を維持。

## 6. エッジケース (≥5、review が精査)
1. **0枚/不在**: by:{filter} で winner が filter 外 → no-op (発動済カウントは effect 側、rules/24)。
2. **複数 observer 同時**: handleHook 全 in-play 反復 → 全発火、owner 順 resolve (rules/15)。
3. **被除去キャラ自身の【現場リムーブ時】と observer の共存**: self 経路 + handleHook 経路で両立、二重なし。
4. **MR 被除去 (opp-turn → PA移動)**: leave:to-remove emit 維持必須 (rules/18)。removeToRemove が MR PA移動前に emit するか要確認。
5. **ガード時**: 被除去=guardUid(opp)、byUid=aUid(self attacker) → CONTACT-SELF 発火 (正)。
6. **any-method が effect/switch/cost 除去で発火**: cause 無filter → 発火 (rules「方法問わず」正)。misplay-overflow は emit 自体 skip。
7. **smoke baseline 移動**: MVP デッキに observer カードが居れば legitimate に移動しうる → 移動なら正当性検証後 re-baseline。

## 8. 敵対レビュー反映 — 確定設計 v2 (opus 3-lens, 全 GO-with-fixes)

レビュー (wf_0c859206) で実害 3 件を捕捉。本節が §1/§3/§6 の該当部を **supersede** する。

### v2-A. variant 表 訂正 (B09026 再分類, BLOCKER ×3)
- B09026 は実テキスト『相手の現場にいるキャラが自分の現場にいる〚カード名［伊織無我］〛とのコンタクトによって…』
  = **CONTACT-FILTER (cardName)**。BARE のままだと伊織無我以外のコンタクト除去で over-fire (BUG-117/118 系)。
- 確定: **CONTACT-SELF 22/42 ・ CONTACT-FILTER 3/6 (D09010=trait警察 / B06067=trait警察+excludeSource / B09026=cardName伊織無我) ・ CONTACT-BARE 2/3 (B01030/B01031) ・ ANY-METHOD 1/2 (B05106)**。
- B09026 の trigger filter は[伊織無我]、effect target は[大岡紅葉] (取り違え禁止)。rules/19 分割名 (B08019 大岡紅葉＆伊織無我) が[伊織無我]に一致する必要 → matchOneFilter の cardName split-name 対応を gate5 で pin。

### v2-B. removedCharMatches 条件 確定形 (excludeSource 追加, REQUIRED ×2)
```
{ kind:'removedCharMatches';
  side?: 'self'|'opp'|'either';                 // 全 variant='opp' (payload.side===owner→self)
  cause?: 'contact-ap'|'effect'|'switch'|'cost'; // CONTACT-*='contact-ap' / ANY-METHOD=省略
  by?: 'self' | { filter: TargetFilter; excludeSource?: boolean } }  // CONTACT-SELF='self' /
       // CONTACT-FILTER={filter,(excludeSource)} / CONTACT-BARE・ANY-METHOD=省略
```
- by:'self' = `payload.byUid === ctx.source.uid` (observer 自身=攻撃者)。
- by:{filter} = byUid(=攻撃者=winner=生存)を **owner side の scene 再取得** + matchOneFilter。excludeSource:true で byUid===source.uid を除外 (triggerCharMatches L308 流用)。
  - D09010 excludeSource 省略 (self も警察で発火, QA確認) / B06067 excludeSource:true / B09026 excludeSource 省略。
- by:{filter} の winner が partner uid (aUid='partner:self') の場合 scene 不在で no-op → 全 FILTER カードの「自分の現場にいる」と整合 (将来 partner 対象カードは payload byUid 種別 snapshot を別途要追加)。

### v2-C. payload から level/ap を DROP (層越え回避, REQUIRED)
- leave:to-remove payload = **`{ uid, cause, side, byUid? }`** に確定。`side`=removeToRemove の `player` (splice 前既取得, O(1))。
- effective level/ap 捕捉は `mutate/scene.ts → read/char.ts` の **層越え import (前例ゼロ・循環リスク)** を要し、かつ 53枚どれも除去キャラ自身を level/ap で filter しない → **removedFilter / level / ap は本 wave で実装しない**。
  将来必要時は printed (def 参照=leaf import) か judge の ax.apSnapshot.bAP を別途 payload 追加。

### v2-D. §6 エッジ 訂正 (NICE)
- §6.4 MR: `toPartnerAreaFromScene` は **caller ゼロ = MR能力① 未配線 (dead-code)**。MR 被除去も plain removeToRemove → leave:to-remove 発火 (rules/18 整合)。B05106=MR は side:'opp' observer で自身除去(side:self)では非発火。**MR relocation 実装は cluster15 スコープ外**。
- §6.6 cascade: ANY-METHOD の除去 effect は leave:to-remove を再 emit し得るが (a)【ターン1】limit で同一 ability 再発火抑止 (b) runAllUntilEmpty SAFETY_CAP で発散防止 (c) 解決順=next() turn-player→owner順。**limit 無し removal-observer は 53枚に存在しない (certify で確定する)**。存在すれば DEFER。
- RemoveCause (scene.ts L10 / atom-handlers.ts L879 の 2 箇所重複) は **不変**。byUid は独立 param。
- 3点同期: eval.ts **CONDITION_KIND_MAP に `removedCharMatches:true`** (switch case とは別、CONDITION_KINDS の source) + cjs CONDS + Condition union。sync-taskA-whitelists / tsc が gate。

## 7. review への論点 (解決済、上記 §8 に反映)
- D1 (ride-leave) の blast radius: removeToRemove caller 6 (contact のみ attribution、他5不変) で additive 保証が崩れる経路は無いか。
- `removedCharMatches` の side/by/cause 評価が 4 variant の公式テキスト語義と 1対1 か (意味等価)。
- splice 前 capture する level/ap は effective か printed か (除去キャラ filter を使うカードの有無で要否判断)。
- MR PA移動・stun・変装 入替え時の leave:to-remove 発火整合。
