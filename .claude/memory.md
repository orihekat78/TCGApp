# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-19.md = ⑱〜㉒ / 2026-06-19-2.md = ㉓〜㉕。)

## セッション㉖ (2026-06-19) — カード追加 wave: declared+cost / enter-observer (engine変更0、3枚)

ユーザー選択=カード追加 wave 継続。次wave候補 B07066 / PR194 / B08075 (DEFERRED-INDEX) を recon→certify→出荷判定。

### 出荷 3枚 (ALL_CARDS 1354→1357、全 engine変更0 = 既存 verb のみ)
- **B07066 / B07066P 赤井秀一** (赤/Lv8/AP7000/LP2/SR): 2 ability composite。
  - a1【自分ターン中】【ターン1】= **enter-observer** (自分側 level≤7 赤井家 の登場で AP8000以下を1枚までリムーブ)。
    `trigger{hook:'enter', matcherCondition:triggerCharMatches{side:'self', payloadKey:'uid', filter:{trait:'赤井家',levelMax:7}}}`
    (NOT selfOnly) + condition turn:self + limit turn1 + sceneRemove{apMax:8000,max:1,side:either}。**B04017 が完全同型**。
    自身 Lv8 なので self-enter は levelMax:7 で自然除外。
  - a2【宣言】【ターン1】= cost `sleepChar{自/赤井家 pick}` (自身が赤井家 → trait filter で self 包含、B05018/B09082同型) →
    look-3{kind:character,trait:赤井家,chooseMatch:upTo}→handAdd→deckToBottomBound→加えたら discard1 (B05078同型)。
- **PR194 灰原哀** (青/Lv2/AP1000/LP1/PR): 【宣言】cost `removeFromScene{self}` (B05018「リムーブエリアに移す:」完全同型) →
  look-2 **filter省略** (=match-all=forced first-match=top) → handAdd → deckToBottomBound。**B01048 同型** (forced-take-top、
  filter フィールド省略で pure-JSON = targetFilterToPredicate(undefined)===()=>true)。

### DEFER: B08075 ブライダルは女が主役 (event)「以下から3つまで選んで行う(上から順)」
certify は green を返したが **self-review全句突合で false-green を検出 → DEFER**:
spec が bare `sequence[opt1,opt2,opt3]` (各 option 内部 0-pick=skip 相当) で表現。だが **opt3 (デッキ4枚見て…残りデッキ下) は
0-take でも top4→bottom の deck 並べ替え副作用がある** → 「opt3 を選ばない (deck 不変)」と「opt3 実行で 0-take (deck scramble)」が
非等価 = opt3 が **unskippable** (fatal、敵対verifier も見落とし)。正しい model = `sequence[optional{opt1},optional{opt2},optional{opt3}]`
だが (a) subset-of-options は唯一カードで前例なし (b) CPU は optional 全 skip = event 完全 no-op (c) optional+pick 合成は
B09056 系 choice-surface gap の既知 fragility。→ DEFER (proper multi-select-options 機構 or optional+pick 合成検証後に再訪)。
※ opt2 charGrantKeyword 短縮形 pick は Task D E0 (atom-handlers:1095) で実装済 = OK。問題は opt3 のみ。

### 検証 (全 green)
engine変更0 (validate-specs pass) / tsc0 / 新 `tests/cards/wave-declared-cost.test.ts` 13件
(a1 matcherCondition: 赤井家L7→true/L8→false/探偵→false/opp→false を evalCond 直で 1対1 / a1 effect apMax:8000 decoy /
a2 deck-look kind+trait decoy / PR194 forced-top decoy / descriptor pin) / vitest 2686(+13) /
smoke exc=0・baseline 不変 (avg=11/winsA=498) / e2e 121pass・1skip (flake なし) / certify(opus) 3/3 green+verifyOk。
非MVP カード (ct-p07/pr-01) は MVP deck (CT-D08/D11) 不在 = 実機盤面に出ない → playwright per-card 不適用、
decoy unit test が実 engine 効果解決経路を駆動 = BUG-117/118 の「engine が filter を実評価」証跡。

### 学び (恒久)
- **certify GREEN+verifyOk でも codegen 前に shipped exemplar と全句突合必須** (B08075 で false-green 検出。
  敵対verifier も「0-pick=skip」近似の deck-reorder 副作用を見落とした)。[[feedback-certify-spec-self-review]]
- enter-observer (「別のキャラが登場したとき」) = `triggerCharMatches{side, payloadKey:'uid', filter}` (NOT selfOnly)。
  enter payload は player を持たないため payloadKey:'uid' 必須、side は scene-scan で導出 (B04017/PR117/PR118 同型)。
- filterless mandatory-1 deck-look (「N枚見て1枚必ず手札」) = filter 省略 → forced first-match=top (B01048/PR194、shipped近似)。
  player の「N枚から選択」は失うが 骨格凍結下では engine の唯一の handling (chooseMatch は 'upTo' = 0枚可 のみ)。
- B03056 の旧 certify (.tmp/certify、2026-06-16) は `conditional{if:sceneHas,then:optional}` で refuted だが、
  出荷版 (㉕) は `ability.condition` (trigger時評価) に restructure 済 = safe。stale certify が collect-greens で refuted 表示は noise。

### branch / commit
branch `cards/wave-declared-cost` → (commit 後 main ff-merge + push 予定)。B08075/B08075P は defer.json + DEFERRED-INDEX 追記。
