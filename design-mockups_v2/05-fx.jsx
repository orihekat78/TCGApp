// 05-fx.jsx
// Shared FX primitives for the effect animations. All accept a `t` (0..1)
// progress prop OR pull from useSprite() context if no t is passed.

function _useProgress(propT) {
  const sprite = useSprite();
  return propT != null ? propT : (sprite ? sprite.progress : 0);
}

// PulseGlow: expanding radial ring with fade
// Props: x, y, color, max, count, t (optional)
function PulseGlow({ x = 640, y = 360, color = '#ffd75e', max = 400, count = 3, t }) {
  const progress = _useProgress(t);
  const rings = Array.from({ length: count }, (_, i) => {
    const offset = i / count;
    const localT = ((progress + offset) % 1);
    const radius = localT * max;
    const opacity = (1 - localT) * 0.85;
    return (
      <circle
        key={i}
        cx={x}
        cy={y}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={4 - localT * 3.4}
        opacity={opacity}
      />
    );
  });
  return <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>{rings}</svg>;
}

// GoldHalo: static glowing halo around a point. Use for ehphasis.
function GoldHalo({ x, y, r = 120, color = '#ffd75e', strength = 1, t }) {
  const progress = _useProgress(t);
  const breath = 0.85 + 0.15 * Math.sin(progress * Math.PI * 4);
  const intensity = strength * breath;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}aa 0%, ${color}55 30%, ${color}00 70%)`,
        opacity: intensity,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    />
  );
}

// SpeedLines: radial action lines emanating from edges toward center
function SpeedLines({ cx = 640, cy = 360, color = '#fff', t, count = 36, length = 380 }) {
  const progress = _useProgress(t);
  const lines = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + progress * 0.5;
    const inner = 200 + Math.sin(i * 1.7) * 30;
    const outer = inner + length + Math.sin(i * 2.3 + progress * 6) * 40;
    const x1 = cx + Math.cos(angle) * outer;
    const y1 = cy + Math.sin(angle) * outer;
    const x2 = cx + Math.cos(angle) * inner;
    const y2 = cy + Math.sin(angle) * inner;
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={2 + (i % 4) * 0.6}
        opacity={0.45 + (i % 3) * 0.18}
        strokeLinecap="round"
      />
    );
  });
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 1280 720">
      {lines}
    </svg>
  );
}

// Particles: gold light particles drifting upward
// Seeded so positions are stable across renders
function Particles({ x = 640, y = 360, count = 24, color = '#ffd75e', spread = 250, rise = 200, t }) {
  const progress = _useProgress(t);
  const seeds = React.useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      ox: (Math.sin(i * 17.3) * 0.5 + 0.5 - 0.5) * spread,
      oy: (Math.cos(i * 9.7) * 0.5 + 0.5 - 0.5) * spread * 0.4,
      phase: (i / count + Math.sin(i * 3.7) * 0.2 + 1) % 1,
      size: 2 + ((i * 7.3) % 5),
    })),
    [count, spread]
  );
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {seeds.map((s, i) => {
        const localT = (progress + s.phase) % 1;
        const opacity = Math.sin(localT * Math.PI) * 0.9;
        const dy = -localT * rise;
        const dx = Math.sin(localT * Math.PI * 2 + i) * 20;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + s.ox + dx,
              top: y + s.oy + dy,
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background: color,
              opacity,
              boxShadow: `0 0 ${s.size * 3}px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
}

// LightningStreak: a single jagged lightning bolt across the screen
function LightningStreak({ from, to, color = '#aaccff', t, jitter = 30 }) {
  const progress = _useProgress(t);
  // bolt visible only briefly
  const visible = progress > 0.05 && progress < 0.4;
  const opacity = visible ? 1 - (progress - 0.05) / 0.35 : 0;
  // Jagged path
  const steps = 8;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const px = from[0] + (to[0] - from[0]) * k;
    const py = from[1] + (to[1] - from[1]) * k;
    const j = (Math.sin(i * 7 + progress * 30) * jitter);
    const dx = -(to[1] - from[1]);
    const dy = (to[0] - from[0]);
    const norm = Math.sqrt(dx * dx + dy * dy) || 1;
    points.push([px + (dx / norm) * j * (i > 0 && i < steps ? 1 : 0), py + (dy / norm) * j * (i > 0 && i < steps ? 1 : 0)]);
  }
  const d = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ');
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 1280 720">
      <path d={d} stroke={color} strokeWidth="3" fill="none" opacity={opacity} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      <path d={d} stroke="#fff" strokeWidth="1" fill="none" opacity={opacity * 0.8} />
    </svg>
  );
}

