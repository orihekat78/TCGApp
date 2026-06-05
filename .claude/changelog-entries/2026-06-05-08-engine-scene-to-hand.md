## Engine 拡張 #4: sceneToHand verb + B06069/B06069P 鈴木園子

**Round/Phase**: 2026-06-05 engine-extension-plan.md step 4

「キャラを手札に戻す (bounce)」効果 (96 枚解禁、unique 27 枚) の primitive `sceneToHand` を
additive に追加。最初の利用カードとして B06069 鈴木園子 (+ パラレル) を batch #1 として実装。

### 変更内容 (additive)

- **`src/engine/mutate/scene.ts`**: `toHand(s, uid)` — char を **所有者の手札** へ移す
  - rules/16: setCards / stackedCards はリムーブエリアへ (離場時のセット解除)
  - rules/17: リムーブではないため `leave:to-remove` は **emit しない**
- **`src/engine/types/effect.ts`**: AtomVerb に `'sceneToHand'` を追加
- **`src/engine/effect/atom-pick-spec.ts`**: `sceneToHand: { defaultArea:'scene', mode:'PA' }`
- **`src/engine/effect/validate.ts`**: ATOM_VERBS に `sceneToHand` を追加
- **`src/engine/effect/atom-handlers.ts`**: `case 'sceneToHand'` (PA 短縮形 + skip-unresolved + 確定 uid)

### 重要な仕様

- **所有者の手札へ戻る**: effect 発動側 (e.g., self) ではなく、char の所属プレイヤー (e.g., opp) の手札へ。
  「相手キャラを手札に戻す」効果は相手の手札を増やす (公式裁定通り)
- **leave:to-remove 不発動**: bounce はリムーブ手段ではないため、rules/17 の「現場リムーブ時」は
  発動しない。removeToRemove と toHand は別経路。
- **PA 短縮形対応**: `{ player, max, side, filter }` で pick query を自動構築

### 実装カード batch #1

| ID | No | カード名 | 効果 |
|----|---|---|---|
| B06069 | 0690 | 鈴木園子 | 【事件編】declared sleep cost → 1ドロー / 【解決編】declared sleep cost → 相手 levelMax:7 を1枚 bounce |
| B06069P | 0690 | 鈴木園子 (parallel) | 同 (rarity 'CP') |

### 互換性 (回帰 0 の根拠)

- 新規 verb のため既存カードは影響を受けない
- typecheck clean / 全 vitest 1757 pass · 1 skip (回帰 0、baseline 1753 + 新規 4)

### 検証

- 新規 unit (`atom-handlers.test.ts` +4): self→hand / opp→opp.hand / setCards→remove / 非リムーブ
- 新規 e2e (`engine-extensions-2026-06-05.spec.ts` +1) — 計 5/5 pass
  - B06069 a2: declared → pendingEffectPick(sceneToHand) → effectPickResolve(opp-bnc) →
    opp 手札に D08013、opp scene 空 を実機検証
- ALL_CARDS 874 枚 (+2)

### 残実装 (25+ 枚)

- B06076 ジェイムズ・ブラック (解決編 enter bounce + declared discard, complex)
- B07008 小嶋元太 (FILE5 enter + optional self-sleep)
- B01067/B03070 メアリー (アクション[事件]証拠得時 bounce — 別 hook 必要)
- 他、bounce を含む 20+ 枚は次バッチで対応予定
