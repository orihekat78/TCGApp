// 09-app.jsx
// Simple SPA router for the conan TCG prototype.
// - State: route stored in URL hash
// - Renders the right screen based on route
// - Global click delegation: any element with [data-nav-to] navigates
// - Floating "where am I" + "back" + "screen flow" controls

const ROUTES = {
  home:     { component: 'HomeScreen',       label: 'ホーム',     code: 'HOME' },
  setup:    { component: 'SetupScreen',      label: '対戦準備',   code: 'SETUP' },
  match:    { component: 'MatchPlaceholder', label: '対戦',       code: 'MATCH' },
  result:   { component: 'ResultScreen',     label: '対戦結果',   code: 'RESULT' },
  deck:     { component: 'DeckEditor3Col',   label: 'デッキ編集', code: 'DECK' },
  cards:    { component: 'CardsScreen',      label: 'カードリスト', code: 'CARDS' },
  history:  { component: 'HistoryScreen',    label: '対戦履歴',   code: 'HISTORY' },
  replay:   { component: 'ReplayPlaceholder',label: 'リプレイ',   code: 'REPLAY' },
  tutorial: { component: 'TutorialScreen',   label: 'チュートリアル', code: 'TUTORIAL' },
  settings: { component: 'SettingsScreen',   label: '設定',       code: 'SETTINGS' },
};

