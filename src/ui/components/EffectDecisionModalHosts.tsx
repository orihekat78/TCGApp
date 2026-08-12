import { ChooseInterceptModalHost } from '@/ui/components/ChooseInterceptModalHost';
import { DeckPlaceModalHost } from '@/ui/components/DeckPlaceModalHost';
import { DeckReorderModalHost } from '@/ui/components/DeckReorderModalHost';
import { EffectChoiceModalHost } from '@/ui/components/EffectChoiceModalHost';
import { EffectOptionalModalHost } from '@/ui/components/EffectOptionalModalHost';
import { EffectRepeatOptionalModalHost } from '@/ui/components/EffectRepeatOptionalModalHost';
import { LeaveInterceptModalHost } from '@/ui/components/LeaveInterceptModalHost';
import { RpsModalHost } from '@/ui/components/RpsModalHost';
import { SetCardChoiceModalHost } from '@/ui/components/SetCardChoiceModalHost';
import { SetCardReplacementModalHost } from '@/ui/components/SetCardReplacementModalHost';

/**
 * All engine decision surfaces that must accompany EffectPickerModal.
 * Each visible root explicitly enrolls through the shared focus hook or
 * registry marker so MatchMenu can arbitrate one top layer.
 */
export function EffectDecisionModalHosts() {
  return (
    <>
      <EffectChoiceModalHost />
      <EffectOptionalModalHost />
      <ChooseInterceptModalHost />
      <LeaveInterceptModalHost />
      <RpsModalHost />
      <SetCardChoiceModalHost />
      <SetCardReplacementModalHost />
      <EffectRepeatOptionalModalHost />
      <DeckReorderModalHost />
      <DeckPlaceModalHost />
    </>
  );
}