// MagnifierLens: round magnifier with handle that can be positioned
function MagnifierLens({ x, y, r = 100, angle = -45, t, opacity = 1 }) {
  const progress = _useProgress(t);
  const handleAngle = (angle * Math.PI) / 180;
  const handleStart = [x + Math.cos(handleAngle) * r * 0.75, y + Math.sin(handleAngle) * r * 0.75];
  const handleEnd = [x + Math.cos(handleAngle) * r * 1.7, y + Math.sin(handleAngle) * r * 1.7];
  // subtle floating
  const dy = Math.sin(progress * Math.PI * 4) * 4;
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 1280 720">
      <g transform={`translate(0, ${dy})`} opacity={opacity}>
        {/* lens shine */}
        <circle cx={x} cy={y} r={r} fill="rgba(120,180,220,0.18)" />
        <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.45} fill="rgba(255,255,255,0.18)" />
        {/* frame */}
        <circle cx={x} cy={y} r={r} fill="none" stroke="#d4a040" strokeWidth="6" />
        <circle cx={x} cy={y} r={r + 5} fill="none" stroke="#5a3818" strokeWidth="2" opacity="0.7" />
        {/* handle */}
        <line
          x1={handleStart[0]}
          y1={handleStart[1]}
          x2={handleEnd[0]}
          y2={handleEnd[1]}
          stroke="#5a3818"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <line
          x1={handleStart[0]}
          y1={handleStart[1]}
          x2={handleEnd[0]}
          y2={handleEnd[1]}
          stroke="#8a5828"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

// Fingerprint: large fingerprint pattern as background
function Fingerprint({ x = 640, y = 360, size = 500, color = '#ffd75e', opacity = 0.15, t }) {
  const progress = _useProgress(t);
  const arcs = Array.from({ length: 18 }, (_, i) => {
    const r = (i + 1) * (size / 36);
    const wobble = Math.sin(i * 1.3 + progress * 2) * 6;
    return (
      <ellipse
        key={i}
        cx={x}
        cy={y + i * 1.5}
        rx={r + wobble}
        ry={r * 1.15 + wobble * 0.5}
        fill="none"
        stroke={color}
        strokeWidth="2"
        opacity={opacity}
      />
    );
  });
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 1280 720">
      {arcs}
    </svg>
  );
}

// ImpactBurst: manga-style impact star burst
function ImpactBurst({ x, y, r = 200, color = '#fff', strokeColor = '#0a0a0a', t, spikes = 12 }) {
  const progress = _useProgress(t);
  // explode in (0..0.3), hold (0.3..0.7), exit (0.7..1)
  let scale, opacity;
  if (progress < 0.2) {
    scale = (progress / 0.2);
    opacity = scale;
  } else if (progress > 0.75) {
    scale = 1 + (progress - 0.75) * 0.6;
    opacity = 1 - (progress - 0.75) / 0.25;
  } else {
    const wob = Math.sin((progress - 0.2) * Math.PI * 8) * 0.04;
    scale = 1 + wob;
    opacity = 1;
  }
  const points = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.5;
    points.push(`${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`);
  }
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity }} viewBox="0 0 1280 720">
      <g transform={`translate(${x}, ${y}) scale(${scale}) translate(${-x}, ${-y})`}>
        <polygon points={points.join(' ')} fill={color} stroke={strokeColor} strokeWidth="3" strokeLinejoin="miter" />
      </g>
    </svg>
  );
}

