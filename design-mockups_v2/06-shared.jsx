// 06-shared.jsx
// Shared primitives for meta screens (home + deck editor).
// All match conan/src/ui/styles/tokens.css palette.

// Tokens (kept in JS so we can interpolate; mirrors tokens.css)
// Audited against conan/design-mockups/01-board-mockup.html (the in-match board)
// so meta + match share the same palette tokens 1:1.
const T = {
  // ── Base palette (board background tones) ──
  bgDeep:    '#0a1a28',  // matches --bg-deep
  bgZone:    '#1b3a5c',
  bgSelf1:   '#0d2640',
  bgSelf2:   '#1b3a5c',
  bgOpp1:    '#0d2640',
  bgOpp2:    '#2a1b3c',
  bgCell:    'rgba(0,0,0,0.32)',
  borderZone:'#3a6ea5',
  borderSelf:'#44dd99',
  borderOpp: '#aa66dd',

  // ── Accent ──
  gold:      '#ffd700',  // matches --accent-gold
  goldDim:   '#a88a1a',
  goldSoft:  '#ffd75e',  // mid-bright variant used by match-board for evidence/LP text
  neonBlue:  '#4ec3ff',
  neonYellow:'#ffd54a',
  accentBlue:'#3a6ea5',

  // ── Card color palette (matches --color-*) ──
  blue:      '#2b6cb5',
  yellow:    '#d4a425',
  yellowBorder: '#e0b830',  // match-board uses brighter border ring for yellow cards
  red:       '#c84040',
  green:     '#3aa67a',
  purple:    '#8a4cc0',

  // ── Card stat text colors (from match-board .card .ap/.lp/.lv) ──
  apColor:   '#ff9b6e',  // AP — warm orange-red
  lpColor:   '#ffd75e',  // LP — gold-soft
  lvColor:   '#6ed1ff',  // Lv — cool blue

  // ── State colors (match-board sleep/stun/named) ──
  stateSleep:'rgba(40, 80, 200, 0.6)',
  stateStun: 'rgba(220, 50, 50, 0.65)',
  stateNamed:'rgba(240, 200, 40, 0.95)',

  // ── Case status (match-board case-editing/resolved) ──
  caseEditing: '#3366ff',
  caseResolved:'#ee2255',

  // ── Targeting (validity highlights) ──
  targetValid:   '#44dd99',
  targetInvalid: 'rgba(238, 80, 80, 0.5)',

  // ── Text ──
  textPrimary:  '#e0ecf8',
  textSecondary:'#b8d4f0',
  textMuted:    '#7090b5',
  textDisabled: '#4a5a70',

  // ── Typography ──
  fontJp:    '"Hiragino Sans","Yu Gothic UI","Noto Sans JP",-apple-system,sans-serif',
  fontMono:  '"Cascadia Code","Consolas","JetBrains Mono",monospace',
  fontSerif: '"Hiragino Mincho ProN","Yu Mincho",serif',

  // ── Patterns ──
  keepOut:   'repeating-linear-gradient(90deg, #ffd700 0 22px, #0a0a0a 22px 44px)',
};

const COLOR_TOKEN = {
  blue:   T.blue,
  yellow: T.yellow,
  red:    T.red,
  green:  T.green,
  purple: T.purple,
};

