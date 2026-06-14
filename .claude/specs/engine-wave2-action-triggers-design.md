# engine拡張 wave#2 cluster3 — action-lifecycle trigger 族 設計 (v2、敵対レビュー3lens反映済)

branch `engine/wave2-action-triggers`。骨格凍結例外 (user 承認済 engine拡張 + 既存骨格バグ修正)。
調査: Workflow 7 lens → 敵対レビュー 3 lens (fable×2+opus、approve-with-fixes、fatal 0、major 7 全反映 =
`.tmp/cluster3-action-triggers/{*,review-*}.md`)。一次根拠: TSV qAndA — 宣言時 trigger = ガード判定前に発動+
**効果も即解決** (6枚同一裁定) / アクション終了時 = 現場在場時のみ (4枚同一裁定)。

## 出荷 15枚 / DEFER 1枚

**出荷**: B01036 B01037 B01068 B02068 B03097 B08048 D04005 (a群) + B08012 B08012P B01067 D04007 (b群) +
PR086 PR092 B03073 B05108 (c群)。B08012P・PR092 = gameplay 列 byte 一致 → spread 再録。全 16 枚未実装確認済。
**DEFER**: B06049 — a2「相手の【ヒラメキ】は発動しない」= 抑止機構 + side-level action flag ゼロ (G5)。partial 出荷不可。

## engine 変更 (X9〜X13/X16 = additive、X14/X15 = 既存骨格バグ修正)

### X9: evidence:gain emit 新設 + refresh guard — `flow/action-case.ts` gainSelfEvidence (:87-115)
- **先に refresh guard** (RI-4/F2): fileAdd 同型の「1枚ごと事前 deck0→refresh→add」ループ (atom-handlers.ts:386-398
  方式、mill 同型の事後 check は不可 RI-7)。BUG-142 の一部 (rules/10 手順3 + rules/14 違反の既存骨格バグ)
- emit は **実獲得時のみ** (evidence 件数 前後比較、deck0+remove0 敗北時は emit 無し — false-fire 防止)
- payload `{player: ax.byPlayer, byUid: ax.byUid, uid: ax.byUid, via:'action-case'}` / source `{player, uid: ax.byUid}`
- emit は action-case 経路のみ (推理/効果/refresh 由来では emit しない — 排他性を pin)。AI/human は本関数 1 箇所に合流

### X10: TRIGGERED_HOOKS に action:end / evidence:gain 追加 — `listeners/triggered.ts:57-90`
- cjs HOOKS whitelist (`taskA-validate-specs.cjs:31-36`) 同期 (sync テスト検知)。action:unguarded は不要のため追加しない
- action:end は emit 済 (state-machine.ts:445/:331、source=actor)。「離場なら不発」= in-play scan + selfOnly で自然成立 (pin P5)

### X11: 新 Condition `triggerActionKind {v:'char'|'case'}` — triggerPayload.target.kind 読み
- 3点同期: effect.ts union / cond/eval.ts switch + CONDITION_KIND_MAP / cjs CONDS。既存 `and` 複合子と併用し JSON 純化
  (例 B01036 matcherCondition = and[triggerActionKind char, triggerCharMatches{side:'self', filter:{color:'緑'}}])
- B02068 granted descriptor (validate.ts:175-188 関数禁止) の唯一の blocker 解消。a群全カード closure 不使用
  (lint:listener の matcher 未指定 warn は exit 0 = 許容、completeness F4)

### X12: scope:'action' modifier の read/filter 合算 — 4 サイト
- read/char.ts ap/lp/level 3 関数 + **target/candidates.ts:283-287 の filter 側 inline 合算 (第4サイト、RI-1)** に
  `*Mod_action` 追加。mutate ModScope (char.ts:8) + atom cast は **charModifyAP/LP/Level の 3 箇所のみ** —
  **charGrantKeyword (:974) は除外** (grantedKeywords は suffix 無し格納で action 清掃が効かない罠、RI-9)
- 清掃は既存 2 経路 (clearTurnEffects('action') @ state-machine.ts:436-441/:323-327 + turn-end safety net)。
  read 経由と filter 経由の値一致 pin を新設。B03097/B08048 の「アクション終了時まで AP+」解禁

