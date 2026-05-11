# 03. 類似ファンメイドTCGアプリの事例

## YGOPro / Dueling Network（遊戯王）

### 概要
- ファンメイドのオンライン遊戯王対戦クライアント
- カード画像・効果テキスト・対戦エンジンを完全実装
- 多数のユーザー（Dueling Networkは最盛期400万ユーザー）

### 結末
- **コナミ（Nihon Ad Systems）から C&D（停止命令）を受けて停止**
- YGOPro公式サイトは「legal reasons」と表示し閉鎖

### 教訓
- 規模が大きく目立った
- IPホルダーが公式オンラインゲーム（Master Duel）を出すと黙認姿勢が変わる
- **オンライン公開・大規模 = 高リスク**

## MTG Forge（マジック・ザ・ギャザリング）

### 概要
- オフラインの一人プレイMTGクライアント
- オープンソース・無料・約20年運営
- カード画像と効果実装を含む

### 法的状況
- 法的にはグレー（権利者は黙認）
- 過去に **Wizards of the Coast から DMCA通知** を受けた事例あり（一部開発者が開発停止）
- 全体としてはコミュニティが小規模を維持し継続

### Wizards Fan Content Policy
> 自社IPを別のゲームに使うことは、無料/有料問わず明示的に禁止

→ 公式ポリシー上は **明確に侵害**。それでも黙認されている。

### 教訓
- オフライン・低注目度 = グレーで継続可能
- ただしいつでも停止される可能性あり
- DMCAを受けたら即対応必須

## Hearthstone Sim 等（ハースストーン）

- 主に **ボット開発・統計用ライブラリ** として存在
- フルゲームクライアントではない（リスク回避）
- Blizzardは黙認

## 共通パターン

| 要素 | 影響 |
|------|------|
| **規模** | 大規模ほど目立つ → C&Dを受けやすい |
| **収益化** | 収益化していないことが擁護要素 |
| **カード画像配布** | 自前ホスティングは複製権侵害 |
| **公式の競合プロダクト** | 公式が公式アプリを出すと黙認姿勢が硬化 |
| **オープンソース** | ソース自体は権利侵害ではないが、画像・テキスト同梱はNG |

## 名探偵コナンTCG 固有の状況

- 公式が **オンライン対戦アプリを出していない**（2026年5月時点）
- 2024年発売の比較的新しいタイトル → 権利者の運用方針が今後固まる可能性
- 既存のファンメイドTCGアプリは見当たらない（先行事例なし）
- 原作（コナン）自体は世界的IPで権利意識が強い

## 出典

- [Vice: YGOPro fight to keep alive](https://vice.com/en/article/qkjzdd/yu-gi-oh-online)
- [MTG Forge legal status discussion](http://mtgrares.blogspot.com/2010/07/is-forge-legal.html)
- [Forge DMCA notice incident](https://www.coolstuffinc.com/a/forge-developer-ends-development-after-dmca)
- [Wizards Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy)
