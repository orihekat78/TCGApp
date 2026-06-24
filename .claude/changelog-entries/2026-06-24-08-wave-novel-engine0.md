# cards — wave novel-0624 (novel-tail 9枚、engine変更0)

**Round/Phase**: 2026-06-24 カード追加 wave (engine変更0)。novel-tail green候補を classify→certify→
adversarial-verify の 3 層パイプラインで仕分け、verified-ok のみ手書き品質で出荷。

## パイプライン

- 残 unshipped green候補 154 → fresh 127 → DEFER/出荷済を機械除外 → **clean 95**。
- 高歩留り subset (single-clause・cutin/hira/henso 列なし) **59 rep** を classify workflow (opus, 59 agent,
  live engine code grounding) で仕分け: **GREEN 11 / GATED 44 / RISKY 4**。GATED 44 は全て真の engine gap
  (set-card-removal COST kind 不在 / mill-with-bind 不在 / hand-reveal hook 不在 / continuousModifier lvlDelta /
  relative filter 等) で false-gate 0 を確認。
- GREEN∪RISKY **15 rep** を certify+adversarial-verify (wf-certify.mjs, opus, SUB=5):
  **green 12 / verify-ok 9 / refuted 3 / yellow 3**。

## 出荷 (ALL_CARDS +9、engine変更0)

| rep | カード | 要点マッピング |
|-----|--------|---------------|
| B08092 | 出来損ないの名探偵 (黒 event) | event-use, 【事件青&黒】caseColor gate → draw + 手札から【現場リムーブ時】Lv4- enter(sleep) + 絆[シェリー/灰原哀] conditional Lv7- remove。現場リムーブ時 filter は live (read/keyword.ts, 出荷 B09104) |
| B02033 | 死力を尽くして (緑 event) | optional{chain[charRemoveSetCard n:2 (合わせて2枚) → sceneRemove max:1]}。「してもよい」=optional / 「そうした場合」=chain |
| B03095 | 松本清長 (青 char) | 【ターン1】action:declare observer(triggerCharMatches opp) + 自スリープ gate(charStateIs) → 警察 reactivate (sceneSetState active, 自身選択可) |
| B04019 | 服部平蔵 (青 char) | 【宣言】【ターン1】cost sceneToDeckBottom(filterAny: 服部平次 OR 警察, Lv7+) → AP8000- remove + remove から 警察Lv5- revive(sleep) |
| B04079 | 高木渉 (青 char) | a1=ミスリード1 (shared) / a2=【登場時】scry1 (deckRevealUntil maxN:1 + optional deckToBottom) |
| B05014 | 工藤新一 (青 char) | 突撃 innate / phase-end 自スリープ gate → self bounce(sceneToHand) + remove から コナンLv3- revive(sleep) |
| B09063 | 谷森棋士 (赤 char) | a1=ミスリード1 / a2=【自分ターン中】【ターン1】Lv8 enter observer + 相手Lv7不在 → draw |
| B09066 | メアリー (赤 char) | a1=【登場時】絆(赤井家 excludeSelf) conditional sleep / a2=【パートナー赤】phase-end 自スリープ → draw+discard |
| D01008 | 阿笠博士 (青 char) | 【登場時】手札から少年探偵団Lv4- を 0-1枚 enter(してもよい) → 未登場(not bound) なら キャラ AP+1000(turn) |

- 全て手書き品質の codegen (taskA-codegen、grounding コメント付) → register。touched = src/cards のみ。

## BUG-145 over-fire 検証 (最重要)

effect 側 `conditional` の枝に pick を持つ 3枚 (B09066/B08092/D01008) が、refuted の B05062 と同じ
over-fire gate (BUG-145) に該当しないことを engine code 直読で確定:
- resolveEffectPicks は conditional の両枝を pre-walk するが、**Pattern-B short-form atom pick**
  (sceneSetState/sceneRemove/charModifyAP の max/filter 形, uid/target 無) は初期 walk で
  push 抑止 (`isPatternB && !_fromAtomHandler → return`) され dispatch 時のみ surface。
- 一方 B05062 は枝に **`choice`** (else) を持つため pre-walk で eager-surface → 正しく refuted。
- 回帰 test (wave-novel-0624.test.ts) に over-fire guard を追加: 3枚の conditional を humanChooser
  pre-walk して pick/choice/optional surface=0 を機械実証。

## 検証 (engine変更0 ゲート)

- **engine変更0 証跡**: `git diff src/engine` 空。validate-specs pass=9/9。
- `tsc` 0 / `vitest` 3068 pass +1 skip (本 wave +14: structural 9 + over-fire guard 5) / 0 fail。
- `smoke:1000` winsA=498 / avg=11.00 / timeouts=exceptions=0、baseline OK (engine変更0)。
- 8 lint errors=0 (card-addition/test-pair は wave test で WARN のみ)。

## DEFER 追記 (6 rep)

DEFERRED-INDEX へ refuted 3 + yellow 3 を engine gap 付きで記録 (BUG-145 choice over-fire /
group-scoped 1-of-N choice / colorNot filter / cost-relative dynamic filter / relative AP filter /
pick-then-branch-on-picked-state)。