// One-time CSS injection for interactive states (hover / focus / active).
// Inline styles can't express :hover, so we name interactive elements with
// `meta-*` classes and let this stylesheet handle the state transitions.
if (typeof document !== 'undefined' && !document.getElementById('meta-interaction-styles')) {
  const s = document.createElement('style');
  s.id = 'meta-interaction-styles';
  s.textContent = `
    /* ── Buttons ─────────────────────────────────────────────── */
    .meta-btn-small {
      transition: background 120ms, border-color 120ms, transform 100ms, box-shadow 120ms;
    }
    .meta-btn-small:hover {
      background: var(--meta-hover-bg, rgba(78,195,255,0.18)) !important;
      border-color: var(--meta-hover-border, #4ec3ff) !important;
      box-shadow: 0 0 12px var(--meta-hover-glow, rgba(78,195,255,0.35));
      transform: translateY(-1px);
    }
    .meta-btn-small:active { transform: translateY(0); }

    .meta-btn-setup {
      transition: background 140ms, border-color 140ms, box-shadow 140ms, color 140ms;
    }
    .meta-btn-setup:hover {
      background: rgba(78,195,255,0.18) !important;
      border-color: #4ec3ff !important;
      color: #e0ecf8 !important;
      box-shadow: 0 0 14px rgba(78,195,255,0.4);
    }

    .meta-btn-ready {
      transition: transform 140ms, filter 140ms;
    }
    .meta-btn-ready:hover {
      transform: translateY(-2px) scale(1.02);
      filter: brightness(1.08);
    }
    .meta-btn-ready:hover > div:nth-child(1) {
      filter: blur(14px) brightness(1.4);
    }
    .meta-btn-ready:active { transform: translateY(0) scale(1); }

    /* ── Card hover (subtle lift + glow ring) ──────────────────── */
    .meta-card-hover {
      transition: transform 160ms cubic-bezier(.2,.7,.3,1), box-shadow 160ms, filter 160ms;
    }
    .meta-card-hover:hover {
      transform: translateY(-4px) scale(1.03);
      box-shadow: 0 12px 24px rgba(0,0,0,0.7), 0 0 16px rgba(255,215,0,0.45) !important;
      filter: brightness(1.06);
      z-index: 5;
    }

    /* ── Nav items (top bar) ────────────────────────────────────── */
    .meta-nav-item {
      transition: color 120ms, background 120ms, border-color 120ms;
      border-radius: 2px;
    }
    .meta-nav-item:hover {
      color: #ffd700 !important;
      background: rgba(255,215,0,0.05);
    }

    /* ── List rows (deck list, history, chapter, deck quick select) ─ */
    .meta-row {
      transition: background 110ms, border-color 110ms, transform 110ms;
    }
    .meta-row:hover {
      background: rgba(78,195,255,0.06) !important;
      border-color: rgba(78,195,255,0.4) !important;
      transform: translateX(2px);
    }
    .meta-row:hover .meta-row-arrow {
      transform: translateX(4px);
      color: #ffd700 !important;
    }
    .meta-row-arrow { transition: transform 120ms, color 120ms; }

    /* ── CTA tiles (home bottom row) ────────────────────────────── */
    .meta-cta-tile {
      transition: transform 160ms cubic-bezier(.2,.7,.3,1), border-color 160ms, box-shadow 160ms;
    }
    .meta-cta-tile:hover {
      transform: translateY(-4px);
      border-color: var(--meta-tile-accent, #ffd700) !important;
      box-shadow: 0 14px 28px rgba(0,0,0,0.75), 0 0 24px var(--meta-tile-glow, rgba(255,215,0,0.3)), inset 0 0 24px var(--meta-tile-glow, rgba(255,215,0,0.15)) !important;
    }
    .meta-cta-tile:hover .meta-cta-svg { filter: drop-shadow(0 0 8px var(--meta-tile-accent, #ffd700)); }
    .meta-cta-svg { transition: filter 160ms; }

    /* ── Chip / pill controls ───────────────────────────────────── */
    .meta-chip {
      transition: background 120ms, border-color 120ms, color 120ms;
    }
    .meta-chip:hover {
      background: rgba(255,215,0,0.12) !important;
      border-color: #ffd700 !important;
      color: #ffd700 !important;
    }

    /* ── Focus ring (keyboard a11y) ─────────────────────────────── */
    .meta-btn-small:focus-visible,
    .meta-btn-setup:focus-visible,
    .meta-btn-ready:focus-visible,
    .meta-card-hover:focus-visible,
    .meta-nav-item:focus-visible,
    .meta-row:focus-visible,
    .meta-cta-tile:focus-visible,
    .meta-chip:focus-visible {
      outline: 2px solid #ffd700;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(s);
}

// ── Background: shared dark-noir base with optional per-scene overlay ──
// Pass `scene` to mix in a screen-specific decorative layer.
// Backwards-compatible: `theme="noir"` (default) | `theme="crimson"` still works.
function MetaBg({ theme = 'noir', scene = 'default', children }) {
  const palette = theme === 'noir'
    ? {
        spot: 'rgba(78,195,255,0.10)',
        base: 'radial-gradient(ellipse at 50% 30%, #15263e 0%, #0a1424 50%, #050a14 100%)',
        accentSvg: '%234ec3ff',
        magnifier: '%23ffd75e',
      }
    : { // 'crimson'
        spot: 'rgba(196,24,24,0.10)',
        base: 'radial-gradient(ellipse at 50% 30%, #2a0e18 0%, #14060c 60%, #06030a 100%)',
        accentSvg: '%23ff7ab8',
        magnifier: '%23ffd75e',
      };
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(ellipse 70% 50% at 50% -8%, ${palette.spot}, transparent 70%),
        repeating-linear-gradient(115deg, transparent 0 80px, rgba(0,0,0,0.10) 80px 82px),
        url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360' viewBox='0 0 360 360'><g fill='none' stroke='${palette.magnifier}' stroke-width='1.4' opacity='0.06'><circle cx='150' cy='150' r='95'/><circle cx='150' cy='150' r='80'/><line x1='220' y1='220' x2='320' y2='320' stroke-width='10'/><circle cx='150' cy='150' r='55' stroke-dasharray='2 5'/></g></svg>"),
        url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><g fill='none' stroke='${palette.accentSvg}' stroke-width='0.5' opacity='0.06'><path d='M0 0h48v48H0z'/><path d='M24 0v48M0 24h48'/></g></svg>"),
        ${palette.base}
      `,
      backgroundRepeat: 'no-repeat, no-repeat, no-repeat, repeat, no-repeat',
      backgroundPosition: '0 0, 0 0, right -40px bottom -40px, 0 0, 0 0',
      backgroundSize: 'auto, auto, 360px 360px, 48px 48px, auto',
    }}>
      {/* Scene-specific decorative layer (sits between base + content) */}
      <SceneOverlay scene={scene} />
      {/* Vignette on top of overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(0,0,0,0.55) 100%)',
      }} />
      {children}
    </div>
  );
}

function SceneOverlay({ scene }) {
  const Overlay = SCENE_OVERLAYS[scene];
  if (!Overlay) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <Overlay />
    </div>
  );
}

// Per-scene decorative overlays. Each returns SVG/CSS layered at low opacity.
const SCENE_OVERLAYS = {
  // HOME — kept blank, the HeroBackdrop in 06-home owns the city skyline.
  home: null,

  // DECK — detective's desk: paper texture + horizontal ruled lines + scattered notes
  deck: () => (
    <React.Fragment>
      {/* Paper rule lines */}
      <svg style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.05 }}>
        <defs>
          <pattern id="ruled" width="100%" height="36" patternUnits="userSpaceOnUse">
            <line x1="0" y1="35.5" x2="100%" y2="35.5" stroke="#4ec3ff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ruled)" />
      </svg>
      {/* Margin tear strip on left */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 24,
        background: 'linear-gradient(90deg, rgba(255,215,94,0.08), transparent)',
        borderRight: '1px dashed rgba(255,215,94,0.10)',
      }} />
      {/* Scattered post-it shapes */}
      <div style={{ position: 'absolute', right: 80, top: 200, width: 100, height: 100,
        background: 'rgba(255,215,94,0.025)', transform: 'rotate(6deg)', borderRadius: 2,
        boxShadow: 'inset 0 0 24px rgba(255,215,94,0.04)' }} />
      <div style={{ position: 'absolute', left: 60, bottom: 140, width: 80, height: 80,
        background: 'rgba(78,195,255,0.025)', transform: 'rotate(-8deg)', borderRadius: 2 }} />
      {/* Subtle fingerprint smudge bottom-right */}
      <svg style={{ position: 'absolute', right: 80, bottom: 60, width: 280, height: 280, opacity: 0.04 }} viewBox="0 0 100 100">
        {[10, 18, 26, 34, 42].map((r, i) => (
          <ellipse key={i} cx="50" cy="50" rx={r} ry={r * 1.1} fill="none" stroke="#ffd75e" strokeWidth="0.8"
            strokeDasharray={`${20 - i * 2} ${4 + i}`} transform={`rotate(${i * 15} 50 50)`} />
        ))}
      </svg>
    </React.Fragment>
  ),

  // CARDS — evidence file cabinet: vertical dividers + index tabs
  cards: () => (
    <React.Fragment>
      {/* Vertical divider columns */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06 }}>
        <defs>
          <pattern id="filecols" width="240" height="100%" patternUnits="userSpaceOnUse">
            <line x1="239.5" y1="0" x2="239.5" y2="100%" stroke="#ffd75e" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#filecols)" />
      </svg>
      {/* Index tabs along the top */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 64, height: 6, display: 'flex' }}>
        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((l, i) => (
          <div key={i} style={{ flex: 1, position: 'relative' }}>
            <div style={{
              position: 'absolute', left: '50%', top: 0,
              transform: 'translateX(-50%)',
              padding: '1px 6px',
              fontFamily: '"Cascadia Code",monospace', fontSize: 9, fontWeight: 800,
              color: 'rgba(255,215,94,0.18)', letterSpacing: '0.15em',
            }}>{l}</div>
          </div>
        ))}
      </div>
      {/* Number tickmarks along left edge */}
      <div style={{ position: 'absolute', left: 6, top: 130, bottom: 30, width: 14,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: '"Cascadia Code",monospace', fontSize: 8, color: 'rgba(255,215,94,0.15)' }}>
        {['001','008','015','022','029','036','043','047'].map((n) => <div key={n}>{n}</div>)}
      </div>
    </React.Fragment>
  ),

  // HISTORY — cork board: dotted cork pattern + pins + connecting strings
  history: () => (
    <React.Fragment>
      {/* Cork dots */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08 }}>
        <defs>
          <pattern id="cork" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="5" r="0.7" fill="#c98a4a" />
            <circle cx="14" cy="8" r="0.5" fill="#a8763a" />
            <circle cx="8" cy="16" r="0.6" fill="#b87a3e" />
            <circle cx="18" cy="17" r="0.4" fill="#c98a4a" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cork)" />
      </svg>
      {/* Cork tint */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 60% 50%, rgba(180,120,60,0.04), transparent 60%)' }} />
      {/* Connecting strings between hypothetical pins */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.10 }}>
        <line x1="280" y1="200" x2="980" y2="380" stroke="#c41818" strokeWidth="1" strokeDasharray="6 4" />
        <line x1="980" y1="380" x2="1380" y2="240" stroke="#c41818" strokeWidth="1" strokeDasharray="6 4" />
        <line x1="980" y1="380" x2="660" y2="720" stroke="#c41818" strokeWidth="1" strokeDasharray="6 4" />
      </svg>
      {/* Pushpins */}
      {[[280, 200, '#c41818'], [980, 380, '#ffd75e'], [1380, 240, '#4ec3ff'], [660, 720, '#44dd99']].map(([x, y, c], i) => (
        <div key={i} style={{
          position: 'absolute', left: x - 4, top: y - 4,
          width: 8, height: 8, borderRadius: '50%',
          background: c, opacity: 0.5,
          boxShadow: `0 0 8px ${c}88, 0 1px 2px rgba(0,0,0,0.5)`,
        }} />
      ))}
    </React.Fragment>
  ),

  // TUTORIAL — chalkboard: vertical chalk lines + chalk dust + faint diagrams
  tutorial: () => (
    <React.Fragment>
      {/* Faint chalk green tint */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(58,166,122,0.05), transparent 70%)' }} />
      {/* Chalk dust at bottom */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80,
        background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.025))' }} />
      {/* Faint diagram on the right */}
      <svg style={{ position: 'absolute', right: 60, top: 220, width: 360, height: 240, opacity: 0.08 }} viewBox="0 0 360 240" fill="none">
        <rect x="20" y="40" width="80" height="100" stroke="#fff" strokeWidth="1" />
        <text x="22" y="160" fontFamily="serif" fontSize="14" fill="#fff">A</text>
        <path d="M110 90 L 250 90" stroke="#fff" strokeWidth="1" strokeDasharray="4 4" markerEnd="url(#arrtut)" />
        <text x="160" y="80" fontFamily="serif" fontSize="11" fill="#fff">vs</text>
        <rect x="260" y="40" width="80" height="100" stroke="#fff" strokeWidth="1" />
        <text x="262" y="160" fontFamily="serif" fontSize="14" fill="#fff">B</text>
        <text x="160" y="200" fontFamily="serif" fontSize="11" fill="#fff" textAnchor="middle">AP 5 &gt; 3 → A 勝利</text>
        <defs>
          <marker id="arrtut" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6" fill="#fff" /></marker>
        </defs>
      </svg>
      {/* Chalk scratches across */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.025 }} preserveAspectRatio="none">
        {[160, 320, 540, 780, 920].map((y, i) => (
          <line key={i} x1={i * 200} y1={y} x2={i * 200 + 600} y2={y + ((i % 2) * 6 - 3)} stroke="#fff" strokeWidth="0.5" />
        ))}
      </svg>
    </React.Fragment>
  ),

  // SETTINGS — control console: scanlines + waveform + alphanumeric noise
  settings: () => (
    <React.Fragment>
      {/* Scanlines */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(78,195,255,0.04) 2px 3px)' }} />
      {/* Waveform at bottom */}
      <svg style={{ position: 'absolute', left: 0, right: 0, bottom: 80, width: '100%', height: 120, opacity: 0.10 }} viewBox="0 0 1920 120" preserveAspectRatio="none">
        <path d={`M0 60 ${Array.from({ length: 80 }, (_, i) => {
          const x = i * 24;
          const y = 60 + Math.sin(i * 0.4) * 20 + Math.sin(i * 1.1) * 8;
          return `L ${x} ${y}`;
        }).join(' ')}`} stroke="#4ec3ff" strokeWidth="1.2" fill="none" />
      </svg>
      {/* Top-right alphanumeric ticker */}
      <div style={{ position: 'absolute', right: 32, top: 84,
        fontFamily: '"Cascadia Code",monospace', fontSize: 10, color: 'rgba(78,195,255,0.18)',
        letterSpacing: '0.1em', lineHeight: 1.6, textAlign: 'right',
      }}>
        <div>SYS · 0x4E8F · OK</div>
        <div>RENDER · 1920x1080 · 60fps</div>
        <div>ENGINE · v0.8.3-phase9</div>
        <div>NET · LOCAL · 0ms</div>
      </div>
      {/* Subtle cyan tint */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 30%, rgba(78,195,255,0.04), transparent 60%)' }} />
    </React.Fragment>
  ),

  // SETUP — confrontation arena: left/right colored lights + center divide
  setup: () => (
    <React.Fragment>
      {/* Left green wash */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '50%', bottom: 0,
        background: 'radial-gradient(ellipse at 30% 40%, rgba(68,221,153,0.06), transparent 60%)' }} />
      {/* Right purple wash */}
      <div style={{ position: 'absolute', right: 0, top: 0, width: '50%', bottom: 0,
        background: 'radial-gradient(ellipse at 70% 40%, rgba(138,76,192,0.06), transparent 60%)' }} />
      {/* Center divide */}
      <svg style={{ position: 'absolute', left: '50%', top: 0, height: '100%', width: 2, opacity: 0.18 }} preserveAspectRatio="none" viewBox="0 0 2 1080">
        <line x1="1" y1="120" x2="1" y2="960" stroke="#ffd75e" strokeWidth="1" strokeDasharray="8 8" />
      </svg>
      {/* Audience silhouette at bottom */}
      <svg style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 80, opacity: 0.12 }} viewBox="0 0 1920 80" preserveAspectRatio="none">
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={i * 50 + (i % 3) * 4} cy={80 - (i % 5) * 4} r={14 + (i % 3) * 2} fill="#050810" />
        ))}
      </svg>
    </React.Fragment>
  ),

  // RESULT — verdict stage: central spotlight + audience + gold dust
  result: () => (
    <React.Fragment>
      {/* Stage spotlight */}
      <div style={{ position: 'absolute', left: '50%', top: '15%',
        width: 900, height: 900, marginLeft: -450,
        background: 'radial-gradient(circle, rgba(255,215,94,0.12) 0%, rgba(255,215,94,0.04) 30%, transparent 65%)',
        filter: 'blur(10px)' }} />
      {/* Crown of converging beams */}
      <svg style={{ position: 'absolute', left: '50%', top: 0, marginLeft: -800, width: 1600, height: 700, opacity: 0.06 }} viewBox="0 0 1600 700">
        {Array.from({ length: 12 }, (_, i) => {
          const angle = -Math.PI / 2 + (i - 5.5) * 0.18;
          const x = 800 + Math.cos(angle) * 1200;
          const y = 200 + Math.sin(angle) * 1200;
          return <line key={i} x1="800" y1="200" x2={x} y2={y} stroke="#ffd75e" strokeWidth="4" />;
        })}
      </svg>
      {/* Floor reflection */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 200,
        background: 'linear-gradient(180deg, transparent, rgba(255,215,94,0.04))',
        borderTop: '1px solid rgba(255,215,94,0.08)' }} />
      {/* Audience silhouette */}
      <svg style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 100, opacity: 0.18 }} viewBox="0 0 1920 100" preserveAspectRatio="none">
        {Array.from({ length: 50 }, (_, i) => (
          <circle key={i} cx={i * 40 + (i % 4) * 3} cy={100 - (i % 6) * 3} r={16 + (i % 4) * 2} fill="#050810" />
        ))}
      </svg>
    </React.Fragment>
  ),

  // REPLAY — video archive room: scanlines + film perforations + timecode
  replay: () => (
    <React.Fragment>
      {/* Heavy scanlines */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,215,94,0.04) 3px 4px)' }} />
      {/* Film perforations left + right */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 18 }}>
        {Array.from({ length: 22 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', left: 4, top: i * 50 + 10, width: 10, height: 24,
            background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,215,94,0.15)', borderRadius: 2 }} />
        ))}
      </div>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 18 }}>
        {Array.from({ length: 22 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', right: 4, top: i * 50 + 10, width: 10, height: 24,
            background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,215,94,0.15)', borderRadius: 2 }} />
        ))}
      </div>
      {/* Timecode top-right */}
      <div style={{ position: 'absolute', right: 30, top: 90,
        fontFamily: '"Cascadia Code",monospace', fontSize: 11, color: 'rgba(255,215,94,0.4)',
        letterSpacing: '0.12em', padding: '3px 8px',
        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,215,94,0.2)', borderRadius: 2,
      }}>
        ● REC · 00:08:24:11 / 00:12:34:00
      </div>
    </React.Fragment>
  ),
};

