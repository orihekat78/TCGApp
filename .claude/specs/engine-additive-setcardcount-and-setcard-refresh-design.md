# engine additive: $self.setCardCount dyn + charSetCard fromDeckTop refresh (session64)

NEXT-PROMPT option B の「forEach-scene setCard」「caseMonoColor 簡約」等は **全て engine 変更不要** と
deterministic grounding で判明 (keyword filter / boundMatchesFilter / 既存 caseMonoColor が既に被覆、
「解禁表記 stale」教訓)。本 session は **本物の additive gap 2 件** を実装する。

両 unit とも独立 additive。挙動不変ゲート: tsc0 / vitest baseline (HEAD=3199) / smoke:1000 winsA=498 /
専用 test / 8lint。各 unit を独立 commit + FF push する。

---

## Unit A — `$self.setCardCount` dyn token (B05030 主眼 解禁)

**gap (B05030.ts 内に明記済)**: 「このキャラにセットされているカード1枚につき AP+1000」(継続) を表す
dyn token が不在。`src/engine/dyn/eval.ts` resolveSelf は sceneTrait/faceUpEvidence/fileCount/ap/lp/uid/cardId のみ。

**fix (engine 1 file, 単一 honor site)**: dyn token に sync registry は無い (resolveSelf が unknown で throw)。
- `import { scene } from '@/engine/read/scene.js'`
- resolveSelf の **char-level** 分岐 (uid 解決後 switch、ap/lp と同列) に追加:
  ```ts
  case 'setCardCount':
    return scene.byUid(state, uid)?.setCards.length ?? 0;
  ```
- 安全性: `setCards.length` (静的 state field) を読むのみ → ap/lp 再帰なし (BUG-156/157 と無縁)。
  `continuousDelta` (read/char.ts:45) が `ctx.source.uid` = modifier 所有 char を設定済 → uid 利用可。
  既存カードは本 token 未使用 → smoke winsA=498 を機械保証。

**card (B05030.ts)**: deferred 主眼を D08005 a1 と同型で un-defer:
```ts
const a2: AbilityDef = {
  id: 'a2', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDelta: { dyn: '$self.setCardCount * 1000' } },
  description: '【自分ターン中】このキャラにセットされているカード1枚につき、AP+1000。', ...
}; // abilities: [a1, a2]
```
→ B05030 が **fully faithful** 化 (突撃[キャラ] + 登場時set + 自分ターン中 set数×AP)。

**test**: dyn eval (set 0/1/N → 0/1/N、decoy: 他 char の set / stackedCards は数えない) +
B05030 integration (自ターン: AP=5000+set×1000 / 相手ターン: turn 条件で bonus 0 / 登場時 set 1 → 自ターン 6000)。

---

## Unit B — charSetCard `fromDeckTop` refresh-on-empty (BUG: deck0 refresh 未配線)

**gap (latent BUG, BUG-142 同族)**: `char.ts:226` の fromDeckTop empty-deck 分岐が
`log 'empty-deck'; return` で **no-op** = rules/14「デッキ0で即 refresh」+ B08033 公式Q&A
「残り全部セット→リフレッシュ→残り分セット」違反。36 shipped カードが fromDeckTop 使用 (deck0 edge のみ影響)。

**fix (engine 1 file)**: char.ts:226 の no-op を draw/fileAdd/evidenceGain (core.ts:201-220) と同型の
refresh-then-loss に置換 (BUG-153 host-absent check は先行のまま維持):
```ts
if (sscDeck.length === 0) {
  const r = mutate.deck.refresh(s, sscP);
  if (!r.ok) {
    if (s.gameResult === undefined) mutate.gameResult.set(s, sscP === 'self' ? 'opp' : 'self', 'deck-out');
    mutate.log.append(s, {..., action:'effect:charSetCard', target: scUid, result:'empty-deck-refresh-fail'});
    return;
  }
}
scCardId = s.players[sscP].deck.shift()!;  // refresh 後 remove>0 ゆえ ≥1 枚
```
水平展開: 短縮形 path (paShortFormAwait, uid 未指定 + n/max) も resolve 後 **同 explicit-uid 分岐に再 dispatch**
されるため単一 site 修正で被覆 (char.ts:231 が唯一の fromDeckTop deck.shift)。

**test**: fromDeckTop で deck0 → refresh 発火 (remove→deck shuffle + 相手 evidence+1) → set 成功 /
deck0 かつ remove0 → 敗北 (gameResult deck-out) / deck≥1 → 従来通り (回帰0) /
host-absent は deck 不消費のまま (BUG-153 不変)。

**risk**: shipped-path (36 card) の deck0 edge 変更 → smoke 再 gate 必須。挙動は rules/14 faithful 化 (= bug fix)。
BUG-XXX エントリ作成。
