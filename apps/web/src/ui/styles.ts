/** Bundled UI styles (tokens + components) for plain TypeScript without a CSS loader. */
export const UI_STYLES = `
:root {
  color-scheme: light dark;
  --color-sun: #f5a524;
  --color-shade: #1f7a8c;
  --color-ink: #111418;
  --color-surface: #ffffff;
  --color-surface-step: #f2f3f5;
  --color-text: #111418;
  --color-text-secondary: #5b6570;
  --color-border: #c9ced4;
  --color-accent: #0066cc;
  --color-text-on-accent: #ffffff;
  --color-focus: #0066cc;
  --font-system: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --text-34: 34px;
  --text-26: 26px;
  --text-28: 28px;
  --color-placeholder: #4b545e;
  --text-17: 17px;
  --text-15: 15px;
  --text-13: 13px;
  --radius-card: 12px;
  --radius-sheet: 16px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --motion-sheet: 240ms;
  --touch-min: 44px;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-placeholder: #9aa3ad;
    --color-sun: #ffb84d;
    --color-shade: #3aa0b3;
    --color-ink: #f5f7fa;
    --color-surface: #1c2026;
    --color-surface-step: #262b32;
    --color-text: #f5f7fa;
    --color-text-secondary: #a8b0ba;
    --color-border: #3a414a;
    --color-accent: #409cff;
    --color-text-on-accent: #0b1220;
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
  height: 100dvh;
}

.shadeway-ui * {
  box-sizing: border-box;
}

.shadeway-ui button,
.shadeway-ui input,
.shadeway-ui [role='radio'],
.shadeway-ui [tabindex='0'] {
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
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  transition: height var(--motion-sheet) cubic-bezier(0.32, 0.72, 0, 1);
  pointer-events: auto;
  max-height: min(62dvh, calc(100dvh - var(--safe-top) - 48px));
  box-shadow: 0 -4px 24px rgba(17, 20, 24, 0.08);
}

.shadeway-sheet[data-screen='search'][data-detent='peek'] {
  height: calc(96px + var(--safe-bottom));
}

.shadeway-sheet[data-screen='search'][data-detent='half'] {
  height: calc(176px + var(--safe-bottom));
}

.shadeway-sheet[data-screen='search'] .sheet-body {
  gap: 0;
  padding-bottom: var(--space-2);
}

.shadeway-sheet[data-screen='search'] .search-screen {
  gap: 0;
}

.shadeway-sheet[data-screen='search'] .search-fields__stack {
  gap: 0;
}

.shadeway-sheet[data-screen='compare'] .sheet-body,
.shadeway-sheet[data-screen='in-route'] .sheet-body {
  padding-bottom: 0;
}

.shadeway-sheet[data-editing='true'] {
  bottom: var(--sheet-keyboard-offset, 0px);
}

.shadeway-sheet[data-screen='search'][data-editing='true'] {
  height: var(--sheet-edit-height, calc(100dvh - var(--safe-top) - 48px));
  max-height: var(--sheet-edit-height, calc(100dvh - var(--safe-top) - 48px));
}

.shadeway-sheet[data-screen='compare'] {
  height: min(62dvh, 420px);
}

.shadeway-sheet[data-screen='in-route'] {
  height: auto;
  max-height: min(62dvh, calc(100dvh - var(--safe-top) - 48px));
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

@media (min-width: 900px) {
  .shadeway-sheet {
    left: 16px;
    right: auto;
    width: 384px;
    top: 16px;
    bottom: auto;
    height: auto;
    max-height: calc(100dvh - 32px);
    border-radius: var(--radius-sheet);
  }

  .shadeway-sheet[data-screen='search'],
  .shadeway-sheet[data-screen='compare'],
  .shadeway-sheet[data-screen='in-route'] {
    height: auto;
    max-height: calc(100dvh - 32px);
  }

  .shadeway-sheet[data-screen='search'][data-editing='true'] {
    height: auto;
    max-height: calc(100dvh - 32px);
  }

  .sheet-grabber {
    display: none;
  }

  .shadeway-sheet[data-screen='compare'] .sheet-body,
  .shadeway-sheet[data-screen='in-route'] .sheet-body {
    flex: 0 1 auto;
    overflow: visible;
  }

  .compare-screen,
  .in-route-screen {
    flex: 0 1 auto;
    min-height: auto;
  }

  .compare-screen__scroll {
    flex: 0 1 auto;
    min-height: auto;
    overflow: visible;
  }
}

.sheet-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0 var(--space-4) var(--space-4);
  gap: var(--space-3);
}

.compare-screen,
.search-screen,
.in-route-screen {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--space-3);
}

.compare-screen__scroll,
.search-screen {
  overflow: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.compare-screen__footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: calc(var(--space-4) + var(--safe-bottom));
}

.search-fields {
  display: grid;
  grid-template-columns: 1fr var(--touch-min);
  gap: var(--space-2);
  align-items: stretch;
}

.search-fields__stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.search-field {
  width: 100%;
  min-height: var(--touch-min);
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  padding: 0 var(--space-3);
  font-size: var(--text-17);
  background: var(--color-surface-step);
  color: var(--color-text);
}

.search-field::placeholder {
  color: var(--color-placeholder);
  opacity: 1;
}

.search-field--active {
  border-color: var(--color-accent);
}

.search-swap {
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-step);
  color: var(--color-text);
  font-size: var(--text-17);
}

.suggest {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.suggest__option {
  min-height: 56px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-card);
  background: transparent;
  color: var(--color-text);
  font-size: var(--text-17);
  text-align: left;
}

.compare-header {
  display: grid;
  grid-template-columns: var(--touch-min) 1fr;
  gap: var(--space-2);
  align-items: center;
  flex-shrink: 0;
}

.compare-header__chips {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.icon-button {
  width: var(--touch-min);
  height: var(--touch-min);
  border: 0;
  border-radius: 999px;
  background: var(--color-surface-step);
  color: var(--color-text);
  font-size: var(--text-17);
}

.departure-chip,
.chip {
  min-height: var(--touch-min);
  padding: 0 var(--space-3);
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-step);
  color: var(--color-text);
  font-size: var(--text-15);
}

@media (min-width: 900px) {
  .departure-chip {
    white-space: normal;
    text-align: left;
    line-height: 1.35;
    max-width: 100%;
  }
}

.departure-picker__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 220px;
  overflow: auto;
}

.departure-picker__check {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-accent);
  font-weight: 700;
}

.departure-picker__option {
  position: relative;
  min-height: var(--touch-min);
  padding: 0 var(--space-6);
  border: 0;
  border-radius: var(--radius-card);
  background: transparent;
  color: var(--color-text);
  font-size: var(--text-15);
  text-align: left;
}

.departure-picker__notice,
.sheet-estimate-label {
  margin: 0;
  font-size: var(--text-15);
  color: var(--color-text-secondary);
  line-height: 1.35;
}

.route-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.route-card {
  position: relative;
  box-sizing: border-box;
  border-radius: var(--radius-card);
  border: 2px solid var(--color-border);
  padding: 6px var(--space-3) 7px;
  background: var(--color-surface);
  min-height: 5.5rem;
  height: 5.5rem;
  text-align: left;
  width: 100%;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.route-card[aria-checked='true'] {
  border-color: var(--color-accent);
}

.route-card__sun {
  font-size: var(--text-26);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0;
  line-height: 1;
  flex-shrink: 0;
}

.route-card__sun--muted {
  font-size: var(--text-17);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.route-card__title {
  font-size: var(--text-15);
  font-weight: 600;
  margin: 0;
}

.route-card__meta {
  font-size: var(--text-15);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.route-card__note {
  display: none;
}

.route-card__check {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  color: var(--color-accent);
  font-weight: 700;
}

.confidence-badge {
  display: inline-block;
  font-size: var(--text-13);
  padding: 2px var(--space-2);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.shade-strip {
  display: flex;
  width: 100%;
  height: 7px;
  border-radius: 6px;
  overflow: hidden;
  margin-top: auto;
  flex-shrink: 0;
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

.primary-action {
  width: 100%;
  min-height: 52px;
  border: 0;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-text-on-accent);
  font-size: var(--text-17);
  font-weight: 600;
  flex-shrink: 0;
}

.primary-action--inline {
  width: auto;
  min-width: 7rem;
  padding: 0 var(--space-4);
}

.secondary-action {
  min-height: var(--touch-min);
  border: 0;
  background: transparent;
  color: var(--color-accent);
  font-size: var(--text-15);
}

.in-route-screen {
  padding-bottom: calc(var(--space-4) + var(--safe-bottom));
}

.compare-peek-summary {
  display: none;
  margin: 0;
  padding: 0 var(--space-4);
  font-size: var(--text-15);
  color: var(--color-text-secondary);
  line-height: var(--touch-min);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shadeway-sheet[data-screen='compare'][data-keyboard='true'] {
  height: calc(96px + var(--safe-bottom));
}

.shadeway-sheet[data-screen='compare'][data-keyboard='true'] .compare-screen__scroll,
.shadeway-sheet[data-screen='compare'][data-keyboard='true'] .compare-screen__footer,
.shadeway-sheet[data-screen='compare'][data-keyboard='true'] .compare-header {
  display: none;
}

.shadeway-sheet[data-screen='compare'][data-keyboard='true'] .compare-peek-summary {
  display: block;
}

.in-route-screen__status {
  margin: 0;
  font-size: var(--text-15);
  color: var(--color-text-secondary);
  line-height: 1.35;
  max-width: 32ch;
}

.in-route-screen__sun {
  margin: 0;
  font-size: var(--text-34);
  font-weight: 600;
  line-height: 1.15;
  color: var(--color-ink);
}

.in-route-screen__totals {
  margin: 0;
  font-size: var(--text-15);
  color: var(--color-text-secondary);
}

.in-route-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.status-message {
  font-size: var(--text-17);
  margin: var(--space-3) 0;
}

.status-message--secondary {
  color: var(--color-text-secondary);
  font-size: var(--text-15);
}

.shimmer-card,
.shimmer-row {
  height: 88px;
  border-radius: var(--radius-card);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-text-secondary) 12%, transparent),
    color-mix(in srgb, var(--color-text-secondary) 24%, transparent),
    color-mix(in srgb, var(--color-text-secondary) 12%, transparent)
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .shimmer-card,
  .shimmer-row {
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