// ── App TopBar (logo + nav + player profile) ───────────────────────────
function AppTopBar({ playerName = 'TANTEI_01', playerRank = '探偵 II', winRate = 64, played = 128, page = 'HOME' }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 0, height: 64,
      display: 'flex', alignItems: 'center',
      padding: '0 32px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.45) 70%, transparent)',
      borderBottom: `1px solid rgba(78,195,255,0.20)`,
      zIndex: 10,
      fontFamily: T.fontJp,
      color: T.textPrimary,
    }}>
      {/* Left: logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{
          width: 44, height: 44, position: 'relative',
          border: `2px solid ${T.gold}`,
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(78,195,255,0.1))',
          boxShadow: `0 0 12px rgba(255,215,0,0.3)`,
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="11" cy="11" r="7" stroke={T.gold} strokeWidth="1.8" />
            <circle cx="11" cy="11" r="4" stroke={T.gold} strokeWidth="0.8" opacity="0.5" />
            <line x1="16" y1="16" x2="24" y2="24" stroke={T.gold} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontMono, letterSpacing: '0.18em' }}>
            CONAN TCG
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, letterSpacing: '0.04em' }}>
            探偵 名鑑
          </div>
        </div>
      </div>

      {/* Center: nav (no shop / events) */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4 }}>
        {['HOME', 'DECK', 'CARDS', 'TUTORIAL', 'SETTINGS'].map((p) => {
          const active = p === page;
          return (
            <div
              key={p}
              data-nav-to={p.toLowerCase()}
              className="meta-nav-item"
              style={{
              padding: '8px 22px',
              fontFamily: T.fontMono,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: active ? T.gold : T.textSecondary,
              borderBottom: active ? `2px solid ${T.gold}` : '2px solid transparent',
              cursor: 'pointer',
              position: 'relative',
            }}>
              {p}
            </div>
          );
        })}
      </div>

      {/* Right: profile with stat strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Win/play stats */}
        <div style={{ display: 'flex', gap: 18, paddingRight: 14, borderRight: '1px solid rgba(78,195,255,0.15)' }}>
          <StatInline label="勝率" value={`${winRate}%`} color={T.green} />
          <StatInline label="対戦" value={played} color={T.neonBlue} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 14px 6px 6px',
          background: 'rgba(78,195,255,0.08)',
          border: '1px solid rgba(78,195,255,0.25)',
          borderRadius: 22,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `linear-gradient(135deg, ${T.blue}, ${T.purple})`,
            border: `1.5px solid ${T.gold}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: T.textPrimary,
          }}>
            🕵
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, fontFamily: T.fontMono, letterSpacing: '0.05em' }}>{playerName}</div>
            <div style={{ fontSize: 10, color: T.gold, fontFamily: T.fontJp, letterSpacing: '0.12em', marginTop: 1 }}>{playerRank}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatInline({ label, value, color }) {
  return (
    <div style={{ textAlign: 'right', lineHeight: 1.1 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 16, fontWeight: 800, color, letterSpacing: '0.04em', marginTop: 1 }}>{value}</div>
    </div>
  );
}

function CurrencyChip({ icon, value, color, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 12px',
      background: 'rgba(0,0,0,0.4)',
      border: `1px solid ${color}33`,
      borderRadius: 16,
    }}>
      <span style={{ color, fontSize: 14, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, fontFamily: T.fontMono, letterSpacing: '0.04em' }}>
        {value}
      </span>
      <span style={{ fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>{label}</span>
    </div>
  );
}

// ── Mini card (for deck editor grids / hand displays) ──────────────────
// width is the controlling dimension; height = w * 1.4
function MetaCard({ card, w = 90, selected = false, dimmed = false, count, onClick, hoverable = true, badge }) {
  const h = Math.round(w * 1.4);
  const c = COLOR_TOKEN[card.color] || T.blue;
  const showFull = w >= 110;
  const fontName = w >= 90 ? Math.max(10, Math.round(w * 0.13)) : 9;
  return (
    <div
      onClick={onClick}
      className={hoverable ? 'meta-card-hover' : undefined}
      style={{
        position: 'relative',
        width: w, height: h,
        borderRadius: w >= 90 ? 6 : 4,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        outline: selected ? `2.5px solid ${T.gold}` : 'none',
        outlineOffset: 1,
        opacity: dimmed ? 0.42 : 1,
        background: `linear-gradient(180deg, ${c} 0%, ${shade(c, -0.35)} 100%)`,
        boxShadow: selected
          ? `0 0 14px ${T.gold}88, 0 4px 10px rgba(0,0,0,0.55)`
          : '0 3px 8px rgba(0,0,0,0.55)',
        border: `1px solid ${shade(c, -0.5)}`,
        flexShrink: 0,
      }}
    >
      {/* color stripe top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: w >= 90 ? 18 : 12,
        background: `linear-gradient(180deg, ${shade(c, 0.25)}, ${c})`,
        display: 'flex', alignItems: 'center', padding: '0 5px',
        justifyContent: 'space-between',
      }}>
        {card.cost != null && (
          <div style={{
            width: w >= 90 ? 16 : 12, height: w >= 90 ? 16 : 12,
            borderRadius: '50%',
            background: '#fff', color: shade(c, -0.4),
            fontFamily: T.fontMono, fontWeight: 800,
            fontSize: w >= 90 ? 10 : 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${shade(c, -0.4)}`,
          }}>
            {card.cost}
          </div>
        )}
        <div style={{
          fontSize: w >= 90 ? 9 : 7,
          color: '#fff', fontFamily: T.fontMono, letterSpacing: '0.06em',
          opacity: 0.85, marginLeft: 'auto',
        }}>
          {card.rarity}
        </div>
      </div>
      {/* Art area — abstract silhouette */}
      <div style={{
        position: 'absolute',
        top: w >= 90 ? 18 : 12, left: 0, right: 0, bottom: w >= 90 ? 32 : 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(ellipse at 50% 40%, ${shade(c, 0.15)} 0%, ${shade(c, -0.5)} 90%)`,
      }}>
        <CardSilhouette card={card} color={c} />
      </div>
      {/* Name footer */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.85), rgba(0,0,0,0.4))',
        padding: w >= 90 ? '4px 6px' : '2px 3px',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <div style={{
          flex: 1,
          fontSize: fontName, fontWeight: 700,
          color: '#fff', fontFamily: T.fontJp,
          textShadow: '0 1px 2px rgba(0,0,0,0.9)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {card.name}
        </div>
        {card.ap != null && showFull && (
          <div style={{
            fontSize: 10, fontWeight: 800,
            color: T.apColor,
            fontFamily: T.fontMono,
          }}>
            {(card.ap / 1000).toFixed(0)}K
          </div>
        )}
      </div>
      {/* count badge */}
      {count != null && (
        <div style={{
          position: 'absolute', right: -4, top: -4,
          minWidth: 22, height: 22,
          padding: '0 5px',
          background: count > 3 ? T.red : T.gold,
          color: count > 3 ? '#fff' : '#1a1208',
          borderRadius: 11,
          border: `1.5px solid ${T.bgDeep}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
        }}>
          ×{count}
        </div>
      )}
      {badge && (
        <div style={{
          position: 'absolute', left: 4, top: w >= 90 ? 22 : 16,
          padding: '2px 5px',
          background: badge === 'partner' ? T.gold : 'rgba(0,0,0,0.7)',
          color: badge === 'partner' ? '#1a1208' : T.neonYellow,
          fontFamily: T.fontMono, fontSize: 8, fontWeight: 800,
          letterSpacing: '0.1em',
          borderRadius: 2,
        }}>
          {badge.toUpperCase()}
        </div>
      )}
    </div>
  );
}

