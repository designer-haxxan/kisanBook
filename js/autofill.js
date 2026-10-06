// Auto-fill login from magic link: #u=<username>&p=<password>
// Runs as a plain (non-module) script so it executes before the hash router.
(function () {
  var params = new URLSearchParams(location.hash.replace(/^#/, ''));
  var u = params.get('u');
  var p = params.get('p');

  // Both must be present and non-empty; single-param or route hashes (#/dashboard) → do nothing.
  if (!u || !p) return;

  // Strip credentials from address bar immediately — before anything else reads the hash.
  history.replaceState(null, '', location.pathname + location.search);

  var tries = 0;
  (function fill() {
    var userEl   = document.getElementById('login-username');
    var passEl   = document.getElementById('login-password');
    var loginBtn = document.getElementById('login-btn');
    var loginView = document.getElementById('view-login');

    // Wait until the login form is visible (app.js shows it after auth check).
    var formReady = userEl && passEl && loginBtn && loginView &&
                    !loginView.classList.contains('d-none');

    if (!formReady) {
      if (++tries < 100) setTimeout(fill, 100); // poll up to ~10 s
      return;
    }

    // Fill values and notify any listeners.
    userEl.value = u;
    passEl.value = p;
    userEl.dispatchEvent(new Event('input', { bubbles: true }));
    passEl.dispatchEvent(new Event('input', { bubbles: true }));

    // Clear credentials from memory immediately.
    u = p = null;

    // Urdu hint — inserted before the Sign in button.
    if (!document.getElementById('autofill-hint')) {
      var hint = document.createElement('div');
      hint.id = 'autofill-hint';
      hint.className = 'autofill-hint';
      hint.setAttribute('dir', 'rtl');
      hint.textContent = 'یوزر نیم اور پاس ورڈ خود بخود بھر دیے گئے ہیں۔ بس لاگ ان دبائیں';
      loginBtn.parentNode.insertBefore(hint, loginBtn);
    }

    // Gentle pulse so even an uneducated user knows exactly what to tap.
    loginBtn.classList.add('autofill-pulse');
  })();
})();
