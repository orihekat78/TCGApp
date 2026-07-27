# 次タスク用: Conan熟練判断の実行

`conan-router`から開始し、次を読む。

- `.claude/specs/plans/2026-07-27-tcg-expert-knowledge-plan.md`
- `.claude/specs/plans/2026-07-27-conan-expert-runtime-resume-plan.md`
- `.claude/specs/tcg-expert-play/`
- `.claude/sessions/2026-07-27-tcg-expert-method-retrospective.md`
- pause handoff、55組worklist、BUG-272--274。

## 実行順

1. 汎用TCG source registerを一次資料で更新。参考/仮説を混ぜない。
2. INDEX Ver.2.4 / keywords Ver.2.5不一致を公式原典で解消する。
3. `validation-protocol.md`のex ante 8局面を満たす。過去結果で理由を書き換えない。
4. Conanの対象デッキ・カード本文を公式原典で確認し、未知は明記する。
5. 公開UIだけでUI mapを補足し、rule/UI差は`blocked-ui-rule-mismatch`にする。
6. clean commit後、committed registryからruntime packetを凍結する。
7. Gateを記録して停止する。

row 026、ブラウザ実対局、55組継続はユーザーが改めて明示承認するまで実施しない。
実施承認後も `#setup` から、公開UI/公開ログ/実クリックのみ。dispatch、state注入、
pending、非公開情報、裏向き識別は禁止。接続停止が2回連続したときだけ新規ブラウザ。
