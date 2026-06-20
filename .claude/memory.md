# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-19.md = ⑱〜㉒ / 2026-06-19-2.md = ㉓〜㉕ / 2026-06-19-3.md = ㉖。)

## セッション㉗ (2026-06-21) — カード追加 wave: DSL 再author (engine変更0、3rep/5刷)

ユーザー選択=カード追加 wave 継続 (A)。standing green queue **枯渇** (`taskA-next-chunk`=[])。
→ DEFERRED-INDEX の **DSL-fix 系 refuted** (engine変更0 で再author 可能なもの) を再評価して出荷。
B05028/B09038 は調査で **既出荷済** (8286f2c3) と判明 = DEFER note line244 stale。残 engine変更0 候補 = 3 rep。

### 出荷 (ALL_CARDS 1357→1362)
- **B02026 綾小路文麿** (緑L5、parallel無): a1 action:declare 観測者 `triggerCharMatches{side:opp, filter:{}}`+limit turn1+draw1
  / a2 ヒラメキdraw。**旧refuted真因**=filter フィールド無で相手partner誤発火。**fix**=空 `filter:{}` (eval.ts:298 が
  filter 存在時=空{}も JS truthy のみ scene走査→partner除外。kind:character 不要)。exemplar B03097/B02012。
- **B04004/B04004P 毛利蘭** (青L8): a1 partnerColorKeyword(青/迅速) / a2 cluster15 contact-removal `removedCharMatches{opp,contact-ap,self}`
  +chain[discard{max:1},evidenceGain] (B09071同型) / a3 **絆+actor+target gate**。**旧refuted真因**=a3 actor-gate欠落。
  **fix**=`matcherCondition and[triggerCharMatches{side:opp,filter:{}}, triggerCharMatches{payloadKey:'targetUid',side:self,filter:{cardName:工藤新一}}]`
  +condition bond+sceneSetState{active}。targetUid=action:declare payload flat併記 (state-machine:198、exemplar B08048)。
- **B09097/B09097P コルン** (黒L4): 登場時 and[caseColor{[赤,黒],and},caseStatus{事件編}]+chain[discard{max:1,color:[赤,黒],bind},
  draw2, conditional{boundMatchesFilter{$removed,levelMin:7}→mill{opp,3}}]。**旧refuted真因**=「bare-chain CPU強制discard」。
  **fix**=shipped twin B04056/D08003 と同じ `discard{max:1}`(min:0=decline可) で再author。DEFER note の optional ラップ不要
  (敵対verifyが「AI-policy divergence only / 有益効果 greedy-accept 妥当」と nit-ship 判定)。「カード」=kind無でevent含む。mill=BUG-137 refresh済。

### 検証 (全 green)
engine変更0 **確証** (git diff: engine/・_shared/ 無変更 = registry+カード+test のみ)。validate-specs pass
(B02026/B09097 JSON-expressible / B04004 は partnerColorKeyword closure=MANUAL、shipped B06038/B09071 同カテゴリ)。tsc0。
vitest 2686 (baseline一致)。新 `tests/cards/wave-dsl-reauthor.test.ts` **28件** (decoy で全filter/gate 1対1)。
smoke exc=0・baseline不変(avg11/winsA498)。e2e 120pass/1skip/**1fail=spectator-speed pre-existing** (registry revert でも再現=本wave無関係、stash切り分け証明)。
**敵対verify (opus、過剰発火lens+語義fidelity lens 計6)= 6/6 ship・refuted0・allShip=true** (指摘は全 nit 確認)。

### 学び (恒久)
- **standing green 枯渇後の生産=DEFERRED-INDEX の「DSL-fix refuted」再評価**。engine gate でなく旧 spec バグなら engine変更0 で再author 可。
  ただし「既知fix」は hint であって保証でない (B09097 の optional ラップ提案は shipped twin と矛盾→bare-chain が正)。全句 grounding 必須。
- **`triggerCharMatches` の filter フィールド有無で挙動激変**: 空 `filter:{}` (JS truthy) → scene走査で partner除外 /
  フィールド完全省略 → scene走査 skip で partner action も誤発火。「現場にいるキャラ」は `filter:{}` で表現 (kind:character 不要)。
- **action target gate** = `triggerCharMatches{payloadKey:'targetUid'}` (B08048)。action:declare payload は char target 時 targetUid を flat併記 (state-machine:198)。
- 「手札からN枚リムーブしてもよい。そうした場合〜」= bare `chain[discard{max:1},…]` (B04056/D08003 shipped convention)。CPU は有益なら greedy-accept、human decline 可、両方 rules/15 合法。optional ラップは CPU 常時 skip になる別挙動。

### branch / commit
branch `cards/wave-dsl-reauthor`。次=docs同期→pre-commit→commit→main ff-merge→push→CI green。
DEFERRED-INDEX の B02026/B04004/B09097 行 + 残5 note を出荷済化済。
