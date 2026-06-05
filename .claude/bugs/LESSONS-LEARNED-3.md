# LESSONS LEARNED 3 — BUG-117〜121 期 (2026-06-05/06)

[LESSONS-LEARNED.md](LESSONS-LEARNED.md) (教訓 1〜11) / [LESSONS-LEARNED-2.md](LESSONS-LEARNED-2.md) (12〜22) の続き。

## 教訓 23: 型/DSL に field・前提が在る ≠ engine が評価する (silent field-drop)

**該当**: BUG-117 (deckRevealUntil の ap/lp filter) / BUG-118 (matchOneFilter の kind filter)

declarative な filter/条件は **型 (TargetFilter) に field が在っても、それを受ける engine の評価経路が
実際に読むとは限らない**。typecheck は通るため見落とす。BUG-117 は ap/lp、BUG-118 は kind が、
評価経路 (targetFilterToPredicate / matchOneFilter) で **黙って drop** され、カードがテキストと違う候補を拾っていた。

- TargetFilter の評価経路は **複数** ある (matchOneFilter=target pick の正路 /
  targetFilterToPredicate=deckRevealUntil 専用)。新 field を型に足したら **全経路**に評価を入れる。
- → enforcement: card-addition-checklist §7「画面処理 = テキスト文言」Playwright 検査 (decoy を盤面に置く)。

## 教訓 24: turnEffects key を足したら clearTurnEffects も対称更新

**該当**: BUG-119 (charModifyLevel の lvlMod_turn/contact が turn-end で未削除 → 永続化)

`mutate/char.ts` で新しい turnEffects key (lvlMod_turn 等) を導入したら、**同ファイルの
`clearTurnEffects` (turn-end cleanup) にも対応する delete を必ず追加**する。ap/lp と対称に保つ。
e2e は「適用 → ターン跨ぎ → 解除」まで検証する (同一ターン内 assert だけでは未検出)。

## 教訓 25: 「選択者」と「対象の側」を混同しない / 複数択 surface は trigger 種別ごと

**該当**: BUG-120 (charSetCard 短縮形の byPlayer=a.player で chooser が相手に) /
BUG-121 (enter トリガの複数択 choice が surface されず option 0 既定化)

- pick/choice の **byPlayer (=選択者=常に controller=ctx.source.player)** と
  **side/player (=対象の側)** を分離する。短縮形 verb 追加時、参照実装は charModifyAP。
- 複数択 choice の human surface 経路は trigger 種別で異なる (declared=useActionsPanelFlow:606 /
  enter等=pendingEffectChoice 機構)。新 choice カードは **トリガ別に surface するか実機確認**。
- → enforcement: card-addition-checklist §7 の「選択者」「複数択 modal」項目 + [[choice-surface-pending-effect-choice]]。

## 教訓 26: filter の「値の格納先」と「エリア×カード種別」を実データで確認する

**該当**: BUG-122 (filter.keyword:'カットイン' が keywords[] のみ参照で ability-icon を未検出 → 候補0で機能不全) /
BUG-123 (remove/hand pick で kind:'character' 欠落 → 同色イベントが誤候補化)

教訓 23 (型に field 在る≠評価する) の **値レベルの続き**:

- **値の格納先**: filter.keyword は型上任意文字列だが、アイコン能力 (カットイン/変装/ヒラメキ/ミスリード)
  は keywords[] でなく ability 構造で表現される。判定述語は `engine.read.keyword.defHasKeyword` に一元化し、
  複数経路 (matchOneFilter / contact.isCutInCard) が別実装しない (ドリフト = field-drop 再発の温床)。
- **エリア × kind**: イベントを含むエリア (hand/remove/deck) から「キャラ」を選ぶ pick は `kind:'character'`
  必須。色/レベル filter だけだと同条件イベントが混入 (trait/cardName filter は events traits:[] で安全)。
  scene area は char 専用なので不要。
- → enforcement: card-addition-checklist §7「アイコン能力 filter」「エリア × kind」項目。

---

## 教訓ファイルの更新運用 (2026-06-06 明文化、user 質問への回答)

教訓ファイルは **自動更新されない** (hook/script 無し)。以下を **手動運用** とする:

1. **バグ修正時 (即時)**: 各 `BUG-XXX.md` の「防止策/教訓」を埋める (個別レベル)。
2. **同種バグ 2 件以上 or session 完了時**: 横断教訓を `LESSONS-LEARNED-N.md` に起こす
   (本ファイルが BUG-117〜121 の例)。**月次 audit 待ちにしない**。
3. **教訓 → enforcement**: 各教訓に lint script or checklist 項目を紐づける (passive doc で終わらせない)。
4. 100 行を超えたら `-N+1.md` に分割し、[LESSONS-LEARNED.md](LESSONS-LEARNED.md) にポインタを残す。

## 関連

- [BUG-117](BUG-117.md) / [BUG-118](BUG-118.md) / [BUG-119](BUG-119.md) / [BUG-120](BUG-120.md) / [BUG-121](BUG-121.md)
- [card-addition-checklist.md](../specs/card-addition-checklist.md) §7 (text-faithfulness Playwright 検査)
