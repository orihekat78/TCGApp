# 次セッション キックオフプロンプト — 2026-05-23 末

新セッション冒頭で claude 自身がこのファイルを読んで context にする。

---

## 前セッション (2026-05-23) 概要

D08015 (小嶋元太) ワークフロー作成依頼から始まり、resolve-picks pattern B 修正 → 9 連続 BUG 起票/修正 cascade。24 commit、vitest 1573 PASS、smoke 1000 戦 0 例外維持。

詳細: [.claude/memory.md](../memory.md) / [.claude/sessions/2026-05-23.md](2026-05-23.md)

## 最優先タスク — BUG-077 RCA Phase 2 (Playwright trace 必須)

### 状況

**D08013 a1 step 2 evidenceToHand が UI 経路で動かない**:

- ログには「効果: 証拠 → 手札」が出る
- しかし evidence -1 / hand +1 が反映されない (silent skip)
- 4 phase の e2e integration test ([tests/engine/effect/bug-077-evidence-to-hand-e2e.test.ts](../../tests/engine/effect/bug-077-evidence-to-hand-e2e.test.ts)) で engine logic は全 PASS
- → UI dispatch 経路特有の問題 (Immer produce / Zustand store frozen state interaction 等の仮説)

### 具体的実施手順

1. **dev server 起動**: `npm run dev` (background)

2. **atom-handlers.ts の case 'evidenceToHand' 入口に console.log を一時埋め込み**:

   ```typescript
   case 'evidenceToHand': {
     const p = a.player as Player;
     const target = normalizeTargetToString(a.target);
     console.log('[BUG-077 trace]', {
       aTarget: JSON.stringify(a.target),
       target,
       evidence: s.players[p]?.evidence?.map((e) => e.cardId),
       handBefore: s.players[p]?.hand?.length,
     });
     // ... 既存 logic
   }
   ```

3. **useEngineDispatch.ts の effectPickResolve 内、`engineEvent.queue` 直前にも trace**:

   ```typescript
   console.log('[BUG-077 dispatch trace]', {
     pendingAtomVerb: pending.atomVerb,
     pendingAtomArgs: JSON.stringify(pending.atomArgs),
     candidates: pending.candidates,
     pickedUid: picked,
     resolvedAtomArgs: JSON.stringify(resolvedAtom.args),
   });
   ```

4. **Playwright で D08013 a1 を実機実行**:
   - localhost:5173 navigate
   - 対戦開始 → mulligan (D08013 が手札に来るまで)
   - ターン進行 (FILE 4+ まで、CPU 速度高速)
   - D08013 (level 4) 手札使用
   - step 2 modal 出る → 証拠選択 → click

5. **dev console output から原因特定**:
   - `aTarget` が pick query object のままなら → effectPickResolve dispatch が target を上書きしていない
   - `target` が undefined なら → normalizeTargetToString に問題
   - `evidence` が空配列なら → state が draft で反映されていない
   - 一致しない cardId なら → cand.cardId 取得ロジックに問題

6. **修正 + console.log 削除 + commit**
7. **ユーザー実機 verify 依頼**

### 仮説候補 (Phase D 完了で除外できなかった)

- Immer の auto-freeze で draft の splice が失敗
- Zustand store の pending object が frozen で `{...pending.atomArgs}` spread 時に何かが失われる
- post-dispatch drain の競合 (pendingEffectPick null クリアと resolved atom 実行のタイミング)

## 次優先タスク (BUG-077 完了後)

### A. BUG-067〜070 (未着手)

| BUG | severity | 内容 |
| --- | --- | --- |
| BUG-067 | 中 | 事件カード declared ability の `declaredUseCount` 不在、ターン①制限 enforcement 不可 |
| BUG-068 | 中 | `resolveBindRef` が charModifyAP/charModifyLP/discard 未配線、`$<key>.<field>` silent fail |
| BUG-069 | 低 | LogPanel が scene uid (`self-1` 等) を cardId/カード名 解決しない |
| BUG-070 | 中 | BUG-009 水平展開 4 項目 audit (リフレッシュ敗北 / 痕跡発見 / 現場 6 枚スイッチ / LP≤0 推理) |

### B. ユーザー実機 verify 依頼項目

- D08015 a1 (BUG-065/071/072 適用後): 1 ドロー → 1 リム の 2 step がログに時系列で出る
- D08013 a1 (BUG-077 修正後): 証拠+1 → 証拠→手札 → 手札リム の 3 step が log + 状態反映

## 必須遵守事項 (BUG-066 + 教訓 11)

「修正済」記述前に必ず 4 点 verify:

0. **カードの公式効果テキストを読む** (カードファイル冒頭コメント + description、step 数 = 動詞数)
1. **関連ファイル現状確認** (関連 BUG の関連ファイルを Read、修正内容が実在することを verify)
2. **警告語句 grep** (`暫定` / `TODO` / `FIXME` / `未対応` / `未配線` / `skip` / `本格対応` / `仮対応` / `workaround`、見つかれば別 BUG 起票)
3. **memory observation 検索** (mem-search で BUG ID + atom 名 / function 名)

加えて engine 関数修正時は **caller 側コードも 4 点 verify 対象** (BUG-071 教訓)。

## コード touchpoint

| ファイル | 役割 |
| --- | --- |
| `src/engine/effect/resolve-picks.ts` | pattern A/B 解決、side-channel set |
| `src/engine/effect/atom-handlers.ts` | atom 個別実行、awaiting-pick で tryRePickFromAtom 呼出 |
| `src/engine/listeners/triggered.ts` | triggered ability の queue |
| `src/ui/hooks/useEngineDispatch.ts` | dispatch 経由 atom queue + runAllUntilEmpty |
| `src/ui/components/EffectPickerModal.tsx` | 人間 pick UI |
| `src/ui/components/LogPanel.tsx` | log 表示 + ACTION_LABEL mapping |
| `tests/engine/effect/bug-077-evidence-to-hand-e2e.test.ts` | BUG-077 RCA test (Phase A-D PASS) |

## 検証コマンド

- `npm test` — vitest 全件 (1573 PASS 期待)
- `npm run typecheck` — TypeScript
- `npm run smoke:1000` — AI vs AI 1000 戦 (timeouts=0 exceptions=0 期待)
- `npm run docs` — auto docs 再生成
- `npm run dev` — dev server (Playwright trace 用)

## CLAUDE.md / 規約再確認

- 効率より精度 (速度 < 精度)
- ルール参照義務 (`.claude/rules/01〜30` / 推測禁止)
- 骨格凍結原則 (engine 編集は最小、共通クラス優先)
- 全 Markdown 100 行以内 (D08013-workflow.md / 一部 BUG ファイルは超過承認済み)
- pre-commit hook (`docs:check` 自動実行、差分あれば `npm run docs` で再生成)
