---
date: 2026-07-10
seq: 12
slug: token-reduction-6
---

## token 削減 6 施策 + roadmap 統合 M-plan (session 数 10-13 → 5-7 圧縮の下拵え)

ユーザー指示「1〜6すべて行いたい」。

1. **rules 自動注入停止**: `.claude/rules/*.md` は Claude Code v2.1.198+ の native 自動ロード対象
   (guide agent 裏取り済) → settings.json `claudeMdExcludes: ['.claude/rules/**']`。固定費 2-3 万
   token/session 削減。参照義務は不変 (都度 Read) — CLAUDE.md に明記。
2. **`npm run ground` 新設** (scripts/ground-dossier.cjs): grounding の「探す」工程を決定論化 —
   TSV 行 / 登録判定 / DEFER 該当行 / capability snapshot (AtomVerb 93 / Condition 40 / Cost 21 /
   dyn / TargetFilter/Query / hook 45 を実ファイル直 parse、stale 無し) を .tmp/_ground/ に出力。
   grounding agent 費 ~700k → ~250k/回 見込み。
3. **specs/grounding/ 永続化**: agent 判断を unit 単位で保存 (報告は agent が直接 Write、main へは
   要約 5 行)。D06013 dossier 保存済 (T3 2点修正設計)。
4. **gen:probes 拡張**: cost-gate に removeDeckTop (deck 不足) + 非 pay 単独 cost 正規化。
   ★実バグ修正: condition-off の and 展開が `all` 参照 (実型は `cs`) で死んでいた。
5. **review right-sizing**: T0-T2 sweep = cluster 単位 1 lens / 4 lens は T3 のみ / 純機械 lens は
   haiku 4.5 / lens やり直しは resumeFromRunId cache — CLAUDE.md モデル段階化に追記。
6. **locate 委譲**: 定義/参照探索は Serena find_symbol / cavecrew-investigator (圧縮出力) —
   本体 sed 全域読み禁止を CLAUDE.md 化。

roadmap に統合 M-plan (S3〜S15 → M1〜M6) 追記。次 = M1 mega-sweep。
