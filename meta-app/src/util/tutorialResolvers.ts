// spec: .claude/specs/meta-ui/16-tutorial-real-board.md
// Phase 17-C': カード resolver の共有モジュール。
// RealMatchView と TutorialBoardSnapshot が同じ resolver を使うよう一元化
// (src/ には触らず import のみ。挙動は従来 RealMatchView と完全同一)。

import {
  createCardResolver,
  createCaseResolver,
  createHandCardResolver,
} from '@/ui/services/cardResolvers';

// カード JSON は conan ルート直下 (RealMatchView と同じ相対パス)
import ctD08 from '../../../ct-d08-cards.json';
import ctD11 from '../../../ct-d11-cards.json';

export const resolveCard = createCardResolver(ctD08 as never, ctD11 as never);
export const resolveCase = createCaseResolver(ctD08 as never, ctD11 as never);
export const resolveHandCard = createHandCardResolver(ctD08 as never, ctD11 as never);
