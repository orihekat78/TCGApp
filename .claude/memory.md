# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 = [2026-07-03-cardphase.md](sessions/2026-07-03-cardphase.md)。
> 再開手順: Track A = `.claude/NEXT-SESSION-PROMPT.md` / Track B = `.claude/NEXT-SESSION-PROMPT-TRACK-B.md`。

## 2026-07-03 CARD PHASE #2 — B06006 江戸川コナン 出荷 (engine変更0)

- **出荷**: B06006 江戸川コナン (青/Lv5/AP4000/LP1、探偵|毛利探偵事務所|少年探偵団)、origin **63000bc6** (FF push、race なし)。
- **3句** 全 primitive 出荷済 = engine変更0 (dormant-exemplar 解禁、DEFERRED-INDEX 709 出荷済マーク):
  - a1 `【解決編】突撃` = continuous `condition{caseStatus:解決編}` + `continuousModifier{grantKeywords:()=>['突撃']}` (D08021 a2 と condition 差替のみ)
  - a2 `【自分ターン中】重ね1枚AP+1000` = `apDelta{dyn:'$self.stackedCount * 1000'}` + `condition{turn:self}` (B05030 apDelta-dyn 同型)
  - a3 `【登場時】mill1 → リムーブの[探偵]/[少年探偵団]2枚まで下に重ね` = `chain[ mill{n:1,gate:false}, charStackCard pick{area:remove, filter:{kind:character, trait:['探偵','少年探偵団']}, n:0-2} ]` (D08021 a1 の trait 配列化 + 先頭 mill)
- **第2gate 実測** (green 鵜呑みせず全 primitive を engine コード直参照): trait 配列 any-match = candidates.ts:345 `wants.some(w=>traits.includes(w))` / caseStatus = eval.ts:113 switch + CONDITION_KIND_MAP / mill gate = core.ts:219 (`gate===true && deck<n` skip、必須は gate:false) / stackedCount dyn = dyn/eval.ts:393。
- **probe test 10件** (tests/cards/ct-p06/B06006.test.ts): shape 4 + 実機 6 (a2 AP スケール 6000/4000/opp-turn非加算/setCards非計上, a1 突撃 は解決編のみ)。engine 実評価を裏取り。
- **ゲート**: tsc0 / vitest 442files 3775+10probe pass / smoke:1000 winsA=498 不変・exceptions0 (engine変更0 証跡) / 8 CI lint errors=0。CI push 済 (run 28638331871、要 green 確認)。
- **★教訓 (B03033 latent gap 実踏)**: smoke report は gitignored だが `docs:structure` が `.claude/reports/smoke-*` を拾って structure.md に +2行 (762→764)。**docs regen 前に今回生成の smoke json/md を rm** して 762 維持 → clean checkout と一致。gen-structure EXCLUDE_DIRS 未収録の gap は別 commit 案件。
- **card-authoring vein 生存**: 次候補 = B06068 (revokedKeywords) / B06026 (char-leave selfToEvidence、実機 verify 要) / B05028 / B09038。手順 = 第2gate (未登録 + engine token 出荷 grep) → D08021/B05030 型 clone → probe → 6ゲート → FF。
