# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-21-2.md = ㉘ / 2026-06-21-3.md = ㉙。)

## セッション㉚ (2026-06-21) — engine拡張 micro-cluster: evidence-top→hand (evidenceToHand fromTop, 1刷)

ユーザー選択=カード追加 wave 継続 (A、engine変更0 完全枯渇=非推奨を明示後も A 選択)。前 wave (handToEvidence) の
DEFER 残 B03077 を解禁。「自分の証拠を**上から**1つ手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠
として得る」= evidence-**top**→hand。決定論 yield scan + 全句 grounding で「上から」型は **B03077 単独 (1 base)** と確定。

### engine 変更 (1 フラグ追加、純 additive、新 verb なし)
`src/engine/effect/atom-handlers.ts` の `case 'evidenceToHand'` に **`fromTop` 分岐 1 つ**追加。`fromTop===true` で
pick path をスキップし証拠最上 (末尾=1番上、`mutate/evidence.removeTop` が `ev[length-1]` を top 扱いと整合) を
**手動 pop + `hand.add`** (`removeTop` は remove エリア行きゆえ使わない)。証拠0 → no-op + `__chainStepNoApply=true`
で chain break (`filePopToHand` 同型)。
- **新 verb でない** → AtomVerb union / ATOM_PICK_SPEC / validate / cjs whitelist の同期は **不要** (`args:unknown`
  ゆえ型変更も不要)。前 wave (handToEvidence=4点同期) と対照的に低コスト。
- **回帰ゼロ**: `fromTop` 使用既存カード 0。pick path 不変。smoke baseline 不変が証跡。

### 出荷 (ALL_CARDS 1368→1369、P変種なし)
- **B03077 水無怜奈** (赤L4 AP4000 LP1 アナウンサー、C): a1 = `triggered{enter,selfOnly}` +
  `optional{chain[evidenceToHand{fromTop:true}, handToEvidence{n:1}]}` / a2 = ヒラメキ
  `triggered{evidence:remove-by-action,optional}` + `draw{n:1}`。
  - **DSL 合成**: `optional`=してもよい (fromTop は deterministic ゆえ B06029 の pick-0 decline 不可 → optional が
    唯一の decline 経路) / `chain`=そうした場合 (step1 no-op→break) / step2=得る(必須 n:1)。exemplar D09010 a1
    (`optional{chain[discard, evidenceGain]}`) + D01003 a2 (ヒラメキ draw)。

### 検証 (全 green)
- tsc0。vitest full **2739pass/1skip/0fail** (前2731から+8=新decoy、減なし)。smoke:1000 exc=0・baseline不変
  (avg10.998/winsA498)。playwright **120pass/1skip/1fail** (spectator-speed:79 は既知 timing flake、単独~40%失敗だが
  B03077 は非MVP=MVP smoke/spectator デッキ不在 + fromTop 分岐 dormant = code-path 非交差、無関係)。
- 新 `tests/cards/evidence-top-to-hand.test.ts` **8件** (実 engine 駆動): §1 ★上から=末尾(最上)★ E_BOTTOM/E_TOP
  両端 decoy で E_TOP のみ手札 (1対1 witness) / §2 ★境界:証拠0★ no-op+`__chainStepNoApply=true` / §3 残り順序保持 /
  §4 ★swap opt-in★ a1 を optionalRun:true で駆動 (fromTop→handToEvidence pick→AI drain) net不変 / §5 chain break
  opt-in/0証拠 / §6 opt-out decline / §7 出荷構造突合。
- **敵対verify (opus、refute lens) = OVERALL SHIP / 9点全ok / refute0**: 上から=正しい配列端、optional decline
  (human surface/AI skip=合法 passive)、chain break、forced/optional split (rules/15)、Q&A 同札再証拠化、
  step1後step2 forced 充足、ヒラメキ draw refresh (BUG-036)、全 card field、全句被覆。

### 学び (恒久)
- **engine拡張 micro-cluster の clean yield 逓減**: ㉘=2base → ㉙=1base → ㉚=1base。単一 additive gate は 1base 級が現実。
- **「上から」= deterministic top は free pick と別経路**: pick をスキップする専用分岐 + chain-break 明示設定が要る
  (filePopToHand 同型)。「N枚から選び」(pick) と「上から N枚」(deterministic) は engine 上別物。
- **decoy の「上から」witness は両端にカードを置く**: E_BOTTOM 残し E_TOP のみ取れることを実 engine で 1対1 確認。
- **既知 flake 注意**: spectator-speed.spec.ts:79 は timing flake が ~40% に悪化 (handoff の note より悪い)。本 wave とは
  無関係 (HUD step/pause timing vs evidence engine) だが、将来 BUG 起票 or test 安定化を検討する余地あり。

### branch / commit
branch `cards/wave-evidence-top-to-hand`。docs同期→pre-commit→commit→main ff-merge→push→CI green 予定。
DEFERRED-INDEX: B03077 行を出荷済に + evidence-top→hand cluster section 追加 + 次弾候補表に行追加。
