// spec: .claude/specs/meta-ui/02-design-system.md
// Barrel re-export — shared プリミティブ全件

export { T, COLOR_TOKEN, shade } from './tokens';
export type { TokenSet } from './tokens';
export { ensureInteractionStyles } from './interactionStyles';
export { MetaBg } from './MetaBg';
export type { SceneName, SceneTheme } from './MetaBg';
export { AppTopBar } from './AppTopBar';
export { PrimaryHeader, PRIMARY_NAV_ITEMS } from './PrimaryHeader';
export { MetaCard } from './MetaCard';
// CardSilhouette は Phase 11 で MetaCard から切り離されたが、参照可能なまま残置
export { CardSilhouette } from './CardSilhouette';
export {
  PrimaryButton, GhostButton, SmallButton, SetupButton, SetupReadyButton,
} from './Button';
export { FilterGroup } from './FilterGroup';
export type { FilterItem } from './FilterGroup';
export { EmptyState } from './EmptyState';
export type { EmptyIconKind, EmptyTone } from './EmptyState';
export { WarningBanner } from './WarningBanner';
export type { BannerTone } from './WarningBanner';
export { LoadingDots } from './LoadingDots';
export { NetworkStatus } from './NetworkStatus';
export type { NetState } from './NetworkStatus';
