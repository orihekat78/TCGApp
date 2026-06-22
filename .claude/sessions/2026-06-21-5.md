# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-21-3.md = ㉙ / 2026-06-21-4.md = ㉚。)

## セッション㉛ (2026-06-21) — engine拡張 micro-cluster: evidence-self→hand (handAddFromRemove fromSelf, 1base/2刷)

ユーザーが A (カード追加継続) を選択 (B/C 推奨だったが)。決定論 yield scan で【ヒラメキ】「このカードを手札に
加える」族を洗い直し → handoff の base (B06033) は別 engine 限界で DEFER 必須と判明、別 base PR085/PR091 が clean と発見。

### engine 変更 (1 flag、純 additive)
`src/engine/effect/atom-handlers.ts` `case 'handAddFromRemove'` に `fromSelf` 分岐追加。fromSelf=true で pick skip →
`ctx.source.cardId` (= リムーブされた証拠カード自身) を所有者 remove から `lastIndexOf` で取り手札へ。
- タイミング: action-case `removeOpponentEvidenceTop` → `mutate/evidence.removeTop` が ev.cardId を remove 末尾に push →
  `triggered.ts handleEvidenceRemovedHook` が ctx.source={cardId:ev.cardId, player:所有者} でヒラメキ起動。
- args:unknown ゆえ型/whitelist 同期不要 (fromTop 同型)。回帰ゼロ (新フラグ、既存 pick/cardIds path 不変)。

### 出荷 (ALL_CARDS 1369→1371、cards/wave-evidence-self-to-hand)
- **PR085/PR091 沖矢昴** (赤L4 AP4000 LP1 大学院生、cardId 0481 絵柄違い2刷)。
  a1 = 登場時キャラ1枚まで pick→ターン終了まで〚ブレット〛(charGrantKeyword{$pick,turn}、exemplar D02013/B03005)。
  a2 = hirameki self→hand (上記 fromSelf)。PR091 は PR085 spread。

### DEFER (decoy が engine 限界を検出)
- **B06033/B06033P** (緑event「わが味方となるべし!!」): hirameki verb は本 wave で解禁したが、a1 =
  `sequence[chain[evidenceToHand{pick}, handToEvidence], sceneEnter{YAIBA}]` が **continuation-nest 限界**に抵触。
  evidenceToHand が pick で pause すると chain の continuation=[handToEvidence] を親 sequence が [sceneEnter] で
  **上書き** (BUG-111 family、1:1 continuation nest 非対応) → handToEvidence 脱落。公式Q&A「証拠から加えた札を登場可」が
  swap→enter 順を強制し chain を sequence 末尾に移せない (shipped の sequence[chain] は全て chain が最終 step)。
  別 engine 変更ゆえ「1 wave=1 engine パターン」原則で DEFER。decoy §8 が検出。

### 検証 (全 green)
tsc0 / vitest **2747pass 1skip 0fail** (2739+8新) / decoy 8pass / smoke exc=0・baseline不変(avg10.998/winsA498) /
playwright **121pass 1skip 0fail** (spectator-speed:79 flaky 今回 pass) / 敵対verify opus **OVERALL SHIP/8点ok/refute0**
(production hiramekiResolve path=useEngineDispatch:368 も独立確認)。validate-specs の PR280 fail は pre-existing 無関係。

### 学び (恒久)
- **handoff の base 候補が誤りでも別 base が clean なことがある**: B06033(handoff想定) は DEFER 必須、PR085/091 が clean。
  yield scan で同テキスト全カードの **main effect 実装可否**まで洗うこと。「DEFER note は hint であって保証でない」。
- **decoy が engine 限界を検出**: B06033 は grounding 上 clean に見えたが §8 (swap実行) で handToEvidence 脱落を検出。
  非MVP は decoy unit test が唯一の engine 駆動証跡。境界 (swap在/不在 両方) を必ず踏む。
- **clean yield 逓減を再追認**: ㉘=2base→㉙=1base→㉚=1base→㉛=1base(2刷)。engine拡張 micro-cluster は 1base 級が現実。
- spectator-speed:79 flaky は今回 pass (~40% 失敗の日もある)。C タスク候補のまま。

### branch / commit
branch `cards/wave-evidence-self-to-hand`。docs同期→commit→main ff-merge→push→CI green 予定。
DEFERRED-INDEX: evidence-self→hand cluster section 追加 + B06033 行を新 gate (continuation-nest) に更新。
