// 05-card.jsx
// Shared dummy card SVG component for the effect animations file.
// Style: detective-style dark navy card with cyan border and gold serif text.
// Conan color system: blue / yellow / red.

const CARD_COLORS = {
  blue: {
    border: '#4ec3ff',
    bgTop: '#1a2a3e',
    bgBot: '#0c1a2c',
    art: '#2a4060',
    artShadow: '#0e2238',
    glow: 'rgba(78,195,255,0.55)',
  },
  yellow: {
    border: '#ffd75e',
    bgTop: '#2a2616',
    bgBot: '#1a160c',
    art: '#5a4c20',
    artShadow: '#2a2208',
    glow: 'rgba(255,215,94,0.55)',
  },
  red: {
    border: '#ff7a7a',
    bgTop: '#3a1a1a',
    bgBot: '#1c0c0c',
    art: '#5a2424',
    artShadow: '#2a0c0c',
    glow: 'rgba(255,93,93,0.55)',
  },
  partner: {
    // Partner / detective card — gold + cyan, premium feel
    border: '#ffd75e',
    bgTop: '#0c1828',
    bgBot: '#040810',
    art: '#1c2e48',
    artShadow: '#0a1424',
    glow: 'rgba(255,215,94,0.65)',
  },
};

// Conan-flavored silhouette icons drawn into the art area.
// Each is a simple monochrome shape so it reads at small sizes.
function CardArt({ kind, color, w, h }) {
  // viewport: art area is roughly 0..w wide, 0..h tall
  const stroke = color.border;
  const fill = 'rgba(255,255,255,0.06)';
  const cx = w / 2;
  const cy = h / 2;

  switch (kind) {
    case 'magnifier': {
      const r = h * 0.32;
      return (
        <g opacity="0.85">
          <circle cx={cx - r * 0.35} cy={cy - r * 0.15} r={r} fill="none" stroke={stroke} strokeWidth={h * 0.04} />
          <circle cx={cx - r * 0.35} cy={cy - r * 0.15} r={r * 0.78} fill={fill} />
          <line
            x1={cx - r * 0.35 + r * 0.7}
            y1={cy - r * 0.15 + r * 0.7}
            x2={cx + r * 1.0}
            y2={cy + r * 0.85}
            stroke={stroke}
            strokeWidth={h * 0.07}
            strokeLinecap="round"
          />
        </g>
      );
    }
    case 'fingerprint': {
      // concentric arcs
      const baseR = h * 0.16;
      return (
        <g opacity="0.7">
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M ${cx - (baseR + i * h * 0.05)} ${cy} a ${baseR + i * h * 0.05} ${baseR + i * h * 0.06} 0 1 1 ${(baseR + i * h * 0.05) * 2} 0`}
              fill="none"
              stroke={stroke}
              strokeWidth={h * 0.018}
              strokeLinecap="round"
            />
          ))}
        </g>
      );
    }
    case 'silhouette': {
      // shadowy person bust
      return (
        <g opacity="0.75">
          <circle cx={cx} cy={cy - h * 0.12} r={h * 0.16} fill={stroke} opacity="0.45" />
          <path
            d={`M ${cx - h * 0.28} ${cy + h * 0.32} q ${h * 0.28} ${-h * 0.32} ${h * 0.56} 0 z`}
            fill={stroke}
            opacity="0.45"
          />
        </g>
      );
    }
    case 'footprint': {
      const fp = (x, y, mirror) => (
        <g transform={`translate(${x},${y}) scale(${mirror ? -1 : 1},1)`}>
          <ellipse cx="0" cy="0" rx={h * 0.06} ry={h * 0.1} fill={stroke} opacity="0.55" />
          <circle cx={-h * 0.06} cy={-h * 0.13} r={h * 0.025} fill={stroke} opacity="0.5" />
          <circle cx={-h * 0.04} cy={-h * 0.16} r={h * 0.02} fill={stroke} opacity="0.45" />
        </g>
      );
      return (
        <g opacity="0.8">
          {fp(cx - h * 0.18, cy - h * 0.08, false)}
          {fp(cx + h * 0.18, cy + h * 0.06, true)}
        </g>
      );
    }
    case 'bowtie': {
      const bw = h * 0.32;
      return (
        <g opacity="0.85">
          <path
            d={`M ${cx} ${cy} L ${cx - bw} ${cy - bw * 0.6} L ${cx - bw} ${cy + bw * 0.6} Z`}
            fill={stroke}
            opacity="0.6"
          />
          <path
            d={`M ${cx} ${cy} L ${cx + bw} ${cy - bw * 0.6} L ${cx + bw} ${cy + bw * 0.6} Z`}
            fill={stroke}
            opacity="0.6"
          />
          <rect x={cx - bw * 0.12} y={cy - bw * 0.25} width={bw * 0.24} height={bw * 0.5} fill={stroke} />
        </g>
      );
    }
    case 'question':
    default:
      return (
        <text
          x={cx}
          y={cy + h * 0.18}
          fill={stroke}
          opacity="0.6"
          fontFamily="serif"
          fontSize={h * 0.55}
          fontWeight="700"
          textAnchor="middle"
        >
          ?
        </text>
      );
  }
}

// DummyCard: scalable detective-style card.
// Props:
//   w, h: card display size (CSS px)
//   color: 'blue' | 'yellow' | 'red' | 'partner'
//   name: card name (Japanese text shown bottom)
//   ap: number shown top-right (optional)
//   cost: number shown top-left (optional)
//   art: 'magnifier' | 'fingerprint' | 'silhouette' | 'footprint' | 'bowtie' | 'question'
//   faceDown: if true, show card back
//   glow: 0..1, how strong the outer glow is
//   tilt: degrees Y-rotation
//   highlight: outline color override (e.g. for "selected" state)
function DummyCard({
  w = 200,
  h = 280,
  color = 'blue',
  name = '???',
  ap = null,
  cost = null,
  art = 'question',
  faceDown = false,
  glow = 0,
  highlight = null,
  style = {},
  edition = null, // '事件' | '解決'
}) {
  const c = CARD_COLORS[color] || CARD_COLORS.blue;
  const radius = h * 0.04;
  const borderColor = highlight || c.border;

  const glowFilter = glow > 0
    ? `drop-shadow(0 0 ${10 + glow * 24}px ${c.glow}) drop-shadow(0 0 ${4 + glow * 12}px ${c.glow})`
    : 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))';

  if (faceDown) {
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        style={{ filter: glowFilter, ...style }}
      >
        <defs>
          <linearGradient id={`back-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a0e10" />
            <stop offset="1" stopColor="#0c0406" />
          </linearGradient>
          <pattern id={`pat-${color}`} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="1.2" fill="#ffd75e" opacity="0.18" />
          </pattern>
        </defs>
        <rect x="1" y="1" width={w - 2} height={h - 2} rx={radius} fill={`url(#back-${color})`} stroke="#ffd75e" strokeWidth="2" />
        <rect x="6" y="6" width={w - 12} height={h - 12} rx={radius * 0.7} fill={`url(#pat-${color})`} />
        {/* Detective insignia: bowtie + magnifier */}
        <g transform={`translate(${w / 2}, ${h / 2})`}>
          <circle r={h * 0.18} fill="none" stroke="#ffd75e" strokeWidth="1.5" opacity="0.7" />
          <circle r={h * 0.13} fill="none" stroke="#ffd75e" strokeWidth="1" opacity="0.5" />
          <text
            y={h * 0.04}
            fill="#ffd75e"
            opacity="0.85"
            fontFamily="serif"
            fontSize={h * 0.13}
            fontWeight="700"
            textAnchor="middle"
            letterSpacing="0.1em"
          >
            CT
          </text>
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      style={{ filter: glowFilter, ...style }}
    >
      <defs>
        <linearGradient id={`bg-${color}-${name}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.bgTop} />
          <stop offset="1" stopColor={c.bgBot} />
        </linearGradient>
        <linearGradient id={`art-${color}-${name}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.art} />
          <stop offset="1" stopColor={c.artShadow} />
        </linearGradient>
      </defs>

      {/* Card body */}
      <rect
        x="1"
        y="1"
        width={w - 2}
        height={h - 2}
        rx={radius}
        fill={`url(#bg-${color}-${name})`}
        stroke={borderColor}
        strokeWidth="2"
      />

      {/* Cost (top-left circle) */}
      {cost != null && (
        <g>
          <circle cx={h * 0.07} cy={h * 0.07} r={h * 0.055} fill="#0a0a12" stroke={borderColor} strokeWidth="1.5" />
          <text x={h * 0.07} y={h * 0.092} fill={borderColor} fontFamily="serif" fontSize={h * 0.07} fontWeight="700" textAnchor="middle">
            {cost}
          </text>
        </g>
      )}

      {/* AP (top-right) */}
      {ap != null && (
        <g>
          <rect x={w - h * 0.16} y={h * 0.025} width={h * 0.13} height={h * 0.085} rx={h * 0.012} fill="#0a0a12" stroke={borderColor} strokeWidth="1.2" />
          <text x={w - h * 0.095} y={h * 0.092} fill={borderColor} fontFamily="serif" fontSize={h * 0.062} fontWeight="700" textAnchor="middle">
            {ap}
          </text>
        </g>
      )}

      {/* Art window */}
      <rect
        x={w * 0.08}
        y={h * 0.16}
        width={w * 0.84}
        height={h * 0.48}
        rx={h * 0.018}
        fill={`url(#art-${color}-${name})`}
        stroke={c.artShadow}
        strokeWidth="1"
      />
      <svg
        x={w * 0.08}
        y={h * 0.16}
        width={w * 0.84}
        height={h * 0.48}
        viewBox={`0 0 ${w * 0.84} ${h * 0.48}`}
      >
        <CardArt kind={art} color={c} w={w * 0.84} h={h * 0.48} />
      </svg>

      {/* Edition tag */}
      {edition && (
        <g>
          <rect
            x={w * 0.08}
            y={h * 0.66}
            width={h * 0.13}
            height={h * 0.05}
            rx={h * 0.01}
            fill={edition === '解決' ? '#ffd75e' : '#c43838'}
          />
          <text
            x={w * 0.08 + h * 0.065}
            y={h * 0.7}
            fontFamily="sans-serif"
            fontSize={h * 0.035}
            fontWeight="700"
            textAnchor="middle"
            fill={edition === '解決' ? '#1a1a1a' : '#fff'}
          >
            {edition}
          </text>
        </g>
      )}

      {/* Name */}
      <text
        x={w / 2}
        y={h * 0.78}
        fill={c.border}
        fontFamily="'Hiragino Mincho ProN', 'Yu Mincho', serif"
        fontSize={h * 0.062}
        fontWeight="700"
        textAnchor="middle"
        letterSpacing="0.04em"
      >
        {name}
      </text>

      {/* Traits line */}
      <line
        x1={w * 0.12}
        y1={h * 0.83}
        x2={w * 0.88}
        y2={h * 0.83}
        stroke={borderColor}
        strokeOpacity="0.4"
        strokeWidth="0.5"
      />

      {/* Text area */}
      <rect
        x={w * 0.08}
        y={h * 0.85}
        width={w * 0.84}
        height={h * 0.11}
        rx={h * 0.012}
        fill="#000"
        opacity="0.3"
      />
      <text x={w * 0.12} y={h * 0.905} fill={c.border} opacity="0.65" fontFamily="sans-serif" fontSize={h * 0.028}>
        ・・・・・・・・・
      </text>
      <text x={w * 0.12} y={h * 0.94} fill={c.border} opacity="0.45" fontFamily="sans-serif" fontSize={h * 0.028}>
        ・・・・・・
      </text>
    </svg>
  );
}

Object.assign(window, { DummyCard, CARD_COLORS });
