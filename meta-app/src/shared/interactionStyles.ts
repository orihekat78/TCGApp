// spec: .claude/specs/meta-ui/02-design-system.md
// 原典: design-mockups_v2/06-shared.jsx の冒頭 CSS injection
// インラインスタイルで :hover を表現できないため meta-* クラス + 専用 stylesheet

let injected = false;

export function ensureInteractionStyles(): void {
  if (injected) return;
  if (typeof document === 'undefined') return;
  if (document.getElementById('meta-interaction-styles')) {
    injected = true;
    return;
  }
  const s = document.createElement('style');
  s.id = 'meta-interaction-styles';
  s.textContent = CSS;
  document.head.appendChild(s);
  injected = true;
}

const CSS = `
/* Buttons */
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

/* Card hover */
.meta-card-hover {
  transition: transform 160ms cubic-bezier(.2,.7,.3,1), box-shadow 160ms, filter 160ms;
}
.meta-card-hover:hover {
  transform: translateY(-4px) scale(1.03);
  box-shadow: 0 12px 24px rgba(0,0,0,0.7), 0 0 16px rgba(255,215,0,0.45) !important;
  filter: brightness(1.06);
  z-index: 5;
}

/* Nav items */
.meta-nav-item {
  transition: color 120ms, background 120ms, border-color 120ms;
  border-radius: 2px;
}
.meta-nav-item:hover {
  color: #ffd700 !important;
  background: rgba(255,215,0,0.05);
}

/* List rows */
.meta-row {
  transition: background 110ms, border-color 110ms, transform 110ms;
}
.meta-row:hover {
  background: rgba(78,195,255,0.06) !important;
  border-color: rgba(78,195,255,0.4) !important;
  transform: translateX(2px);
}
.meta-row:hover .meta-row-arrow { transform: translateX(4px); color: #ffd700 !important; }
.meta-row-arrow { transition: transform 120ms, color 120ms; }

/* CTA tiles */
.meta-cta-tile {
  transition: transform 160ms cubic-bezier(.2,.7,.3,1), border-color 160ms, box-shadow 160ms;
}
.meta-cta-tile:hover {
  transform: translateY(-4px);
  border-color: var(--meta-tile-accent, #ffd700) !important;
  box-shadow: 0 14px 28px rgba(0,0,0,0.75),
              0 0 24px var(--meta-tile-glow, rgba(255,215,0,0.3)),
              inset 0 0 24px var(--meta-tile-glow, rgba(255,215,0,0.15)) !important;
}
.meta-cta-tile:hover .meta-cta-svg { filter: drop-shadow(0 0 8px var(--meta-tile-accent, #ffd700)); }
.meta-cta-svg { transition: filter 160ms; }

/* Chips */
.meta-chip { transition: background 120ms, border-color 120ms, color 120ms; }
.meta-chip:hover {
  background: rgba(255,215,0,0.12) !important;
  border-color: #ffd700 !important;
  color: #ffd700 !important;
}

/* Loading dots animation (used by LoadingDots / NetworkStatus 'syncing') */
@keyframes meta-pulse {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
  40% { opacity: 1; transform: scale(1.1); }
}
.meta-loading-dot { animation: meta-pulse 1.2s infinite; }

/* Focus ring */
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

/* Route fade transition (10-D) */
@keyframes meta-fade-in {
  from { opacity: 0; transform: translateY(8px); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0);   filter: blur(0); }
}
.meta-fade { animation: meta-fade-in 280ms cubic-bezier(.2,.7,.3,1) both; }
`;
