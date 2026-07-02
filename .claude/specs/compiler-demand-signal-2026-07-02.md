# Track B compiler — demand-signal + audit queue (2026-07-02)

Track B (text→DSL compiler) の B1.5/B2 実測が空振り (下記) → 用途を **bulk author から「監査 + Track A 優先度シグナル」へ pivot** (ユーザー承認 2026-07-02)。
本ファイル = compiler が機械抽出した (a) Track A 拡張の需要ランク、(b) B3 監査 queue。数値は `.tmp/compiler/*.json` から再生成可能。

## 実測 (なぜ pivot したか)

| 施策 | unlock | 実測 |
|---|---|---|
| B1.5 parametric (数値/色/特徴 slot 化) | **+0 枚** | safe template 12、全て既 exact 被覆行にのみ発火 (unshipped の filler 値は全て shipped 既出) |
| B2 whole-line bulk | **1→2/539 枚** | 印字行が shipped と byte 一致する card のみ full-compile |
| 節分割 (「。」decomp) 上限 | **9/539 枚** | 節の 63.5% が新規、DSL は節合成不能 (chain/binding 越境)、高 mismatch risk |

結論: 残 539 枚は shipped の**組み替えでなく新規複雑文**。whole-line 文法は飽和。実 throughput lever は Track A engine 拡張。

## (a) Track A 拡張 需要ランク (**再採寸済 2026-07-02**、origin/main 8ae3f56f 直 grep)

再生成: `node scripts/compiler/demand-signal.cjs` → `.tmp/compiler/demand-signal.json` ({lines, subclauses} 2 粒度・ids 付き)。
初版候補を engine 直読で再採寸 → **真の Track A 需要は 4 family のみ**。残りは既出荷で card-phase 送り:

| # cards | 需要 (真の engine gap) | ids / 備考 |
|---|---|---|
| 8 | partner【事件解決】書き換え + 代替勝利【証拠隠滅】= **同一 8 枚** (初版 8+8 は二重計上) | B03135/B05118/B05119/B06105-108/D07024。P10/E3 (勝敗系 rewrite) |
| 4+3 | 非MR カードの PA 移動 + PA〚ビッグジュエル〛計数 aura (G39 PA card slot) | B07059/B07060/PR195/PR196 (+計数 3)。mutate/partner.ts 旧 stub は dead 化済 = 未実装 |
| 4 | 「アクション中のキャラ」TargetFilter 軸 (【ヒラメキ】【解決編】K枚スタン) | B03085/B05032/B05111/B08006。stun verb (sceneSetState) は有、filter 軸のみ novel |
| 4 | 「以下からKつ選んで行う」multi-select (G34) | B05023/B05062/B07013/B09067。choice atom は 1 択のみ |

**降格 = engine 出荷済 (card-phase authoring へ)**:
- **MR PA 宣言 19 + PA 発動 5**: mr-partner-area core **出荷済** (bef3adad+5352c470 = on-partner-area scope declared/triggered + partnerAreaMR slot)。auto-mem「未実装」は stale。per-card 残 gate は要実測
- **set-event family ~15**: charSetCard fromSelf WRITE (0629d) + on-set-host rider READ (b34d33cc) 両出荷 → B01023/B01039/B01057/B02052/B02067/B03041/B03080/B05041/B05117/B06012/B06063/B06064/B07014/B08017/D10024
- **keyword turn-grant 散発 ~13** (突撃等): grantKeyword(scope turn/permanent) 出荷済
- **ability grant (turn)**: charGrantAbility (Task D E4) 出荷済。turn 清掃のみ = permanent 形は per-card 確認
- **【事件緑＆白】〚突撃〛4**: caseColor color[]+combine:'and' 出荷済 → ENGINE0 (D06003/04/21/23)

**conflict-blocked (Track A ではなく B3-1)**: 「【ヒラメキ】キャラをK枚スリープ」(10: B01020/B02076/B04073/B05008/B05097/B06078/B06085/B08008/B08036/PR133)・「リムーブエリアの〚名/特徴〛手札回収」(5+4) は engine/文法とも被覆済だが conflict で key refuse。canonical 化で unlock = B3-1 の ROI 根拠。

## (b) B3 監査 queue (compiler 副産物)

★**B3-1 / B3-3 とも完了 (2026-07-02 後続 session)**。結果:

1. ~~conflicts 5 key~~ → **0 (B3-1 完了)**。shipped card 再編集ではなく **canonical.cjs 意味射影の正規化 N1-N5** で解消
   (engine 直読で結果同値を証明した encoding 揺れのみ吸収、根拠脚注は canonical.cjs 冒頭): N1 singleton-choice
   unwrap / N2 matcherCondition(removedCharMatches)→condition lift / N3 charSetCard faceUp:false drop /
   N4 sceneSetState PA 短縮形展開 (effect-root 限定) / N5 icon-disguise 配列位置 stable-move。
   唯一の真 fidelity drift = **C2 B03012 a2 の filter kind:'character' 過剰制約** (印字にキャラ限定なし) → card 修正
   (挙動不変: 工藤新一名の非キャラは partner のみでリムーブ不可)。効果: G1 match 1167→**1244** (+77)、
   conflict-blocked 行が rule 化。unshipped unlock は **P printing 2 枚のみ** (B07031P/B08049P、出荷済) —
   ヒラメキ sleep 10 枚は各々**別の新規複雑文**を持ち card 単位 unlock はゼロ (『残 539 は新規複雑文』結論を再確認。
   初版 ROI 根拠の『10+5+4 枚 unlock』は行 unlock と card unlock の混同 — 訂正)。
2. shipped-gap-suspect 25 枚 — B3-2 certify 済 (BUG-163 修正 / BUG-164 起票)。残 25 は B09100 系 + P variant。
3. ~~exceptions 9 枚~~ → **監査完了 (B3-3、opus workflow 7 agent + 敵対 verify)**: **7/7 家系 FULL_CORRECT** —
   全て benign 構造逸脱で誤訳ゼロ。内訳: B03129/P + PR055 (disguise+cutin 多能力構造 → **N5 で match 昇格**) /
   B05024/P・B08044/P・D09027 (shared factory caseResolvedHandRemove の closure matcher) / D04004 (grantKeywords
   closure)。現 exceptions **7** = 上記 closure 系 5 + B05030 (ability 配列順 drift: triggered/continuous 間 —
   非 disguise 間の順序は意味保持のため正規化対象外、benign 裁定のみ記録) — いずれも**恒久 exception 枠**。
4. ~~align-ambiguous 2 枚 (B09041/P)~~ → **FULL_CORRECT (B3-3)**。曖昧根因 = 印字行を持たない合成 helper ability
   (a2 action:guarded 記録) で benign。恒久 skip 枠。

## 修正済 (本セッション)

compiler oracle が surface した誤訳 2 件を修正 → [[BUG-162]] (PR276/D02004 「アクション終了時まで」scope + PR276 gated-chain)。conflict 6→5 (C6 解消)。

## compiler 資産の恒久価値

G1 (mismatch=0) oracle + conflict 検出 = shipped 1510 枚の**回帰ゲート**。今後 Track A がカード追加/変更で同文言異 DSL を生むと mine/CI で surface される。再現: tsv-corpus → dump-shipped → mine → oracle。
