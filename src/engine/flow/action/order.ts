// engine.flow.action.order — computeOrder (rules/08)
// Extracted from state-machine.ts and contact.ts to avoid duplication.
// rules: 08-contact.md

/**
 * computeOrder — コンタクト行動順 (rules/08)
 *
 * AP 低い側が 1 番目。同値の場合は **アクションされた側 (= 非ターンプレイヤー)** が 1 番目。
 *
 * @param aAP 攻撃側 AP (byUid)
 * @param bAP 防衛側 AP
 * @param attackerSide { aUid: 攻撃側 uid, bUid: 防衛側 uid }
 */
export function computeOrder(
  aAP: number,
  bAP: number,
  attackerSide: { aUid: string; bUid: string },
): { firstUid: string; secondUid: string } {
  if (aAP < bAP) {
    return { firstUid: attackerSide.aUid, secondUid: attackerSide.bUid };
  }
  if (aAP > bAP) {
    return { firstUid: attackerSide.bUid, secondUid: attackerSide.aUid };
  }
  // 同値: 防衛側 (アクションされた側 = 非ターンプレイヤー) が 1 番目
  return { firstUid: attackerSide.bUid, secondUid: attackerSide.aUid };
}
