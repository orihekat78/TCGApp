# 02. 効果スタック設計

## 結論

**ハイブリッド型** — MTG「The Stack」(LIFO) を骨格に、
Hearthstone 風 Trigger Queue を「同時発動の即時バッチ」として埋め込む。

## コナンTCG の要求仕様への対応

| 仕様（公式裁定） | 対応する設計 |
|------------------|-------------|
| 「未解決効果スタック」+「ターンプレイヤー優先」 | MTG型 The Stack (LIFO) + APNAP順 |
| 「同時発動 → 所有者が好きな順で解決」 | Hearthstone型 Trigger Queue (immutable batch) |
| 「〜代わりに〜」「〜無効にする」 | 置換効果は即時解決（スタックに乗せない別パイプ） |
| 「開始済みアクションは条件喪失でも継続」 | フレームに `snapshot` を持ち、解決時に再評価しない |

## 中核データ構造

```typescript
interface EffectFrame {
  source: CardId;          // 効果の発生源
  owner: PlayerID;         // 所有プレイヤー
  payload: EffectSpec;     // 何をするか
  snapshot: ContextSnap;   // 発動時の盤面情報（再評価しない）
}

// G.stack: EffectFrame[]   // LIFO（top が末尾）
// G.replacementPipe: ReplacementSpec[]   // 即時解決の置換効果
```

## 解決アルゴリズム

```
1. アクション/効果が発動条件を満たすイベント発生
2. 「置換効果」候補を先にスキャン
   → 即時解決 ("代わりに" / "無効にする")
3. 通常トリガーを APNAP 順で集める
   3a. アクティブ側所有のすべてを所有者選択順で stack に push
   3b. 非アクティブ側所有も同様に push
4. stack を LIFO で解決
5. 解決中に新しい効果が発動したら 2 から再帰
6. stack が空になったら元の処理に戻る
```

## AI との相性

- `G.stack` も状態の一部 → MCTSが「次にスタックに反応する手」を `enumerate` で列挙可能
- `snapshot` 保持により、解決中の状態変化が AI 探索を不安定にしない
- 「即時解決の置換効果」は別パイプにすることで、AI が枝分かれを誤認しない

## 設計上の落とし穴

### 落とし穴1: 解決時の再評価

> 「開始済みアクションは条件喪失でも継続」

→ stack に push する瞬間に **必要な情報は snapshot に固定** する。
解決時に「このカードは現場にあるか?」を再チェックしない。

### 落とし穴2: イベントの細粒度

「現場リムーブ時」と「証拠からリムーブ時」（ヒラメキ）は別イベント。
ガード〜コンタクト発生の間に解決される、など順序が厳密。
→ イベント列挙を `.claude/rules/22-26` のQ&A裁定に逐一マッピング。

## 関連

- [01-frameworks-survey.md](01-frameworks-survey.md)
- [04-card-dsl-patterns.md](04-card-dsl-patterns.md)

## 出典

- [MTG Stack & APNAP rule](https://tcgprotectors.com/blogs/magic-the-gathering-blog/mtg-guide-stacking-triggers)
- [Hearthstone Advanced Rulebook](https://hearthstone.wiki.gg/wiki/Advanced_rulebook)
- [MTG Stack Wiki](https://mtg.fandom.com/wiki/Stack)