// TextStamp: a stamp-like label that crashes in
function TextStamp({
  text,
  x,
  y,
  size = 90,
  color = '#c43838',
  rotate = -8,
  t,
  font = "'Hiragino Mincho ProN', 'Yu Mincho', serif",
}) {
  const progress = _useProgress(t);
  // Anticipation: scale up huge then slam down with bounce
  let scale, opacity;
  if (progress < 0.15) {
    // scale-in to 4x with low opacity
    scale = 4 - (progress / 0.15) * 2;
    opacity = (progress / 0.15);
  } else if (progress < 0.25) {
    // slam down with bounce
    const k = (progress - 0.15) / 0.1;
    scale = 2 - 1.05 * Easing.easeOutBack(k);
    opacity = 1;
  } else if (progress < 0.85) {
    scale = 0.95 + Math.sin((progress - 0.25) * Math.PI * 4) * 0.02;
    opacity = 1;
  } else {
    scale = 0.95;
    opacity = 1 - (progress - 0.85) / 0.15;
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
        opacity,
        fontFamily: font,
        fontWeight: 900,
        fontSize: size,
        color,
        textShadow: `0 0 8px ${color}66, 4px 4px 0 rgba(0,0,0,0.5)`,
        letterSpacing: '0.1em',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
}

// SparkleFlash: a single point flash with cross rays (megane-no-kira-n)
function SparkleFlash({ x, y, size = 120, color = '#fff', t }) {
  const progress = _useProgress(t);
  // tight pulse 0..0.5
  const k = Math.min(1, progress * 2);
  const open = k < 0.5 ? k * 2 : 1 - (k - 0.5) * 2;
  const rayLen = size * (0.3 + open * 0.7);
  const opacity = open;
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 1280 720">
      <g opacity={opacity}>
        {/* center disc */}
        <circle cx={x} cy={y} r={size * 0.18 * (0.5 + open * 0.5)} fill={color} />
        {/* cross rays */}
        {[0, 45, 90, 135].map((a) => {
          const rad = (a * Math.PI) / 180;
          const dx = Math.cos(rad) * rayLen;
          const dy = Math.sin(rad) * rayLen;
          const w = a % 90 === 0 ? size * 0.07 : size * 0.04;
          return (
            <g key={a}>
              <line
                x1={x - dx}
                y1={y - dy}
                x2={x + dx}
                y2={y + dy}
                stroke={color}
                strokeWidth={w * 2}
                strokeLinecap="round"
                opacity="0.4"
              />
              <line
                x1={x - dx}
                y1={y - dy}
                x2={x + dx}
                y2={y + dy}
                stroke={color}
                strokeWidth={w}
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// Vignette: dark frame around the screen
function Vignette({ strength = 1, color = '#000', t }) {
  const progress = _useProgress(t);
  const op = strength * (t == null ? 1 : Math.sin(progress * Math.PI));
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, transparent 40%, ${color} 110%)`,
        opacity: op,
      }}
    />
  );
}

// ChromaticGlitch: text or content shifted into red/cyan halos (misread feel)
// Wraps children with split color layers
function ChromaticGlitch({ children, intensity = 1, t }) {
  const progress = _useProgress(t);
  const shake = Math.sin(progress * Math.PI * 50) * 4 * intensity;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${shake}px, 0)`, filter: 'drop-shadow(0 0 0 #ff0044)', mixBlendMode: 'screen', opacity: 0.7 }}>
        {children}
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${-shake}px, 0)`, filter: 'drop-shadow(0 0 0 #00ddff)', mixBlendMode: 'screen', opacity: 0.7 }}>
        {children}
      </div>
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
    </div>
  );
}

// RedSplash: dramatic red flash across screen (Conan-style "ジャジャーン!")
function RedSplash({ t, intensity = 1 }) {
  const progress = _useProgress(t);
  // sharp in, slow fade
  let opacity;
  if (progress < 0.06) opacity = (progress / 0.06) * intensity;
  else opacity = (1 - (progress - 0.06) / 0.94) * intensity;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `radial-gradient(ellipse 60% 80% at 50% 50%, #c41818 0%, #6a0608 40%, #1a0202 80%)`,
        opacity,
        mixBlendMode: 'multiply',
      }}
    />
  );
}

// WhiteFlash: full screen white flash
function WhiteFlash({ t, peak = 0.5, duration = 1, color = '#fff' }) {
  const progress = _useProgress(t);
  // triangle around peak
  const dist = Math.abs(progress - peak);
  const opacity = Math.max(0, 1 - dist / (duration / 2));
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: color,
        opacity,
      }}
    />
  );
}

Object.assign(window, {
  PulseGlow,
  GoldHalo,
  SpeedLines,
  Particles,
  LightningStreak,
  MagnifierLens,
  Fingerprint,
  ImpactBurst,
  TextStamp,
  SparkleFlash,
  Vignette,
  ChromaticGlitch,
  RedSplash,
  WhiteFlash,
});