// Stylized art: ID-seeded background pattern + first character + role icon.
// Replaces the generic silhouette so each card is uniquely identifiable
// without using copyrighted official art.
function CardSilhouette({ card, color }) {
  const seed = stringSeed(card?.num || 'X');
  const initial = (card?.name || '?').charAt(0);
  const role = pickRole(card?.features || [], card?.type);
  // Tuning per card type
  const isPartner = card?.type === 'partner';
  const isEvent = card?.type === 'event';
  return (
    <svg width="92%" height="92%" viewBox="0 0 100 100" fill="none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={`bg-${card?.num || 'x'}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
      </defs>
      {/* ID-seeded pattern: 6 concentric arcs offset by seed */}
      {!isEvent && Array.from({ length: 5 }, (_, i) => {
        const r = 14 + i * 9;
        const dash = (seed % (4 + i)) * 1.5 + 2;
        const rot = (seed * (i + 1)) % 360;
        return (
          <circle key={i} cx="50" cy="50" r={r}
            stroke="rgba(255,255,255,0.22)" strokeWidth="0.7"
            strokeDasharray={`${dash} ${dash * 1.5}`}
            transform={`rotate(${rot} 50 50)`}
            fill="none" />
        );
      })}
      {/* For events: a paper sheet motif */}
      {isEvent && (
        <React.Fragment>
          <rect x="22" y="14" width="56" height="72" rx="2"
            stroke="rgba(255,255,255,0.4)" strokeWidth="1"
            fill={`url(#bg-${card?.num})`} />
          {[24, 34, 44, 54].map((y, i) => (
            <line key={i} x1="28" y1={y} x2={68 - i * 4} y2={y}
              stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />
          ))}
        </React.Fragment>
      )}
      {/* Center circle backdrop */}
      <circle cx="50" cy="50" r={isEvent ? 18 : 26} fill={`url(#bg-${card?.num})`} />
      {/* Big initial (kanji) — the primary identifier */}
      <text x="50" y={isPartner ? 56 : 58}
        textAnchor="middle"
        fontFamily="'Hiragino Mincho ProN','Yu Mincho',serif"
        fontSize={isPartner ? 38 : 34}
        fontWeight="900"
        fill="rgba(255,255,255,0.95)"
        style={{
          textShadow: '0 2px 4px rgba(0,0,0,0.7)',
          filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.6))',
        }}>
        {initial}
      </text>
      {/* Role icon — top-right corner */}
      <g transform="translate(76, 18)">
        <RoleIcon kind={role} />
      </g>
      {/* Partner crown ribbon */}
      {isPartner && (
        <path d="M28 22 L40 28 L50 22 L60 28 L72 22 L70 30 L30 30 Z"
          fill="rgba(255,215,0,0.85)"
          stroke="rgba(140,90,0,0.7)" strokeWidth="0.6" />
      )}
    </svg>
  );
}

