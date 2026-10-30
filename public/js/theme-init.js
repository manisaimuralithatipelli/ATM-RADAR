// Runs before the page is painted (loaded as a blocking script in <head>) so the
// right theme is applied immediately and there is no flash of the wrong colours.
// A saved choice wins. Without one, the operating system preference is used.
(function () {
  var theme = 'light';
  try {
    var saved = localStorage.getItem('atmradar.theme');
    if (saved === 'light' || saved === 'dark') {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
  } catch (err) {
    // Storage blocked: fall back to the system preference only
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
    } catch (ignored) {
      theme = 'light';
    }
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
