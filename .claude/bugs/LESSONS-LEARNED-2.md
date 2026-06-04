# LESSONS LEARNED 2 — 直近期 (BUG-074〜113)

[LESSONS-LEARNED.md](LESSONS-LEARNED.md) (教訓 1〜11、BUG-001〜073 期) の続き。
BUG-074〜105 + 2026-06-04 セッション (BUG-106〜113 + switch-on-effect-enter / effective-value filter) から抽出。

## 教訓 12: pick 機構は human modal と AI drain の両経路を同時配線 (教訓 1 拡張)

**該当**: BUG-106 / BUG-109 (+ BUG-111 latent)

`tryRePickFromAtom` で pendingEffectPick を積む atom を human (modal→effectPickResolve) だけ配線して「実装済」
としがち。AI/CPU は modal が無く drain (`drainAiEffectPicks`) が無いと **silent no-op** (PA 短縮形 charModifyAP/
sceneEnter が AI で不発: 疾風 / reanimate)。walk 展開は PB 短縮形のみで PA は runtime 解決のため AI drain 必須。
→ enforcement: smoke 1000 (AI 経路 exercise) + `lint-side-channel.ts` に AI drain check 追加提案。

## 教訓 13: 派生数値 (有効 AP/LP) は単一 reader (read.char) を全 consumer が経由

**該当**: BUG-110 (表示) / Task2 effective-value filter / BUG-113 (残差)

同じ有効 AP/LP (= override?printed + turnEffects±修正 + dyn) を consumer 毎に別実装すると不整合。表示は read.char で
有効値、target/条件 filter (candidates.ts) は override?printed のみ、とズレた (debuff が「APX以下」対象外 / buff 済が
「LP0の」に誤含)。数値派生は `read.char.*` を唯一の真実とし、ad-hoc な `c.apOverride ?? def.ap` を外で書かない。
→ enforcement: `lint-effective-value-read.ts` (read.char 外の override?printed grep、提案/defer)。

## 教訓 14: 「コード自己整合 review」と「ルール準拠 review」は別軸・両方必須 (教訓 7 拡張)

**該当**: 本セッション user 指摘 (switch-on-effect-enter, BUG-106 / BUG-093) / Task1〜3

敵対的レビューは「コードが意図通りか」を検証するが「意図が公式ルールに合うか」は別軸。現場満杯の効果登場 skip は
コード上正しいが rules/20 スイッチを提供せず不完全だった。機能変更後は code review に加え rules/01〜30 audit を別途行う。
→ enforcement: 設計時「ルール網羅性チェック」(CLAUDE.md) + 機能変更後 rules audit (AUDIT-YYYY-MM-DD-rules-compliance.md)。

## 教訓 15: source を場外へ移すコスト/効果は source identity をコスト前に捕捉

**該当**: BUG-108 / BUG-112

`selfToDeckBottom` 等のコストは後続 lookup (useDeclaredAbility) / 回数カウント (incrDeclaredUseCount) が off-board の
source を見つけられず失敗/no-op。コスト支払い前に source identity を捕捉し以降は off-board を考慮。char 紐付け state
(declaredUseCount 等) は char が場を離れると失われる前提で設計。
→ enforcement: passive doc + review checklist (このコスト/効果は source を場外へ動かすか)。

## 教訓 16: modal を別 modal の上に開くなら z-index を上回らせる (教訓 5 実証)

**該当**: switch-on-effect-enter (Task1) / BUG-088

reanimate の CardListModal(1500) が開いたまま SceneSwitchPickerModal(1000) を上に開き、下の backdrop が pointer event
を奪い操作不能。BUG-088 も SpectatorHUD vs ReplayPanel の同型。**unit/integration では検出不能**、実機 Playwright で発覚。
→ enforcement: 既存 modal の上に出す UI は z-index 順序を確認し、Playwright で click まで検証。

## 教訓 17: sequence 内の複数 pick step は side-channel 上書き/drain 漏れに注意 (教訓 1 最頻クラスタ)

**該当**: BUG-074〜078 / BUG-105 (5+ 件、本期最多)

