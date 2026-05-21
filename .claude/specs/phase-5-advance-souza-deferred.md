# Phase 5 advance: Souza Sub-task B / C 確認 + 公式 defer 宣言

## Context

Phase 9 ロードマップ A の Souza Sub-task B (人間用順序決定 UI) と Sub-task C (「発見された」参照効果)
について、MVP デッキ (CT-D08 / CT-D11) の全カードを grep で確認した結果、
**souza atom を使うカードが 1 枚も存在しない** ことが判明。

公式 defer 宣言として spec 化、後続セッションで MVP 外カードが追加されるか
Phase 5 advance.2 の判断が出るまで実装着手しない。

## 確認結果

```
$ grep -r "souzaX\|verb: 'souza'" src/cards/ct-d08 src/cards/ct-d11
(0 matches)
```

唯一の言及は `src/cards/_shared/souzaX.ts` (共通ユーティリティ):
- 行 6: 「公開したカードを『発見された』カードとして、その後の効果を解決する (rules/13)」
- 行 9: 「『発見された』参照効果は Sub-task B/C で `state.discoveredCards` を追加して実装予定」

## 現状の engine 実装

`src/engine/effect/atom-handlers.ts:317-348` の `case 'souza'`:
- defender のデッキ上 X 枚を **peek 順 (= AI 自動順序)** でデッキの下に移す
- `HeuristicPolicy.chooseSouzaOrder` を呼ばない (現状は実質 no-op の peek 順)
- log には `revealed ${count}` を記録、`state.discoveredCards` は無し

→ MVP のカードが souza を使わないため、本 deferred 仕様で問題なく動作中。

## Sub-task B (人間用順序決定 UI) defer 理由

実装に必要な構成要素:

1. **`pendingSouza` side channel** (store + listener)
2. **`souzaResolve` dispatch action** (useEngineDispatch)
3. **`useSouzaFlowDriver` hook** (AI 自動 / human modal 待ち)
4. **`SouzaReorderModal.tsx` の完成** (drag-and-drop or up/down 並べ替え)
5. **`souza` atom の rewrite**: 現状の同期 peek 順を `pendingSouza` で人間 / AI 入力待ちに

MVP カードが使わないため、**本 commit では実装しない**。
将来 souza-using カードが追加されたら以下の順序で実装:
- まず engine 側 (atom rewrite + listener / side-channel)
- 次に UI 側 (driver + modal 完成)
- 並行して unit / E2E test

## Sub-task C (「発見された」参照効果) defer 理由

`state.discoveredCards: ReadonlyArray<string>` field を `GameState` に追加し、
souza 解決中にこの list を埋める。「発見された」を参照するカード効果 (例: 「【発見】の中から
特徴[警察]を 1 枚手札に加える」等) は GameState 経由でアクセスする。

MVP に該当カード無しのため deferred。

## 関連

- Plan: `C:\Users\arumi\.claude\plans\jiggly-watching-lake.md` (A 節 / Souza Sub-task B / C)
- Phase 5 advance UI (A): Misread UI は完了 (`35a0736`)、本 spec で Souza B/C を deferred 化
- 次フェーズ候補: Cleanup (隠れタスク 9 件)

## 補足: 「現状で十分動く」根拠

- smoke 1000戦 (HP × HP): 525/475、exceptions 0、souza 関連エラーなし
- E2E 38 全緑、souza 関連 spec なし (MVP デッキで発火しないため)
- typecheck clean、`_shared/souzaX.ts` は実装済だが card 側で未使用
