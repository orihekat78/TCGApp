# YOU vs CPU 人間プレイヤー再現・品質検証計画

## Goal

## Scope correction (2026-07-27)

- Validation roster is 10 decks: exclude the three `TEST-*` fixture decks from the 13 public deck entries.
- The execution table is 55 unordered YOU/CPU pairs, mirrors included exactly once (upper triangle), not `N²` / 169 ordered pairs.
- `.claude/sessions/2026-07-27-you-vs-cpu-human-validation-worklist.csv` is the authoritative 55-row list.

## Expert-method dependency (2026-07-27)

- This plan remains a 55-row upper-triangle coverage plan. It is not an `N²`
  ordered-pair plan and does not claim role-symmetry or causal win-rate proof.
- Before any queued row resumes, use the separate generic knowledge plan and
  Conan runtime-resume plan. Their gates add decision quality; they do not
  change the roster, order, or acceptance status of the 55-row worklist.
- A row record must state the actual visible role appearance. It must not claim
  both roles were tested unless both were actually executed and documented.

Meta UI (`http://localhost:5174`) で、YOUが公開情報だけを見て実UIを操作し、
CPUと対戦する。完走数ではなく、判断・ルール・UI理解・状態解決を証明する。

## 根拠と許可する経路

- 基準: [テスト強化方針](../you-vs-cpu-test-strengthening.md) 47-91行。
- 旧経路: `tests/e2e/full-match-human-vs-cpu.spec.ts` 97-191行。
- console収集: `tests/e2e/helpers/setup.ts` の `setupGamePage`。
- UI/Test契約: `src/ui/AGENTS.md`、`tests/AGENTS.md`。
- 許可: Playwright `page` / `locator` / `expect`、表示DOM、実クリック、キーボード。
- 禁止: `window.__game.dispatch`、state/pending注入、非公開領域を使う判断、
  先頭候補固定、YOU側のターン終了だけで完走させること。
- `window.__game`の読み取りも対局判断には使わない。失敗後診断に限定する。

## Phase 0: 製品・文書ディスカバリー

- [ ] `main`最新、clean worktree、5174の起動状態を確認する。
- [ ] 5174のデッキ選択UIから現在の全デッキID・名称を採取し、`N`を確定する。
- [ ] `sample-d08` / `sample-d11`以外のローカルデッキも実選択後に内容を確認する。
- [ ] setup、mulligan、手札使用、対象選択、推理、アクション、ログ、結果の
  実セレクタと既存E2Eパターンを特定する。存在しないAPIやselectorを作らない。
- [ ] ルール判断が必要なら`.claude/rules/INDEX.md`から該当項目だけを読む。
- [ ] 旧E2Eを基準スモークとして残し、新検証の品質証拠には数えない。

## Phase 1: 判断契約と証拠形式

- [ ] 各デッキに勝ち筋、マリガン、AP温存、登場、推理、攻撃、任意効果、
  コンタクト/カットイン、事件解決の優先方針を定義する。
- [ ] 各行動で「公開盤面・候補・選択・理由・操作結果」を記録する。
- [ ] CPU行動後と各効果解決後に盤面を再観測し、計画を更新する。
- [ ] 相手手札、山札順、裏向きセットカードへのアクセスを失敗扱いにする。
- [ ] 30ターン到達、同一状態反復、END偏重、未解決modalは合格でなく要調査。
- [ ] clean / non-clean / blocked / rerun-required の結果区分を固定する。

## Phase 2: 代表対局パイロット

- [ ] desktopで異なる性格の2デッキをYOUにして、開始から結果まで実操作する。
- [ ] 851×393で同じ判断経路を1戦通し、実クリック可能性を確認する。
- [ ] マリガン、カード使用、対象選択、推理、アクション、任意判断、
  コンタクト/カットイン、事件解決のうち発生した経路を追跡する。
- [ ] pending解決後にpending 0、modal 0、次の合法操作成功を確認する。
- [ ] player/console error 0、pointer interception 0、同時modal 1件以下を確認する。
- [ ] パイロットで判断ログが説明不能なら、総当たり前に判断方針を修正する。

## Phase 3: 現行デッキ総当たり

- [ ] 現行`N`デッキをYOU/CPUの順序付き`N²`組（ミラー含む）で実行する。
- [ ] UI操作と待機だけを機械化し、行動判断は公開情報とデッキ方針から行う。
- [ ] seed、YOU/CPUデッキ、勝者、ターン、使用card/ability/decision、
  owner/chooser、停止理由、UI所見を記録する。
- [ ] 各デッキがYOU側とCPU側の両方で検証されたことを集計する。
- [ ] 総当たりは組合せ探索。未発動能力を「検証済み」にしない。
- [ ] non-clean/blocked行は原因修正後、同じ組合せとseedで再実行する。

## Phase 4: レビューと横断確認

- [ ] 判断: 合法手の先頭固定でなく、盤面と勝ち筋に説明可能か。
- [ ] ルール: source、ability、owner、chooser、target、変更sideが正しいか。
- [ ] UI理解: 手番、phase、主要操作、disabled理由、選択数、確定/取消、
  CPU/解決中状態、公開/非公開が初見で分かるか。
- [ ] UI誤操作: 迷い、誤クリック、透明hitbox、重なり、画面外を記録する。
- [ ] 導線: setup→deck→mulligan→match→log→result→次対戦が一貫するか。
- [ ] `#deck` / `#cards`: 色、混色、カード情報、詳細導線を確認する。
- [ ] 対戦: 虫眼鏡専用詳細、セット一覧分離、相手裏向き非公開を確認する。
- [ ] desktop、851×393を必須。393×851、360×640は代表経路も確認する。

## Phase 5: 不具合処理と検証

- [ ] 目視だけでBUG確定しない。公式ルール、候補集合、ActionContext、ログで裏付ける。
- [ ] 確認済み不具合は1件1 BUG文書。TDDで修正し、類似箇所を横断調査する。
- [ ] engine/state/resolverは`engine_reviewer`、ルール競合は`rules_adjudicator`、
  横断修正は`regression_hunter`でレビューする。
- [ ] UIは`ux_reviewer`、`product_design_director`、desktop/mobileの`visual_qa`で確認する。
- [ ] focused Vitest/Playwright後、full Vitest、typecheck、lint、Root/Meta Playwright、
  `npm run docs:check`を実行する。
- [ ] 最終条件: console error 0、非公開漏えい0、直接dispatch 0、clean行の未解決状態0。
- [ ] 2実装waveまたは約60% contextで結果と再開点を記録し、新タスクへ渡す。
