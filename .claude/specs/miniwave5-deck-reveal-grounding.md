# mini-wave #5: deck-reveal 拡張 grounding (2026-07-10 sonnet5 high ×3 実測、実装前)

> 対象 = cluster ③: B03049+P (bottom-reveal) / B05047 (per-card placement) / B01022 (multi-deploy)。
> worktree = C:/tmp/megaw1 branch `engine/miniwave5-deck-reveal` (2c3fe6a1 起点、着手時 rebase 必須)。
> 出典 = workflow wf_2b2e819a-8a1 journal。ROI 順に P3 → P2 → P1 (P1 は T3、別 session 可)。

## P3: B03049+P「デッキ下から1枚公開→白キャラ lv≤FILE なら登場(必須)、他は手札」 — T2 小

- gap: picks.ts atomDeckRevealUntil (L82-112) 走査がトップ順固定。**新規 verb 不要 — `fromBottom?: boolean` param 1本**。
  maxN 分岐 `deck[i]` → `deck[deck.length-1-i]` / 非 maxN `[...deck].reverse()`。既存 ~60 消費者は byte 互換。
- カード = shipped idiom 組合せ: cost `{kind:'removeFromScene', target:{kind:'self'}, n:1}` (B04009 VERBATIM) /
  deckRevealUntil{fromBottom:true, maxN:1, filter:{color:'白',kind:'character',levelMax:{dyn:'$self.fileCount'}}, bind/bindMatch} /
  conditional matched → sceneEnter{cardId:'$matched.cardId'} (D11019 型、shuffle step 無し) /
  handAddFromDeck{cardId:'$revealed.cardId'} (B01050 型、matched 時 $revealed=[] で no-op) / a2 ヒラメキ draw (B01050 a3)。
- ⚠ chooseMatch:'upTo' を付けない (公式QA「必ず登場」— 必須分岐)。
- ⚠ refresh 境界: handAddFromDeck (core.ts:865-886) / sceneEnter deck-splice (scene.ts:184-189) は take 後 deck0 の
  即 refresh を内部処理しない (既存 shipped 同等、新規リスクではないが probe で明記)。
- UI 不要 (switch は既存 SceneSwitch 経路)。

## P2: B05047「上から2枚見て各カードを上か下へ」【登場時】【変装時】 — T2 + Playwright (新 UI 部品型)

- gap: per-card top/bottom 振り分け機構 全不在。deckToBottomBound は一括 bottom のみ (picks.ts:205-243)。
  resolveBindRef は配列 bind の先頭のみ ($revealed[1] index 参照不可)。forEach 内 human pick 未サポート設計。
- 設計 (7-8 files): 新 atom `deckPlaceSplitBound{player,bindKey}` — human は side-channel
  `__pendingDeckPlaceSide{player,cardIds}` early-return (chooseMatch __windowIds 同型) / AI は全カード元順 top (恒等、
  souza AI default 踏襲 = smoke baseline 不変)。dispatch 追加 (atom-handlers.ts:244-251) / _shared.ts drain /
  useEngineDispatch action `deckPlaceResolve{top[],bottom[]}` (deckReorderResolve L331-357 同型 multiset 検証) /
  store pendingDeckPlace / **新規 DeckPlaceModalHost.tsx** (DeckReorderModalHost 土台、上へ/下へ 2 カラム)。
- カード: B02044 dual-hook idiom (a1 hook:'enter' selfOnly / a2 hook:'disguise:into' selfOnly に同一 body 複製) →
  sequence[deckRevealUntil{maxN:2,bind:'$revealed'}, deckPlaceSplitBound{bindKey:'$revealed'}]。
- ⚠ 逐次 choice×2 代替案は不採用 (mutate.deck.toTop/toBottom は bulk API — 逐次だと「両方 top の相対順」が固定される)。

## P1: B01022「上から6枚見て lv4以下[少年探偵団] 2枚まで登場、残りシャッフルしてデッキ下」 — **T3** (4 lens + Playwright)

- Route B 採用: plain reveal → window 制限つき別 sceneEnter multi-pick → 既存 deckToBottomBound+deckShuffle。
- engine 3 (additive): ①picks.ts:164-183 bindKey 書込みの matched-exclusion を `bindMatchKey !== undefined` で gate
  (既存 **168** 消費者は全部 bindMatch ペア済 = 挙動不変、grep 実測済 (grounding 時の 91+ は過小計上)) + Candidate に index 追加 (型定義済 candidate.ts:7)。
  重複 cardId 耐性のため indexOf 再利用せず並行 index 配列で 1:1 対応。
  ②TargetQuery.fromGroupCards?: string 新設 (effect.ts:296-327、fromGroup は char 専用のため独立 field)。
  ③candidates.ts fromGroup ブロック (L201-210) と並列に fromGroupCards 分岐 (bound index Set で card-kind post-filter)。
- UI 4: CardListModal CardListKind に 'deck' + TITLE/HINT/PICK_BANNER (multi-select 機構は pickNMax>1 で実装済・流用) /
  Playmat.tsx:358-384 pickAreaKind に area:'deck' (cards ソースは gameState 直読み禁止 — pending.candidates から構築、
  window 外が見えるため) / DeckRevealOverlay hold 条件を pendingEffectPick 存在まで一般化 (現状 awaitingPick のみ →
  human multi-pick 待ち中に自動進行 = **soft-lock/演出破綻**)。
- カード: sequence[discard 1, deckRevealUntil{maxN:6,bind:'$revealed'} (filter/chooseMatch/bindMatch 全省略),
  sceneEnter{cardIds:'$pick.cardIds', from:'deck', target:{pick, query:{area:'deck',side:'self',
  filter:{kind:'character',trait:'少年探偵団',levelMax:4}, fromGroupCards:'$revealed'}, n:{min:0,max:2}}},
  deckToBottomBound{bindKey:'$revealed'} (sceneEnter 済 splice 分は cardId 不一致 skip 防御 L219-227), deckShuffle]。
- ⚠ RED probe で「pick 待機中に他の deck 操作が割り込まない」ことを確認 (index 前提の唯一の弱点)。

## 手順残り (mini-wave loop)

RED probe (tests/engine/effect/miniwave5-deck-reveal.test.ts、miniwave3-verbs scaffold + event._resetRegistry 教訓) →
実装 → `npm run hybrid:prepare -- --reps B03049,B05047,B01022 --include-deferred --skip-refresh --max-refusals 2` →
author=opus/verify=sonnet5 workflow (payload Read 方式) → hybrid:finish → gen:probes + probe agent →
混成 2-lens (P1 は 4 lens+Playwright) → ship。P3+P2 先行 ship / P1 切り離し可。
ship 後: DEFERRED-INDEX 該当行消し込み + roadmap S1/S2 行更新 + 随伴 `node scripts/gen-p-spread.cjs --dry`。
