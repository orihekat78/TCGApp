// Phase 9a-1: チュートリアル L0「ゲームの目的」
//
// rules: 01-victory-conditions.md
// research: .claude/research/tutorial/01-curriculum-design.md
//
// Phase 9a-1 は L0 のみ 3 ステップ。L1-L13 は Phase 9a-2 以降で追加。

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
};

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'L0-1',
    title: 'ようこそ、名探偵',
    body: '名探偵コナンTCG は 2 人で証拠を集めて事件を解決するカードゲーム。CT-D08 と CT-D11 のデッキで対戦します。',
  },
  {
    id: 'L0-2',
    title: '勝利条件',
    body: '相手より先に事件の必要証拠数を集め、パートナーで「事件解決」を宣言したら勝利。先攻は 7 枚、後攻は 6 枚の証拠が必要。',
  },
  {
    id: 'L0-3',
    title: '進めましょう',
    body: '盤面右側の「ACTIONS」パネルから推理・アクション・ターン終了が選べます。まずは END ターンを押してみよう。',
  },
] as const;