sequence で modal 待機 atom が連続すると、各 step の pendingEffectPick が次 step で上書きされ step2/3 modal が出ない /
step3 が queue に残らない。atom が pick を積んだら **後続 step 実行前に必ず drain/pause** する (BUG-105 = resolver の
sequence pick-await pause)。
→ enforcement: 3+ step modal sequence (D08013 a1 等) を e2e regression に固定 + 教訓 1 lint-side-channel。

## 教訓 18: closure matcher は ctx.source.uid で「当事者」を自己照合 (教訓 2 具体化)

**該当**: BUG-097 / BUG-098

guardedBySelf / contactOpponentApHigher 等が global hook (contact/guard) を subscribe する際、所有者が当事者かを照合
しないと無関係 event で過剰発火。matcherCondition は ctx.source.uid を持つので照合可能 (closure matcher は持てない)。
→ enforcement: triggered.test に「自分が当事者 / 他者が当事者」2 case を mandatory pattern 化。

## 教訓 19: turn-scope modifier は writer / reader / cleaner の三角で検証 (教訓 13 拡張)

**該当**: BUG-092 / BUG-095 / BUG-096

turn-scope の修正値・付与 keyword・回数 limit は writer(atom) → reader(read.char selector) → cleaner(turnEnd
clearTurnEffects) の 3 層が揃わないと read 漏れ/永続化/未 enforce。1 層だけ足すと非対称になる。
→ enforcement: turn-scope effect 追加時に writer/reader/cleaner + clear の test を同一 PR で必須化。

## 教訓 20: binding/ctx は effect 境界 (queue/dispatch/continuation) を越えて保持

**該当**: BUG-082 / BUG-091 / BUG-107

deferred effect / cutin / pick-resolve continuation で bindings ($matched, $contact.byUid, $entered) が境界を越えず
stale/空になる。event.queue は Immer draft に bindings を取込んで失う (BUG-107) → 保存 ctx の runEffect で共有。
bind ref key の表記揺れ ($matched vs $matchedUid) も不一致原因 (BUG-091)。
→ enforcement: 「deferred effect + binding ref」の matrix test。bind ref key 命名規則を統一。

## 教訓 21: engine の機能は呼出元 (UI / AI) が全引数・全経路で使って完成 (教訓 12 一般化)

**該当**: BUG-080 / BUG-084

engine が optionalCardId 対応しても UI flow が渡さない (NH step2) / AI enumerator と UI enumDeclaredAbilitySources の
二重定義で AI が case:self 宣言能力を列挙しない。engine capability は全呼出元で使われて初めて機能する。
→ enforcement: 重要 enumeration は engine public method に一元化 + 呼出元の引数 matrix test。

## 教訓 22: hook の emit 元が複数なら全経路で emit する (emit 側完全性)

**該当**: BUG-089

case:to-resolved 等を複数 atom/flow (atom, assist, file 自動移行, AI policy) が emit する場合、実プレイ経路で emit
漏れが起きやすい。emit 元を全列挙し全経路で emit する。
→ enforcement: hook ごとの emit 元一覧 (hooks-map) + 全 emit path × listener の coverage。

## 教訓 → enforcement mapping (12〜22)

| 教訓 | enforcement |
| --- | --- |
| 12 human/AI pick parity | smoke 1000 (AI 経路) + lint-side-channel に AI drain check 追加提案 |
| 13 派生数値 単一 reader | lint-effective-value-read.ts (提案/defer) |
| 14 コード vs ルール 別軸 review | 設計ルール網羅性チェック + 機能変更後 rules audit (passive) |
| 15 cost が source 場外移動 | passive doc + review checklist |
| 16 modal z-index | lint-component-testid.ts + Playwright interaction |
| 17 sequence 複数 pick side-channel | 3+ step modal sequence の e2e regression 固定 + lint-side-channel |
| 18 matcher 自己照合 | triggered.test 自他 2 case mandatory |
| 19 turn-scope 三角 (write/read/clear) | turn-scope effect の 3 層 test 同一 PR 必須 |
| 20 binding 境界保持 | deferred effect + binding ref の matrix test / key 命名統一 |
| 21 engine-呼出元 parity | enumeration の engine 一元化 + 引数 matrix test |
| 22 hook emit 完全性 | hooks-map (emit 元一覧) + emit path × listener coverage |
