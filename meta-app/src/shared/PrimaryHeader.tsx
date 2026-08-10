import type { Route } from '../router/routes';
import brandLogo from '../assets/detective-conan-logo.png';

type NavIconName = 'home' | 'deck' | 'cards' | 'play' | 'tutorial' | 'history' | 'settings';

export const PRIMARY_NAV_ITEMS: readonly { label: string; route: Route; icon: NavIconName }[] = [
  { label: 'ホーム', route: 'home', icon: 'home' },
  { label: 'デッキ', route: 'deck', icon: 'deck' },
  { label: 'カード', route: 'cards', icon: 'cards' },
  { label: 'ゲーム開始', route: 'setup', icon: 'play' },
  { label: 'チュートリアル', route: 'tutorial', icon: 'tutorial' },
  { label: '履歴', route: 'history', icon: 'history' },
  { label: '設定', route: 'settings', icon: 'settings' },
];

interface Props {
  current: Route;
  onNav: (route: Route) => void;
}

export function PrimaryHeader({ current, onNav }: Props) {
  return (
    <header className="home-header">
      <button className="home-brand" type="button" onClick={() => onNav('home')} aria-label="ホームへ移動">
        <img src={brandLogo} alt="DETECTIVE CONAN" />
      </button>
      <nav id="home-primary-navigation" className="home-navigation" aria-label="メインナビゲーション">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <button
            key={item.route}
            type="button"
            data-route={item.route}
            className={item.route === 'setup' ? 'home-nav-start' : undefined}
            aria-current={item.route === current ? 'page' : undefined}
            onClick={() => onNav(item.route)}
          >
            <PrimaryNavIcon name={item.icon} />
            <span className="home-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}

function PrimaryNavIcon({ name }: { name: NavIconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg className="home-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {name === 'home' && <><path {...common} d="M3 10.5 12 3l9 7.5" /><path {...common} d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" /></>}
      {name === 'deck' && <><path {...common} d="m5 6-2 1.2 7 13 2-1.1" /><rect {...common} x="8" y="3" width="12" height="17" rx="1.5" /><path {...common} d="M11 7h6M11 11h6" /></>}
      {name === 'cards' && <><rect {...common} x="5" y="3" width="14" height="18" rx="1.5" /><rect {...common} x="8" y="7" width="8" height="7" rx="1" /><path {...common} d="M9 18h6" /></>}
      {name === 'play' && <path d="m8 5 11 7-11 7V5Z" fill="currentColor" />}
      {name === 'tutorial' && <><path {...common} d="m3 9 9-5 9 5-9 5-9-5Z" /><path {...common} d="M7 12.2V17c3 2 7 2 10 0v-4.8M21 9v6" /></>}
      {name === 'history' && <><path {...common} d="M4.6 8A8.5 8.5 0 1 1 3.5 14" /><path {...common} d="M4 3v5h5M12 7v5l3 2" /></>}
      {name === 'settings' && <><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>}
    </svg>
  );
}
