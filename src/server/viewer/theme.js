// ── theme ─────────────────────────────────────────────────
let _isDark = true;
export function isDark() { return _isDark; }
export function setIsDark(v) { _isDark = v; }

function safeStorageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

/** Read a CSS variable from :root / html element */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function applyTheme() {
  document.documentElement.classList.toggle('light', !_isDark);
  document.documentElement.classList.toggle('dark', _isDark);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = _isDark ? '○' : '●';
}

export function toggleTheme() {
  _isDark = !_isDark;
  safeStorageSet('omm-theme', _isDark ? 'dark' : 'light');
  applyTheme();
}

export function initTheme() {
  const saved = safeStorageGet('omm-theme');
  if (saved) {
    _isDark = saved !== 'light';
  } else {
    // Respect system preference (apply-before-paint already set the class,
    // but we sync the JS state to match)
    _isDark = !document.documentElement.classList.contains('light');
  }
  applyTheme();
}

/**
 * Return SVG structural colors read from CSS variables.
 * These are used by viewer-app.js when rendering the canvas SVG.
 */
export function themeColors() {
  return {
    groupFill:             cssVar('--svg-group-fill')             || (_isDark ? '#0a0a0a' : '#f8f8f8'),
    groupStroke:           cssVar('--svg-group-stroke')           || (_isDark ? '#666666' : '#bbb'),
    subFill:               cssVar('--svg-sub-fill')               || (_isDark ? '#111111' : '#efefef'),
    subStroke:             cssVar('--svg-sub-stroke')             || (_isDark ? '#666666' : '#bbb'),
    subLabelFill:          cssVar('--svg-sub-label-fill')         || (_isDark ? '#ffffff' : '#888'),
    edgeColor0:            cssVar('--svg-edge-0')                 || (_isDark ? '#909090' : '#94a3b8'),
    edgeColor1:            cssVar('--svg-edge-1')                 || (_isDark ? '#787878' : '#bbb'),
    edgeLabelBg:           cssVar('--svg-edge-label-bg')          || (_isDark ? '#000000' : '#e8e8e8'),
    edgeLabelText:         cssVar('--svg-edge-label-text')        || (_isDark ? '#aaaaaa' : '#475569'),
    grpLabelFill:          cssVar('--svg-grp-label-fill')         || (_isDark ? '#ffffff' : '#475569'),
    grpLabelCenterFill:    cssVar('--svg-grp-label-center-fill')  || (_isDark ? '#dddddd' : '#222'),
  };
}
