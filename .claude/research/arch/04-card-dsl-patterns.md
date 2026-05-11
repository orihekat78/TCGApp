# 04. カード効果 DSL 設計（最重要）

## 結論

**方式3「宣言的メタ + ハンドラ」を主軸、方式2「キーワードDSL」を併用** のハイブリッド。

## 既存TCGエンジンの方式（要約）

| エンジン | 言語 | 方式 | 規模 |
|---------|------|------|------|
| **SabberStone** (Hearthstone) | C# | 宣言的タスク配列 + Trigger/Aura/Enchant | 数千枚 |
| **MTG Forge** | テキストDSL (.txt) | A:/T:/S:/K:/R:/SVar: のキー値 | 数万枚 |
| **EDOPro / Project Ignis** | Lua | 完全手続き型（1カード=1.lua） | 1万枚超 |
| **boardgame.io 標準** | TS関数 | Move を純粋関数で | 中小規模向き |

## 4方式の比較

| 評価軸 | 方式1 素TS関数 | 方式2 コマンド配列 | **方式3 メタ+ハンドラ** | 方式4 Lua |
|---|---|---|---|---|
| 表現力 | ◎ | △（DSL拡張要） | ◎ | ◎ |
| 学習コスト | △ TS全部 | ○ 単純カードは易 | ○ 雛形コピペ | × Lua習得 |
| テスト容易性 | ◎ | ◎ | ◎ | △ サンドボックス要 |
| AI統合容易性 | ◎ | ○ インタプリタ層 | ◎ | × VM起動コスト |
| 型安全性 | ◎ | ○ Discriminated Union | ◎ | × 型なし |
| リファクタコスト | × | ○ 中央定義差替 | ◎ 型でgrep可 | × |

## 採用方針の根拠

### 主軸：方式3（メタ + ハンドラ）

1. **トリガーは有限種** → `meta.triggers` で静的列挙
   - AI が「このカードが反応する可能性のあるイベント」を事前インデックス化可能
2. **複雑効果はTS手続きで書く方が現実的**
   - 独自DSLを自作すると数百枚到達前に DSL のバグ取りで疲弊
3. **TypeScript の型推論で整合性強制**
   - `triggers: ['ENTER_SCENE']` を書いたら `onEnterScene` の実装を要求

### 併用：方式2（キーワードDSL）

「常時有効」の単純な修飾だけは方式2が圧倒的に楽：

```typescript
keywords: [{ type: 'AP_BUFF', value: 1000, while: { ... } }]
```

突撃 / AP+1000 / 〚特徴X〛などをここで宣言し、エンジン中央で集中処理（Aura計算）。

## TSコードスケッチ

```typescript
// src/cards/case/CT-D08/D08001.ts
import { defineCard } from '../../../engine/dsl';

export default defineCard({
  meta: {
    id: 'D08-001',
    name: '工藤新一(変装:コナン)',
    type: 'character', cost: 3, ap: 5000, lp: 2,
    keywords: [{ type: 'DISGUISE', from: 'D08-002' }],
    triggers: ['ENTER_SCENE', 'DISGUISE_RESOLVE', 'EVIDENCE_REMOVE'],
  },
  // 【登場時】山札の上2枚を見て1枚を証拠へ
  onEnterScene: async (s, ctx) => {
    const top2 = ctx.peekDeck(s, ctx.self.owner, 2);
    const pick = await ctx.choose(ctx.self.owner, top2, 1);
    ctx.moveTo(s, pick, 'evidence');
  },
  // 【変装】解決時：相手キャラ1体のAP-1000
  onDisguiseResolve: (s, ctx) => {
    ctx.queueChoice(ctx.self.owner, {
      kind: 'TARGET_OPPONENT_CHAR', count: 1,
      then: t => ctx.applyBuff(s, t, { ap: -1000, until: 'END_OF_TURN' }),
    });
  },
});
```

`defineCard` は型推論で `meta.triggers` と `on*` ハンドラの整合を **型レベル** で強制する。
`ctx` は AI 探索時に副作用を仮想化できる読み書き API。

## 関連

- [02-effect-stack-patterns.md](02-effect-stack-patterns.md)
- [05-cpu-ai-patterns.md](05-cpu-ai-patterns.md)
- [../data/04-folder-structure.md](../data/04-folder-structure.md)

## 出典

- [SabberStone Implement Cards](https://github.com/HearthSim/SabberStone/wiki/Implement-Cards)
- [Card-Forge/forge Card-scripting-API](https://github.com/Card-Forge/forge/wiki/Card-scripting-API)
- [ProjectIgnis CardScripts](https://github.com/ProjectIgnis/CardScripts/blob/master/README.md)
- [bgio-effects プラグイン](https://github.com/boardgameio/boardgame.io/discussions/903)