### X13: action:declare payload に flat `targetUid` 追記 — state-machine.ts:194 emit
- char target 時のみ。`$trigger.targetUid` (atom-handlers.ts:175-180) + `triggerCharMatches{payloadKey:'targetUid'}` 有効化
- ガード成立後も宣言時 target.uid を保持 (qAndA: ガードされてもレベル-1 適用済)。既存 matcher (B01032 p.target.kind) 不変

### X14: CPU 経路 declare-trigger drain 順序修正 (既存骨格バグ → BUG-141)
- ai/action-resolution.ts: resolveActionAgainstChar (:110-127) は declare 直後に drain せず chooseGuard 後 —
  公式裁定「効果もガード判定前に解決」違反 (B01036 ガード候補剥奪が CPU で逆順)。fix: declare 直後 drain 挿入
- **resolveActionAgainstCase (:160-171) にも declare-drain 追加** (F3-i。passGuard 固定の case ガード窓自体は BUG-144 起票・別途)
- smoke 影響 (RI-3/F3): 対象 = **D08021** (selfOnly draw/evidenceGain) + **D11015** (AP+1000 pick、chooseGuard が
  readEffectiveAp 参照) → **baseline 変動を事前宣言**。段階別 smoke で帰属分離 (検証節)

### X15: evidenceGain verb の refresh guard (既存骨格バグ → BUG-142)
- atom-handlers.ts:455-462 に fileAdd 同型「1枚ごと事前 check」ループ (RI-7)。X9 の gainSelfEvidence guard と同族
- 水平展開: evidenceGain 使用出荷 13 枚 (smoke 内 D08013/D08021/D11003) / **reasoning.ts:118-124 も同族 refresh
  未配線 = BUG-142 水平展開に記録し修正は繰越** (F2)。smoke baseline 変動を事前宣言

### X16: contact driver の pause gate 拡張 (既存骨格バグ → BUG-141 に併記、RI-2/F1)
- useContactFlowDriver.ts:114/:128 の進行 gate が pendingEffectPick のみ → human 所有の optional/choice modal 解決前に
  guard-window へ進む (B02068 granted optional のブレットがガード可否に未反映 = qAndA 違反)。
  fix: gate に pendingEffectOptional + pendingEffectChoice を追加 (D11007 a3 fix 同型)

## カード別 DSL 要点 (全句突合: clause-a/b.md + review 反映。短縮形 PA は player/side 明記必須 RI-5)

- **B01036**: 【ターン1】and[char, charMatches self 緑] → sceneSetState{player:'self', state:'sleep', max:1} (0枚=ターン1消費)
- **B01037**: 同 trigger 【ターン1】→ draw1 + discard{player:'self', n:1} (必須)。hirameki: draw1
- **B01068**: selfOnly + case → charGrantKeyword{uid:'$self', kw:'ブレット', scope:'turn'} (guard.ts:46-49 turn-grant 評価済)
- **B02068**: 【パートナー赤】event-use (B02014 同型) → charGrantAbility{player:'self', max:5, side:'self',
  filter:{color:'赤'}, scope:'turn', ability:{trigger:{action:declare, selfOnly, matcherCondition: triggerActionKind case},
  effect: optional{chain[discard1, charGrantKeyword $self ブレット turn]}}} — X16 が human 経路の前提
- **B03097**: and[char, charMatches **opp** filter:{}] (空filter=パートナー除外) → charModifyAP{player:'self', **side:'self'**
  (既定 either 罠 RI-5), max:1, filter:{cardName:'目暮十三'}, delta:2000, **scope:'action'**}。limit 無し=毎回。
  **hirameki: draw1 (completeness F1 — 脱落補正)**
- **B08048**: a1 selfOnly+char → sequence[charModifyLevel{uid:'$trigger.targetUid', delta:-1, scope:'turn'},
  conditional{triggerCharMatches{payloadKey:'targetUid', filter:{levelMax:6}} (修正後 level・解決時評価) →
  charModifyAP{uid:'$self', delta:3000, scope:'action'}}]。a2 enter + sceneHas{excludeSelf, trait:'FBI'} → 突撃 $self turn
- **D04005**: and[case, charMatches self filter:{}] → 突撃 $self turn (毎回、重複 grant 無害)。hirameki: draw1。ミスリード無し
- **B08012/P**: a1 continuous bond[真田貴大]→突撃[事件] (B09051 同型)。a2 evidence:gain selfOnly → draw1
- **B01067**: evidence:gain selfOnly → sceneToHand{player:'self', max:1, side:'opp', filter:{levelMax:5}} (B06069 同型)
- **D04007**: misreadX(1) + evidence:gain charMatches{side:'self', payloadKey:'byUid'}【ターン1】→
  optional{chain[discard1, evidenceGain n:1]} (辞退/手札0 でも消費)
