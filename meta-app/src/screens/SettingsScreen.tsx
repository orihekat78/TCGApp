import { useCallback, useEffect, useRef, useState } from 'react';
import { T } from '../shared/tokens';
import { PrimaryHeader } from '../shared/PrimaryHeader';
import {
  useMetaStore,
  type DensityName,
  type PresentationSpeedName,
  type SpectatorAiSpeedName,
} from '../state/metaStore';
import type { Route } from '../router/routes';
import type { RegisterNavigationBlocker } from '../router/navigationBlocker';
import './SettingsScreen.css';

interface Props {
  onNav: (route: Route) => void;
  registerNavigationBlocker?: RegisterNavigationBlocker;
}

const NOOP_REGISTER_NAVIGATION_BLOCKER: RegisterNavigationBlocker = () => () => {};

interface SettingsDraft {
  density: DensityName;
  presentationSpeed: PresentationSpeedName;
  spectatorAi: SpectatorAiSpeedName;
}

const DEFAULT_DRAFT: SettingsDraft = {
  density: 'comfortable',
  presentationSpeed: 'standard',
  spectatorAi: 'standard',
};

const SPEED_OPTIONS = [
  { label: '遅い', value: 'slow' },
  { label: '標準', value: 'standard' },
  { label: '速い', value: 'fast' },
] as const;

const SPECTATOR_OPTIONS = [
  { label: '遅い', value: 'slow' },
  { label: '標準', value: 'standard' },
  { label: '速い', value: 'fast' },
] as const;

export function SettingsScreen({
  onNav,
  registerNavigationBlocker = NOOP_REGISTER_NAVIGATION_BLOCKER,
}: Props) {
  const settings = useMetaStore((state) => state.settings);
  const setSettings = useMetaStore((state) => state.setSettings);
  const [draft, setDraft] = useState<SettingsDraft>(() => ({
    density: settings.density,
    presentationSpeed: settings.presentationSpeed,
    spectatorAi: settings.spectatorAi,
  }));
  const [status, setStatus] = useState('');
  const hasUnsavedChanges = draft.density !== settings.density
    || draft.presentationSpeed !== settings.presentationSpeed
    || draft.spectatorAi !== settings.spectatorAi;
  const dirtyRef = useRef(hasUnsavedChanges);
  dirtyRef.current = hasUnsavedChanges;
  const confirmDiscard = useCallback(() => (
    !dirtyRef.current || window.confirm('未保存の変更があります。破棄して移動しますか？')
  ), []);

  useEffect(() => registerNavigationBlocker({
    confirmRouteLeave: ({ from, to }) => from !== 'settings' || to === 'settings' || confirmDiscard(),
    shouldWarnBeforeUnload: () => dirtyRef.current,
  }), [confirmDiscard, registerNavigationBlocker]);

  const saveDraft = () => {
    setSettings(draft);
    setStatus('設定を保存しました。');
  };

  const resetDraft = () => {
    setDraft(DEFAULT_DRAFT);
    setStatus('初期値を下書きに反映しました。保存すると適用されます。');
  };

  return (
    <div className="settings-screen" style={{ fontFamily: T.fontJp, color: T.textPrimary }}>
      <PrimaryHeader current="settings" onNav={onNav} />

      <main className="settings-frame" aria-labelledby="settings-title">
        <header className="settings-heading">
          <p>SETTINGS</p>
          <h1 id="settings-title">設定</h1>
        </header>

        <div className="settings-sheet">
          <div className="settings-sheet-body" tabIndex={0}>
          <SettingsGroup title="表示">
            <SettingsRow label="表示密度">
              <Segmented
                ariaLabel="表示密度"
                value={draft.density}
                options={[
                  { label: 'コンパクト', value: 'compact' },
                  { label: '標準', value: 'comfortable' },
                ]}
                onChange={(density) => setDraft((current) => ({ ...current, density: density as DensityName }))}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="演出">
            <SettingsRow label="演出速度">
              <Segmented
                ariaLabel="演出速度"
                value={draft.presentationSpeed}
                options={SPEED_OPTIONS}
                onChange={(presentationSpeed) => setDraft((current) => ({
                  ...current,
                  presentationSpeed: presentationSpeed as PresentationSpeedName,
                }))}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="観戦">
            <SettingsRow label="観戦時のCPU速度">
              <Segmented
                ariaLabel="観戦時のCPU速度"
                value={draft.spectatorAi}
                options={SPECTATOR_OPTIONS}
                onChange={(spectatorAi) => setDraft((current) => ({
                  ...current,
                  spectatorAi: spectatorAi as SpectatorAiSpeedName,
                }))}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="アクセシビリティ">
            <div className="settings-note">
              端末サイズとコントラストに応じて、ブラウザの設定を適用します。
            </div>
          </SettingsGroup>

          </div>

          <footer className="settings-actions">
            <p role="status" aria-live="polite">
              {hasUnsavedChanges ? '未保存の変更があります。' : status}
            </p>
            <button className="settings-save" type="button" onClick={saveDraft}>設定を保存</button>
            <button className="settings-reset" type="button" onClick={resetDraft}>初期状態に戻す</button>
          </footer>
        </div>
      </main>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings-group" aria-labelledby={`settings-${title}`}>
      <h2 id={`settings-${title}`}>{title}</h2>
      {children}
    </section>
  );
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <span>{label}</span>
      <div className="settings-control">{children}</div>
    </div>
  );
}

function Segmented<V extends string | number>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: V;
  options: readonly { label: string; value: V }[];
  onChange: (value: V) => void;
}) {
  return (
    <div className="settings-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={value === option.value}
          className={value === option.value ? 'is-selected' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