// Hash a string to a small integer for seeding pattern variation
function stringSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return Math.abs(h);
}

// Pick a role icon kind from card features
function pickRole(features, type) {
  if (type === 'event') return 'doc';
  for (const f of features) {
    if (f === '探偵' || f === '私立探偵') return 'glass';
    if (f === '警察') return 'badge';
    if (f === '怪盗') return 'hat';
    if (f === '少年探偵団') return 'star';
    if (f === '科学者') return 'flask';
    if (f === '発明家') return 'gear';
    if (f === '空手家') return 'fist';
    if (f === '毛利探偵事務所') return 'glass';
  }
  return 'plain';
}

function RoleIcon({ kind }) {
  const stroke = 'rgba(255,215,0,0.95)';
  const fill = 'rgba(255,215,0,0.18)';
  const w = 1.4;
  switch (kind) {
    case 'glass': // detective magnifier
      return <g>
        <circle cx="0" cy="0" r="6" stroke={stroke} strokeWidth={w} fill={fill} />
        <line x1="4" y1="4" x2="10" y2="10" stroke={stroke} strokeWidth={w + 0.4} strokeLinecap="round" />
      </g>;
    case 'badge': // police badge (5-point star)
      return <path d="M0 -7 L1.8 -2.5 L7 -2 L3 1.3 L4.3 6.5 L0 3.5 L-4.3 6.5 L-3 1.3 L-7 -2 L-1.8 -2.5 Z" stroke={stroke} strokeWidth={w} fill={fill} strokeLinejoin="round" />;
    case 'hat': // thief top-hat
      return <g>
        <rect x="-6" y="-1" width="12" height="2" stroke={stroke} strokeWidth={w} fill={fill} />
        <rect x="-4" y="-7" width="8" height="6" stroke={stroke} strokeWidth={w} fill={fill} />
      </g>;
    case 'star': // boy-detectives star
      return <path d="M0 -6 L1.5 -2 L6 -2 L2.5 0.8 L3.8 5 L0 2.6 L-3.8 5 L-2.5 0.8 L-6 -2 L-1.5 -2 Z" stroke={stroke} strokeWidth={w} fill={fill} strokeLinejoin="round" />;
    case 'flask': // scientist flask
      return <g>
        <path d="M-2 -6 L-2 -2 L-5 5 L5 5 L2 -2 L2 -6 Z" stroke={stroke} strokeWidth={w} fill={fill} strokeLinejoin="round" />
        <line x1="-2" y1="-6" x2="2" y2="-6" stroke={stroke} strokeWidth={w} />
      </g>;
    case 'gear': // inventor gear
      return <g>
        <circle cx="0" cy="0" r="3.5" stroke={stroke} strokeWidth={w} fill={fill} />
        {[0, 60, 120, 180, 240, 300].map((a, i) => (
          <line key={i} x1="0" y1="0" x2={Math.cos(a * Math.PI / 180) * 7} y2={Math.sin(a * Math.PI / 180) * 7} stroke={stroke} strokeWidth={w + 0.3} strokeLinecap="round" />
        ))}
      </g>;
    case 'fist': // karate fist
      return <g>
        <rect x="-5" y="-3" width="10" height="6" rx="1.5" stroke={stroke} strokeWidth={w} fill={fill} />
        <line x1="-3" y1="-3" x2="-3" y2="3" stroke={stroke} strokeWidth={w * 0.6} />
        <line x1="0" y1="-3" x2="0" y2="3" stroke={stroke} strokeWidth={w * 0.6} />
        <line x1="3" y1="-3" x2="3" y2="3" stroke={stroke} strokeWidth={w * 0.6} />
      </g>;
    case 'doc': // event document seal
      return <g>
        <circle cx="0" cy="0" r="5" stroke={stroke} strokeWidth={w} fill={fill} />
        <path d="M-2.5 0 L-0.5 2 L3 -2" stroke={stroke} strokeWidth={w + 0.2} fill="none" strokeLinecap="round" />
      </g>;
    default:
      return <circle cx="0" cy="0" r="4" stroke={stroke} strokeWidth={w} fill={fill} />;
  }
}

