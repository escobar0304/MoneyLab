// Sets the theme before anything is painted or any module is evaluated.
//
// A deferred module script runs after the browser has already drawn the page,
// so setting the theme there flashes the wrong one on every load — and a white
// flash on the dark theme is the worst version of that. It also means
// module-scope constants that read the theme resolve against the right one.
//
// A file rather than an inline <script>, because the app's policy is
// `script-src 'self'` and an inline script is exactly what that refuses. It
// was inline once: the dev server sends no policy, so it worked everywhere it
// was tested and did nothing at all behind nginx, which is the one place the
// flash was meant to be prevented.
//
// Classic and synchronous on purpose — no `defer`, no `type="module"` — since
// both of those would run it after first paint again. Kept in step with
// `readTheme()` and `applyTheme()` in src/lib/settings/theme.ts; the test there
// runs this file to hold the two to the same answers.
(function () {
  var SURFACE = { paper: '#faf8f5', ink: '#0b0d12' };
  var theme = 'paper';
  try {
    if (localStorage.getItem('moneylab-theme') === 'ink') theme = 'ink';
  } catch (e) {
    // Storage refused, as some private windows do: the default, never a throw.
  }
  var root = document.documentElement;
  root.dataset.theme = theme;
  // The two metas colour what CSS cannot reach before it loads: the canvas
  // behind the page, scrollbars and form controls, and the phone's browser bar.
  var scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute('content', theme === 'ink' ? 'dark' : 'light');
  var bar = document.querySelector('meta[name="theme-color"]');
  if (bar) bar.setAttribute('content', SURFACE[theme]);
})();
