# GameState → UI マッピング表・Selectors (2026-05-11)

GameState フィールドと UI コンポーネントの対応、UI用 selector 関数。スキーマは [ui-state-map.md](2026-05-11-ui-state-map.md)。

## 対応表 (GameState → UI)

| GameState | UIコンポーネント | 表示 |
|----------|----------------|------|
| `turn.number, turn.player` | `<ChapterTag>` | 「▼ 先攻3ターン目」 |
| `turn.phase` | `<PhaseStrip>` | 現在フェイズ強調 |
| `pendingEffects.length` | `<EffectStackIndicator>` | 「効果解決中 (N件)」 |
| `scratchTrace[player]` | `<ScratchTraceIndicators>` | 「痕跡: 発見済/未発見」 |
| `players[X].partner.state, location` | `<PartnerCard>` / `<AssistedPartnerInFile>` | 回転 + 位置 |
| `players[X].case.status` | `<StatusStamp>` | 「事件編」青/「解決編」赤 |
| `players[X].case.requiredEvidence` | `<EvidenceProgress>` | 「証拠 3/7」 |
| `players[X].scene[i].state` | `<SceneCharCard>` | 回転+バッジ |
| `players[X].scene[i].isNamed` | `<SceneCharCard>` | 「名乗り」バッジ |
| `players[X].scene[i].enterOrder` | dev-mode only | 疾風N判定用 |
| `players[X].scene[i].setCards.length` | バッジ「+Nセット」 | 左下バッジ |
| `players[X].scene[i].stackedCards` | バッジ「重ねN」 | 右上バッジ |
| `players[X].scene[i].apOverride / lpOverride` | カード詳細モーダル | 「元AP/LP無効化中」表示 |
| `players[X].scene[i].turnEffects.contactImmune` | キャラに小アイコン | 盾アイコン |
| `players[X].hand.length` | `<HandZone>` / 相手枚数バッジ | 自分=実カード、相手=枚数 |
| `players[X].deck.length` | `<DeckZone>` | 残量バッジ |
| `players[X].evidence` | `<EvidenceZone>` | 裏向きスタック |
| `players[X].remove[最新]` | `<RemoveZone>` | 最新表向き |
| `players[X].file` | `<FileZone>` | 裏向き横向き + パートナー混在 |
| `turnState[player].handUseUsed` | `<ActionMenu>` 「手札の使用」 | true なら disabled |
| `turnState[player].nextHintUsed` | `<ActionMenu>` 「手札の使用」 | true なら disabled |
| `turnState[player].assistedThisTurn` | `<ActionMenu>` 「事件解決」 | true なら disabled |
| `log[最新N]` | `<LogBar>` | 折りたたみ・展開で表示 |
| `gameResult` | `<VictoryScreen>` / `<DefeatScreen>` | フルスクリーン演出 |

## 派生計算 (UI用 selector)

```typescript
function canReason(unit): boolean {
  if (unit.state !== 'active') return false;
  if (unit.isNamed && !hasKeyword(unit, '迅速')) return false;
  return true;
}

function canAction(unit, targetType: 'character' | 'case'): boolean {
  if (unit.state !== 'active') return false;
  if (!unit.isNamed) return true;
  if (hasKeyword(unit, '迅速')) return true;
  if (hasKeyword(unit, '突撃')) return true;
  if (targetType === 'character' && hasKeyword(unit, '突撃[キャラ]')) return true;
  if (targetType === 'case'      && hasKeyword(unit, '突撃[事件]')) return true;
  return false;
}

function canDeclareAbility(unit, ability): boolean {
  if (ability.costRequiresSleep && unit.state !== 'active') return false;
  const useCount = unit.declaredUseCount[ability.id] ?? 0;
  if (ability.maxPerTurn && useCount >= ability.maxPerTurn) return false;
  return canPayCost(unit, ability.cost);
}

function canUseFromHand(card, player): { ok: boolean; reason?: string } {
  if (player.turnState.handUseUsed) return { ok: false, reason: '1ターン1回制限' };
  if (player.turnState.nextHintUsed) return { ok: false, reason: 'ネクストヒント後は使用不可' };
  if (player.file.length < card.cost) return { ok: false, reason: 'FILE不足' };
  if (!isColorAllowed(card, player.case)) return { ok: false, reason: '事件色不一致' };
  return { ok: true };
}
```

## 補足: 必要証拠数 / 色制限 / 2色カード / 物理マーカー

- **必要証拠数**: 先攻=7 / 後攻=6 (rules/01)。`players[X].case.requiredEvidence` フィールド
- **色制限** (rules/20): 「手札の使用」「ネクストヒント」のみ事件色制限適用。例外: 効果による登場・カットイン・ヒラメキ は色制限なし
- **2色カード**: どちらの色としても扱う。手札/NH使用は事件が両色を持つ必要
- **事件編/解決編マーカー** (rules/06, 30): 物理マットでは裏返し可能トークン。デジタルUIでは `<StatusStamp>` コンポーネントで「事件編」青/「解決編」赤の表現に置換。アシスト時に自動で反転アニメ

## 関連

- [ui-state-map.md](2026-05-11-ui-state-map.md)
- [ui-action-flows.md](2026-05-11-ui-action-flows.md)