function useHashRoute(initial = 'home') {
  const [route, setRoute] = React.useState(() => {
    const hash = window.location.hash.slice(1);
    return ROUTES[hash] ? hash : initial;
  });
  React.useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (ROUTES[hash]) setRoute(hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = React.useCallback((to) => {
    if (!ROUTES[to]) return;
    window.location.hash = to;
    setRoute(to);
  }, []);
  return [route, navigate];
}

function useScale() {
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / 1920, (window.innerHeight - 60) / 1080);
      setScale(Math.max(0.25, s));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

// History-aware navigation (so the floating "back" can pop)
const navHistory = [];

function PrototypeApp() {
  const [route, navigate] = useHashRoute('home');
  const [history, setHistory] = React.useState([]);
  const scale = useScale();

  // Wrap navigate to track history
  const go = React.useCallback((to) => {
    if (!ROUTES[to] || to === route) return;
    // Engine-stub hook: simulate matches on transition
    const stub = window.engineStub;
    if (stub) {
      // SETUP → MATCH: start a simulated match for this session
      if (route === 'setup' && to === 'match') {
        const decks = stub.decks.list();
        const p1 = decks[0] || window.SAMPLE_DECK;
        const p2 = decks[1] || window.SAMPLE_DECK;
        window.__currentMatch = stub.flow.simulateMatch({ p1Deck: p1, p2Deck: p2 });
      }
      // MATCH → RESULT: record to history
      if (route === 'match' && to === 'result' && window.__currentMatch) {
        stub.history.record(window.__currentMatch);
      }
    }
    setHistory((h) => [...h, route]);
    navigate(to);
  }, [navigate, route]);

  // Global click delegation
  React.useEffect(() => {
    const handler = (e) => {
      const target = e.target.closest('[data-nav-to]');
      if (target) {
        const to = target.getAttribute('data-nav-to');
        if (to && ROUTES[to]) {
          e.preventDefault();
          e.stopPropagation();
          go(to);
        }
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [go]);

  // Keyboard shortcuts
  // h: home / d: deck / c: cards / t: tutorial / s: settings
  // r: result / m: match / p: setup (play) / y: history / l: replay
  // Esc / Backspace: back · Enter on home: start match · ?: help
  const [helpOpen, setHelpOpen] = React.useState(false);
  React.useEffect(() => {
    const SHORTCUTS = {
      h: 'home', d: 'deck', c: 'cards', t: 'tutorial', s: 'settings',
      r: 'result', m: 'match', p: 'setup', y: 'history', l: 'replay',
    };
    const handler = (e) => {
      // Ignore when typing in inputs
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === 'escape' || key === 'backspace') {
        if (helpOpen) { setHelpOpen(false); return; }
        if (history.length > 0) { e.preventDefault(); back(); }
        return;
      }
      if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (key === 'enter' && route === 'home') {
        e.preventDefault();
        go('setup');
        return;
      }
      if (SHORTCUTS[key]) {
        e.preventDefault();
        go(SHORTCUTS[key]);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [go, back, route, history, helpOpen]);

  const back = React.useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    navigate(prev);
  }, [history, navigate]);

  const Screen = window[ROUTES[route].component];

  return (
    <React.Fragment>
      {/* Scaled stage */}
      <div style={{
        position: 'fixed',
        left: '50%', top: 0,
        width: 1920, height: 1080,
        transform: `translateX(-50%) scale(${scale})`,
        transformOrigin: 'top center',
        background: '#050810',
        boxShadow: '0 0 40px rgba(0,0,0,0.8)',
      }}>
        <div key={route} className="meta-page-anim" style={{ position: 'absolute', inset: 0 }}>
          {Screen ? <Screen /> : <div style={{ padding: 40, color: '#fff' }}>未実装: {route}</div>}
        </div>
      </div>

      {/* Floating nav HUD (always visible, doesn't scale with the stage) */}
      <NavHUD route={route} history={history} back={back} go={go} helpOpen={helpOpen} setHelpOpen={setHelpOpen} />
    </React.Fragment>
  );
}

function ShortcutHelpOverlay({ onClose }) {
  const groups = [
    { label: 'NAV', items: [
      ['H', 'HOME'], ['D', 'DECK'], ['C', 'CARDS'],
      ['T', 'TUTORIAL'], ['S', 'SETTINGS'],
    ]},
    { label: 'PLAY', items: [
      ['P', 'SETUP'], ['M', 'MATCH'], ['R', 'RESULT'],
      ['Y', 'HISTORY'], ['L', 'REPLAY'],
    ]},
    { label: 'CONTROL', items: [
      ['Enter', 'HOME → SETUP'], ['Esc', 'Back'],
      ['?', 'Toggle help'], ['Click', 'Buttons w/ data-nav-to'],
    ]},
  ];
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        fontFamily: '"Hiragino Sans","Yu Gothic UI",sans-serif',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 720, padding: '28px 32px',
        background: 'linear-gradient(180deg, rgba(13,30,52,0.98), rgba(8,18,32,0.98))',
        border: '1.5px solid rgba(255,215,0,0.6)',
        borderRadius: 6,
        boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 32px rgba(255,215,0,0.2)',
        color: '#e0ecf8',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 18 }}>
          <div style={{
            fontFamily: '"Cascadia Code",monospace', fontSize: 11,
            color: '#ffd700', letterSpacing: '0.3em', fontWeight: 800,
          }}>SHORTCUTS</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.06em' }}>キーボードショートカット</div>
          <div style={{ marginLeft: 'auto', fontFamily: '"Cascadia Code",monospace', fontSize: 10, color: '#7090b5', letterSpacing: '0.15em' }}>Esc で閉じる</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {groups.map((g, gi) => (
            <div key={gi}>
              <div style={{
                fontFamily: '"Cascadia Code",monospace', fontSize: 10, fontWeight: 800,
                color: '#ffd700', letterSpacing: '0.28em',
                marginBottom: 10, paddingBottom: 6,
                borderBottom: '1px solid rgba(255,215,0,0.2)',
              }}>{g.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.items.map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <kbd style={{
                      minWidth: 28, padding: '3px 8px',
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(78,195,255,0.4)',
                      borderRadius: 3,
                      fontFamily: '"Cascadia Code",monospace',
                      fontSize: 11, fontWeight: 800,
                      color: '#4ec3ff',
                      textAlign: 'center',
                      letterSpacing: '0.08em',
                    }}>{k}</kbd>
                    <span style={{ fontSize: 12, color: '#b8d4f0' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NavHUD({ route, history, back, go, helpOpen, setHelpOpen }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div style={{
      position: 'fixed', left: 12, bottom: 12,
      zIndex: 10000,
      fontFamily: '"Hiragino Sans","Yu Gothic UI",sans-serif',
      pointerEvents: 'auto',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: 'rgba(8,16,28,0.95)',
        border: `1.5px solid rgba(255,215,0,0.6)`,
        borderRadius: 4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
      }}>
        {/* Back */}
        <button
          onClick={back}
          disabled={history.length === 0}
          style={{
            padding: '4px 10px',
            background: history.length ? 'rgba(78,195,255,0.15)' : 'rgba(78,195,255,0.05)',
            border: `1px solid ${history.length ? '#4ec3ff66' : 'rgba(78,195,255,0.15)'}`,
            color: history.length ? '#4ec3ff' : '#4a5a70',
            fontFamily: '"Cascadia Code","Consolas",monospace',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.15em',
            borderRadius: 2,
            cursor: history.length ? 'pointer' : 'not-allowed',
          }}
        >← BACK</button>

        {/* Current */}
        <div style={{
          padding: '4px 10px',
          background: 'rgba(255,215,0,0.15)',
          border: `1px solid #ffd70088`,
          borderRadius: 2,
        }}>
          <span style={{ fontFamily: '"Cascadia Code",monospace', fontSize: 9, color: '#ffd700', letterSpacing: '0.2em' }}>
            {ROUTES[route].code}
          </span>
          <span style={{ marginLeft: 6, fontSize: 12, color: '#ffd700', fontWeight: 700 }}>
            {ROUTES[route].label}
          </span>
        </div>

        {/* Jump menu toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: '4px 10px',
            background: expanded ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0.4)',
            border: `1px solid #ffd70044`,
            color: '#ffd700',
            fontFamily: '"Cascadia Code",monospace',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.15em',
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >
          JUMP {expanded ? '▾' : '▴'}
        </button>

        {/* Quick home */}
        <button
          onClick={() => go('home')}
          style={{
            padding: '4px 10px',
            background: 'rgba(68,221,153,0.15)',
            border: `1px solid #44dd99aa`,
            color: '#44dd99',
            fontFamily: '"Cascadia Code",monospace',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.15em',
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >⌂ HOME</button>

        <span style={{
          fontFamily: '"Cascadia Code",monospace', fontSize: 10,
          color: '#7090b5', letterSpacing: '0.15em',
          paddingLeft: 6, borderLeft: '1px solid rgba(78,195,255,0.2)',
        }}>
          conan TCG · prototype #09
        </span>
      </div>

      {/* Network status pill (right of the HUD) */}
      <div style={{
        position: 'absolute', left: 'calc(100% + 8px)', top: '50%',
        transform: 'translateY(-50%)',
        whiteSpace: 'nowrap',
      }}>
        {window.NetworkStatus && <window.NetworkStatus state="online" />}
      </div>

      {helpOpen && <ShortcutHelpOverlay onClose={() => setHelpOpen(false)} />}

      {/* Jump menu */}
      {expanded && (
        <div style={{
          position: 'absolute', left: 0, bottom: 'calc(100% + 8px)',
          padding: '10px 12px',
          background: 'rgba(8,16,28,0.97)',
          border: `1.5px solid rgba(255,215,0,0.5)`,
          borderRadius: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          minWidth: 320,
        }}>
          <div style={{
            fontFamily: '"Cascadia Code",monospace', fontSize: 9,
            color: '#ffd700', letterSpacing: '0.3em', marginBottom: 8,
          }}>
            JUMP TO SCREEN
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
            {Object.entries(ROUTES).map(([key, r]) => (
              <button
                key={key}
                onClick={() => { go(key); setExpanded(false); }}
                style={{
                  padding: '6px 10px',
                  textAlign: 'left',
                  background: key === route ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0.35)',
                  border: `1px solid ${key === route ? '#ffd700aa' : 'rgba(78,195,255,0.2)'}`,
                  color: key === route ? '#ffd700' : '#b8d4f0',
                  fontFamily: '"Hiragino Sans",sans-serif',
                  fontSize: 12, fontWeight: 600,
                  borderRadius: 2, cursor: 'pointer',
                  display: 'flex', alignItems: 'baseline', gap: 8,
                }}
              >
                <span style={{
                  fontFamily: '"Cascadia Code",monospace',
                  fontSize: 9, opacity: 0.6, letterSpacing: '0.15em',
                  width: 64,
                }}>{r.code}</span>
                <span>{r.label}</span>
              </button>
            ))}
          </div>
          <div style={{
            marginTop: 10, paddingTop: 8,
            borderTop: '1px solid rgba(78,195,255,0.15)',
            fontFamily: '"Cascadia Code",monospace', fontSize: 9,
            color: '#7090b5', letterSpacing: '0.12em',
          }}>
            画面内のボタンクリックでも遷移します · ESC で閉じる
          </div>
        </div>
      )}
    </div>
  );
}

// Mount
// Inject screen transition keyframes
if (typeof document !== 'undefined' && !document.getElementById('meta-route-anim')) {
  const s = document.createElement('style');
  s.id = 'meta-route-anim';
  s.textContent = `
    @keyframes meta-page-enter {
      from { opacity: 0; transform: translateY(8px) scale(0.995); filter: blur(2px); }
      to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
    }
    .meta-page-anim {
      animation: meta-page-enter 280ms cubic-bezier(.2, .7, .3, 1) both;
    }
  `;
  document.head.appendChild(s);
}

ReactDOM.createRoot(document.getElementById('app')).render(<PrototypeApp />);
