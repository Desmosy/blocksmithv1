export const HOME_STUDIO_CSS = `/* CraftGPT-style BlockSmith home — also injected via HomeStudioStyles */
@keyframes home-studio-spin {
  to {
    transform: rotate(360deg);
  }
}

html:has(.home-studio),
html:has(.home-studio) body {
  height: auto;
  overflow: auto;
  background: #ffffff;
  color: #171717;
  font-family: var(--font-inter, Inter), ui-sans-serif, system-ui, sans-serif;
}

/* ─── Home studio ─── */
.home-studio {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  color: #171717;
  background: #ffffff;
  overflow-x: hidden;
}

.home-studio__glow {
  position: absolute;
  left: 50%;
  top: 22%;
  width: min(720px, 90vw);
  height: 280px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 214, 120, 0.18) 0%,
    rgba(255, 235, 180, 0.08) 45%,
    transparent 72%
  );
  pointer-events: none;
  z-index: 0;
}

.home-studio__header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 2rem;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.home-studio__brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  text-decoration: none;
  color: inherit;
}

.home-studio__brand-name {
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.home-studio__logo-mark {
  position: relative;
  display: flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
}

.home-studio__logo-dot {
  position: absolute;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  border: 2px solid #fff;
}

.home-studio__logo-dot--a {
  background: #f5c542;
  left: 0.15rem;
  top: 0.35rem;
  z-index: 1;
}

.home-studio__logo-dot--b {
  background: #1a1a1a;
  right: 0.15rem;
  bottom: 0.35rem;
  z-index: 2;
}

.home-studio__header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.home-studio__header-link {
  font-size: 0.875rem;
  font-weight: 500;
  color: #525252;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  border: 1px solid #e5e5e5;
  background: #fff;
  transition: background 0.15s, color 0.15s;
}

.home-studio__header-link:hover {
  background: #fafafa;
  color: #171717;
}

.home-studio__main {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem 3rem;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.home-studio__title {
  margin: 0 0 2.5rem;
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  text-align: center;
  line-height: 1.2;
  color: #0a0a0a;
}

.home-studio__composer {
  width: 100%;
  background: #ffffff;
  border-radius: 1.25rem;
  border: 1px solid #ebebeb;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
}

.home-studio--drag .home-studio__composer {
  border-color: #f5c542;
  box-shadow: 0 8px 40px rgba(245, 197, 66, 0.25);
}

.home-studio__textarea {
  display: block;
  width: 100%;
  min-height: 140px;
  padding: 1.25rem 1.35rem 0.75rem;
  border: none;
  outline: none;
  resize: vertical;
  font-size: 1rem;
  line-height: 1.55;
  color: #171717;
  background: transparent;
  font-family: inherit;
  box-sizing: border-box;
}

.home-studio__textarea::placeholder {
  color: #a3a3a3;
}

.home-studio__composer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem 0.85rem;
}

.home-studio__composer-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
}

.home-studio__parser-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #525252;
  background: #f5f5f5;
  border-radius: 9999px;
  border: 1px solid #ebebeb;
  white-space: nowrap;
}

.home-studio__parser-icon {
  font-size: 0.5rem;
  color: #737373;
}

.home-studio__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.home-studio__attach-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: #737373;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.home-studio__attach-btn:hover {
  background: #f5f5f5;
  color: #171717;
}

.home-studio__file-tag {
  font-size: 0.75rem;
  color: #737373;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-studio__send-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 50%;
  background: #0a0a0a;
  color: #ffffff;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}

.home-studio__send-btn:hover:not(:disabled) {
  transform: scale(1.04);
}

.home-studio__send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.home-studio__send-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: home-studio-spin 0.8s linear infinite;
}

.home-studio__error {
  margin: 0.75rem 0 0;
  text-align: center;
  font-size: 0.875rem;
  color: #dc2626;
}

.home-studio__or-divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  margin: 2rem 0 1.5rem;
  color: #a3a3a3;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.home-studio__or-divider::before,
.home-studio__or-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #ebebeb;
}

.home-studio__examples {
  width: 100%;
  margin-top: 2.5rem;
}

.home-studio__examples-label {
  margin: 0 0 1rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #525252;
}

.home-studio__examples-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.home-studio__example-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  padding: 0.85rem 1.1rem;
  font-size: 0.9375rem;
  font-weight: 400;
  color: #171717;
  text-align: left;
  text-decoration: none;
  background: #ffffff;
  border: 1px solid #ebebeb;
  border-radius: 9999px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
  box-sizing: border-box;
}

.home-studio__example-pill:hover {
  background: #fafafa;
  border-color: #d4d4d4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.home-studio__panel {
  width: 100%;
  margin-top: 1.5rem;
  padding: 1rem 1.15rem;
  background: #ffffff;
  border: 1px solid #ebebeb;
  border-radius: 1rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.home-studio__panel--muted {
  background: #fafafa;
}

.home-studio__panel-title {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.home-studio__panel-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: #525252;
  cursor: pointer;
  font-family: inherit;
}

.home-studio__panel-list {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
}

.home-studio__panel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0;
  font-size: 0.875rem;
  color: #171717;
  text-decoration: none;
  border-top: 1px solid #f0f0f0;
}

.home-studio__panel-list li:first-child .home-studio__panel-row {
  border-top: none;
}

.home-studio__panel-row:hover {
  color: #0a0a0a;
}

.home-studio__panel-meta {
  font-style: normal;
  font-size: 0.75rem;
  color: #a3a3a3;
}

.home-studio__chevron--open {
  transform: rotate(90deg);
}

.home-studio__footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 2rem 1.75rem;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  font-size: 0.8125rem;
  color: #a3a3a3;
  box-sizing: border-box;
}

.home-studio__footer-links a {
  color: #737373;
  text-decoration: none;
}

.home-studio__footer-links a:hover {
  color: #171717;
}

/* ─── Scan card ─── */
.scan-card {
  width: 100%;
  padding: 1.25rem 1.35rem 1.35rem;
  background: #ffffff;
  border: 1px solid #ebebeb;
  border-radius: 1.25rem;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.04);
  position: relative;
  z-index: 1;
  box-sizing: border-box;
}

.scan-card__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.scan-card__icon {
  color: #525252;
  flex-shrink: 0;
}

.scan-card__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #171717;
}

.scan-card__hint {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  color: #737373;
  line-height: 1.5;
}

.scan-card__hint code {
  font-size: 0.75rem;
  padding: 0.1em 0.35em;
  background: #f5f5f5;
  border-radius: 4px;
  color: #525252;
}

.scan-card__notice {
  margin: 0;
  padding: 0.85rem 1rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #737373;
  background: #fafafa;
  border: 1px solid #ebebeb;
  border-radius: 0.75rem;
}

.scan-card__connect {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.scan-card__connected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  font-size: 0.8125rem;
}

.scan-card__connected-label {
  color: #525252;
  font-weight: 500;
}

.scan-card__connected-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.scan-card__link-btn {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #737373;
  cursor: pointer;
  font-family: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.scan-card__link-btn:hover:not(:disabled) {
  color: #171717;
}

.scan-card__link-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scan-card__field-label {
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #737373;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scan-card__select {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #e5e5e5;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  background: #fafafa;
  color: #171717;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.scan-card__select:focus {
  background: #fff;
  border-color: #d4d4d4;
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
}

.scan-card__select:disabled {
  opacity: 0.6;
}

.scan-card__btn--github {
  background: #24292f;
  color: #ffffff;
  border-color: #24292f;
  gap: 0.5rem;
}

.scan-card__btn--github:hover:not(:disabled) {
  background: #32383f;
}

.scan-card__input {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #e5e5e5;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  background: #fafafa;
  color: #171717;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.scan-card__input:focus {
  background: #fff;
  border-color: #d4d4d4;
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
}

.scan-card__input::placeholder {
  color: #a3a3a3;
}

.scan-card__input:disabled {
  opacity: 0.6;
}

.scan-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.85rem;
  justify-content: flex-end;
}

.scan-card__btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 7.5rem;
  padding: 0.65rem 1.15rem;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
  border-radius: 999px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s;
  white-space: nowrap;
}

.scan-card__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.scan-card__btn--primary {
  background: #0a0a0a;
  color: #ffffff;
  border-color: #0a0a0a;
}

.scan-card__btn--primary:hover:not(:disabled) {
  background: #262626;
}

.scan-card__btn--secondary {
  background: #ffffff;
  color: #525252;
  border-color: #e5e5e5;
}

.scan-card__btn--secondary:hover:not(:disabled) {
  background: #fafafa;
  color: #171717;
  border-color: #d4d4d4;
}

.scan-card__spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: home-studio-spin 0.8s linear infinite;
}

.scan-card__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.85rem;
  padding: 0.45rem 0 0;
  border-top: 1px solid #f0f0f0;
}

.scan-card__progress-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f5c542;
  animation: scan-card-pulse 1.2s ease-in-out infinite;
}

@keyframes scan-card-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.scan-card__progress-text {
  font-size: 0.8125rem;
  color: #737373;
  font-weight: 500;
}

.scan-card__error {
  margin: 0.75rem 0 0;
  font-size: 0.8125rem;
  color: #dc2626;
  line-height: 1.45;
}

.scan-card__stats {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: #a3a3a3;
}
`;
