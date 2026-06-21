# engine拡張 micro-cluster — evidence-self→hand (handAddFromRemove fromSelf フラグ, 1 base / 2 刷)

**Round/Phase**: 2026-06-21 カード追加 wave (A 継続)。【ヒラメキ】「このカードを手札に加える」族。
証拠から action[事件] でリムーブされる**そのカード自身**を (リムーブエリア経由で) 手札へ戻す。

## engine 変更 (1 フラグ追加、純 additive、新 verb なし)

`src/engine/effect/atom-handlers.ts` の `case 'handAddFromRemove'` に **`fromSelf` 分岐 1 つ**を追加。
`fromSelf===true` で pick path をスキップし、`ctx.source.cardId` (= リムーブされた証拠カード自身) を
所有者の remove エリアから `lastIndexOf` (直近 push 分) で取得し `mutate.hand.add` で手札へ。

- **タイミング根拠**: action[事件] の `flow/action-case.ts removeOpponentEvidenceTop` → `mutate/evidence.removeTop`
  が `ev.cardId` を所有者 remove **末尾に push** 済。その後 `listeners/triggered.ts handleEvidenceRemovedHook`
  が `ctx.source = {cardId: ev.cardId, player: 所有者, area:'evidence'}` でヒラメキを起動 → `fromSelf` 分岐が
  `lastIndexOf` で「まさにこの 1 枚」を引き当てる (同 cardId の旧コピーが remove にあっても末尾優先で正しい)。
- **境界 (不在)**: source が remove に無ければ no-op + log (防御的、通常は必ず存在)。
- **atom args は `args: unknown`** → 型変更不要。**新 verb でない** (既存 handAddFromRemove に flag 追加) ため
  AtomVerb union / ATOM_PICK_SPEC / validate / cjs whitelist の同期不要 (`fromTop` と同型)。
- **回帰ゼロ確証**: `fromSelf` を使う既存カードは 0 (新フラグ)。既存 handAddFromRemove の pick / cardIds path は不変。
  smoke baseline 不変 (avg 10.998 / winsA 498 / exc 0) が証跡。

## DSL (ヒラメキ self-redirect)

a2 = `triggered{evidence:remove-by-action, optional}` + `atom handAddFromRemove{player:'self', fromSelf:true}`。
- `optional:true` = ヒラメキの fire/skip は所有者選択 (公式Q&A「【ヒラメキ】は発動させないことを選択できます」)。
- `player:'self'` は `ctx.source.player` (= 証拠所有者) に解決 → 所有者の remove → 所有者の手札。

## 追加カード (1 base / 2 刷、ALL_CARDS 1369 → 1371)

- **PR085 / PR091 沖矢昴** (赤 L4 AP4000 LP1 大学院生、PR、cardId 0481 の絵柄違い 2 刷):
  「【登場時】キャラを1枚まで選び、ターン終了時まで〚ブレット〛（このキャラのアクションはガードできない）を与える。
   【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。」
  - a1 = `triggered{enter,selfOnly}` + `choice→charGrantKeyword{uid:'$pick', kw:'ブレット', scope:'turn',
    target:pick{scene,either,n:{0,1}}}` (exemplar D02013/B03005 a1。`ブレット` granted は guard.ts:47
    `read.char.hasKeyword` が turnEffects.grantedKeywords を honor=read/char.ts:203)。
  - a2 = ヒラメキ self→hand (上記 fromSelf)。
  - PR091 は PR085 の spread (テキスト byte 同一)。

## DEFER (同族で発見した別 engine gate)

- **B06033/B06033P 「わが味方となるべし!!」** (緑 event L6): a1 = `sequence[ chain[evidenceToHand{max:1, pick},
  handToEvidence{n:1}], sceneEnter{from:hand, YAIBA緑lv6} ]`。公式Q&A「証拠から手札に加えたカードを登場可」が
  **swap→enter 順を強制** (swap で手札に来た札を enter 候補にする) → chain を sequence 末尾に移せない。
  **継続(continuation)上書き限界**: evidenceToHand が pick で pause すると chain が
  continuation=[handToEvidence] を set するが、親 sequence が同じ pick entry の continuation を [sceneEnter] で
  **上書き** (BUG-111 family、1:1 continuation 設計は nest 非対応) → handToEvidence が脱落。decoy §8 が検出。
  shipped の `sequence[chain[...]]` は全て chain が**最終 step** (後続無) でこの競合を回避している。
  → **continuation-nest** は hirameki verb とは別 engine 変更ゆえ「1 wave=1 engine パターン」原則で DEFER。

## 検証

- tsc clean。vitest full **2747 pass / 1 skip / 0 fail** (前 baseline 2739 から +8 = 新 decoy、減なし)。
- smoke:1000 **exceptions=0・baseline 不変** (avg=10.998 / winsA=498) = engine-additive 回帰ゼロ証跡。
- 新規 `tests/cards/evidence-self-to-hand.test.ts` **8 件** (実 engine 駆動):
  §1 ★self★ remove=[OTHER, PR085] で PR085 のみ手札 (別 cardId 残) / §2 ★lastIndexOf★ 同 cardId 複数で末尾を取る /
  §3 ★境界:不在★ no-op / §4 ★e2e★ `removeOpponentEvidenceTop` → removeTop が PR085 を remove へ + emit →
  listener が pendingHirameki{cardId:PR085} set → drain → a2 resolve → PR085 が remove→手札 (実 flow 一気通貫) /
  §5 PR085 grant ブレット (hasKeyword + turnEffects.grantedKeywords) / §6 PR091 spread / §7 出荷構造突合。
- playwright 回帰 suite (spectator-speed:79 は既知 timing flake、本変更は非MVP + `fromSelf:true` 以外で dormant=非交差)。

## 学び (恒久)

- **engine拡張 micro-cluster の clean yield は逓減を再追認**: ㉘ distinct-name-count=2base → ㉙ handToEvidence=1base →
  ㉚ evidence-top→hand=1base → ㉛ evidence-self→hand=**1base (2刷)**。連続 3 wave で 1base 級。
- **handoff の「1 base」候補が誤りでも、別 base が clean なことがある**: handoff は B06033 を本族の base としていたが、
  B06033 は continuation-nest 限界で実は DEFER 必須。決定論 yield scan で同 hirameki テキストの全カードを洗い直し、
  **実装可能な main effect を持つ別 base (PR085/PR091)** が clean と判明 → そちらを出荷。
  「既知 fix / DEFER note は hint であって保証でない」(shipped twin 突合 + decoy 実機検証で最終確認) の実例。
- **decoy が engine 限界を検出**: B06033 は certify/grounding 上は clean に見えたが、§8 decoy (swap 実行=証拠在) で
  handToEvidence 脱落を検出。非MVP は decoy unit test が唯一の engine 駆動証跡 (smoke では踏めない) を再確認。
- **「上から/N枚選び/このカード自身」は engine 上 3 経路**: deterministic-top (fromTop) / free-pick / deterministic-self
  (fromSelf)。後者2は pick をスキップする専用分岐が要る。