// Color blender — darken/lighten a hex color.
function shade(hex, amount) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const mix = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const nr = Math.round(r * (1 - a) + mix * a);
  const ng = Math.round(g * (1 - a) + mix * a);
  const nb = Math.round(b * (1 - a) + mix * a);
  return '#' + [nr, ng, nb].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ── Button styles ─────────────────────────────────────────────────────
function PrimaryButton({ children, label, sub, big = false, accent = T.gold, onClick }) {
  return (
    <div onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
        padding: big ? '18px 56px' : '12px 32px',
        background: `linear-gradient(180deg, ${accent}, ${shade(accent, -0.4)})`,
        color: shade(accent, -0.7),
        fontFamily: T.fontJp,
        fontWeight: 800,
        fontSize: big ? 22 : 16,
        letterSpacing: '0.06em',
        borderRadius: 4,
        cursor: 'pointer',
        boxShadow: `0 0 18px ${accent}55, 0 6px 12px rgba(0,0,0,0.5), inset 0 1px 0 ${shade(accent, 0.4)}`,
        border: `1px solid ${shade(accent, -0.6)}`,
        position: 'relative',
      }}>
      <div>{label || children}</div>
      {sub && (
        <div style={{ fontSize: big ? 11 : 10, fontFamily: T.fontMono, opacity: 0.7, letterSpacing: '0.15em', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function GhostButton({ children, label, sub, accent = T.neonBlue, onClick, big = false }) {
  return (
    <div onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
        padding: big ? '14px 36px' : '10px 22px',
        background: `linear-gradient(180deg, rgba(78,195,255,0.10), rgba(78,195,255,0.03))`,
        color: accent,
        fontFamily: T.fontJp,
        fontWeight: 700,
        fontSize: big ? 16 : 13,
        letterSpacing: '0.08em',
        borderRadius: 3,
        cursor: 'pointer',
        border: `1px solid ${accent}66`,
        boxShadow: `inset 0 0 12px ${accent}11`,
      }}>
      <div>{label || children}</div>
      {sub && (
        <div style={{ fontSize: 9, fontFamily: T.fontMono, opacity: 0.55, letterSpacing: '0.15em', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Section header (annotation panels above artboards) ─────────────────
function ArtboardLabel({ children, top = 24, left = 24 }) {
  return (
    <div style={{
      position: 'absolute', left, top, zIndex: 100,
      padding: '4px 10px',
      background: 'rgba(0,0,0,0.65)',
      border: `1px solid ${T.gold}44`,
      borderRadius: 3,
      fontFamily: T.fontMono,
      fontSize: 11,
      color: T.gold,
      letterSpacing: '0.18em',
    }}>
      {children}
    </div>
  );
}

window.T = T;
window.COLOR_TOKEN = COLOR_TOKEN;
window.MetaBg = MetaBg;
window.AppTopBar = AppTopBar;
window.MetaCard = MetaCard;
window.CurrencyChip = CurrencyChip;
window.shade = shade;
window.PrimaryButton = PrimaryButton;
window.GhostButton = GhostButton;
window.ArtboardLabel = ArtboardLabel;

// ── Cross-file shared helpers ──────────────────────────────────────────
// Small toolbar button with sub-label (used by deck editor, cards, history).
function SmallButton({ label, sub, accent = T.neonBlue, solid = false, active = false, onClick, navTo }) {
  const base = solid
    ? { background: `linear-gradient(180deg, ${accent}, ${shade(accent, -0.35)})`, color: shade(accent, -0.7), border: `1px solid ${shade(accent, -0.4)}` }
    : { background: active ? `${accent}22` : 'rgba(0,0,0,0.35)', color: accent, border: `1px solid ${accent}55` };
  return (
    <div onClick={onClick} data-nav-to={navTo} className="meta-btn-small" style={{
      ...base,
      padding: '6px 14px',
      borderRadius: 3,
      fontFamily: T.fontJp, fontWeight: 700, fontSize: 12,
      letterSpacing: '0.08em',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 8,
      lineHeight: 1,
      '--meta-hover-bg': `${accent}22`,
      '--meta-hover-border': accent,
      '--meta-hover-glow': `${accent}55`,
    }}>
      <span>{label}</span>
      {sub && (
        <span style={{
          fontFamily: T.fontMono, fontSize: 9, opacity: 0.55,
          letterSpacing: '0.16em', fontWeight: 800,
        }}>{sub}</span>
      )}
    </div>
  );
}

// Filter chip row group (used by deck editor + cards + history).
function FilterGroup({ label, items, small }) {
  return (
    <div>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {items.map((it, i) => (
          <div key={i} style={{
            padding: small ? '3px 7px' : '4px 8px',
            background: it.active ? `${it.c}33` : 'rgba(0,0,0,0.3)',
            border: `1px solid ${it.active ? it.c : `${it.c}33`}`,
            borderRadius: 2,
            display: 'flex', alignItems: 'center', gap: 5,
            cursor: 'pointer',
          }}>
            <div style={{ fontSize: 11, fontWeight: it.active ? 700 : 500, color: it.active ? it.c : T.textMuted }}>{it.label}</div>
            {it.n != null && (
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: it.active ? it.c : T.textDisabled, opacity: 0.7 }}>{it.n}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// "Setup" button — ghost-style w/ JP + EN label (used by setup, result, tutorial).
function SetupButton({ label, sub, onClick, navTo }) {
  return (
    <div onClick={onClick} data-nav-to={navTo} className="meta-btn-setup" style={{
      padding: '12px 30px',
      background: 'rgba(0,0,0,0.5)',
      border: `1px solid ${T.neonBlue}55`,
      borderRadius: 3,
      fontFamily: T.fontJp, fontWeight: 700, fontSize: 14,
      color: T.neonBlue, letterSpacing: '0.1em',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: T.fontMono, fontSize: 10, opacity: 0.5, letterSpacing: '0.18em' }}>{sub}</span>
    </div>
  );
}

// Big "ready" button with chevron clip (used by setup, result, tutorial).
function SetupReadyButton({ label = '推 理 開 始', sub = 'READY · BEGIN MATCH', navTo }) {
  return (
    <div data-nav-to={navTo} className="meta-btn-ready" style={{
      position: 'relative',
      width: 340, height: 64,
      cursor: 'pointer',
    }}>
      <div style={{ position: 'absolute', inset: -10, background: `radial-gradient(ellipse, ${T.gold}55, transparent 60%)`, filter: 'blur(8px)' }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.4)})`,
        border: `2px solid #f0e08a`,
        borderRadius: 4,
        clipPath: 'polygon(18px 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 18px 100%, 0 50%)',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 14px rgba(0,0,0,0.5)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <div style={{
          fontFamily: T.fontSerif, fontSize: 22, fontWeight: 900,
          color: '#1a1208', letterSpacing: '0.3em', marginRight: '-0.3em',
        }}>
          {label}
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: 'rgba(20,12,8,0.7)', letterSpacing: '0.35em' }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

window.SmallButton = SmallButton;
window.FilterGroup = FilterGroup;
window.SetupButton = SetupButton;
window.SetupReadyButton = SetupReadyButton;

// ── Empty state ────────────────────────────────────────────────────────
// Generic placeholder shown when a panel has no data yet.
function EmptyState({ icon = 'box', title, body, cta, ctaNavTo, tone = 'muted' }) {
  const accent = tone === 'warn' ? T.gold : tone === 'error' ? T.red : T.textMuted;
  return (
    <div style={{
      flex: 1,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', gap: 14,
      textAlign: 'center',
      color: T.textMuted,
    }}>
      <div style={{
        width: 72, height: 72,
        border: `1.5px dashed ${accent}66`,
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(circle, ${accent}11, transparent 70%)`,
      }}>
        <EmptyIcon kind={icon} color={accent} />
      </div>
      {title && (
        <div style={{
          fontFamily: T.fontSerif, fontSize: 16, fontWeight: 700,
          color: T.textSecondary, letterSpacing: '0.06em',
        }}>{title}</div>
      )}
      {body && (
        <div style={{ fontSize: 12, color: T.textMuted, maxWidth: 280, lineHeight: 1.5 }}>{body}</div>
      )}
      {cta && (
        <div data-nav-to={ctaNavTo} className="meta-btn-small" style={{
          marginTop: 4,
          padding: '6px 16px',
          background: `${T.gold}22`,
          border: `1px solid ${T.gold}88`,
          borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
          color: T.gold, letterSpacing: '0.18em',
          cursor: 'pointer',
        }}>{cta}</div>
      )}
    </div>
  );
}

function EmptyIcon({ kind, color }) {
  switch (kind) {
    case 'deck':
      return <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="8" y="4" width="20" height="28" rx="2" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" />
        <line x1="13" y1="14" x2="23" y2="14" stroke={color} strokeWidth="1" opacity="0.5" />
        <line x1="13" y1="20" x2="23" y2="20" stroke={color} strokeWidth="1" opacity="0.5" />
        <line x1="13" y1="26" x2="20" y2="26" stroke={color} strokeWidth="1" opacity="0.5" />
      </svg>;
    case 'history':
      return <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="13" stroke={color} strokeWidth="1.5" />
        <path d="M18 9 L18 18 L24 22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>;
    case 'search':
      return <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="15" cy="15" r="9" stroke={color} strokeWidth="1.5" />
        <line x1="22" y1="22" x2="30" y2="30" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1="11" y1="15" x2="19" y2="15" stroke={color} strokeWidth="1" opacity="0.5" />
      </svg>;
    case 'card':
      return <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="10" y="6" width="16" height="24" rx="2" stroke={color} strokeWidth="1.5" />
        <line x1="14" y1="14" x2="22" y2="14" stroke={color} strokeWidth="0.8" opacity="0.5" />
      </svg>;
    case 'offline':
      return <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <path d="M6 14 Q18 6 30 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 19 Q18 14 26 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M14 24 Q18 22 22 24" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <circle cx="18" cy="29" r="1.5" fill={color} />
        <line x1="6" y1="6" x2="30" y2="30" stroke={color} strokeWidth="2" />
      </svg>;
    case 'box':
    default:
      return <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <path d="M6 12 L18 6 L30 12 L30 26 L18 32 L6 26 Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M6 12 L18 18 L30 12" stroke={color} strokeWidth="1.5" />
        <line x1="18" y1="18" x2="18" y2="32" stroke={color} strokeWidth="1.5" />
      </svg>;
  }
}

// ── Warning / error banner ─────────────────────────────────────────────
function WarningBanner({ tone = 'warn', title, body, items }) {
  const accent = tone === 'error' ? T.red : tone === 'info' ? T.neonBlue : T.gold;
  const tonedBg = tone === 'error' ? 'rgba(200,64,64,0.10)' : tone === 'info' ? 'rgba(78,195,255,0.08)' : 'rgba(255,215,0,0.08)';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px',
      background: tonedBg,
      border: `1px solid ${accent}77`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 3,
    }}>
      <div style={{
        width: 22, height: 22, flexShrink: 0,
        background: accent, color: '#0a1a28',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontSerif, fontWeight: 900, fontSize: 14,
      }}>!</div>
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.45 }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 10,
          color: accent, letterSpacing: '0.2em',
          marginBottom: 2,
        }}>{tone.toUpperCase()}</div>
        {title && <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{title}</div>}
        {body && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{body}</div>}
        {items && items.length > 0 && (
          <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 11, color: T.textSecondary, lineHeight: 1.6 }}>
            {items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Loading dots ───────────────────────────────────────────────────────
function LoadingDots({ label = '読み込み中', color = T.gold }) {
  // 3 pulsing dots
  if (typeof document !== 'undefined' && !document.getElementById('meta-loading-anim')) {
    const s = document.createElement('style');
    s.id = 'meta-loading-anim';
    s.textContent = `
      @keyframes meta-pulse {
        0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
        40% { opacity: 1; transform: scale(1.1); }
      }
      .meta-loading-dot { animation: meta-pulse 1.2s infinite; }
    `;
    document.head.appendChild(s);
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="meta-loading-dot" style={{
            width: 6, height: 6, borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            animationDelay: `${i * 0.16}s`,
          }} />
        ))}
      </div>
      {label && (
        <span style={{
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
          color, letterSpacing: '0.18em',
        }}>{label}</span>
      )}
    </div>
  );
}

// ── Network status pill ────────────────────────────────────────────────
function NetworkStatus({ state = 'online' }) {
  const cfg = {
    online:  { color: T.green, label: 'ONLINE',       sub: '同期 OK' },
    syncing: { color: T.gold,  label: 'SYNCING',      sub: '同期中' },
    offline: { color: T.red,   label: 'OFFLINE',      sub: 'ローカル動作' },
    error:   { color: T.red,   label: 'SYNC FAILED',  sub: '再試行 →' },
  }[state] || { color: T.textMuted, label: '—', sub: '' };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '4px 10px',
      background: 'rgba(0,0,0,0.5)',
      border: `1px solid ${cfg.color}66`,
      borderRadius: 12,
      fontFamily: T.fontMono, fontSize: 10,
      letterSpacing: '0.18em',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: cfg.color,
        boxShadow: state === 'online' ? `0 0 6px ${cfg.color}` : 'none',
        animation: state === 'syncing' ? 'meta-pulse 1.2s infinite' : 'none',
      }} />
      <span style={{ color: cfg.color, fontWeight: 800 }}>{cfg.label}</span>
      {cfg.sub && <span style={{ color: T.textMuted }}>· {cfg.sub}</span>}
    </div>
  );
}

window.EmptyState = EmptyState;
window.WarningBanner = WarningBanner;
window.LoadingDots = LoadingDots;
window.NetworkStatus = NetworkStatus;
