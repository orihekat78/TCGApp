# 設計: ヒラメキ inline 化 + factory 廃止 (2026-06-03)

## ゴール
カットインで行った「factory 廃止 + 各カードに inline atom 化 (D08007 参照)」を、ヒラメキの factory (`hiramekiDraw` / `hiramekiCharStun`) に適用する。リファレンスは **D08013 a2** (インライン triggered ヒラメキ draw)。カード実装の話で UI 変更ではない。

- **不変条件**: 全カードの **ランタイム動作・description・テスト結果は不変** (構造リファクタ + 短縮形糖衣)。

## スコープ (factory 使用 3 カード)
- **D08024 a2** (`hiramekiDraw({n:1})`) → D08013 a2 同形に inline:
  ```typescript
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動 (action[事件] リムーブ時)
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ```
- **D08019 a2 / D11009 a3** (`hiramekiCharStun({side:'either'})`) → triggered + **sceneSetState 短縮形** に inline:
  ```typescript
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // キャラを1枚まで選び、スリープさせる
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
  ```

## 動作不変性
- hiramekiDraw → draw atom: **byte 一致**。
- hiramekiCharStun → sceneSetState 短縮形: **同一 pick query を生成** (Phase2 検証済、B2 で D08019 a1 / D11003 a3 が実証)。`{ player:'self', max:1, side:'either', state:'sleep' }` → `target:{kind:'pick', query:{area:'scene', side:'either'}, n:{min:0,max:1}, chooser:'self'}` + uid:'$pick'。単一 option `choice` を除去 (resolver は `options[0]` 実行で結果不変)。
- ⚠ choice 除去で AI seeded 列挙木が変わり smoke 決着分布が動く可能性 (カード動作は不変、cutin/Phase3 と同様の既知良性挙動)。

## 付随更新
- **factory 削除**: `src/cards/_shared/hiramekiDraw.ts` / `hiramekiCharStun.ts` + 各 unit test (`tests/cards/_shared/hiramekiDraw.test.ts` / `hiramekiCharStun.test.ts`) + spec (`shared-classes/hiramekiDraw.md` / `hiramekiCharStun.md`)。
- **barrel/index**: `src/cards/_shared/index.ts` から2 export 削除、`tests/cards/_shared/index.test.ts` の2 assertion を削除、`shared-classes/INDEX.md` を更新。
- **`tests/cards/_shared/caseTraitConditioned.test.ts`**: `hiramekiDraw` を fixture に使用しているため、inline AbilityDef (最小 triggered draw) に差し替え。
- **不変**: e2e/integration/listener の hirameki テスト (`hirameki-draw.spec` / `hirameki-char-stun.spec` / `hirameki-listener.test` / `hirameki-e2e.test` / `useEngineDispatch.hirameki.test`) は factory を import せずカード駆動なので inline 後も有効。

## エッジケース
- 候補0枚 (現場0) → sceneSetState 短縮形 `max:1` (min0) で skip 可、hirameki fire/skip は triggered listener 管轄 (不変)。
- スタン状態キャラ → sleep にならない (rules/24、engine 側で保証、不変)。
- デッキ0枚 → draw で自動リフレッシュ (rules/14、不変)。

## 検証
tsc + vitest 全件 + smoke 1000 (例外0) + e2e (hirameki-draw / hirameki-char-stun)。
各カード test が動作不変オラクル (D08024/D08019/D11009 の既存 test が PASS)。

## 関連
- リファレンス: `src/cards/ct-d08/D08013.ts` a2 (inline hirameki draw)
- 規約: `.claude/specs/card-authoring-convention.md` (1行atom / comment-above / 冗長 choice 除去 / 短縮形)
- engine: `evidence:remove-by-action` hook + triggered listener (`handleEvidenceRemovedHook`、不変)
