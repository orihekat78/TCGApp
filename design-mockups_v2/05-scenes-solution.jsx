// 05-scenes-solution.jsx
// Solution chapter transition. Event chapter → Solution chapter (事件編 → 解決編).

function PlaymatBgSolution() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(ellipse at 50% 50%, #0e1828 0%, #050810 75%),
        linear-gradient(180deg, #060a12, #020306)
      `,
    }}>
      <svg style={{ position: 'absolute', inset: 0, opacity: 0.06 }} viewBox="0 0 1280 720">
        <defs>
          <pattern id="hex-bg-sol" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
            <path d="M30 0 L60 15 L60 37 L30 52 L0 37 L0 15 Z" fill="none" stroke="#4ec3ff" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="1280" height="720" fill="url(#hex-bg-sol)" />
      </svg>
    </div>
  );
}

// A simplified scene area showing 4 case cards in the middle
function CaseRow({ edition = '事件', opacity = 1, y = 360 }) {
  return (
    <div style={{
      position: 'absolute',
      left: 0, right: 0, top: y - 60,
      display: 'flex', justifyContent: 'center', gap: 14,
      opacity,
    }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{
          transform: `rotate(${(i - 1.5) * 1.5}deg)`,
          filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))',
        }}>
          <DummyCard
            w={100} h={140}
            color={i === 2 ? 'yellow' : 'blue'}
            name="事件"
            ap={null} cost={null}
            art={['footprint','fingerprint','silhouette','magnifier'][i]}
            edition={edition}
          />
        </div>
      ))}
    </div>
  );
}

// Edition tag — large standalone label
function EditionTagLabel({ edition, x, y, scale = 1, opacity = 1 }) {
  const isSolve = edition === '解決';
  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      transform: `translate(-50%, -50%) scale(${scale})`,
      opacity,
      pointerEvents: 'none',
    }}>
      <div style={{
        padding: '12px 36px',
        background: isSolve ? '#ffd75e' : '#c41818',
        color: isSolve ? '#1a1208' : '#fff',
        fontFamily: "'Hiragino Mincho ProN', serif",
        fontSize: 56, fontWeight: 900,
        letterSpacing: '0.25em',
        boxShadow: isSolve
          ? '0 0 30px rgba(255,215,94,0.7), 0 12px 24px rgba(0,0,0,0.5)'
          : '0 0 20px rgba(196,24,24,0.6), 0 12px 24px rgba(0,0,0,0.5)',
        border: `3px solid ${isSolve ? '#5a4218' : '#fff'}`,
      }}>
        {edition === '事件' ? '事件編' : '解決編'}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Solution A — Page-turn / horizontal split
// Beats:
//   0.0-0.5s: 事件編 tag visible at bottom, cases on board
//   0.5-1.2s: vertical split appears (mid-screen) — upper half slides up, lower slides down
//   1.2-2.0s: "解決編突入" title visible in the gap
//   2.0-3.0s: lower half slides back showing new state (gold 解決 tags)
//   3.0-4.0s: settle
function SolutionSceneA() {
  return (
    <Stage width={1280} height={720} duration={4.0} background="#050810" persistKey="solution-a">
      <PlaymatBgSolution />

      {/* Case rows */}
      <Sprite start={0} end={0.7} keepMounted>
        {({ progress }) => {
          // shift up
          const k = progress > 0.5 ? Easing.easeInCubic((progress - 0.5) / 0.5) : 0;
          return (
            <div style={{
              position: 'absolute', inset: 0,
              transform: `translateY(${-k * 360}px)`,
              opacity: 1 - k,
            }}>
              <CaseRow edition="事件" y={300} />
              <EditionTagLabel edition="事件" x={640} y={580} scale={0.7} opacity={0.9} />
            </div>
          );
        }}
      </Sprite>

      {/* Mid-page split slash */}
      <Sprite start={0.4} end={1.1}>
        {({ progress }) => {
          const k = Easing.easeOutCubic(Math.min(1, progress / 0.4));
          const w = k * 1300;
          const opacity = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
          return (
            <svg style={{ position: 'absolute', inset: 0 }} viewBox="0 0 1280 720">
              <line x1={640 - w / 2} y1={360} x2={640 + w / 2} y2={360} stroke="#ffd75e" strokeWidth="4" opacity={opacity} />
              <line x1={640 - w / 2} y1={360} x2={640 + w / 2} y2={360} stroke="#fff" strokeWidth="1" opacity={opacity * 0.8} />
            </svg>
          );
        }}
      </Sprite>

      {/* Bridge title: 解決編突入 */}
      <Sprite start={0.9} end={3.4}>
        {({ progress }) => {
          let opacity, scale, y;
          if (progress < 0.15) {
            const k = Easing.easeOutBack(progress / 0.15);
            opacity = k; scale = 0.6 + 0.4 * k; y = 360;
          } else if (progress > 0.85) {
            const k = (progress - 0.85) / 0.15;
            opacity = 1 - k; scale = 1 + k * 0.1; y = 360 - k * 30;
          } else {
            const bob = Math.sin((progress - 0.15) * Math.PI * 4) * 0.015;
            opacity = 1; scale = 1 + bob; y = 360;
          }
          return (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center',
              opacity, transform: `translateY(-50%) scale(${scale})`,
              pointerEvents: 'none',
            }}>
              <div style={{
                display: 'inline-block',
                fontFamily: "'Hiragino Mincho ProN', serif",
                fontSize: 80, fontWeight: 900,
                color: '#ffd75e',
                letterSpacing: '0.25em',
                textShadow: '0 0 30px rgba(255,215,94,0.85), 6px 6px 0 rgba(140,0,0,0.55)',
                WebkitTextStroke: '2px rgba(140,90,0,0.5)',
              }}>
                解 決 編
              </div>
              <div style={{
                marginTop: 6,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 14,
                color: 'rgba(255,215,94,0.8)',
                letterSpacing: '0.5em',
              }}>
                SOLUTION PHASE
              </div>
            </div>
          );
        }}
      </Sprite>

      {/* Gold pulse rings during transition */}
      <Sprite start={1.0} end={3.0}>
        <PulseGlow x={640} y={360} color="#ffd75e" max={500} count={3} />
      </Sprite>

      {/* Particles drifting up */}
      <Sprite start={1.1} end={3.4}>
        <Particles x={640} y={460} count={28} color="#ffd75e" spread={400} rise={300} />
      </Sprite>

      {/* New state: 解決 cases swap in (3.0-4.0) */}
      <Sprite start={2.5} end={4.0}>
        {({ progress }) => {
          let opacity = 0, y = 240;
          if (progress < 0.3) {
            const k = Easing.easeOutCubic(progress / 0.3);
            opacity = k;
            y = 600 - k * 360;
          } else if (progress > 0.85) {
            opacity = 1 - (progress - 0.85) / 0.15;
            y = 240;
          } else {
            opacity = 1;
            y = 240;
          }
          return (
            <div style={{ position: 'absolute', inset: 0, opacity, transform: `translateY(${y - 240}px)` }}>
              <CaseRow edition="解決" y={500} />
              <EditionTagLabel edition="解決" x={640} y={620} scale={0.5} opacity={1} />
            </div>
          );
        }}
      </Sprite>

      {/* Backboard meta */}
      <div style={{
        position: 'absolute', left: 24, top: 18,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        color: 'rgba(255,215,94,0.5)', letterSpacing: '0.15em',
      }}>
        EDITION TRANSITION · 事件 → 解決
      </div>
    </Stage>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Solution B — Shatter + Stamp
// Beats:
//   0.0-0.5s: establish (事件編 tag big in center, slowly throbbing red)
//   0.5-1.0s: tag shatters into glass shards
//   1.0-1.8s: dark pause, debris drifting
//   1.8-2.4s: 解決編 stamp crashes in from above with anticipation
//   2.4-3.0s: bounce + red ring ripples + flash
//   3.0-4.5s: settle, throb
function SolutionSceneB() {
  return (
    <Stage width={1280} height={720} duration={4.5} background="#050810" persistKey="solution-b">
      <PlaymatBgSolution />

      {/* Phase 1: 事件編 tag (0-1.0) */}
      <Sprite start={0} end={1.0}>
        {({ progress }) => {
          let opacity = 1, scale = 1;
          if (progress > 0.5) {
            // shatter starts
            const k = (progress - 0.5) / 0.5;
            opacity = 1 - k;
            scale = 1 + k * 0.15;
          } else {
            const bob = Math.sin(progress * Math.PI * 4) * 0.01;
            scale = 1 + bob;
          }
          return (
            <EditionTagLabel
              edition="事件"
              x={640} y={360}
              scale={1.4 * scale}
              opacity={opacity}
            />
          );
        }}
      </Sprite>

      {/* Glass shards */}
      <Sprite start={0.5} end={1.6}>
        <GlassShards x={640} y={360} count={14} color="#c41818" />
      </Sprite>

      {/* Crack lines flashing through */}
      <Sprite start={0.45} end={0.85}>
        <CrackLines cx={640} cy={360} />
      </Sprite>

      {/* Red splash */}
      <Sprite start={0.5} end={1.3}>
        <RedSplash intensity={0.6} />
      </Sprite>

      {/* Pause / debris drift (1.0-1.8) — handled by shards lingering */}

      {/* Phase 3: 解決編 stamp slams in (1.7-3.0) */}
      <Sprite start={1.7} end={3.0}>
        {({ progress }) => {
          // anticipation: comes from above, scale 3x, slams down
          let y, scale, opacity, rotate;
          if (progress < 0.25) {
            const k = Easing.easeInCubic(progress / 0.25);
            y = -200 + k * 560;
            scale = 4 - k * 2.5;
            opacity = k;
            rotate = -15 + k * 5;
          } else if (progress < 0.35) {
            // slam impact + bounce
            const k = (progress - 0.25) / 0.1;
            y = 360 - (1 - Easing.easeOutBack(k)) * 30;
            scale = 1.5 + (1 - Easing.easeOutBack(k)) * 0.5;
            opacity = 1;
            rotate = -10 + k * 4;
          } else {
            const k = (progress - 0.35) / 0.65;
            const bob = Math.sin(k * Math.PI * 5) * 0.015;
            y = 360;
            scale = 1.5 + bob;
            opacity = progress > 0.92 ? 1 - (progress - 0.92) / 0.08 : 1;
            rotate = -6 + Math.sin(k * Math.PI * 3) * 1.5;
          }
          return (
            <div style={{
              position: 'absolute',
              left: 640, top: y,
              transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
              opacity,
              pointerEvents: 'none',
            }}>
              <div style={{
                padding: '20px 50px',
                background: '#ffd75e',
                color: '#1a1208',
                fontFamily: "'Hiragino Mincho ProN', serif",
                fontSize: 80, fontWeight: 900,
                letterSpacing: '0.25em',
                border: '4px solid #5a4218',
                boxShadow: '0 0 40px rgba(255,215,94,0.6), 0 16px 32px rgba(0,0,0,0.7)',
                whiteSpace: 'nowrap',
              }}>
                解決編
              </div>
            </div>
          );
        }}
      </Sprite>

      {/* Impact wave at slam */}
      <Sprite start={1.9} end={2.6}>
        <PulseGlow x={640} y={360} color="#c41818" max={600} count={2} />
      </Sprite>
      <Sprite start={1.95} end={2.2}>
        <WhiteFlash peak={0.2} duration={0.4} color="#ffd75e" />
      </Sprite>

      {/* Conan red ripples around stamp */}
      <Sprite start={2.0} end={4.5}>
        <Particles x={640} y={360} count={20} color="#ffd75e" spread={500} rise={120} />
      </Sprite>

      {/* Final state continues 解決編 throbbing */}
      <Sprite start={3.0} end={4.5}>
        {({ progress }) => {
          let opacity, scale;
          const bob = Math.sin(progress * Math.PI * 2) * 0.02;
          if (progress < 0.1) {
            const k = progress / 0.1;
            opacity = k;
            scale = 1.5 + bob;
          } else {
            opacity = 1;
            scale = 1.5 + bob;
          }
          // Note: the prior sprite ends at 3.0, this overlaps to maintain visual
          return (
            <div style={{
              position: 'absolute', left: 640, top: 360,
              transform: `translate(-50%, -50%) rotate(-6deg) scale(${scale})`,
              opacity,
              pointerEvents: 'none',
            }}>
              <div style={{
                padding: '20px 50px',
                background: '#ffd75e',
                color: '#1a1208',
                fontFamily: "'Hiragino Mincho ProN', serif",
                fontSize: 80, fontWeight: 900,
                letterSpacing: '0.25em',
                border: '4px solid #5a4218',
                boxShadow: '0 0 30px rgba(255,215,94,0.5), 0 16px 32px rgba(0,0,0,0.7)',
                whiteSpace: 'nowrap',
              }}>
                解決編
              </div>
            </div>
          );
        }}
      </Sprite>

      {/* Backboard meta */}
      <div style={{
        position: 'absolute', left: 24, top: 18,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        color: 'rgba(196,24,24,0.6)', letterSpacing: '0.15em',
      }}>
        EDITION TRANSITION · SHATTER + STAMP
      </div>
    </Stage>
  );
}

function GlassShards({ x, y, count = 14, color = '#c41818' }) {
  const { progress } = useSprite();
  const shards = React.useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      angle: (i / count) * Math.PI * 2 + Math.sin(i * 4.7) * 0.4,
      speed: 180 + (i * 23) % 220,
      size: 16 + (i * 7) % 30,
      rotate: (i * 71) % 360,
      rotSpeed: ((i * 13) % 600) - 300,
      gravity: 1.6 + ((i * 5) % 10) * 0.1,
    })),
    [count]
  );
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {shards.map((s, i) => {
        const dx = Math.cos(s.angle) * s.speed * progress;
        const dy = Math.sin(s.angle) * s.speed * progress + 200 * progress * progress * s.gravity;
        const rotate = s.rotate + s.rotSpeed * progress;
        const opacity = progress < 0.1 ? progress / 0.1 : (progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + dx, top: y + dy,
              width: s.size, height: s.size,
              background: color,
              opacity: opacity * 0.85,
              transform: `rotate(${rotate}deg)`,
              clipPath: 'polygon(20% 0, 80% 10%, 100% 70%, 60% 100%, 10% 80%)',
              boxShadow: `0 0 6px ${color}, inset 0 0 4px rgba(255,255,255,0.4)`,
            }}
          />
        );
      })}
    </div>
  );
}

function CrackLines({ cx, cy }) {
  const { progress } = useSprite();
  const k = Math.min(1, progress / 0.4);
  const lines = [];
  const seeds = [0, 1, 2, 3, 4, 5, 6, 7];
  seeds.forEach((i) => {
    const angle = (i / seeds.length) * Math.PI * 2 + Math.sin(i * 1.3) * 0.5;
    const len = (240 + (i * 47) % 200) * k;
    const segs = 4;
    let prev = [cx, cy];
    let path = `M ${cx} ${cy}`;
    for (let s = 1; s <= segs; s++) {
      const r = (len / segs) * s;
      const wob = (Math.sin(i * 1.7 + s * 2.1)) * 12;
      const x = cx + Math.cos(angle + wob * 0.01) * r;
      const y = cy + Math.sin(angle + wob * 0.01) * r + wob;
      path += ` L ${x} ${y}`;
      prev = [x, y];
    }
    lines.push(path);
  });
  const opacity = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;
  return (
    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} viewBox="0 0 1280 720">
      {lines.map((d, i) => (
        <path key={i} d={d} stroke="#fff" strokeWidth="2.5" fill="none" opacity={opacity} />
      ))}
      {lines.map((d, i) => (
        <path key={`g${i}`} d={d} stroke="#ffd75e" strokeWidth="0.8" fill="none" opacity={opacity * 0.6} />
      ))}
    </svg>
  );
}

Object.assign(window, { SolutionSceneA, SolutionSceneB });
