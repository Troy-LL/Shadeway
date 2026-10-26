/** Bundled UI styles (tokens + components) for plain TypeScript without a CSS loader. */
export const UI_STYLES = `
:root {
  color-scheme: light dark;
  --color-sun: #f5a524;
  --color-shade: #1f7a8c;
  --color-ink: #14202b;
  --color-surface: rgba(255, 255, 255, 0.82);
  --color-text: #111418;
  --color-text-secondary: #5b6570;
  --color-accent: #0a84ff;
  --color-focus: #0a84ff;
  --font-system: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --text-34: 34px;
  --text-22: 22px;
  --text-17: 17px;
  --text-15: 15px;
  --text-13: 13px;
  --radius-card: 14px;
  --radius-sheet: 20px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --motion-sheet: 300ms;
  --touch-min: 44px;
  --sheet-peek: 88px;
  --sheet-half: min(52vh, 420px);
  --sheet-full: min(88vh, 640px);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-sun: #ffb84d;
    --color-shade: #3aa0b3;
    --color-ink: #f5f7fa;
    --color-surface: rgba(28, 32, 38, 0.82);
    --color-text: #f5f7fa;
    --color-text-secondary: #a8b0ba;
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-sheet: 0ms;
  }
}

.shadeway-ui {
  font-family: var(--font-system);
  color: var(--color-text);
  pointer-events: none;
}

.shadeway-ui * {
  box-sizing: border-box;
}

.shadeway-ui button,
.shadeway-ui input,
.shadeway-ui [role="radio"],
.shadeway-ui [tabindex="0"] {
  pointer-events: auto;
}

.shadeway-ui :focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.shadeway-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  backdrop-filter: blur(16px);
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  transition: height var(--motion-sheet) ease;
  pointer-events: auto;
  max-height: var(--sheet-full);
}

.shadeway-sheet[data-detent="peek"] {
  height: var(--sheet-peek);
}

.shadeway-sheet[data-detent="half"] {
  height: var(--sheet-half);
}

.shadeway-sheet[data-detent="full"] {
  height: var(--sheet-full);
}

.sheet-grabber {
  min-height: var(--touch-min);
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  width: 100%;
  cursor: grab;
}

.sheet-grabber__pill {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--color-text-secondary);
}

.sheet-body {
  flex: 1;
  overflow: auto;
  padding: 0 var(--space-4) var(--space-4);
}

.search-field {
  width: 100%;
  min-height: var(--touch-min);
  border-radius: var(--radius-card);
  border: 1px solid color-mix(in srgb, var(--color-text-secondary) 35%, transparent);
  padding: 0 var(--space-4);
  font-size: var(--text-17);
  background: color-mix(in srgb, var(--color-surface) 90%, transparent);
  color: var(--color-text);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.chip {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-text-secondary) 35%, transparent);
  background: transparent;
  color: var(--color-text);
  font-size: var(--text-15);
}

.chip--primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.recents {
  margin-top: var(--space-4);
}

.recents__title {
  font-size: var(--text-13);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-2);
}

.route-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.route-card {
  border-radius: var(--radius-card);
  border: 2px solid transparent;
  padding: var(--space-3);
  background: color-mix(in srgb, var(--color-surface) 70%, transparent);
  min-height: var(--touch-min);
  text-align: left;
  width: 100%;
  cursor: pointer;
}

.route-card[aria-checked="true"] {
  border-color: var(--color-accent);
}

.route-card__title {
  font-size: var(--text-17);
  margin: 0 0 var(--space-2);
}

.route-card__total {
  font-size: var(--text-15);
  color: var(--color-text-secondary);
  margin: 0;
}

.route-card__sun {
  font-size: var(--text-34);
  font-weight: 600;
  color: var(--color-ink);
  margin: var(--space-1) 0;
}

.route-card__badge {
  display: inline-block;
  font-size: var(--text-13);
  color: var(--color-text-secondary);
  margin-top: var(--space-2);
}

.confidence-badge {
  display: inline-block;
  font-size: var(--text-13);
  padding: 2px var(--space-2);
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--color-text-secondary) 40%, transparent);
  margin-bottom: var(--space-2);
}

.shade-strip {
  display: flex;
  width: 100%;
  height: 10px;
  border-radius: 6px;
  overflow: hidden;
  margin: var(--space-2) 0;
}

.shade-strip__shade {
  background: var(--color-shade);
}

.shade-strip__sun {
  background: repeating-linear-gradient(
    135deg,
    var(--color-sun),
    var(--color-sun) 4px,
    color-mix(in srgb, var(--color-sun) 70%, #fff) 4px,
    color-mix(in srgb, var(--color-sun) 70%, #fff) 8px
  );
}

.time-scrubber {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-4);
}

.time-scrubber__slider {
  width: 100%;
  min-height: var(--touch-min);
}

.time-scrubber__label {
  font-size: var(--text-13);
  color: var(--color-text-secondary);
  min-width: 4.5rem;
  text-align: right;
}

.status-message {
  font-size: var(--text-17);
  margin: var(--space-3) 0;
}

.status-message--secondary {
  color: var(--color-text-secondary);
  font-size: var(--text-15);
}

.shimmer-card {
  height: 120px;
  border-radius: var(--radius-card);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-text-secondary) 15%, transparent),
    color-mix(in srgb, var(--color-text-secondary) 30%, transparent),
    color-mix(in srgb, var(--color-text-secondary) 15%, transparent)
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .shimmer-card {
    animation: none;
  }
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

.primary-action {
  width: 100%;
  min-height: var(--touch-min);
  margin-top: var(--space-4);
  border: 0;
  border-radius: var(--radius-card);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--text-17);
  font-weight: 600;
}

.secondary-action {
  min-height: var(--touch-min);
  border: 0;
  background: transparent;
  color: var(--color-accent);
  font-size: var(--text-15);
}

.in-route-banner {
  position: fixed;
  top: var(--space-4);
  left: var(--space-4);
  right: var(--space-4);
  z-index: 11;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  backdrop-filter: blur(16px);
  font-size: var(--text-15);
  pointer-events: auto;
}

.in-route-sheet__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--text-15);
}

.in-route-sheet__sun {
  font-size: var(--text-34);
  font-weight: 600;
  color: var(--color-ink);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
`;
