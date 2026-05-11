# 主要アクションフロー (2026-05-11)

メインフェイズの6行動。Q8「クリック+確認」+ Q9「厳格モード」前提。
ゲーム開始時フロー (マリガン/先攻決定/オートフェイズ) は [ui-game-setup-flows.md](2026-05-11-ui-game-setup-flows.md)。

## 共通フロー骨格

```text
[idle] → click unit → [source-selected]
  → ActionMenu 表示 (canReason/canAction/canDeclareAbility で項目フィルタ)
  → select action → [targeting] (if needed)
  → click target → [confirming] (ConfirmModal)
  → OK → [executing] → アニメ + GameState 更新 → [idle]

任意の段階で Esc/右クリック/Cancel で前段階へ。
```

## ① 推理 — rules: [11](../rules/11-reasoning.md), [13ミスリード](../rules/13-keywords.md)

```text
1. アクティブな自分のパートナー/キャラをクリック
2. ActionMenu: [推理 (LPX)] [...] [キャンセル] (canReason() で disabled 判定)
3. 「推理」選択 → ConfirmModal:「○○で推理 (LP=X → 証拠X枚)。実行しますか?」
4. OK → キャラスリープアニメ
5. 相手のミスリード持ちチェック → 該当あれば <MisleadActivationModal>
6. ミスリード解決後、最終LP確認 (LP≤0なら証拠0)
7. デッキ→証拠エリアへLP枚分カードが飛ぶアニメ (裏向き)
8. ログ追加 → idle
```

## ② アクション[キャラ/事件] — rules: [07](../rules/07-action-flow.md), [08](../rules/08-contact.md), [10](../rules/10-action-event.md)

```text
1. アクティブな自分のキャラ/パートナーをクリック
2. ActionMenu: [推理] [⚡アクション] [...] (canAction(unit, type) で disabled 判定)
3. 「アクション」選択 → 対象ハイライト:
   - 有効: 相手スリープ/スタンキャラ + 証拠1+の事件
   - 無効: アクティブキャラ・パートナー (✕表示)
4. 対象クリック → ConfirmModal:「○○で○○にアクション (AP X vs Y → リムーブ予測)」
5. OK → キャラスリープアニメ
6. 【現場リムーブ時】効果が発動条件満たせば解決
7. ガード判定: 相手にアクティブキャラあり + ブレット持ちでない → <GuardSelectionModal>
8. ガードされなかった + 対象=キャラ → コンタクト発生 (ui-modal-flows参照)
   ガードされた → 攻撃キャラ vs ガードキャラのコンタクト発生
   対象=事件でガードされず → ヒラメキ判定 → 証拠 -1/+1 アニメ
9. アクション終了演出 (終了時能力発動・効果切れ) → idle
```

### ガード前の中断

ガード判定までにアクションキャラ or 対象キャラが現場を離れた場合、アクションは終了。コンタクト処理に進まない。

## ③ アシスト — rules: [01](../rules/01-victory-conditions.md), [13](../rules/13-keywords.md), [25](../rules/25-qa-effects-resolution.md)

```text
1. アクティブな自分のパートナーをクリック
2. ActionMenu: [推理] [⚡アシスト] [...] [キャンセル]
3. 「アシスト」選択 → 強警告 ConfirmModal:
   「アシストでパートナーがFILEへ移動し、このターン中は事件解決できなくなります。
    FILE が 7枚以上で解決編へ移行します。本当に実行しますか?」
4. OK → パートナースリープ → FILE末尾追加
5. FILE枚数 ≥ 7 なら自動的に解決編移行アニメ + スタンプ反転 (移行必須)
6. turnState.assistedThisTurn = true → 「事件解決」がメニューから消える
7. idle
```

## ④ 事件解決 — rules: [01](../rules/01-victory-conditions.md)

```text
1. アクティブな自分のパートナーをクリック (前提: 解決編 + 必要証拠数達成 + assistedThisTurn=false)
2. ActionMenu: [事件解決 ★ゲーム勝利] [...] [キャンセル]
3. 「事件解決」選択 → 勝利予告 ConfirmModal
4. OK → パートナースリープアニメ → 勝利画面 (セピア紙吹雪 + 関連カード)
5. ゲーム終了
```

## ⑤ 手札の使用 — rules: [05](../rules/05-turn-phases.md), [12](../rules/12-next-hint.md), [20](../rules/20-color-and-switch.md)

```text
1. 手札カードをクリック (disabled条件: 1ターン1回済 / ネクストヒント後 / FILE不足 / 色不一致)
2. キャラの場合: 現場スロットをクリック (5枚埋まりなら <SwitchTargetModal>)
3. ConfirmModal:「○○を現場に登場 (名乗り状態)」 → OK
4. アニメ: 手札→現場へカード飛び + 名乗りバッジ
5. enterOrder 自動カウント (疾風判定用)
6. 【登場時】能力発動条件チェック → 発動
7. turnState.handUseUsed = true → idle
```

イベントの場合: 現場登場ステップなし。効果即解決 → リムーブエリアへ。

## ⑥ ネクストヒント — rules: [12](../rules/12-next-hint.md)

```text
1. FILEエリアをクリック (FILE > 0 必要)
2. ConfirmModal:「FILE最上部を手札に加え、続けて1枚使用できます」 → OK
3. FILE→手札へカード飛びアニメ (パートナーは除く)
4. カード選択モーダル: FILE枚数以下レベルの手札 or 「使用しない」
5. 選択 → 通常の「手札の使用」フロー
6. turnState.nextHintUsed = true (手札の使用も以降不可) → idle
```

## ⑦ 【宣言】能力 — rules: [21](../rules/21-declared-ability-cost.md), [17](../rules/17-icons.md)

```text
1. キャラ/パートナー/MR/事件をクリック
2. ActionMenu に該当能力が表示 (canDeclareAbility で disabled 判定)
3. 選択 → ConfirmModal「コスト: ○○ を支払って効果発動」 → OK
4. コスト解決 (スリープ・リムーブ等)
5. 効果解決
6. declaredUseCount[ability.id]++ (ターン①/②制限管理) → idle
```

## 関連

- [ui-game-setup-flows.md](2026-05-11-ui-game-setup-flows.md)
- [ui-modal-flows-contact.md](2026-05-11-ui-modal-flows-contact.md)
- [ui-edge-cases.md](2026-05-11-ui-edge-cases.md)