- **PR086/P**: action:end selfOnly → optional{sequence[sceneToDeck $self bottom, draw1, sceneEnter{player:'self',
  from:'hand', max:1, filter:{levelMax:6, trait:'警察', kind:'character'}, enterSleep:true}]}。hirameki: sleep1
- **B03073**: action:end selfOnly → sequence[sceneRemove $self 'effect', deckRevealUntil{maxN:4, upTo,
  filter:{levelMax:4, kind:'character'}}, sceneEnter matched (通常登場・名乗り), deckToBottomBound] (D11019 出荷済合成)
- **B05108**: a1 partnerColorKeyword(黒, 突撃)。a2 action:end selfOnly + cond fileAtLeast6 →
  optional{sequence[sceneRemove $self, sceneEnter{player:'self', from:'hand', max:1, filter:{levelMax:7, color:'黒', kind:'character'}}]}

## ルール整合 / エッジ / 検証 / 既知ギャップ

- rules 追記 (F5): R1+R4 = rules/22:35 既存行の**改稿** (二重記載回避) / R2・R5 = rules/22 追記 / R3 = **rules/25** へ。
  各 100 行制約を実装時確認
- エッジ (7): ①0枚/辞退でも【ターン1】消費 ②D04007 手札0 = chain break ③B01036 sleep がガード候補剥奪 (X14/X16 後 全経路成立)
  ④B03097 毎アクション独立適用・終了毎失効 ⑤gain 中 deck0→refresh 継続/remove0 敗北 (X9/X15) ⑥同時複数 trigger 解決順
  (rules/15、ターンプレイヤー優先 = stack.ts:134-138) ⑦**B01036 がスタン対象選択 → スタン維持** (rules/03、F7)
- TDD pin: P1 triggerActionKind char/case 交差 / P2 cond 3点同期 / P3 and 複合 (side self/opp 分離) / P4 X9 emit 排他+実獲得時のみ+
  listener0 no-op / P5 action:end selfOnly+離場不発 / P6 既存 19 枚回帰形状 / **P7 targetUid 解決+payloadKey+修正後 level (F6)** /
  X12 read=filter 値一致+2 清掃経路 / X14 drain 順序 (char+case) / X15 ループ refresh / X16 gate
- **smoke 帰属分離手順** (RI-3): X9-X13+X16 (inert 期待) → smoke#1 一致確認 → X14 → smoke#2 → X15 → smoke#3 (差分は
  D08021/D11015/D08013/D11003 経由の期待変動として RCA・BUG-141/142 に記録) → カード登録 → smoke#4 (追加差分ゼロ期待) →
  baseline 更新 1 回 (正当化を changelog 記載)
- MCP decoy: B01036 (緑以外×/事件×/0枚消費/スタン維持) / B03097 (自分×/事件×/**相手側目暮十三は候補外** RI-5/hirameki) /
  B01068 or D04005 (char×→case○) / B01067 (levelMax decoy/ガード時不発) / **B02068 (optional→ブレット→ガード候補0、X16 実証)** /
  **B08048 (ガード後もレベル-1/修正後 level→AP+3000)** / PR086 (二段 modal) / B05108 (FILE6 境界) / B03073 (decline 不可)
- 既知ギャップ記録 (DEFERRED-INDEX / BUG): U1 変装 actor 帰属 (要照会) / U2 actor 離場後 gain (自然挙動=不発) / U3 ガード前
  対象離場 (abortIfMissing 未配線) / U6 **engine の remove→gain 連続実行はヒラメキ(手順2)→獲得(手順3) と順序逆転** (RI-8、修正繰越) /
  U7 action:end の clear→emit 順序 (rules/08 §7 と逆、c群 無影響、RI-6) / queue 時 pick 確定 (F8 = BUG-134 範囲拡大注記) /
  AI optional 常時辞退 (PR086/B05108/D04007/B02068 の任意効果を CPU 不使用 = 既知 AI 品質制約、F2) /
  BUG-143 (contact mod の turn-end 清掃 = rules/08 §6 違反、決定論検証済・修正別) / BUG-144 (case ガード窓 passGuard 固定)
